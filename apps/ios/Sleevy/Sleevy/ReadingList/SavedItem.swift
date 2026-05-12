import Foundation

struct SavedItem: Codable, Identifiable, Equatable {
    let id: String
    let originalURL: String
    let normalizedURL: String
    let host: String
    let title: String?
    let description: String?
    let siteName: String?
    let faviconURL: String?
    let faviconLightURL: String?
    let faviconDarkURL: String?
    let imageURL: String?
    let canonicalURL: String?
    let previewSummary: String?
    let type: String
    let tags: [String]
    let enrichmentStatus: EnrichmentStatus
    let isRead: Bool
    let lastSavedAt: Date
    let createdAt: Date
    let updatedAt: Date

    enum CodingKeys: String, CodingKey {
        case id
        case originalURL = "originalUrl"
        case normalizedURL = "normalizedUrl"
        case host
        case title
        case description
        case siteName
        case faviconURL = "faviconUrl"
        case faviconLightURL = "faviconLightUrl"
        case faviconDarkURL = "faviconDarkUrl"
        case imageURL = "imageUrl"
        case canonicalURL = "canonicalUrl"
        case previewSummary
        case type
        case tags
        case enrichmentStatus
        case isRead
        case lastSavedAt
        case createdAt
        case updatedAt
    }
}

extension SavedItem {
    func withReadState(_ isRead: Bool) -> SavedItem {
        SavedItem(
            id: id,
            originalURL: originalURL,
            normalizedURL: normalizedURL,
            host: host,
            title: title,
            description: description,
            siteName: siteName,
            faviconURL: faviconURL,
            faviconLightURL: faviconLightURL,
            faviconDarkURL: faviconDarkURL,
            imageURL: imageURL,
            canonicalURL: canonicalURL,
            previewSummary: previewSummary,
            type: type,
            tags: tags,
            enrichmentStatus: enrichmentStatus,
            isRead: isRead,
            lastSavedAt: lastSavedAt,
            createdAt: createdAt,
            updatedAt: updatedAt
        )
    }
}

enum EnrichmentStatus: String, Codable {
    case pending
    case enriched
    case failed
}

struct SavedItemsResponse: Decodable {
    let savedItems: [SavedItem]
}
