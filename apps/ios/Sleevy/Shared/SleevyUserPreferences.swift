import Foundation
import UIKit

enum SleevyThemePreference: String, CaseIterable, Identifiable {
    case system
    case light
    case dark

    var id: String { rawValue }

    var title: String {
        switch self {
        case .system:
            "System"
        case .light:
            "Light"
        case .dark:
            "Dark"
        }
    }
}

enum SleevyUserPreferences {
    static let appGroupIdentifier = "group.app.sleevy"
    static let themeKey = "settings.theme"
    static let sourceNameKey = "settings.source-name"

    static let defaults = UserDefaults(suiteName: appGroupIdentifier) ?? .standard

    static var defaultSourceName: String {
        UIDevice.current.name
    }

    static var sourceName: String {
        let storedValue = defaults.string(forKey: sourceNameKey)?
            .trimmingCharacters(in: .whitespacesAndNewlines)

        guard let storedValue, !storedValue.isEmpty else {
            return defaultSourceName
        }

        return storedValue
    }
}
