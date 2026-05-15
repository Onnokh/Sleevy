import Foundation
import UIKit
import UniformTypeIdentifiers

final class ShareViewController: UIViewController {
    private static let appGroupIdentifier = "group.plowplow.Sleevy"
    private static let sharedAuthTokenKey = "auth-token"
    private static let sharedAppSessionKey = "app-session"
    private static var sourceName: String {
        SleevyUserPreferences.sourceName
    }
    private static let decoder = JSONDecoder()
    private static let encoder = JSONEncoder()
    private static let apiSession: URLSession = {
        let configuration = URLSessionConfiguration.default
        configuration.waitsForConnectivity = false
        configuration.timeoutIntervalForRequest = 8
        configuration.timeoutIntervalForResource = 15
        return URLSession(configuration: configuration)
    }()
    private let activityIndicator = UIActivityIndicatorView(style: .large)
    private let statusLabel = UILabel()
    private var hasStarted = false
    private var captureClient: SleevyCaptureClient {
        SleevyCaptureClient(
            apiBaseURL: apiBaseURL,
            apiOrigin: apiOrigin,
            urlSession: Self.apiSession,
            encoder: Self.encoder,
            decoder: Self.decoder
        )
    }
    private let pendingCaptureStore = SleevyPendingCaptureStore(
        appGroupIdentifier: ShareViewController.appGroupIdentifier
    )

    override func viewDidLoad() {
        super.viewDidLoad()

        view.backgroundColor = .systemBackground

        activityIndicator.translatesAutoresizingMaskIntoConstraints = false
        activityIndicator.startAnimating()

        statusLabel.translatesAutoresizingMaskIntoConstraints = false
        statusLabel.text = "Saving to Sleevy..."
        statusLabel.font = .preferredFont(forTextStyle: .headline)
        statusLabel.textAlignment = .center
        statusLabel.numberOfLines = 0

        view.addSubview(activityIndicator)
        view.addSubview(statusLabel)

        NSLayoutConstraint.activate([
            activityIndicator.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            activityIndicator.centerYAnchor.constraint(equalTo: view.centerYAnchor, constant: -16),
            statusLabel.topAnchor.constraint(equalTo: activityIndicator.bottomAnchor, constant: 16),
            statusLabel.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 24),
            statusLabel.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -24),
        ])
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)

        guard !hasStarted else { return }
        hasStarted = true

        Task { @MainActor in
            await submitSharedItem()
        }
    }

    private func submitSharedItem() async {
        do {
            let sharedURL = try await loadSharedURL()
            let token = try loadSharedAuthToken()
            do {
                _ = try await captureClient.capture(
                    url: sharedURL.absoluteString,
                    token: token,
                    sourceName: Self.sourceName,
                    captureChannel: "ios-share-extension"
                )
                extensionContext?.completeRequest(returningItems: nil)
            } catch {
                guard shouldQueueCapture(after: error) else {
                    throw error
                }

                try queueCapture(sharedURL)
                activityIndicator.stopAnimating()
                statusLabel.text = "Saved offline. Sleevy will sync it when you're back online."
                try? await Task.sleep(nanoseconds: 850_000_000)
                extensionContext?.completeRequest(returningItems: nil)
            }
        } catch {
            statusLabel.text = error.localizedDescription
            activityIndicator.stopAnimating()

            let dismissAction = UIAlertAction(title: "Close", style: .default) { [weak self] _ in
                self?.extensionContext?.cancelRequest(withError: error)
            }

            let alert = UIAlertController(title: "Couldn’t Save Link", message: error.localizedDescription, preferredStyle: .alert)
            alert.addAction(dismissAction)
            present(alert, animated: true)
        }
    }

    private func shouldQueueCapture(after error: Error) -> Bool {
        if error is URLError {
            return true
        }

        if let captureError = error as? SleevyCaptureError {
            switch captureError {
            case .invalidServerResponse, .temporarilyUnavailable:
                return true
            case .sessionExpired, .failed:
                return false
            }
        }

        if let shareError = error as? ShareExtensionError {
            switch shareError {
            case .missingSharedURL, .notSignedIn:
                return false
            }
        }

        return false
    }

    private func loadSharedAuthToken() throws -> String {
        guard
            let defaults = UserDefaults(suiteName: Self.appGroupIdentifier),
            let token = defaults.string(forKey: Self.sharedAuthTokenKey),
            !token.isEmpty
        else {
            throw ShareExtensionError.notSignedIn
        }

        return token
    }

    private func loadSharedURL() async throws -> URL {
        guard let extensionItems = extensionContext?.inputItems as? [NSExtensionItem] else {
            throw ShareExtensionError.missingSharedURL
        }

        for item in extensionItems {
            for provider in item.attachments ?? [] {
                if provider.hasItemConformingToTypeIdentifier(UTType.url.identifier) {
                    let value = try await provider.loadItem(forTypeIdentifier: UTType.url.identifier)
                    if let url = value as? URL {
                        return url
                    }
                    if let data = value as? Data,
                       let text = String(data: data, encoding: .utf8),
                       let url = URL(string: text) {
                        return url
                    }
                }

                if provider.hasItemConformingToTypeIdentifier(UTType.plainText.identifier) {
                    let value = try await provider.loadItem(forTypeIdentifier: UTType.plainText.identifier)
                    if let text = value as? String,
                       let url = URL(string: text.trimmingCharacters(in: .whitespacesAndNewlines)),
                       url.scheme?.hasPrefix("http") == true {
                        return url
                    }
                }
            }
        }

        throw ShareExtensionError.missingSharedURL
    }

    private func queueCapture(_ sharedURL: URL) throws {
        let session = try loadSharedAppSession()
        try pendingCaptureStore.enqueue(
            url: sharedURL.absoluteString,
            for: session.userId,
            sourceName: Self.sourceName,
            captureChannel: "ios-share-extension"
        )
    }

    private func loadSharedAppSession() throws -> SleevySharedAppSession {
        guard
            let defaults = UserDefaults(suiteName: Self.appGroupIdentifier),
            let sessionData = defaults.data(forKey: Self.sharedAppSessionKey),
            let session = try? Self.decoder.decode(SleevySharedAppSession.self, from: sessionData)
        else {
            throw ShareExtensionError.notSignedIn
        }

        return session
    }

    private var apiBaseURL: URL {
        guard
            let value = Bundle.main.object(forInfoDictionaryKey: "SleevyAPIBaseURL") as? String,
            let url = URL(string: value),
            !value.isEmpty
        else {
            return URL(string: "http://localhost:4001")!
        }

        return url
    }

    private var apiOrigin: String {
        guard
            let scheme = apiBaseURL.scheme,
            let host = apiBaseURL.host
        else {
            return apiBaseURL.absoluteString
        }

        if let port = apiBaseURL.port {
            return "\(scheme)://\(host):\(port)"
        }

        return "\(scheme)://\(host)"
    }
}

private enum ShareExtensionError: LocalizedError {
    case missingSharedURL
    case notSignedIn

    var errorDescription: String? {
        switch self {
        case .missingSharedURL:
            return "No shareable URL was found in this item."
        case .notSignedIn:
            return "Sign in to Sleevy in the main app before sharing links."
        }
    }
}

private extension NSItemProvider {
    func loadItem(forTypeIdentifier typeIdentifier: String) async throws -> NSSecureCoding? {
        try await withCheckedThrowingContinuation { continuation in
            loadItem(forTypeIdentifier: typeIdentifier, options: nil) { item, error in
                if let error {
                    continuation.resume(throwing: error)
                    return
                }

                continuation.resume(returning: item)
            }
        }
    }
}
