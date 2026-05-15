import Combine
import SwiftUI

@MainActor
final class AppSettings: ObservableObject {
    @Published var themePreference: SleevyThemePreference {
        didSet {
            SleevyUserPreferences.defaults.set(themePreference.rawValue, forKey: SleevyUserPreferences.themeKey)
        }
    }

    @Published var sourceName: String {
        didSet {
            SleevyUserPreferences.defaults.set(sourceName, forKey: SleevyUserPreferences.sourceNameKey)
        }
    }

    init() {
        let storedTheme = SleevyUserPreferences.defaults.string(forKey: SleevyUserPreferences.themeKey)
        self.themePreference = SleevyThemePreference(rawValue: storedTheme ?? "") ?? .system
        self.sourceName = SleevyUserPreferences.sourceName
    }

    var preferredColorScheme: ColorScheme? {
        switch themePreference {
        case .system:
            nil
        case .light:
            .light
        case .dark:
            .dark
        }
    }

    func normalizeSourceName() {
        let trimmedValue = sourceName.trimmingCharacters(in: .whitespacesAndNewlines)
        sourceName = trimmedValue.isEmpty ? SleevyUserPreferences.defaultSourceName : trimmedValue
    }

    func resetSourceName() {
        sourceName = SleevyUserPreferences.defaultSourceName
    }
}
