import Combine
import Foundation

@MainActor
final class AuthStore: ObservableObject {
    @Published private(set) var session: AppSession?
    @Published private(set) var googleUserProfile: GoogleUserProfile?
    @Published private(set) var isRestoringSession = false
    @Published private(set) var isSigningIn = false
    @Published var errorMessage: String?

    private let keychain = KeychainStore(
        service: AppConfig.keychainService,
        accessGroup: AppConfig.keychainAccessGroup
    )
    private let tokenAccount = "auth-token"
    private let googleSignInClient: any GoogleSignInClient
    private let appleSignInClient: any AppleSignInClient
    private let sharedDefaults = UserDefaults(suiteName: AppConfig.appGroupIdentifier)
    private let decoder = JSONDecoder()
    private let encoder = JSONEncoder()

    init() {
        self.googleSignInClient = makeGoogleSignInClient()
        self.appleSignInClient = makeAppleSignInClient()
    }

    init(
        googleSignInClient: any GoogleSignInClient,
        appleSignInClient: (any AppleSignInClient)? = nil
    ) {
        self.googleSignInClient = googleSignInClient
        self.appleSignInClient = appleSignInClient ?? UnimplementedAppleSignInClient()
    }

    func restoreSession() async {
        guard !isRestoringSession else { return }

        isRestoringSession = true
        errorMessage = nil
        defer { isRestoringSession = false }

        let cachedSession = readCachedSession()

        do {
            guard let token = try keychain.read(account: tokenAccount), !token.isEmpty else {
                clearPersistedSession()
                session = nil
                googleUserProfile = nil
                return
            }

            if let cachedSession {
                session = cachedSession
            }

            googleUserProfile = await googleSignInClient.restoreUserProfile()
            prefetchProfileImage(googleUserProfile)
            let restoredSession = try await fetchSession(token: token)
            if restoredSession.token != token {
                try keychain.write(restoredSession.token, account: tokenAccount)
            }
            session = restoredSession
            cache(session: restoredSession)
        } catch {
            if shouldDiscardSession(for: error) {
                clearPersistedSession()
                session = nil
                googleUserProfile = nil
            } else {
                session = cachedSession
            }

            errorMessage = AppConfig.userFacingNetworkMessage(for: error) ?? error.localizedDescription
        }
    }

    func signInWithGoogle() async {
        guard !isSigningIn else { return }

        isSigningIn = true
        errorMessage = nil
        defer { isSigningIn = false }

        do {
            let googleTokens = try await googleSignInClient.signIn()
            let session = try await exchangeSocialTokensForSession(
                provider: "google",
                idToken: googleTokens.idToken,
                accessToken: googleTokens.accessToken
            )
            try keychain.write(session.token, account: tokenAccount)
            cache(session: session)
            googleUserProfile = await googleSignInClient.restoreUserProfile()
            prefetchProfileImage(googleUserProfile)
            self.session = session
        } catch {
            errorMessage = AppConfig.userFacingNetworkMessage(for: error) ?? error.localizedDescription
        }
    }

    func signInWithApple() async {
        guard !isSigningIn else { return }

        isSigningIn = true
        errorMessage = nil
        defer { isSigningIn = false }

        do {
            let appleTokens = try await appleSignInClient.signIn()
            let session = try await exchangeSocialTokensForSession(
                provider: "apple",
                idToken: appleTokens.idToken,
                nonce: appleTokens.nonce
            )
            try keychain.write(session.token, account: tokenAccount)
            cache(session: session)
            googleUserProfile = nil
            self.session = session
        } catch {
            errorMessage = AppConfig.userFacingNetworkMessage(for: error) ?? error.localizedDescription
        }
    }

    func signOut() async {
        let token = session?.token ?? (try? keychain.read(account: tokenAccount))
        session = nil
        googleUserProfile = nil
        errorMessage = nil
        clearPersistedSession()

        guard let token else {
            googleSignInClient.signOut()
            return
        }

        var request = URLRequest(url: AppConfig.endpoint("/api/auth/sign-out"))
        request.httpMethod = "POST"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue(AppConfig.apiOrigin, forHTTPHeaderField: "Origin")
        request.httpShouldHandleCookies = false

        _ = try? await AppConfig.apiSession.data(for: request)
        googleSignInClient.signOut()
    }

    func deleteAccount() async throws {
        guard let token = session?.token ?? (try? keychain.read(account: tokenAccount)) else {
            throw AuthError.sessionExpired
        }

        var request = URLRequest(url: AppConfig.endpoint("/api/auth/delete-account"))
        request.httpMethod = "POST"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue(AppConfig.apiOrigin, forHTTPHeaderField: "Origin")
        request.httpShouldHandleCookies = false

        let (data, response) = try await AppConfig.apiSession.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse,
              (200..<300).contains(httpResponse.statusCode) else {
            throw authError(from: data, fallback: .invalidServerResponse)
        }

        session = nil
        googleUserProfile = nil
        errorMessage = nil
        clearPersistedSession()
        googleSignInClient.signOut()
    }

    private func exchangeSocialTokensForSession(
        provider: String,
        idToken: String,
        accessToken: String? = nil,
        nonce: String? = nil
    ) async throws -> AppSession {
        var request = URLRequest(url: AppConfig.endpoint("/api/auth/sign-in/social"))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(AppConfig.apiOrigin, forHTTPHeaderField: "Origin")
        request.httpShouldHandleCookies = false
        request.httpBody = try JSONEncoder().encode(
            NativeSocialSignInRequest(
                provider: provider,
                disableRedirect: true,
                idToken: .init(
                    token: idToken,
                    accessToken: accessToken,
                    nonce: nonce
                )
            )
        )

        let (data, response) = try await AppConfig.apiSession.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse else {
            throw AuthError.invalidServerResponse
        }

        guard (200 ..< 300).contains(httpResponse.statusCode) else {
            throw authError(from: data, fallback: .invalidServerResponse)
        }

        let payload = try JSONDecoder().decode(NativeSocialSignInResponse.self, from: data)
        if payload.redirect {
            if let url = payload.url, !url.isEmpty {
                throw AuthError.authenticationFailed("The server tried to start a browser redirect instead of returning a native session.")
            }
            throw AuthError.invalidTokenExchangeResponse
        }

        guard
            let token = bearerToken(from: httpResponse) ?? payload.token,
            let user = payload.user
        else {
            throw AuthError.invalidTokenExchangeResponse
        }
        return AppSession(
            token: token,
            userId: user.id,
            email: user.email,
            name: user.name ?? user.email
        )
    }

    private func fetchSession(token: String) async throws -> AppSession {
        var request = URLRequest(url: AppConfig.endpoint("/api/auth/get-session"))
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue(AppConfig.apiOrigin, forHTTPHeaderField: "Origin")
        request.httpShouldHandleCookies = false

        let (data, response) = try await AppConfig.apiSession.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse else {
            throw AuthError.invalidServerResponse
        }

        if httpResponse.statusCode == 401 || httpResponse.statusCode == 403 {
            throw AuthError.sessionExpired
        }

        guard httpResponse.statusCode == 200 else {
            throw authError(from: data, fallback: .invalidServerResponse)
        }

        let payload = try JSONDecoder().decode(AuthSessionResponse.self, from: data)
        return AppSession(
            token: bearerToken(from: httpResponse) ?? token,
            userId: payload.user.id,
            email: payload.user.email,
            name: payload.user.name ?? payload.user.email
        )
    }

    private func bearerToken(from response: HTTPURLResponse) -> String? {
        guard
            let token = response.value(forHTTPHeaderField: "set-auth-token")?
                .trimmingCharacters(in: .whitespacesAndNewlines),
            !token.isEmpty
        else {
            return nil
        }

        return token
    }

    private func authError(from data: Data, fallback: AuthError) -> AuthError {
        guard
            let payload = try? JSONDecoder().decode(AuthErrorResponse.self, from: data),
            let message = payload.message ?? payload.error,
            !message.isEmpty
        else {
            return fallback
        }

        return .authenticationFailed(message)
    }

    private func readCachedSession() -> AppSession? {
        guard
            let data = sharedDefaults?.data(forKey: AppConfig.sharedAppSessionKey)
        else {
            return nil
        }

        return try? decoder.decode(AppSession.self, from: data)
    }

    private func cache(session: AppSession) {
        guard let data = try? encoder.encode(session) else { return }
        sharedDefaults?.set(data, forKey: AppConfig.sharedAppSessionKey)
    }

    private func prefetchProfileImage(_ profile: GoogleUserProfile?) {
        guard let imageURL = profile?.imageURL else { return }

        Task.detached(priority: .background) {
            _ = try? await RemoteImageDiskCache.shared.data(for: imageURL)
        }
    }

    private func clearPersistedSession() {
        try? keychain.delete(account: tokenAccount)
        sharedDefaults?.removeObject(forKey: AppConfig.sharedAppSessionKey)
    }

    private func shouldDiscardSession(for error: Error) -> Bool {
        guard let authError = error as? AuthError else { return false }

        switch authError {
        case .sessionExpired:
            return true
        default:
            return false
        }
    }
}

private struct NativeSocialSignInRequest: Encodable {
    let provider: String
    let disableRedirect: Bool
    let idToken: IdTokenPayload

    struct IdTokenPayload: Encodable {
        let token: String
        let accessToken: String?
        let nonce: String?
    }
}
