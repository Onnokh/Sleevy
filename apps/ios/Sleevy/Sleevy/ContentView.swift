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
                            HStack(spacing: 8) {
                                Image("GoogleLogo")
                                    .resizable()
                                    .scaledToFit()
                                    .frame(width: 18, height: 18)
                                    .accessibilityHidden(true)
                                Text("Continue with Google")
                            }
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
    @EnvironmentObject private var authStore: AuthStore
    @Environment(\.scenePhase) private var scenePhase
    let session: AppSession
    @StateObject private var store: ReadingListStore
    @State private var selectedTab: SignedInTab = .sleevy
    @State private var sleevyPath: [SignedInRoute] = []
    @State private var libraryPath: [SignedInRoute] = []
    @State private var shouldRefreshAfterActivation = false

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
        .onAppear {
            store.onAuthenticationInvalid = { message in
                authStore.invalidateSession(message: message)
            }
        }
        .onChange(of: scenePhase) { _, newPhase in
            handleScenePhaseChange(newPhase)
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

    private func handleScenePhaseChange(_ phase: ScenePhase) {
        switch phase {
        case .active:
            guard shouldRefreshAfterActivation else { return }
            shouldRefreshAfterActivation = false

            Task {
                await store.refresh()
            }
        case .inactive, .background:
            shouldRefreshAfterActivation = true
        @unknown default:
            break
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
                            name: session.displayName,
                            imageURL: session.provider == "google" ? authStore.googleUserProfile?.imageURL : nil
                        )
                    }
                    .accessibilityLabel("\(session.displayName) account")
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
    @State private var isRetryingLoad = false

    var body: some View {
        Group {
            if store.isLoading && store.savedItems.isEmpty {
                ProgressView("Loading your Sleevy...")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if store.savedItems.isEmpty, let loadFailureMessage {
                VStack(spacing: 16) {
                    ContentUnavailableView(
                        "Unable to Load Sleevy",
                        systemImage: "wifi.exclamationmark",
                        description: Text(loadFailureMessage)
                    )

                    Button {
                        Task {
                            await retryLoad()
                        }
                    } label: {
                        if isRetryingLoad {
                            ProgressView()
                        } else {
                            Label("Try Again", systemImage: "arrow.clockwise")
                        }
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(isRetryingLoad)
                }
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

    private var loadFailureMessage: String? {
        if !store.isOnline {
            return "Connect to the internet, then try again."
        }

        if let errorMessage = store.errorMessage {
            return errorMessage
        }

        if !store.isAPIReachable {
            return "Sleevy could not reach the API. Try again in a moment."
        }

        return nil
    }

    private func retryLoad() async {
        guard !isRetryingLoad else { return }
        isRetryingLoad = true
        defer { isRetryingLoad = false }
        await store.retryLoad()
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
                LabeledContent("Name", value: session.displayName)
                LabeledContent("Email", value: session.email)
                if let providerName = session.providerName {
                    LabeledContent("Provider", value: providerName)
                }

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
    @State private var folderEditor: FolderEditor?
    @State private var folderToDelete: Folder?
    @State private var folderToOpen: Folder?
    @State private var itemToMove: SavedItem?

    var body: some View {
        Group {
            if store.isLoadingLibrary && store.libraryRootItems.isEmpty && store.folders.isEmpty {
                ProgressView("Loading your library...")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if store.libraryRootItems.isEmpty && store.folders.isEmpty && store.libraryErrorMessage == nil {
                ContentUnavailableView(
                    "Library",
                    systemImage: "books.vertical",
                    description: Text("Saved reads you organize will appear here.")
                )
            } else {
                libraryList
            }
        }
        .navigationTitle("Library")
        .navigationBarTitleDisplayMode(.large)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    folderEditor = .create
                } label: {
                    Image(systemName: "folder.badge.plus")
                }
                .accessibilityLabel("New Folder")
            }

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
        .navigationDestination(item: $folderToOpen) { folder in
            FolderLibraryView(folder: folder, store: store)
        }
        .sheet(item: $itemToMove) { item in
            MoveToFolderSheet(item: item, folders: store.folders) { destination in
                try await store.move(item, to: destination)
            }
        }
        .folderActions(store: store, editor: $folderEditor, folderToDelete: $folderToDelete)
        .task {
            await store.loadLibraryRoot()
        }
        .refreshable {
            await store.loadLibraryRoot()
        }
    }

    private var libraryList: some View {
        libraryItemsList
    }

    private let folderPreviewLimit = 3

    private var previewFolders: [Folder] {
        Array(store.folders.prefix(folderPreviewLimit))
    }

    private var libraryItemsList: some View {
        List {
            if !store.folders.isEmpty {
                Section {
                    ForEach(Array(previewFolders.enumerated()), id: \.element.id) { index, folder in
                        FolderListRow(folder: folder) {
                            folderToOpen = folder
                        } onRename: {
                            folderEditor = .rename(folder)
                        } onDelete: {
                            folderToDelete = folder
                        }
                        .listRowInsets(EdgeInsets(top: 0, leading: 30, bottom: 0, trailing: 30))
                        .listRowSeparator(.hidden)
                        .listRowBackground(
                            GroupedSectionRowBackground(
                                isFirst: index == 0,
                                isLast: index == previewFolders.count - 1,
                                separatorLeadingInset: 58
                            )
                        )
                    }
                } header: {
                    HStack(alignment: .firstTextBaseline) {
                        Text("Folders")

                        Spacer()

                        if store.folders.count > folderPreviewLimit {
                            NavigationLink {
                                AllFoldersView(store: store)
                            } label: {
                                Text("Show all (\(store.folders.count))")
                                    .font(.footnote.weight(.semibold))
                                    .textCase(nil)
                                    .foregroundStyle(Color.accentColor)
                            }
                        }
                    }
                }
            }

            if filter.isActive {
                Section {
                    ActiveLibraryFilters(filter: $filter)
                        .listRowInsets(EdgeInsets(top: 8, leading: 18, bottom: 8, trailing: 18))
                        .listRowBackground(Color.clear)
                        .listRowSeparator(.hidden)
                }
            }

            if let errorMessage = store.libraryErrorMessage {
                Section {
                    Text(errorMessage)
                        .font(.footnote)
                        .foregroundStyle(.red)
                }
                .listRowBackground(Color.clear)
            }

            if visibleItems.isEmpty {
                ContentUnavailableView(
                    filter.isActive ? "No Matching Items" : "Library is Empty",
                    systemImage: filter.isActive ? "line.3.horizontal.decrease.circle" : "books.vertical",
                    description: Text(filter.isActive ? "Try changing or clearing your filters." : "Items without a folder appear here.")
                )
                .listRowBackground(Color.clear)
                .listRowSeparator(.hidden)
            }

            if !visibleItems.isEmpty {
                Section {
                    ForEach(visibleItems) { item in
                        SavedItemRow(item: item) {
                            await store.markOpened(item)
                        } onToggleRead: {
                            await store.setRead(item, isRead: !item.isRead)
                        } onDelete: {
                            await store.delete(item)
                        } onMove: {
                            itemToMove = item
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
            }
        }
        .listStyle(.plain)
        .listSectionSpacing(16)
        .defaultScrollAnchor(.top)
        .scrollContentBackground(.hidden)
        .background(Color(uiColor: .systemBackground))
    }

    private var visibleItems: [SavedItem] {
        store.libraryRootItems
            .filter { item in
                (filter.tag == nil || item.tags.contains(filter.tag ?? ""))
                    && (filter.source == nil || item.sourceGroup == filter.source)
                    && (filter.type == nil || item.type == filter.type)
            }
            .sorted(using: sort)
    }

    private var tagFilters: [LibraryFilterOption] {
        countedOptions(store.libraryRootItems.flatMap(\.tags))
    }

    private var sourceFilters: [LibraryFilterOption] {
        countedOptions(store.libraryRootItems.compactMap(\.sourceGroup))
    }

    private var typeFilters: [LibraryFilterOption] {
        countedOptions(store.libraryRootItems.map(\.type))
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

@MainActor
private struct FolderLibraryView: View {
    let folder: Folder
    @ObservedObject var store: ReadingListStore
    @State private var filter = LibraryFilter()
    @State private var sort = LibrarySort.newest
    @State private var isShowingFilters = false
    @State private var itemToMove: SavedItem?

    var body: some View {
        List {
            if filter.isActive {
                ActiveLibraryFilters(filter: $filter)
                    .listRowInsets(EdgeInsets(top: 8, leading: 18, bottom: 8, trailing: 18))
                    .listRowBackground(Color.clear)
                    .listRowSeparator(.hidden)
            }

            if let errorMessage = store.libraryErrorMessage {
                Text(errorMessage)
                    .font(.footnote)
                    .foregroundStyle(.red)
                    .listRowBackground(Color.clear)
            }

            if visibleItems.isEmpty {
                ContentUnavailableView(
                    filter.isActive ? "No Matching Items" : "Folder is Empty",
                    systemImage: filter.isActive ? "line.3.horizontal.decrease.circle" : "folder",
                    description: Text(filter.isActive ? "Try changing or clearing your filters." : "Move saved items here from your Library.")
                )
                .listRowBackground(Color.clear)
                .listRowSeparator(.hidden)
            }

            ForEach(visibleItems) { item in
                SavedItemRow(item: item) {
                    await store.markOpened(item)
                } onToggleRead: {
                    await store.setRead(item, isRead: !item.isRead)
                } onDelete: {
                    await store.delete(item)
                } onMove: {
                    itemToMove = item
                }
                .swipeActions(edge: .leading, allowsFullSwipe: true) {
                    Button {
                        Task { await store.setRead(item, isRead: !item.isRead) }
                    } label: {
                        Label(item.isRead ? "Unread" : "Read", systemImage: item.isRead ? "circle" : "checkmark.circle")
                    }
                    .tint(item.isRead ? .orange : .green)
                }
                .swipeActions(edge: .trailing, allowsFullSwipe: true) {
                    Button(role: .destructive) {
                        Task { await store.delete(item) }
                    } label: {
                        Label("Delete", systemImage: "trash")
                    }
                }
                .listRowInsets(EdgeInsets(top: 0, leading: 18, bottom: 0, trailing: 18))
                .listRowBackground(Color.clear)
            }
        }
        .listStyle(.plain)
        .navigationTitle(folder.name)
        .navigationBarTitleDisplayMode(.large)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Menu {
                    Picker("Sort", selection: $sort) {
                        ForEach(LibrarySort.allCases) { sort in
                            Text(sort.title).tag(sort)
                        }
                    }
                    Button {
                        isShowingFilters = true
                    } label: {
                        Label("Filters", systemImage: "line.3.horizontal.decrease.circle")
                    }
                } label: {
                    Image(systemName: filter.isActive ? "line.3.horizontal.decrease.circle.fill" : "line.3.horizontal.decrease.circle")
                }
            }
        }
        .sheet(isPresented: $isShowingFilters) {
            LibraryFilterSheet(filter: $filter, tags: tagFilters, sources: sourceFilters, types: typeFilters)
        }
        .sheet(item: $itemToMove) { item in
            MoveToFolderSheet(item: item, folders: store.folders) { destination in
                try await store.move(item, to: destination)
            }
        }
        .task(id: folder.id) {
            await store.loadFolderItems(folder)
        }
        .refreshable {
            await store.loadFolderItems(folder)
        }
    }

    private var items: [SavedItem] { store.folderItems[folder.id] ?? [] }
    private var visibleItems: [SavedItem] {
        items.filter {
            (filter.tag == nil || $0.tags.contains(filter.tag ?? ""))
                && (filter.source == nil || $0.sourceGroup == filter.source)
                && (filter.type == nil || $0.type == filter.type)
        }
        .sorted(using: sort)
    }
    private var tagFilters: [LibraryFilterOption] { countedOptions(items.flatMap(\.tags)) }
    private var sourceFilters: [LibraryFilterOption] { countedOptions(items.compactMap(\.sourceGroup)) }
    private var typeFilters: [LibraryFilterOption] { countedOptions(items.map(\.type)) }

    private func countedOptions(_ values: [String]) -> [LibraryFilterOption] {
        let counts = values.reduce(into: [String: Int]()) { result, value in
            let value = value.trimmingCharacters(in: .whitespacesAndNewlines)
            if !value.isEmpty { result[value, default: 0] += 1 }
        }
        return counts.map { LibraryFilterOption(value: $0.key, count: $0.value) }
            .sorted { $0.value.localizedCaseInsensitiveCompare($1.value) == .orderedAscending }
    }
}

private struct GroupedSectionRowBackground: View {
    let isFirst: Bool
    let isLast: Bool
    var separatorLeadingInset: CGFloat = 0

    var body: some View {
        let radius: CGFloat = 12

        ZStack(alignment: .bottom) {
            UnevenRoundedRectangle(
                topLeadingRadius: isFirst ? radius : 0,
                bottomLeadingRadius: isLast ? radius : 0,
                bottomTrailingRadius: isLast ? radius : 0,
                topTrailingRadius: isFirst ? radius : 0,
                style: .continuous
            )
            .fill(Color(uiColor: .secondarySystemBackground))

            if !isLast {
                Rectangle()
                    .fill(Color.primary.opacity(0.08))
                    .frame(height: 0.5)
                    .padding(.leading, separatorLeadingInset)
            }
        }
        .padding(.horizontal, 16)
    }
}

private struct FolderRow: View {
    let folder: Folder

    var body: some View {
        HStack(spacing: 12) {
            FolderIcon(emoji: folder.emoji, color: FolderAccentColor(rawValue: folder.color ?? ""))
                .frame(width: 32, height: 30)

            Text(folder.name)
                .font(.system(size: 16, weight: .medium))
                .foregroundStyle(.primary)
                .lineLimit(1)

            Spacer(minLength: 8)

            Image(systemName: "chevron.forward")
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(.tertiary)
        }
        .contentShape(Rectangle())
        .padding(.vertical, 8)
    }
}

private struct FolderListRow: View {
    let folder: Folder
    let onOpen: @MainActor () -> Void
    let onRename: @MainActor () -> Void
    let onDelete: @MainActor () -> Void

    var body: some View {
        Button(action: onOpen) {
            FolderRow(folder: folder)
        }
        .buttonStyle(.plain)
        .contextMenu {
            Button(action: onRename) {
                Label("Rename", systemImage: "pencil")
            }

            Button(role: .destructive, action: onDelete) {
                Label("Delete", systemImage: "trash")
            }
        }
        .swipeActions(edge: .trailing, allowsFullSwipe: true) {
            Button(role: .destructive, action: onDelete) {
                Label("Delete", systemImage: "trash")
            }

            Button(action: onRename) {
                Label("Rename", systemImage: "pencil")
            }
            .tint(.blue)
        }
    }
}

private struct AllFoldersView: View {
    @ObservedObject var store: ReadingListStore
    @State private var folderEditor: FolderEditor?
    @State private var folderToDelete: Folder?
    @State private var folderToOpen: Folder?

    var body: some View {
        List {
            ForEach(store.folders) { folder in
                FolderListRow(folder: folder) {
                    folderToOpen = folder
                } onRename: {
                    folderEditor = .rename(folder)
                } onDelete: {
                    folderToDelete = folder
                }
                .listRowInsets(EdgeInsets(top: 0, leading: 18, bottom: 0, trailing: 18))
                .listRowBackground(Color.clear)
            }
        }
        .listStyle(.plain)
        .scrollContentBackground(.hidden)
        .background(Color(uiColor: .systemBackground))
        .navigationTitle("Folders")
        .navigationBarTitleDisplayMode(.large)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    folderEditor = .create
                } label: {
                    Image(systemName: "folder.badge.plus")
                }
                .accessibilityLabel("New Folder")
            }
        }
        .navigationDestination(item: $folderToOpen) { folder in
            FolderLibraryView(folder: folder, store: store)
        }
        .folderActions(store: store, editor: $folderEditor, folderToDelete: $folderToDelete)
        .refreshable {
            await store.loadLibraryRoot()
        }
    }
}

private struct FolderActionsModifier: ViewModifier {
    @ObservedObject var store: ReadingListStore
    @Binding var editor: FolderEditor?
    @Binding var folderToDelete: Folder?

    func body(content: Content) -> some View {
        content
            .sheet(item: $editor) { editor in
                FolderEditorSheet(editor: editor) { draft in
                    switch editor {
                    case .create:
                        try await store.createFolder(named: draft.name, emoji: draft.emoji, color: draft.color?.rawValue)
                    case .rename(let folder):
                        try await store.renameFolder(folder, to: draft.name, emoji: draft.emoji, color: draft.color?.rawValue)
                    }
                }
            }
            .alert(
                "Delete \(folderToDelete?.name ?? "Folder")?",
                isPresented: Binding(
                    get: { folderToDelete != nil },
                    set: { if !$0 { folderToDelete = nil } }
                ),
                presenting: folderToDelete
            ) { folder in
                Button("Cancel", role: .cancel) {}
                Button("Delete Folder", role: .destructive) {
                    Task {
                        do {
                            try await store.deleteFolder(folder)
                        } catch {
                            store.libraryErrorMessage = error.localizedDescription
                        }
                        folderToDelete = nil
                    }
                }
            } message: { _ in
                Text("Saved items in this folder are kept in your Library.")
            }
    }
}

private extension View {
    func folderActions(
        store: ReadingListStore,
        editor: Binding<FolderEditor?>,
        folderToDelete: Binding<Folder?>
    ) -> some View {
        modifier(FolderActionsModifier(store: store, editor: editor, folderToDelete: folderToDelete))
    }
}

private enum FolderEditor: Identifiable {
    case create
    case rename(Folder)

    var id: String {
        switch self {
        case .create: "create"
        case .rename(let folder): "rename-\(folder.id)"
        }
    }

    var title: String {
        switch self {
        case .create: "New Folder"
        case .rename: "Rename Folder"
        }
    }

    var initialName: String {
        switch self {
        case .create: ""
        case .rename(let folder): folder.name
        }
    }

    var initialEmoji: String? {
        switch self {
        case .create: nil
        case .rename(let folder): folder.emoji
        }
    }

    var initialColor: FolderAccentColor? {
        switch self {
        case .create: nil
        case .rename(let folder): FolderAccentColor(rawValue: folder.color ?? "")
        }
    }
}

private struct FolderEditorSheet: View {
    @Environment(\.dismiss) private var dismiss
    let editor: FolderEditor
    let onSave: @MainActor (FolderDraft) async throws -> Void
    @State private var name: String
    @State private var selectedEmoji: String?
    @State private var selectedColor: FolderAccentColor?
    @State private var errorMessage: String?
    @State private var isSaving = false

    init(editor: FolderEditor, onSave: @escaping @MainActor (FolderDraft) async throws -> Void) {
        self.editor = editor
        self.onSave = onSave
        _name = State(initialValue: editor.initialName)
        _selectedEmoji = State(initialValue: editor.initialEmoji)
        _selectedColor = State(initialValue: editor.initialColor)
    }

    var body: some View {
        FolderEditorDrawer(
            title: editor.title,
            isSaveDisabled: trimmedName.isEmpty || name.count > 80 || isSaving,
            onCancel: { dismiss() },
            onSave: save
        ) {
            VStack(spacing: 22) {
                FolderIcon(emoji: selectedEmoji, color: selectedColor)
                    .frame(width: 128, height: 104)
                    .padding(.top, 14)

                TextField("Folder name", text: $name)
                    .textInputAutocapitalization(.words)
                    .font(.body)
                    .padding(.horizontal, 14)
                    .frame(height: 48)
                    .frame(maxWidth: .infinity)
                    .background(
                        Color(uiColor: .secondarySystemBackground),
                        in: RoundedRectangle(cornerRadius: 12, style: .continuous)
                    )

                emojiPicker
                colorPicker

                if let errorMessage {
                    Text(errorMessage)
                        .font(.footnote)
                        .foregroundStyle(.red)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
        }
        .presentationDetents([.height(560), .large])
        .presentationDragIndicator(.visible)
        .presentationContentInteraction(.scrolls)
    }

    private var trimmedName: String {
        name.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private func save() {
        Task {
            isSaving = true
            defer { isSaving = false }
            do {
                try await onSave(FolderDraft(
                    name: trimmedName,
                    emoji: selectedEmoji,
                    color: selectedColor
                ))
                dismiss()
            } catch {
                errorMessage = error.localizedDescription
            }
        }
    }

    private var emojiPicker: some View {
        FolderPickerSection(title: "Emoji") {
            Text("Emoji")
                .font(.footnote.weight(.semibold))
                .foregroundStyle(.secondary)

            LazyVGrid(columns: Self.optionGridColumns, spacing: 10) {
                optionButton(isSelected: selectedEmoji == nil) {
                    Image(systemName: "nosign")
                        .font(.headline)
                        .foregroundStyle(.secondary)
                } action: {
                    selectedEmoji = nil
                }

                ForEach(Self.emojis, id: \.self) { emoji in
                    optionButton(isSelected: selectedEmoji == emoji) {
                        Text(emoji).font(.title3)
                    } action: {
                        selectedEmoji = emoji
                    }
                }
            }
        }
    }

    private var colorPicker: some View {
        FolderPickerSection(title: "Color") {
            Text("Color")
                .font(.footnote.weight(.semibold))
                .foregroundStyle(.secondary)

            LazyVGrid(columns: Self.optionGridColumns, spacing: 10) {
                optionButton(isSelected: selectedColor == nil) {
                    Image(systemName: "nosign")
                        .font(.headline)
                        .foregroundStyle(.secondary)
                } action: {
                    selectedColor = nil
                }

                ForEach(FolderAccentColor.allCases) { color in
                    Button {
                        selectedColor = color
                    } label: {
                        Circle()
                            .fill(color.tint.gradient)
                            .frame(width: 28, height: 28)
                            .frame(width: 44, height: 44)
                            .overlay {
                                if selectedColor == color {
                                    Circle()
                                        .stroke(color.tint, lineWidth: 2)
                                        .frame(width: 36, height: 36)
                                }
                            }
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(color.title)
                }
            }
        }
    }

    private static let optionGridColumns = [
        GridItem(.adaptive(minimum: 44, maximum: 48), spacing: 10)
    ]

    @ViewBuilder
    private func optionButton<Content: View>(
        isSelected: Bool,
        @ViewBuilder content: () -> Content,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            content()
                .frame(width: 44, height: 44)
                .background(
                    RoundedRectangle(cornerRadius: 10, style: .continuous)
                        .fill(isSelected ? Color.accentColor.opacity(0.14) : Color(uiColor: .secondarySystemBackground))
                )
                .overlay {
                    if isSelected {
                        RoundedRectangle(cornerRadius: 10, style: .continuous)
                            .stroke(Color.accentColor.opacity(0.45), lineWidth: 1)
                    }
                }
        }
        .buttonStyle(.plain)
    }

    private static let emojis = ["📚", "💼", "🎨", "💡", "✈️", "🏠", "❤️", "⭐️", "🎵", "🎬", "💻", "📦"]
}

private struct FolderEditorDrawer<Content: View>: View {
    let title: String
    let isSaveDisabled: Bool
    let onCancel: () -> Void
    let onSave: () -> Void
    @ViewBuilder let content: Content

    var body: some View {
        NavigationStack {
            ScrollView {
                content
                    .frame(maxWidth: .infinity)
                    .padding(.horizontal, 20)
                    .padding(.bottom, 28)
            }
            .scrollIndicators(.hidden)
            .scrollDismissesKeyboard(.interactively)
            .navigationTitle(title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel", action: onCancel)
                }

                ToolbarItem(placement: .confirmationAction) {
                    Button("Save", action: onSave)
                        .disabled(isSaveDisabled)
                }
            }
        }
    }
}

private struct FolderPickerSection<Content: View>: View {
    let title: String
    @ViewBuilder let content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            content
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .contain)
        .accessibilityLabel(title)
    }
}

private struct FolderDraft {
    let name: String
    let emoji: String?
    let color: FolderAccentColor?
}

private enum FolderAccentColor: String, CaseIterable, Identifiable {
    case blue
    case purple
    case pink
    case red
    case orange
    case yellow
    case green
    case teal

    var id: String { rawValue }
    var title: String { rawValue.capitalized }

    var tint: Color {
        switch self {
        case .blue: .blue
        case .purple: .purple
        case .pink: .pink
        case .red: .red
        case .orange: .orange
        case .yellow: .yellow
        case .green: .green
        case .teal: .teal
        }
    }
}

private struct FolderIcon: View {
    let emoji: String?
    let color: FolderAccentColor?

    var body: some View {
        GeometryReader { proxy in
            let size = min(proxy.size.width, proxy.size.height)

            ZStack {
                Image(systemName: "folder.fill")
                    .resizable()
                    .scaledToFit()
                    .foregroundStyle((color?.tint ?? .accentColor).gradient)

                if let emoji {
                    Text(emoji)
                        .font(.system(size: size * 0.35))
                        .offset(y: size * 0.09)
                }
            }
        }
        .accessibilityHidden(true)
    }
}

private struct MoveToFolderSheet: View {
    @Environment(\.dismiss) private var dismiss
    let item: SavedItem
    let folders: [Folder]
    let onMove: @MainActor (Folder?) async throws -> Void
    @State private var errorMessage: String?

    var body: some View {
        NavigationStack {
            List {
                if item.folder != nil {
                    destinationButton(title: "Library", systemImage: "books.vertical", folder: nil)
                }
                ForEach(folders.filter { $0.id != item.folder?.id }) { folder in
                    destinationButton(title: folder.name, systemImage: "folder", folder: folder)
                }
                if let errorMessage {
                    Text(errorMessage).font(.footnote).foregroundStyle(.red)
                }
            }
            .navigationTitle("Move to Folder")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
            }
        }
        .presentationDetents([.medium, .large])
    }

    private func destinationButton(title: String, systemImage: String, folder: Folder?) -> some View {
        Button {
            Task {
                do {
                    try await onMove(folder)
                    dismiss()
                } catch {
                    errorMessage = error.localizedDescription
                }
            }
        } label: {
            Label(title, systemImage: systemImage)
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
