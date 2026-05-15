//
//  ContentView.swift
//  Sleevy
//
//  Created by Onno Klein Hofmeijer on 01/05/2026.
//

import SwiftUI
import UIKit

struct ContentView: View {
    @EnvironmentObject private var authStore: AuthStore

    var body: some View {
        if let session = authStore.session {
            SignedInTabView(session: session)
        } else {
            NavigationStack {
                if authStore.isRestoringSession {
                    ProgressView("Checking session...")
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else {
                    signedOutView
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                }
            }
            .toolbar(.hidden, for: .navigationBar)
        }
    }

    private var signedOutView: some View {
        ZStack {
            MetalGradientBackground()
                .ignoresSafeArea()

            FloatingBokehView()
                .ignoresSafeArea()

            VStack(spacing: 0) {
                Spacer()

                SleevyBrandmark()
                    .fill(.white)
                    .frame(width: 80, height: 120)
                    .shadow(color: .black.opacity(0.15), radius: 12, y: 4)
                    .padding(.bottom, 48)

                VStack(spacing: 14) {

                    Button {
                        Task { await authStore.signInWithApple() }
                    } label: {
                        if authStore.isSigningIn {
                            ProgressView()
                                .tint(.black)
                                .frame(maxWidth: .infinity, minHeight: 22)
                        } else {
                            Label("Continue with Apple", systemImage: "apple.logo")
                                .frame(maxWidth: .infinity, minHeight: 22)
                        }
                    }
                    .buttonStyle(LandingButtonStyle(variant: .primary))
                    .disabled(authStore.isSigningIn)

                    Button {
                        Task { await authStore.signInWithGoogle() }
                    } label: {
                        if authStore.isSigningIn {
                            ProgressView()
                                .tint(.white)
                                .frame(maxWidth: .infinity, minHeight: 22)
                        } else {
                            Text("Continue with Google")
                                .frame(maxWidth: .infinity, minHeight: 22)
                        }
                    }
                    .buttonStyle(LandingButtonStyle(variant: .secondary))
                    .disabled(authStore.isSigningIn)
                }
                .padding(.horizontal, 32)

                if let errorMessage = authStore.errorMessage {
                    Text(errorMessage)
                        .font(.footnote)
                        .foregroundStyle(.white)
                        .padding(.top, 12)
                }

                Spacer()
            }
        }
    }
}

private struct SignedInTabView: View {
    let session: AppSession
    @StateObject private var store: ReadingListStore
    @State private var selectedTab: SignedInTab = .sleevy
    @State private var sleevyPath: [SignedInRoute] = []
    @State private var libraryPath: [SignedInRoute] = []

    init(session: AppSession) {
        self.session = session
        _store = StateObject(wrappedValue: ReadingListStore(session: session))
    }

    var body: some View {
        TabView(selection: selectedTabBinding) {
            Tab("Home", systemImage: "house", value: SignedInTab.sleevy) {
                NavigationStack(path: $sleevyPath) {
                    ReadingListView(store: store)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                        .accountToolbar(session: session) {
                            sleevyPath.append(.settings)
                        }
                        .navigationDestination(for: SignedInRoute.self) { route in
                            route.makeView(session: session)
                        }
                }
            }

            Tab("Library", systemImage: "rectangle.stack.fill", value: SignedInTab.library) {
                NavigationStack(path: $libraryPath) {
                    LibraryView(store: store)
                        .accountToolbar(session: session) {
                            libraryPath.append(.settings)
                        }
                        .navigationDestination(for: SignedInRoute.self) { route in
                            route.makeView(session: session)
                        }
                }
            }

            Tab(value: SignedInTab.search, role: .search) {
                NavigationStack {
                    SearchView(store: store)
                }
            }
        }
    }

    private var selectedTabBinding: Binding<SignedInTab> {
        Binding {
            selectedTab
        } set: { newTab in
            selectedTab = newTab
            resetPath(for: newTab)
        }
    }

    private func resetPath(for tab: SignedInTab) {
        switch tab {
        case .sleevy:
            sleevyPath = []
        case .library:
            libraryPath = []
        case .search:
            break
        }
    }
}

private enum SignedInTab: Hashable {
    case sleevy
    case library
    case search
}

private enum SignedInRoute: Hashable {
    case settings

    @ViewBuilder
    func makeView(session: AppSession) -> some View {
        switch self {
        case .settings:
            SettingsView(session: session)
        }
    }
}

private struct AccountToolbarModifier: ViewModifier {
    @EnvironmentObject private var authStore: AuthStore
    let session: AppSession
    let onSettings: () -> Void

    func body(content: Content) -> some View {
        content
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Menu {
                        Button {
                            onSettings()
                        } label: {
                            Label("Settings", systemImage: "gearshape")
                        }

                        Divider()

                        Button(role: .destructive) {
                            Task {
                                await authStore.signOut()
                            }
                        } label: {
                            Label("Sign Out", systemImage: "rectangle.portrait.and.arrow.right")
                        }
                    } label: {
                        AccountAvatarButton(
                            name: session.name,
                            imageURL: authStore.googleUserProfile?.imageURL
                        )
                    }
                    .accessibilityLabel("\(session.name) account")
                }
            }
    }
}

private extension View {
    func accountToolbar(session: AppSession, onSettings: @escaping () -> Void) -> some View {
        modifier(AccountToolbarModifier(session: session, onSettings: onSettings))
    }
}

@MainActor
private struct SearchView: View {
    @ObservedObject var store: ReadingListStore
    @State private var query = ""

    var body: some View {
        Group {
            if store.isLoading && store.savedItems.isEmpty {
                ProgressView("Loading your Sleevy...")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if trimmedQuery.isEmpty {
                ContentUnavailableView(
                    "Search Sleevy",
                    systemImage: "magnifyingglass",
                    description: Text("Search saved titles, domains, tags, and links.")
                )
            } else if filteredItems.isEmpty {
                ContentUnavailableView.search(text: trimmedQuery)
            } else {
                List(filteredItems) { item in
                    SavedItemRow(item: item) {
                        await store.markOpened(item)
                    } onToggleRead: {
                        await store.setRead(item, isRead: !item.isRead)
                    } onDelete: {
                        await store.delete(item)
                    }
                    .swipeActions(edge: .leading, allowsFullSwipe: true) {
                        Button {
                            Task {
                                await store.setRead(item, isRead: !item.isRead)
                            }
                        } label: {
                            Label(
                                item.isRead ? "Unread" : "Read",
                                systemImage: item.isRead ? "circle" : "checkmark.circle"
                            )
                        }
                        .tint(item.isRead ? .orange : .green)
                    }
                    .swipeActions(edge: .trailing, allowsFullSwipe: true) {
                        Button(role: .destructive) {
                            Task {
                                await store.delete(item)
                            }
                        } label: {
                            Label("Delete", systemImage: "trash")
                        }
                    }
                    .listRowInsets(EdgeInsets(top: 0, leading: 18, bottom: 0, trailing: 18))
                    .listRowBackground(Color.clear)
                    .listRowSeparatorTint(.white.opacity(0.08))
                }
                .listStyle(.plain)
                .scrollContentBackground(.hidden)
                .background(Color(uiColor: .systemBackground))
            }
        }
        .navigationTitle("Search")
        .navigationBarTitleDisplayMode(.large)
        .searchable(text: $query, placement: .navigationBarDrawer(displayMode: .always))
        .task {
            await store.loadIfNeeded()
        }
        .refreshable {
            await store.refresh()
        }
    }

    private var filteredItems: [SavedItem] {
        let query = trimmedQuery.lowercased()
        guard !query.isEmpty else { return [] }

        return store.savedItems.filter { item in
            item.searchableText.localizedCaseInsensitiveContains(query)
        }
    }

    private var trimmedQuery: String {
        query.trimmingCharacters(in: .whitespacesAndNewlines)
    }
}

private struct SettingsView: View {
    @EnvironmentObject private var authStore: AuthStore
    @EnvironmentObject private var appSettings: AppSettings
    @State private var isShowingDeleteConfirmation = false
    @State private var isDeletingAccount = false
    @State private var deleteAccountErrorMessage: String?

    let session: AppSession

    var body: some View {
        Form {
            Section("Theme") {
                Picker("Appearance", selection: $appSettings.themePreference) {
                    ForEach(SleevyThemePreference.allCases) { theme in
                        Text(theme.title).tag(theme)
                    }
                }
                .pickerStyle(.segmented)
            }

            Section("Account") {
                LabeledContent("Name", value: session.name)
                LabeledContent("Email", value: session.email)

                Button(role: .destructive) {
                    Task {
                        await authStore.signOut()
                    }
                } label: {
                    Label("Sign Out", systemImage: "rectangle.portrait.and.arrow.right")
                }
            }

            Section {
                TextField("Source name", text: $appSettings.sourceName)
                    .textInputAutocapitalization(.words)
                    .submitLabel(.done)
                    .onSubmit(appSettings.normalizeSourceName)

                Button("Use Device Name") {
                    appSettings.resetSourceName()
                }
                .disabled(appSettings.sourceName == SleevyUserPreferences.defaultSourceName)
            } header: {
                Text("Source Name")
            } footer: {
                Text("New links saved from this iPhone will use this name as their source.")
            }

            Section {
                Button(role: .destructive) {
                    isShowingDeleteConfirmation = true
                } label: {
                    if isDeletingAccount {
                        ProgressView()
                            .frame(maxWidth: .infinity)
                    } else {
                        Text("Delete Account")
                            .font(.footnote)
                            .frame(maxWidth: .infinity)
                    }
                }
                .disabled(isDeletingAccount)
            } footer: {
                Text("Permanently delete your account and all saved data.")
            }
        }
        .navigationTitle("Settings")
        .navigationBarTitleDisplayMode(.large)
        .onDisappear(perform: appSettings.normalizeSourceName)
        .alert("Delete Account?", isPresented: $isShowingDeleteConfirmation) {
            Button("Cancel", role: .cancel) {}
            Button("Delete Account", role: .destructive) {
                Task {
                    isDeletingAccount = true
                    do {
                        try await authStore.deleteAccount()
                    } catch {
                        deleteAccountErrorMessage = AppConfig.userFacingNetworkMessage(for: error)
                            ?? error.localizedDescription
                    }
                    isDeletingAccount = false
                }
            }
        } message: {
            Text("This will permanently delete your account and all saved data. This cannot be undone.")
        }
        .alert("Account Deletion Failed", isPresented: Binding(
            get: { deleteAccountErrorMessage != nil },
            set: { if !$0 { deleteAccountErrorMessage = nil } }
        )) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(deleteAccountErrorMessage ?? "Please try again.")
        }
    }
}

@MainActor
private struct LibraryView: View {
    @ObservedObject var store: ReadingListStore
    @State private var filter = LibraryFilter()
    @State private var sort = LibrarySort.newest
    @State private var isShowingFilters = false

    var body: some View {
        Group {
            if store.isLoading && store.savedItems.isEmpty {
                ProgressView("Loading your library...")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if store.savedItems.isEmpty {
                ContentUnavailableView(
                    "Library",
                    systemImage: "books.vertical",
                    description: Text("Saved reads you organize will appear here.")
                )
            } else if visibleItems.isEmpty {
                ContentUnavailableView(
                    "No Matching Items",
                    systemImage: "line.3.horizontal.decrease.circle",
                    description: Text("Try changing or clearing your filters.")
                )
            } else {
                libraryList
            }
        }
        .navigationTitle("Library")
        .navigationBarTitleDisplayMode(.large)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Menu {
                    Picker("Sort", selection: $sort) {
                        ForEach(LibrarySort.allCases) { sort in
                            Text(sort.title).tag(sort)
                        }
                    }

                    Divider()

                    Button {
                        isShowingFilters = true
                    } label: {
                        Label("Filters", systemImage: "line.3.horizontal.decrease.circle")
                    }

                    if filter.isActive {
                        Button(role: .destructive) {
                            filter = LibraryFilter()
                        } label: {
                            Label("Clear Filters", systemImage: "xmark.circle")
                        }
                    }
                } label: {
                    Image(systemName: filter.isActive ? "line.3.horizontal.decrease.circle.fill" : "line.3.horizontal.decrease.circle")
                        .contentTransition(.symbolEffect(.replace))
                }
                .accessibilityLabel(filter.isActive ? "Filters Active" : "Filters")
            }
        }
        .sheet(isPresented: $isShowingFilters) {
            LibraryFilterSheet(
                filter: $filter,
                tags: tagFilters,
                sources: sourceFilters,
                types: typeFilters
            )
        }
        .task {
            await store.loadIfNeeded()
        }
        .refreshable {
            await store.refresh()
        }
    }

    private var libraryList: some View {
        List {
            if filter.isActive {
                Section {
                    ActiveLibraryFilters(filter: $filter)
                        .listRowInsets(EdgeInsets(top: 8, leading: 18, bottom: 8, trailing: 18))
                        .listRowBackground(Color.clear)
                        .listRowSeparator(.hidden)
                }
            }

            if let errorMessage = store.errorMessage {
                Section {
                    Text(errorMessage)
                        .font(.footnote)
                        .foregroundStyle(.red)
                }
                .listRowBackground(Color.clear)
            }

            ForEach(visibleItems) { item in
                SavedItemRow(item: item) {
                    await store.markOpened(item)
                } onToggleRead: {
                    await store.setRead(item, isRead: !item.isRead)
                } onDelete: {
                    await store.delete(item)
                }
                .swipeActions(edge: .leading, allowsFullSwipe: true) {
                    Button {
                        Task {
                            await store.setRead(item, isRead: !item.isRead)
                        }
                    } label: {
                        Label(
                            item.isRead ? "Unread" : "Read",
                            systemImage: item.isRead ? "circle" : "checkmark.circle"
                        )
                    }
                    .tint(item.isRead ? .orange : .green)
                }
                .swipeActions(edge: .trailing, allowsFullSwipe: true) {
                    Button(role: .destructive) {
                        Task {
                            await store.delete(item)
                        }
                    } label: {
                        Label("Delete", systemImage: "trash")
                    }
                }
                .listRowInsets(EdgeInsets(top: 0, leading: 18, bottom: 0, trailing: 18))
                .listRowBackground(Color.clear)
                .listRowSeparatorTint(.white.opacity(0.08))
            }
        }
        .listStyle(.plain)
        .scrollContentBackground(.hidden)
        .background(Color(uiColor: .systemBackground))
    }

    private var visibleItems: [SavedItem] {
        store.savedItems
            .filter { item in
                (filter.tag == nil || item.tags.contains(filter.tag ?? ""))
                    && (filter.source == nil || item.sourceGroup == filter.source)
                    && (filter.type == nil || item.type == filter.type)
            }
            .sorted(using: sort)
    }

    private var tagFilters: [LibraryFilterOption] {
        countedOptions(store.savedItems.flatMap(\.tags))
    }

    private var sourceFilters: [LibraryFilterOption] {
        countedOptions(store.savedItems.compactMap(\.sourceGroup))
    }

    private var typeFilters: [LibraryFilterOption] {
        countedOptions(store.savedItems.map(\.type))
    }

    private func countedOptions(_ values: [String]) -> [LibraryFilterOption] {
        let counts = values.reduce(into: [String: Int]()) { counts, value in
            let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !trimmed.isEmpty else { return }
            counts[trimmed, default: 0] += 1
        }

        return counts
            .map { LibraryFilterOption(value: $0.key, count: $0.value) }
            .sorted { lhs, rhs in
                if lhs.count == rhs.count {
                    lhs.value.localizedCaseInsensitiveCompare(rhs.value) == .orderedAscending
                } else {
                    lhs.count > rhs.count
                }
            }
    }
}

private struct LibraryFilter: Equatable {
    var tag: String?
    var source: String?
    var type: String?

    var isActive: Bool {
        tag != nil || source != nil || type != nil
    }
}

private struct LibraryFilterOption: Identifiable, Hashable {
    let value: String
    let count: Int

    var id: String { value }
}

private enum LibrarySort: String, CaseIterable, Identifiable {
    case newest
    case oldest
    case title
    case unread

    var id: String { rawValue }

    var title: String {
        switch self {
        case .newest:
            "Newest First"
        case .oldest:
            "Oldest First"
        case .title:
            "Title A-Z"
        case .unread:
            "Unread First"
        }
    }
}

private extension Array where Element == SavedItem {
    func sorted(using sort: LibrarySort) -> [SavedItem] {
        switch sort {
        case .newest:
            sorted { lhs, rhs in lhs.lastSavedAt > rhs.lastSavedAt }
        case .oldest:
            sorted { lhs, rhs in lhs.lastSavedAt < rhs.lastSavedAt }
        case .title:
            sorted { lhs, rhs in lhs.librarySortTitle.localizedCaseInsensitiveCompare(rhs.librarySortTitle) == .orderedAscending }
        case .unread:
            sorted { lhs, rhs in
                if lhs.isRead == rhs.isRead {
                    lhs.lastSavedAt > rhs.lastSavedAt
                } else {
                    !lhs.isRead && rhs.isRead
                }
            }
        }
    }
}

private struct LibraryFilterSheet: View {
    @Environment(\.dismiss) private var dismiss
    @Binding var filter: LibraryFilter
    let tags: [LibraryFilterOption]
    let sources: [LibraryFilterOption]
    let types: [LibraryFilterOption]

    var body: some View {
        NavigationStack {
            List {
                filterSection("Tags", options: tags, selection: $filter.tag, systemImage: "number")
                filterSection("Sources", options: sources, selection: $filter.source, systemImage: "tray.and.arrow.down")
                filterSection("Types", options: types, selection: $filter.type, systemImage: "doc.text")

                if filter.isActive {
                    Section {
                        Button(role: .destructive) {
                            filter = LibraryFilter()
                        } label: {
                            Label("Clear Filters", systemImage: "xmark.circle")
                        }
                    }
                }
            }
            .navigationTitle("Filters")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") {
                        dismiss()
                    }
                }
            }
        }
        .presentationDetents([.medium, .large])
    }

    @ViewBuilder
    private func filterSection(
        _ title: String,
        options: [LibraryFilterOption],
        selection: Binding<String?>,
        systemImage: String
    ) -> some View {
        if !options.isEmpty {
            Section(title) {
                ForEach(options) { option in
                    Button {
                        selection.wrappedValue = selection.wrappedValue == option.value ? nil : option.value
                    } label: {
                        HStack(spacing: 12) {
                            Label(option.value, systemImage: systemImage)
                                .labelStyle(.titleAndIcon)

                            Spacer()

                            Text(option.count, format: .number)
                                .font(.footnote.monospacedDigit())
                                .foregroundStyle(.secondary)

                            if selection.wrappedValue == option.value {
                                Image(systemName: "checkmark")
                                    .font(.body.weight(.semibold))
                                    .foregroundStyle(.tint)
                            }
                        }
                    }
                    .foregroundStyle(.primary)
                }
            }
        }
    }
}

private struct ActiveLibraryFilters: View {
    @Binding var filter: LibraryFilter

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                if let tag = filter.tag {
                    FilterChip(label: "Tag", value: tag) {
                        filter.tag = nil
                    }
                }

                if let source = filter.source {
                    FilterChip(label: "Source", value: source) {
                        filter.source = nil
                    }
                }

                if let type = filter.type {
                    FilterChip(label: "Type", value: type) {
                        filter.type = nil
                    }
                }
            }
        }
    }
}

private struct FilterChip: View {
    let label: String
    let value: String
    let onRemove: () -> Void

    var body: some View {
        Button {
            onRemove()
        } label: {
            HStack(spacing: 6) {
                Text(label)
                    .foregroundStyle(.secondary)
                Text(value)
                    .foregroundStyle(.primary)
                Image(systemName: "xmark.circle.fill")
                    .foregroundStyle(.secondary)
            }
            .font(.footnote.weight(.medium))
            .lineLimit(1)
            .padding(.horizontal, 10)
            .padding(.vertical, 7)
            .background(Color(uiColor: .secondarySystemFill), in: Capsule())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Remove \(label) filter \(value)")
    }
}

private extension SavedItem {
    var sourceGroup: String? {
        if let sourceName = sourceName?.trimmingCharacters(in: .whitespacesAndNewlines).nonEmptyValue {
            return sourceName
        }

        guard let captureChannel else { return nil }

        switch captureChannel {
        case "ios-app", "ios-share-extension":
            return "iOS"
        case "chrome-extension", "web-companion":
            return "Browser"
        case "raycast":
            return "Raycast"
        case "api":
            return "API"
        default:
            return captureChannel
        }
    }

    var librarySortTitle: String {
        title?.trimmingCharacters(in: .whitespacesAndNewlines).nonEmptyValue
            ?? siteName?.trimmingCharacters(in: .whitespacesAndNewlines).nonEmptyValue
            ?? host
    }
}

private extension SavedItem {
    var searchTitle: String {
        title?.trimmingCharacters(in: .whitespacesAndNewlines).nonEmptyValue
            ?? siteName?.trimmingCharacters(in: .whitespacesAndNewlines).nonEmptyValue
            ?? searchDomain
    }

    var searchDomain: String {
        host.replacingOccurrences(
            of: #"^www\."#,
            with: "",
            options: .regularExpression
        )
    }

    var searchableText: String {
        [
            searchTitle,
            searchDomain,
            description,
            previewSummary,
            type,
            tags.joined(separator: " "),
            originalURL,
            canonicalURL,
        ]
        .compactMap { $0 }
        .joined(separator: " ")
    }

    var searchURL: URL? {
        Self.safeURL(canonicalURL) ?? Self.safeURL(originalURL)
    }

    var searchMonogram: String {
        String(searchDomain.prefix(1)).uppercased()
    }

    private static func safeURL(_ value: String?) -> URL? {
        guard
            let value,
            let url = URL(string: value),
            let scheme = url.scheme?.lowercased(),
            scheme == "http" || scheme == "https"
        else {
            return nil
        }

        return url
    }
}

private extension String {
    var nonEmptyValue: String? {
        isEmpty ? nil : self
    }
}

private struct LandingButtonStyle: ButtonStyle {
    enum Variant { case primary, secondary }
    let variant: Variant

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.body.weight(.semibold))
            .foregroundStyle(variant == .primary ? Color.black : Color.white)
            .padding(.vertical, 16)
            .background(
                variant == .primary
                    ? AnyShapeStyle(Color.white)
                    : AnyShapeStyle(Color.white.opacity(0.2))
            )
            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .strokeBorder(Color.white.opacity(variant == .secondary ? 0.3 : 0), lineWidth: 1)
            )
            .opacity(configuration.isPressed ? 0.8 : 1)
            .animation(.easeOut(duration: 0.15), value: configuration.isPressed)
    }
}

#Preview {
    ContentView()
        .environmentObject(AuthStore())
}
