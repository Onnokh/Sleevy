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
                        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
                }
            }
            .toolbar(.hidden, for: .navigationBar)
        }
    }

    private var signedOutView: some View {
        VStack(spacing: 0) {
            VStack(alignment: .leading, spacing: 20) {
                Text("Save now, read later.")
                    .font(.largeTitle.bold())

                Text("Sign in with Google to sync the links you save in Sleevy.")
                    .foregroundStyle(.secondary)

                Button {
                    Task {
                        await authStore.signInWithGoogle()
                    }
                } label: {
                    if authStore.isSigningIn {
                        ProgressView()
                            .frame(maxWidth: .infinity)
                    } else {
                        Text("Continue with Google")
                            .frame(maxWidth: .infinity)
                    }
                }
                .buttonStyle(.borderedProminent)
                .disabled(authStore.isSigningIn)

                if let errorMessage = authStore.errorMessage {
                    Text(errorMessage)
                        .font(.footnote)
                        .foregroundStyle(.red)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(24)
            .padding(.top, 12)

            Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
    }
}

private struct SignedInTabView: View {
    let session: AppSession
    @State private var selectedTab: SignedInTab = .sleevy
    @State private var sleevyPath: [SignedInRoute] = []
    @State private var libraryPath: [SignedInRoute] = []

    var body: some View {
        TabView(selection: selectedTabBinding) {
            Tab("Sleevy", systemImage: "bookmark", value: SignedInTab.sleevy) {
                NavigationStack(path: $sleevyPath) {
                    ReadingListView(session: session)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                        .accountToolbar(session: session) {
                            sleevyPath.append(.settings)
                        }
                        .navigationDestination(for: SignedInRoute.self) { route in
                            route.makeView()
                        }
                }
            }

            Tab("Library", systemImage: "books.vertical", value: SignedInTab.library) {
                NavigationStack(path: $libraryPath) {
                    LibraryView()
                        .accountToolbar(session: session) {
                            libraryPath.append(.settings)
                        }
                        .navigationDestination(for: SignedInRoute.self) { route in
                            route.makeView()
                        }
                }
            }

            Tab(value: SignedInTab.search, role: .search) {
                NavigationStack {
                    SearchView(session: session)
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
    func makeView() -> some View {
        switch self {
        case .settings:
            SettingsView()
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
                ToolbarItem(placement: .topBarTrailing) {
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
    @StateObject private var store: ReadingListStore
    @State private var query = ""

    init(session: AppSession) {
        _store = StateObject(wrappedValue: ReadingListStore(session: session))
    }

    var body: some View {
        Group {
            if store.isLoading && store.savedItems.isEmpty {
                ProgressView("Loading your Sleevy...")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if trimmedQuery.isEmpty {
                ContentUnavailableView(
                    "Search Sleevy",
                    systemImage: "magnifyingglass",
                    description: Text("Search saved titles, domains, topics, and links.")
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
    var body: some View {
        ContentUnavailableView(
            "Settings",
            systemImage: "gearshape",
            description: Text("Account and app preferences will appear here.")
        )
        .navigationTitle("Settings")
        .navigationBarTitleDisplayMode(.large)
    }
}

private struct LibraryView: View {
    var body: some View {
        ContentUnavailableView(
            "Library",
            systemImage: "books.vertical",
            description: Text("Saved reads you organize will appear here.")
        )
        .navigationTitle("Library")
        .navigationBarTitleDisplayMode(.large)
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
            topicOverride,
            topic,
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

#Preview {
    ContentView()
        .environmentObject(AuthStore())
}
