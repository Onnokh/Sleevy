import Foundation

enum AppConfig {
    static let keychainService = "plowplow.Sleeve"
    static let appGroupIdentifier = "group.plowplow.Sleeve"
    static let sharedAuthTokenKey = "auth-token"
    static let sharedAppSessionKey = "app-session"
    static let apiSession: URLSession = {
        let configuration = URLSessionConfiguration.default
        configuration.waitsForConnectivity = false
        configuration.timeoutIntervalForRequest = 8
        configuration.timeoutIntervalForResource = 15
        return URLSession(configuration: configuration)
    }()

    static let remoteImageSession: URLSession = {
        let configuration = URLSessionConfiguration.default
        configuration.waitsForConnectivity = false
        configuration.timeoutIntervalForRequest = 4
        configuration.timeoutIntervalForResource = 8
        configuration.requestCachePolicy = .returnCacheDataElseLoad
        configuration.urlCache = .shared
        return URLSession(configuration: configuration)
    }()

    static let apiBaseURL: URL = {
        if
            let value = Bundle.main.object(forInfoDictionaryKey: "SleeveAPIBaseURL") as? String,
            let url = URL(string: value),
            !value.isEmpty,
            !value.contains("REPLACE_WITH")
        {
            return url
        }

        if
            let value = ProcessInfo.processInfo.environment["SLEEVE_API_BASE_URL"],
            let url = URL(string: value)
        {
            return url
        }

        return URL(string: "http://localhost:4001")!
    }()

    static let apiOrigin: String = {
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
    }()

    static func endpoint(_ path: String) -> URL {
        var components = URLComponents(url: apiBaseURL, resolvingAgainstBaseURL: false)!
        components.path = path
        return components.url!
    }

    static func userFacingNetworkMessage(for error: Error) -> String? {
        guard let urlError = error as? URLError else {
            return nil
        }

        switch urlError.code {
        case .notConnectedToInternet, .networkConnectionLost, .timedOut:
            return "You're offline right now. Sleeve will keep showing your last synced saved items until the connection comes back."
        case .cannotFindHost, .dnsLookupFailed:
            return """
            The Sleeve API host could not be resolved: \(apiBaseURL.absoluteString). \
            Check SLEEVE_API_BASE_URL in apps/ios/Sleeve/BuildConfig/Local.xcconfig and make sure the hostname exists in DNS.
            """
        case .cannotConnectToHost:
            return """
            The Sleeve API host is configured but could not be reached: \(apiBaseURL.absoluteString). \
            Check whether the API is running and whether you need VPN or local networking access.
            """
        default:
            return nil
        }
    }

    static func isOfflineNetworkError(_ error: Error) -> Bool {
        guard let urlError = error as? URLError else {
            return false
        }

        switch urlError.code {
        case .notConnectedToInternet, .networkConnectionLost, .timedOut:
            return true
        default:
            return false
        }
    }
}
