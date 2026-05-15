//
//  SleevyTests.swift
//  SleevyTests
//
//  Created by Onno Klein Hofmeijer on 01/05/2026.
//

import Foundation
import Testing
@testable import Sleevy

struct SleevyTests {

    @Test func savedItemDecodesCurrentTagsShape() throws {
        let item = try decodeSavedItem(
            extraFields: #""tags":["front-end","tools"]"#
        )

        #expect(item.tags == ["front-end", "tools"])
    }

    @Test func savedItemDecodesLegacyTopicShape() throws {
        let item = try decodeSavedItem(
            extraFields: #""topic":"design""#
        )

        #expect(item.tags == ["design"])
    }

    @Test func savedItemDefaultsMissingTagsToEmptyArray() throws {
        let item = try decodeSavedItem(extraFields: "")

        #expect(item.tags.isEmpty)
    }

    @Test func savedItemDecodesSourceFields() throws {
        let item = try decodeSavedItem(
            extraFields: #""sourceName":"Onno's iPhone","captureChannel":"ios-share-extension","tags":["tools"]"#
        )

        #expect(item.sourceName == "Onno's iPhone")
        #expect(item.captureChannel == "ios-share-extension")
    }

    private func decodeSavedItem(extraFields: String) throws -> SavedItem {
        let separator = extraFields.isEmpty ? "" : ","
        let json = """
        {
          "id": "item-1",
          "originalUrl": "https://example.com/article",
          "normalizedUrl": "https://example.com/article",
          "host": "example.com",
          "type": "article",
          \(extraFields)\(separator)
          "enrichmentStatus": "enriched",
          "isRead": false,
          "lastSavedAt": "2026-05-13T10:11:12.345Z",
          "createdAt": "2026-05-13T10:11:12.345Z",
          "updatedAt": "2026-05-13T10:11:12.345Z"
        }
        """
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return try decoder.decode(SavedItem.self, from: Data(json.utf8))
    }

}
