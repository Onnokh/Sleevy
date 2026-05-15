import Combine
import SwiftUI
import UIKit
import WebKit

struct ReadingListView: View {
    @ObservedObject var store: ReadingListStore
    @State private var currentTime = Date()
    @State private var isCaptureCapsuleOpen = false
    @State private var captureDraft = ""
    @State private var shouldFocusCaptureDraft = false
    @State private var isSavingCapture = false
    @State private var captureErrorMessage: String?
    @State private var isReadingListScrolled = false
    @State private var capturePlacement: CapturePlacement = .inlineRow

    private let statusRefreshTimer = Timer.publish(every: 30, on: .main, in: .common).autoconnect()

    var body: some View {
        Group {
            if store.isLoading && store.savedItems.isEmpty && store.pendingSavedItems.isEmpty {
                ProgressView("Loading your Sleevy...")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if unreadItems.isEmpty && store.pendingSavedItems.isEmpty && !isCaptureCapsuleOpen {
                ContentUnavailableView(
                    "All caught up",
                    systemImage: "checkmark.circle",
                    description: Text("Unread saves will appear here.")
                )
            } else {
                readingList
                .listStyle(.plain)
                .scrollContentBackground(.hidden)
                .background(Color(uiColor: .systemBackground))
                .refreshable {
                    await store.refresh()
                }
            }
        }
        .navigationTitle("Inbox")
        .navigationBarTitleDisplayMode(.large)
        .navigationStatusSubtitle(navigationSubtitleText)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    toggleCaptureCapsule()
                } label: {
                    Image(systemName: isCaptureCapsuleOpen ? "xmark" : "plus")
                        .contentTransition(.symbolEffect(.replace))
                }
                .disabled(isSavingCapture)
                .accessibilityLabel(isCaptureCapsuleOpen ? "Close Capture" : "Add Link")
            }
        }
        .onReceive(statusRefreshTimer) { tick in
            currentTime = tick
        }
        .task {
            await store.loadIfNeeded()
        }
    }

    private var readingList: some View {
        List {
            if isCaptureCapsuleOpen && capturePlacement == .inlineRow {
                Section {
                    captureCapsule
                        .listRowInsets(EdgeInsets(top: 10, leading: 18, bottom: 8, trailing: 18))
                        .listRowBackground(Color.clear)
                        .listRowSeparator(.hidden)
                        .transition(.move(edge: .top).combined(with: .opacity))
                }
            }

            if !store.pendingSavedItems.isEmpty {
                Section {
                    ForEach(store.pendingSavedItems) { item in
                        PendingSavedItemRow(item: item) {
                            store.removePendingSavedItem(item)
                        }
                        .swipeActions(edge: .trailing, allowsFullSwipe: true) {
                            Button(role: .destructive) {
                                store.removePendingSavedItem(item)
                            } label: {
                                Label("Remove", systemImage: "trash")
                            }
                        }
                        .listRowInsets(EdgeInsets(top: 0, leading: 18, bottom: 0, trailing: 18))
                        .listRowBackground(Color.clear)
                        .listRowSeparatorTint(.white.opacity(0.08))
                    }
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

            ForEach(unreadItems) { item in
                SavedItemRow(item: item, showsUnreadIndicator: false) {
                    await markOpened(item)
                } onToggleRead: {
                    await setRead(item, isRead: !item.isRead)
                } onDelete: {
                    await store.delete(item)
                }
                .swipeActions(edge: .leading, allowsFullSwipe: true) {
                    Button {
                        Task {
                            await setRead(item, isRead: !item.isRead)
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
        .safeAreaInset(edge: .top, spacing: 0) {
            if isCaptureCapsuleOpen && capturePlacement == .pinnedInset {
                captureCapsule
                .padding(.horizontal, 18)
                .padding(.top, 6)
                .padding(.bottom, 8)
                .background(.bar)
                .transition(.move(edge: .top).combined(with: .opacity))
            }
        }
        .onScrollGeometryChange(for: Bool.self) { geometry in
            geometry.contentOffset.y > 8
        } action: { _, isScrolled in
            isReadingListScrolled = isScrolled
        }
        .animation(.snappy(duration: 0.24), value: isCaptureCapsuleOpen)
        .animation(.snappy(duration: 0.24), value: store.pendingSavedItems)
        .animation(.snappy(duration: 0.24), value: store.savedItems)
    }

    private var unreadItems: [SavedItem] {
        store.savedItems.filter { !$0.isRead }
    }

    private func markOpened(_ item: SavedItem) async {
        withAnimation(.snappy(duration: 0.26)) {
            store.prepareForAnimatedReadStateChange(item)
        }

        await store.markOpened(item)
    }

    private func setRead(_ item: SavedItem, isRead: Bool) async {
        withAnimation(.snappy(duration: 0.26)) {
            store.prepareForAnimatedReadStateChange(item)
        }

        await store.setRead(item, isRead: isRead)
    }

    private var captureCapsule: some View {
        CaptureCapsuleRow(
            urlText: $captureDraft,
            shouldFocus: shouldFocusCaptureDraft,
            isSaving: isSavingCapture,
            errorMessage: captureErrorMessage
        ) {
            await saveCaptureDraft()
        }
    }

    private func toggleCaptureCapsule() {
        guard !isSavingCapture else { return }

        withAnimation(.snappy(duration: 0.24)) {
            isCaptureCapsuleOpen.toggle()
        }

        if isCaptureCapsuleOpen {
            capturePlacement = isReadingListScrolled ? .pinnedInset : .inlineRow
            let clipboardURL = Self.clipboardURLString()
            captureDraft = clipboardURL ?? ""
            shouldFocusCaptureDraft = clipboardURL == nil
            captureErrorMessage = nil
        } else {
            captureDraft = ""
            shouldFocusCaptureDraft = false
            captureErrorMessage = nil
        }
    }

    private func saveCaptureDraft() async {
        let submittedURL = captureDraft.trimmingCharacters(in: .whitespacesAndNewlines)
        guard Self.isLocallySubmittableURL(submittedURL), !isSavingCapture else { return }

        isSavingCapture = true
        captureErrorMessage = nil
        defer { isSavingCapture = false }

        do {
            _ = try await store.capture(submittedURL)
            UINotificationFeedbackGenerator().notificationOccurred(.success)
            closeCaptureCapsule()
        } catch {
            UINotificationFeedbackGenerator().notificationOccurred(.error)
            captureErrorMessage = error.localizedDescription
        }
    }

    private func closeCaptureCapsule() {
        withAnimation(.snappy(duration: 0.24)) {
            isCaptureCapsuleOpen = false
        }
        captureDraft = ""
        shouldFocusCaptureDraft = false
        captureErrorMessage = nil
    }

    private var navigationSubtitleText: String? {
        if !store.isOnline { return "Offline" }
        if !store.isAPIReachable { return "Error reaching API" }
        if !unreadItems.isEmpty {
            return "\(unreadItems.count) unread"
        }

        guard let lastSync = store.lastSuccessfulSyncAt else { return nil }
        return currentTime.timeIntervalSince(lastSync) < 300 ? "Recently updated" : nil
    }

    private static func clipboardURLString() -> String? {
        if let url = UIPasteboard.general.url {
            return url.absoluteString
        }

        guard let text = UIPasteboard.general.string?.trimmingCharacters(in: .whitespacesAndNewlines),
              isLocallySubmittableURL(text)
        else {
            return nil
        }

        return text
    }

    private static func isLocallySubmittableURL(_ value: String) -> Bool {
        guard !value.isEmpty,
              let url = URL(string: value),
              url.scheme?.isEmpty == false
        else {
            return false
        }

        return true
    }
}

private enum CapturePlacement {
    case inlineRow
    case pinnedInset
}

private extension View {
    @ViewBuilder
    func navigationStatusSubtitle(_ subtitle: String?) -> some View {
        if let subtitle {
            navigationSubtitle(subtitle)
        } else {
            self
        }
    }
}

private struct CaptureCapsuleRow: View {
    @Binding var urlText: String
    let shouldFocus: Bool
    let isSaving: Bool
    let errorMessage: String?
    let onSave: () async -> Void

    @FocusState private var isURLFieldFocused: Bool

    private var canSave: Bool {
        let trimmed = urlText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty,
              let url = URL(string: trimmed),
              url.scheme?.isEmpty == false
        else {
            return false
        }

        return true
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 10) {
                Image(systemName: "link")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(.secondary)
                    .frame(width: 20, height: 20)

                TextField("Paste or type URL", text: $urlText)
                    .focused($isURLFieldFocused)
                    .keyboardType(.URL)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .submitLabel(.done)
                    .disabled(isSaving)
                    .font(.system(size: 15, weight: .medium))
                    .lineLimit(1)
                    .onSubmit {
                        guard canSave else { return }
                        Task {
                            await onSave()
                        }
                    }

                Button {
                    Task {
                        await onSave()
                    }
                } label: {
                    if isSaving {
                        ProgressView()
                            .controlSize(.small)
                            .frame(width: 38, height: 24)
                    } else {
                        Text("Save")
                            .font(.system(size: 14, weight: .semibold))
                            .frame(minWidth: 38, minHeight: 24)
                    }
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.small)
                .disabled(!canSave || isSaving)
            }

            if let errorMessage {
                Text(errorMessage)
                    .font(.footnote)
                    .foregroundStyle(.red)
                    .fixedSize(horizontal: false, vertical: true)
                    .transition(.opacity)
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .background(Color(uiColor: .secondarySystemBackground), in: Capsule())
        .overlay {
            Capsule()
                .stroke(Color.secondary.opacity(0.16), lineWidth: 1)
        }
        .task {
            guard shouldFocus else { return }
            isURLFieldFocused = true
        }
    }
}

private struct PendingSavedItemRow: View {
    let item: PendingSavedItem
    let onDelete: () -> Void

    var body: some View {
        Button {
            guard let url = item.url else { return }
            UIApplication.shared.open(url)
        } label: {
            HStack(alignment: .top, spacing: 12) {
                PendingSavedItemStatusIndicator()
                    .padding(.top, 12)

                PendingSavedItemMonogram(host: item.host)

                VStack(alignment: .leading, spacing: 6) {
                    Text(item.title)
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                        .multilineTextAlignment(.leading)

                    Text(item.host)
                        .font(.system(size: 12, weight: .medium))
                        .foregroundStyle(.tertiary)
                }
                .frame(maxWidth: .infinity, alignment: .leading)

                Text(item.queuedDateLabel)
                    .font(.system(size: 14, weight: .medium))
                    .foregroundStyle(.secondary)
                    .monospacedDigit()
                    .padding(.top, 2)
            }
            .contentShape(Rectangle())
            .padding(.vertical, 14)
        }
        .buttonStyle(.plain)
        .contextMenu {
            if let url = item.url {
                Button {
                    UIPasteboard.general.url = url
                } label: {
                    Label("Copy Link", systemImage: "doc.on.doc")
                }

                ShareLink(
                    item: url,
                    preview: SharePreview(item.title)
                ) {
                    Label("Share", systemImage: "square.and.arrow.up")
                }

                Divider()
            }

            Button(role: .destructive) {
                onDelete()
            } label: {
                Label("Remove", systemImage: "trash")
            }
        }
    }
}

private struct PendingSavedItemStatusIndicator: View {
    var body: some View {
        Image(systemName: "tray.and.arrow.up")
            .font(.system(size: 11, weight: .semibold))
            .foregroundStyle(.secondary)
            .frame(width: 10, height: 10)
    }
}

private struct PendingSavedItemMonogram: View {
    let host: String

    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 11, style: .continuous)
                .fill(Color(uiColor: .secondarySystemFill))

            Text(String(host.prefix(1)).uppercased())
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(.secondary)
        }
        .frame(width: 42, height: 42)
        .padding(.vertical, 4)
    }
}

struct SavedItemRow: View {
    let item: SavedItem
    var showsUnreadIndicator = true
    let onOpen: () async -> Void
    let onToggleRead: () async -> Void
    let onDelete: () async -> Void

    var body: some View {
        Button {
            Task {
                await onOpen()
            }
        } label: {
            HStack(alignment: .top, spacing: 12) {
                SavedItemFavicon(item: item)

                VStack(alignment: .leading, spacing: 6) {
                    Text(item.displayTitle)
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(.primary)
                        .lineLimit(1)
                        .multilineTextAlignment(.leading)

                    Text(item.displayDomain)
                        .font(.system(size: 12, weight: .medium))
                        .foregroundStyle(.secondary)
                }
                .frame(maxWidth: .infinity, alignment: .leading)

                HStack(spacing: 7) {
                    if showsUnreadIndicator && !item.isRead {
                        Circle()
                            .fill(Color.secondary.opacity(0.55))
                            .frame(width: 7, height: 7)
                    }

                    Text(item.createdDateLabel)
                        .font(.system(size: 14, weight: .medium))
                        .foregroundStyle(.secondary)
                        .monospacedDigit()
                }
                .padding(.top, 2)
            }
            .contentShape(Rectangle())
            .padding(.vertical, 14)
        }
        .buttonStyle(.plain)
        .contextMenu {
            Button {
                Task {
                    await onToggleRead()
                }
            } label: {
                Label(
                    item.isRead ? "Mark Unread" : "Mark Read",
                    systemImage: item.isRead ? "circle" : "checkmark.circle"
                )
            }

            if let shareURL = item.shareURL {
                Button {
                    copyLink(shareURL)
                } label: {
                    Label("Copy Link", systemImage: "doc.on.doc")
                }

                ShareLink(
                    item: shareURL,
                    preview: SharePreview(item.displayTitle)
                ) {
                    Label("Share", systemImage: "square.and.arrow.up")
                }

                Divider()
            }

            Button(role: .destructive) {
                Task {
                    await onDelete()
                }
            } label: {
                Label("Delete", systemImage: "trash")
            }
        }
        .accessibilityAction(named: "Copy Link") {
            guard let shareURL = item.shareURL else { return }
            copyLink(shareURL)
        }
    }

    private func copyLink(_ url: URL) {
        UIPasteboard.general.url = url
        UINotificationFeedbackGenerator().notificationOccurred(.success)
        UIAccessibility.post(notification: .announcement, argument: "Link copied")
    }
}

struct AccountAvatarButton: View {
    let name: String
    let imageURL: URL?

    var body: some View {
        Group {
            if let imageURL {
                RemoteRasterImage(url: imageURL) { image in
                    image
                        .resizable()
                        .scaledToFill()
                } fallback: {
                    fallbackAvatar
                }
            } else {
                fallbackAvatar
            }
        }
        .frame(width: 30, height: 30)
        .clipShape(Circle())
    }

    private var fallbackAvatar: some View {
        ZStack {
            Circle()
                .fill(Color(uiColor: .secondarySystemFill))

            Text(name.initials)
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(.primary)
        }
    }
}

private struct SavedItemFavicon: View {
    @Environment(\.colorScheme) private var colorScheme
    let item: SavedItem

    var body: some View {
        Group {
            if let faviconURL = item.preferredFaviconURL(colorScheme: colorScheme) {
                if faviconURL.isSVG {
                    SVGRemoteImage(url: faviconURL, colorScheme: colorScheme) {
                        faviconFallback
                    }
                } else {
                    RemoteRasterImage(url: faviconURL) { image in
                        image
                            .resizable()
                            .scaledToFit()
                    } fallback: {
                        faviconFallback
                    }
                }
            } else {
                faviconFallback
            }
        }
        .frame(width: 30, height: 30)
        .padding(.vertical, 4)
    }

    private var faviconFallback: some View {
        Text(item.monogram)
            .font(.system(size: 16, weight: .semibold, design: .rounded))
            .foregroundStyle(.secondary)
    }
}

private struct RemoteRasterImage<Content: View, Fallback: View>: View {
    let url: URL
    let content: (Image) -> Content
    let fallback: () -> Fallback

    @StateObject private var loader: RemoteRasterImageLoader

    init(
        url: URL,
        @ViewBuilder content: @escaping (Image) -> Content,
        @ViewBuilder fallback: @escaping () -> Fallback
    ) {
        self.url = url
        self.content = content
        self.fallback = fallback
        _loader = StateObject(wrappedValue: RemoteRasterImageLoader(url: url))
    }

    var body: some View {
        Group {
            if let image = loader.image {
                content(Image(uiImage: image))
            } else {
                fallback()
            }
        }
        .task {
            await loader.loadIfNeeded()
        }
        .id(url.absoluteString)
    }
}

@MainActor
private final class RemoteRasterImageLoader: ObservableObject {
    @Published private(set) var image: UIImage?

    private let url: URL
    private var hasStarted = false

    private static let cache = NSCache<NSURL, UIImage>()

    init(url: URL) {
        self.url = url
    }

    func loadIfNeeded() async {
        guard !hasStarted else { return }
        hasStarted = true

        let cacheKey = url as NSURL
        if let cached = Self.cache.object(forKey: cacheKey) {
            image = cached
            return
        }

        do {
            let data = try await RemoteImageDiskCache.shared.data(for: url)
            guard let loadedImage = UIImage(data: data) else { return }
            Self.cache.setObject(loadedImage, forKey: cacheKey)
            image = loadedImage
        } catch {
            return
        }
    }
}

private struct SVGRemoteImage<Fallback: View>: View {
    let url: URL
    let colorScheme: ColorScheme
    let fallback: () -> Fallback

    @StateObject private var loader: SVGSnapshotLoader

    init(
        url: URL,
        colorScheme: ColorScheme,
        @ViewBuilder fallback: @escaping () -> Fallback
    ) {
        self.url = url
        self.colorScheme = colorScheme
        self.fallback = fallback
        _loader = StateObject(
            wrappedValue: SVGSnapshotLoader(url: url, size: 30, colorScheme: colorScheme)
        )
    }

    var body: some View {
        Group {
            if let image = loader.image {
                Image(uiImage: image)
                    .resizable()
                    .scaledToFit()
            } else {
                fallback()
            }
        }
        .task {
            await loader.loadIfNeeded()
        }
        .id("\(url.absoluteString)|\(colorScheme.cacheKey)")
    }
}

@MainActor
private final class SVGSnapshotLoader: ObservableObject {
    @Published private(set) var image: UIImage?

    private let url: URL
    private let size: CGFloat
    private let colorScheme: ColorScheme
    private var hasStarted = false

    private static let cache = NSCache<NSString, UIImage>()

    init(url: URL, size: CGFloat, colorScheme: ColorScheme) {
        self.url = url
        self.size = size
        self.colorScheme = colorScheme
    }

    func loadIfNeeded() async {
        guard !hasStarted else { return }
        hasStarted = true

        let cacheKey = "\(url.absoluteString)|\(Int(size))|\(colorScheme.cacheKey)" as NSString
        if let cached = Self.cache.object(forKey: cacheKey) {
            image = cached
            return
        }

        do {
            let data = try await RemoteImageDiskCache.shared.data(for: url)
            let renderedImage = try await Self.renderSVG(
                data: data,
                size: size,
                colorScheme: colorScheme
            )
            Self.cache.setObject(renderedImage, forKey: cacheKey)
            image = renderedImage
        } catch {
            return
        }
    }

    private static func renderSVG(
        data: Data,
        size: CGFloat,
        colorScheme: ColorScheme
    ) async throws -> UIImage {
        let webView = WKWebView(frame: CGRect(x: 0, y: 0, width: size, height: size))
        webView.isOpaque = false
        webView.backgroundColor = .clear
        webView.scrollView.backgroundColor = .clear
        webView.scrollView.isScrollEnabled = false
        if colorScheme == .dark {
            webView.overrideUserInterfaceStyle = .dark
        } else {
            webView.overrideUserInterfaceStyle = .light
        }

        let cssColorScheme = colorScheme == .dark ? "dark" : "light"

        let html = """
        <!doctype html>
        <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <meta name="color-scheme" content="light dark">
          <style>
            :root {
              color-scheme: \(cssColorScheme);
            }
            html, body {
              margin: 0;
              padding: 0;
              width: \(size)px;
              height: \(size)px;
              background: transparent;
              overflow: hidden;
              color-scheme: \(cssColorScheme);
            }
            body {
              display: flex;
              align-items: center;
              justify-content: center;
            }
            img {
              width: \(size)px;
              height: \(size)px;
              object-fit: contain;
              display: block;
            }
          </style>
        </head>
        <body>
          <img alt="" src="data:image/svg+xml;base64,\(data.base64EncodedString())">
        </body>
        </html>
        """

        let navigationDelegate = SVGNavigationDelegate()
        webView.navigationDelegate = navigationDelegate

        try await navigationDelegate.loadHTML(html, in: webView)

        let configuration = WKSnapshotConfiguration()
        configuration.afterScreenUpdates = true
        configuration.snapshotWidth = NSNumber(value: Double(size))

        return try await withCheckedThrowingContinuation { continuation in
            webView.takeSnapshot(with: configuration) { image, error in
                if let image {
                    continuation.resume(returning: image)
                } else {
                    continuation.resume(throwing: error ?? SVGSnapshotError.snapshotFailed)
                }
            }
        }
    }
}

private final class SVGNavigationDelegate: NSObject, WKNavigationDelegate {
    private var continuation: CheckedContinuation<Void, Error>?

    func loadHTML(_ html: String, in webView: WKWebView) async throws {
        try await withCheckedThrowingContinuation { continuation in
            self.continuation = continuation
            webView.loadHTMLString(html, baseURL: nil)
        }
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        continuation?.resume(returning: ())
        continuation = nil
    }

    func webView(
        _ webView: WKWebView,
        didFail navigation: WKNavigation!,
        withError error: Error
    ) {
        continuation?.resume(throwing: error)
        continuation = nil
    }

    func webView(
        _ webView: WKWebView,
        didFailProvisionalNavigation navigation: WKNavigation!,
        withError error: Error
    ) {
        continuation?.resume(throwing: error)
        continuation = nil
    }
}

private enum SVGSnapshotError: Error {
    case snapshotFailed
}

private extension SavedItem {
    var shareURL: URL? {
        Self.safeRemoteURL(canonicalURL)
            ?? Self.safeRemoteURL(originalURL)
    }

    var displayTitle: String {
        title?.trimmingCharacters(in: .whitespacesAndNewlines).nonEmpty
            ?? siteName?.trimmingCharacters(in: .whitespacesAndNewlines).nonEmpty
            ?? displayDomain
    }

    var displayDomain: String {
        host.replacingOccurrences(
            of: #"^www\."#,
            with: "",
            options: .regularExpression
        )
    }

    var createdDateLabel: String {
        let interval = max(0, Date().timeIntervalSince(lastSavedAt))
        let minutes = Int(interval / 60)

        if minutes < 1 {
            return "now"
        }

        if minutes < 60 {
            return "\(minutes)m"
        }

        let hours = Int(interval / 3_600)
        if hours < 24 {
            return "\(hours)h"
        }

        return Calendar.current.isDate(lastSavedAt, equalTo: Date(), toGranularity: .year)
            ? Self.sameYearDateFormatter.string(from: lastSavedAt)
            : Self.crossYearDateFormatter.string(from: lastSavedAt)
    }

    var googleFaviconURL: URL? {
        var components = URLComponents(string: "https://t2.gstatic.com/faviconV2")
        components?.queryItems = [
            URLQueryItem(name: "client", value: "SOCIAL"),
            URLQueryItem(name: "type", value: "FAVICON"),
            URLQueryItem(name: "fallback_opts", value: "TYPE,SIZE,URL"),
            URLQueryItem(name: "url", value: "http://\(displayDomain)"),
            URLQueryItem(name: "size", value: "64"),
        ]
        return components?.url
    }

    func preferredFaviconURL(colorScheme: ColorScheme) -> URL? {
        let themeSpecificURLString = switch colorScheme {
        case .dark:
            faviconDarkURL ?? faviconURL ?? faviconLightURL
        default:
            faviconLightURL ?? faviconURL ?? faviconDarkURL
        }

        if let themeSpecificURL = Self.safeRemoteURL(themeSpecificURLString) {
            return themeSpecificURL
        }

        return Self.safeRemoteURL(faviconURL) ?? googleFaviconURL
    }

    var monogram: String {
        String(displayDomain.prefix(1)).uppercased()
    }

    private static let sameYearDateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.setLocalizedDateFormatFromTemplate("MMM d")
        return formatter
    }()

    private static let crossYearDateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.setLocalizedDateFormatFromTemplate("MMM d yyyy")
        return formatter
    }()

    private static func safeRemoteURL(_ value: String?) -> URL? {
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

private extension PendingSavedItem {
    var queuedDateLabel: String {
        Self.queuedDateFormatter.string(from: queuedAt)
    }

    private static let queuedDateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.setLocalizedDateFormatFromTemplate("d MMM")
        return formatter
    }()
}

private extension String {
    var nonEmpty: String? {
        isEmpty ? nil : self
    }

    var initials: String {
        let components = split(whereSeparator: \.isWhitespace)
            .prefix(2)
            .compactMap { $0.first.map(String.init) }

        if components.isEmpty {
            return String(prefix(1)).uppercased()
        }

        return components.joined().uppercased()
    }
}

private extension URL {
    var isSVG: Bool {
        pathExtension.caseInsensitiveCompare("svg") == .orderedSame
    }
}

private extension ColorScheme {
    var cacheKey: String {
        switch self {
        case .dark:
            return "dark"
        default:
            return "light"
        }
    }
}
