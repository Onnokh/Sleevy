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

    private enum DecodingKeys: String, CodingKey {
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
        case topic
        case tags
        case enrichmentStatus
        case isRead
        case lastSavedAt
        case createdAt
        case updatedAt
    }

    init(
        id: String,
        originalURL: String,
        normalizedURL: String,
        host: String,
        title: String?,
        description: String?,
        siteName: String?,
        faviconURL: String?,
        faviconLightURL: String?,
        faviconDarkURL: String?,
        imageURL: String?,
        canonicalURL: String?,
        previewSummary: String?,
        type: String,
        tags: [String],
        enrichmentStatus: EnrichmentStatus,
        isRead: Bool,
        lastSavedAt: Date,
        createdAt: Date,
        updatedAt: Date
    ) {
        self.id = id
        self.originalURL = originalURL
        self.normalizedURL = normalizedURL
        self.host = host
        self.title = title
        self.description = description
        self.siteName = siteName
        self.faviconURL = faviconURL
        self.faviconLightURL = faviconLightURL
        self.faviconDarkURL = faviconDarkURL
        self.imageURL = imageURL
        self.canonicalURL = canonicalURL
        self.previewSummary = previewSummary
        self.type = type
        self.tags = tags
        self.enrichmentStatus = enrichmentStatus
        self.isRead = isRead
        self.lastSavedAt = lastSavedAt
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: DecodingKeys.self)
        let legacyTopic = try container.decodeIfPresent(String.self, forKey: .topic)

        self.init(
            id: try container.decode(String.self, forKey: .id),
            originalURL: try container.decode(String.self, forKey: .originalURL),
            normalizedURL: try container.decode(String.self, forKey: .normalizedURL),
            host: try container.decode(String.self, forKey: .host),
            title: try container.decodeIfPresent(String.self, forKey: .title),
            description: try container.decodeIfPresent(String.self, forKey: .description),
            siteName: try container.decodeIfPresent(String.self, forKey: .siteName),
            faviconURL: try container.decodeIfPresent(String.self, forKey: .faviconURL),
            faviconLightURL: try container.decodeIfPresent(String.self, forKey: .faviconLightURL),
            faviconDarkURL: try container.decodeIfPresent(String.self, forKey: .faviconDarkURL),
            imageURL: try container.decodeIfPresent(String.self, forKey: .imageURL),
            canonicalURL: try container.decodeIfPresent(String.self, forKey: .canonicalURL),
            previewSummary: try container.decodeIfPresent(String.self, forKey: .previewSummary),
            type: try container.decode(String.self, forKey: .type),
            tags: try container.decodeIfPresent([String].self, forKey: .tags) ?? legacyTopic.map { [$0] } ?? [],
            enrichmentStatus: try container.decode(EnrichmentStatus.self, forKey: .enrichmentStatus),
            isRead: try container.decode(Bool.self, forKey: .isRead),
            lastSavedAt: try container.decode(Date.self, forKey: .lastSavedAt),
            createdAt: try container.decode(Date.self, forKey: .createdAt),
            updatedAt: try container.decode(Date.self, forKey: .updatedAt)
        )
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
