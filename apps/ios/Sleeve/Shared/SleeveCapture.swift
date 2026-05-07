import Foundation

struct SleeveCaptureClient {
    let apiBaseURL: URL
    let apiOrigin: String
    let urlSession: URLSession
    let encoder: JSONEncoder
    let decoder: JSONDecoder

    func capture(url: String, token: String) async throws -> Data {
        var request = URLRequest(url: endpoint("/v1/captures"))
        request.httpMethod = "POST"
        request.httpShouldHandleCookies = false
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue(apiOrigin, forHTTPHeaderField: "Origin")
        request.httpBody = try encoder.encode(SleeveCaptureRequest(url: url))

        let (data, response) = try await urlSession.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse else {
            throw SleeveCaptureError.invalidServerResponse
        }

        if httpResponse.statusCode == 401 || httpResponse.statusCode == 403 {
            throw SleeveCaptureError.sessionExpired
        }

        guard (200 ..< 300).contains(httpResponse.statusCode) else {
            let message = serverMessage(data)

            if httpResponse.statusCode == 429 || (500 ..< 600).contains(httpResponse.statusCode) {
                throw SleeveCaptureError.temporarilyUnavailable(message ?? "Sleeve could not sync this saved link right now.")
            }

            throw SleeveCaptureError.failed(message ?? "Sleeve could not sync this saved link right now.")
        }

        return data
    }

    private func endpoint(_ path: String) -> URL {
        var components = URLComponents(url: apiBaseURL, resolvingAgainstBaseURL: false)!
        components.path = path
        return components.url!
    }

    private func serverMessage(_ data: Data) -> String? {
        guard let payload = try? decoder.decode(SleeveServerErrorResponse.self, from: data) else {
            return nil
        }

        if payload.tag == "InvalidUrlError" {
            return "Enter a valid URL."
        }

        guard let message = payload.message, !message.isEmpty else { return nil }

        return message
    }
}

enum SleeveCaptureError: LocalizedError {
    case invalidServerResponse
    case sessionExpired
    case temporarilyUnavailable(String)
    case failed(String)

    var errorDescription: String? {
        switch self {
        case .invalidServerResponse:
            return "Sleeve could not save this link right now."
        case .sessionExpired:
            return "Sign in to Sleeve again before saving links."
        case .temporarilyUnavailable(let message), .failed(let message):
            return message
        }
    }
}

struct SleevePendingCaptureStore {
    let appGroupIdentifier: String

    func enqueue(url: String, for userId: String) throws {
        var pendingCaptures = load(for: userId)
        pendingCaptures.insert(
            SleevePendingCapture(
                id: UUID(),
                url: url,
                queuedAt: Date()
            ),
            at: 0
        )
        try persist(pendingCaptures, for: userId)
    }

    func remove(id: UUID, for userId: String) {
        let pendingCaptures = load(for: userId)
        let updatedCaptures = pendingCaptures.filter { $0.id != id }
        try? persist(updatedCaptures, for: userId)
    }

    func load(for userId: String) -> [SleevePendingCapture] {
        guard
            let queueURL = pendingCapturesURL(for: userId),
            let data = try? Data(contentsOf: queueURL),
            let pendingCaptures = try? JSONDecoder.sharedISO8601.decode([SleevePendingCapture].self, from: data)
        else {
            return []
        }

        return pendingCaptures
    }

    func persist(_ pendingCaptures: [SleevePendingCapture], for userId: String) throws {
        guard let queueURL = pendingCapturesURL(for: userId) else { return }

        try FileManager.default.createDirectory(
            at: queueURL.deletingLastPathComponent(),
            withIntermediateDirectories: true
        )

        if pendingCaptures.isEmpty {
            try? FileManager.default.removeItem(at: queueURL)
            return
        }

        let data = try JSONEncoder.sharedISO8601.encode(pendingCaptures)
        try data.write(to: queueURL, options: .atomic)
    }

    private func pendingCapturesURL(for userId: String) -> URL? {
        FileManager.default
            .containerURL(forSecurityApplicationGroupIdentifier: appGroupIdentifier)?
            .appendingPathComponent("PendingCaptures", isDirectory: true)
            .appendingPathComponent("\(userId).json", isDirectory: false)
    }
}

struct SleeveSharedAppSession: Decodable {
    let userId: String
}

struct SleevePendingCapture: Codable, Equatable {
    let id: UUID
    let url: String
    let queuedAt: Date
}

private struct SleeveCaptureRequest: Encodable {
    let url: String
}

private struct SleeveServerErrorResponse: Decodable {
    let tag: String?
    let message: String?

    enum CodingKeys: String, CodingKey {
        case tag = "_tag"
        case message
    }
}

extension JSONDecoder {
    static let sharedISO8601: JSONDecoder = {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return decoder
    }()
}

extension JSONEncoder {
    static let sharedISO8601: JSONEncoder = {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        return encoder
    }()
}
