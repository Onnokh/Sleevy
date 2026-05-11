# Sleevy

Sleevy is the product name for a read-later app that saves web content from multiple entry points and returns to it with lightweight AI assistance.

## Language

**Saved Item**:
A user's saved relationship to a URL they may want to read, watch, or revisit later.
_Avoid_: Bookmark, pin, tab, article

**Link**:
A normalized web URL shared across Accounts for metadata and enrichment.
_Avoid_: Saved Item, user bookmark, per-account URL copy

**Link Metadata**:
Fetched descriptive data for a Link, such as title, image, favicon, canonical URL, and site name.
_Avoid_: AI enrichment, Saved Item metadata

**Link Enrichment**:
Generated or derived classification data for a Link, such as Type, Tag, Preview Summary, and Enrichment Status.
_Avoid_: Saved Item override, raw fetched metadata

**Read-Later App**:
A product centered on returning to captured content, with categorization and summarization as support features.
_Avoid_: Knowledge library, personal knowledge management system

**V1 Read-Later MVP**:
The first usable milestone that proves capture, enrichment, queue, library filters, and cross-client access.
_Avoid_: Production launch, public beta

**Sleevy**:
The product name for the V1 Read-Later MVP.

**Backend Core**:
The backend API project adapted from the existing bookmarks-core project.
_Avoid_: Separate core package, web app API routes as domain logic, throwaway prototype backend

**App Workspace**:
A runnable monorepo app under `apps/`, such as `apps/api`, `apps/web`, `apps/ios`, or `apps/chrome-extension`.
_Avoid_: Package for deployable app, nested repo

**API Contract**:
The versioned HTTP schema that keeps iOS, web, and API request and response shapes aligned.
_Avoid_: Informal JSON, client-specific DTOs

**Hand-Written DTOs**:
Client transport models written as native Codable structs aligned with the API Contract.
_Avoid_: Hand-copied JSON models, generated full client

**REST API**:
The resource-style HTTP API exposed by the backend for iOS, web, share extension, and automation clients.
_Avoid_: RPC API, client-specific endpoints

**Effect HttpApi**:
The Effect-native HTTP route and schema layer used by the API project.
_Avoid_: Express, Fastify, Hono

**Capture Endpoint**:
The REST API endpoint that accepts a URL and creates or updates a Saved Item.
_Avoid_: Create bookmark endpoint, import endpoint

**Capture Result**:
The response outcome from the Capture Endpoint, indicating whether a Saved Item was created or updated.
_Avoid_: Duplicate flag, import status

**Open Action**:
The REST API action that records a Saved Item as opened and therefore read.
_Avoid_: Manual read toggle, generic patch

**Native iOS App**:
The primary iPhone app for viewing the Reading Queue, browsing the Library, and supporting native capture.
_Avoid_: Mobile website, wrapper app

**SwiftUI App**:
The native iOS implementation approach for the app's main screens.
_Avoid_: Web view app, cross-platform wrapper

**Native Motion**:
Native iOS animation and visual polish, including room for Metal shader effects where appropriate.
_Avoid_: Web-style animation, required core workflow

**Enrichment Loading Motion**:
Tasteful native animation, potentially using Metal shaders, that indicates enrichment or loading without distracting from the list.
_Avoid_: Decorative spectacle, blocking progress

**Source**:
A named device or environment from which a user captures URLs, used as a recall cue for finding items later. Each Source belongs to one Account and is identified by its name within that Account. Clients detect the device name automatically; users may override it in settings.
_Avoid_: Capture Channel, integration, client type

**Capture Channel**:
A way a user sends a URL into the app. Stored as a closed enum on each Saved Item: `chrome-extension`, `ios-app`, `ios-share-extension`, `raycast`, `web-companion`, `api`.
_Avoid_: Integration, source, device

**Chrome Extension**:
A browser Capture Channel that saves the active tab URL with one click using a Capture Token.
_Avoid_: Browser plugin, Chrome plugin

**iOS Share Extension**:
The native iPhone Capture Channel exposed from the system share sheet.
_Avoid_: Shortcut workaround, mobile web form

**Manual URL Capture**:
A small UI Capture Channel where the user pastes a URL to save it.
_Avoid_: Bookmark form, editor

**Clipboard Capture**:
A one-button native iOS capture flow that previews a URL from the clipboard before saving, or opens empty Manual URL Capture when the clipboard does not contain a URL.
_Avoid_: Paste workflow, import screen, ingest form

**Clipboard URL Preview**:
A lightweight on-device preview shown before saving a clipboard URL.
_Avoid_: Enrichment preview, server preview, metadata fetch

**Capture Capsule**:
An inline native iOS capture surface that appears at the top of the Reading Queue without moving the app chrome.
_Avoid_: Bottom sheet, modal form, full-screen composer

**Pending Capture**:
A native iOS capture that is saved locally when the API is unavailable and synced later.
_Avoid_: Failed capture, offline-only item, draft

**Web Companion**:
The keyboard-driven desktop client for viewing, navigating, and managing Saved Items, with Manual URL Capture and Token Settings.
_Avoid_: API-hosted UI, passive feed, primary mobile client

**Command Palette**:
A transient modal launcher opened with Cmd+K that combines Saved Item search, page navigation, action commands, and URL capture in a flat grouped list.
_Avoid_: Search bar, settings menu, permanent panel

**Cached Viewing**:
Basic client-side retention of recently loaded Saved Metadata for viewing when connectivity is poor.
_Avoid_: Offline capture, sync queue

**One-Tap Capture**:
A capture experience that saves a URL without requiring categorization, notes, or other decisions first.
_Avoid_: Manual filing, import workflow

**Account**:
The authenticated owner of a private collection of Saved Items.
_Avoid_: Workspace, team, profile, multi-user tenant

**App Session**:
The authenticated session used by the human-facing app after Google login.
_Avoid_: API token, magic link, Sign in with Apple

**Prototype Auth**:
A temporary pre-production authentication approach used before paid Apple Developer Program setup is justified.
_Avoid_: Production auth, public login

**Capture Token**:
A personal token used by non-interactive Capture Channels to save URLs into an Account.
_Avoid_: Session, password, later integration

**Token Settings**:
A small web companion settings surface for creating and copying a Capture Token.
_Avoid_: Admin panel, developer portal

**Read-List Access**:
Permission for an automation client to retrieve Saved Items from an Account.
_Avoid_: Capture, public feed

**Enrichment**:
Post-capture processing that adds metadata such as title, content type, tag, or summary to a Link.
_Avoid_: Saving, ingest

**Hard Metadata**:
Deterministic metadata collected without AI, such as title, host, image URL, favicon, canonical URL, and Type.
_Avoid_: AI enrichment, manual categorization

**AI Enrichment**:
Server-side Enrichment that uses an AI provider to generate a Preview Summary and Tag.
_Avoid_: On-device AI, manual categorization

**Enrichment Job**:
An asynchronous backend task that performs Enrichment for a Link after capture.
_Avoid_: Save request, synchronous enrichment

**Enrichment Status**:
A coarse client-visible state: pending, enriched, or failed.
_Avoid_: Stage details, debug log

**Basic Link**:
A Link with only its Original URL and minimal capture metadata.
_Avoid_: Failed item, broken item

**Hydration**:
The client-side update where a newly saved item gains enriched metadata after initially appearing with minimal data, typically after refresh.
_Avoid_: Refresh, reload

**Type**:
A content kind assigned from hard rules, such as Video, Website, Article, or Repository, where Website is the fallback.
_Avoid_: Category, user tag, folder

**Type Icon**:
A small visual indicator for a Saved Item's Type.
_Avoid_: Type chip, row badge text

**Tag**:
A subject area from the closed v1 vocabulary: AI, Tools, TypeScript, Security, Design, Backend, or Front-end. A Link may have multiple Tags.
_Avoid_: Category, user tag, folder

**No Tag Filter**:
A Library filter that shows Saved Items without any Tags.
_Avoid_: None tag, generated tag value

**Reading Queue**:
The primary list of all Saved Items, ordered with the most recently saved item first.
_Avoid_: Library, dashboard, feed

**Library**:
A complete browsing surface for all Saved Items with filters such as category.
_Avoid_: Reading Queue, knowledge base

**V1 Library**:
A lightweight Library view that reuses Saved Item list UI with Type and Tag filters.
_Avoid_: Knowledge base, advanced search

**Queue Tab**:
The native iOS tab that shows the Reading Queue.
_Avoid_: Home, feed

**Library Tab**:
The native iOS tab that shows the V1 Library filters and list.
_Avoid_: Search tab, knowledge base

**Read State**:
Whether a Saved Item has been read or watched by the user.
_Avoid_: Status, completion

**Unread Dot**:
A small dot that indicates a Saved Item has not been opened yet.
_Avoid_: Badge, bold unread row

**Delete Action**:
A simple destructive action that removes a Saved Item from the Account.
_Avoid_: Archive, trash, hide

**Original URL**:
The URL captured for a Saved Item and opened when the user wants to consume it.
_Avoid_: Reader link, canonical link

**Normalized URL**:
The comparable form of an Original URL used to detect duplicate saves.
_Avoid_: Raw URL, display URL

**Duplicate Save**:
A capture of a URL whose Normalized URL already belongs to an existing Saved Item.
_Avoid_: Duplicate item, copy

**Saved Metadata**:
The retained descriptive data for a Link, such as title, image, summary, type, tag, and URL.
_Avoid_: Archived content, page copy

**Saved Item Override**:
A user-specific replacement for shared Link metadata in a Saved Item, such as a Tag Override.
_Avoid_: Shared metadata edit, generated tag

**Domain Subtitle**:
A small host/domain label shown under a Saved Item title.
_Avoid_: Full URL, breadcrumb

**External Image URL**:
An image URL discovered during enrichment and loaded directly by clients.
_Avoid_: Proxied image, cached asset

**Last Saved At**:
The timestamp of the most recent capture or Duplicate Save for a Saved Item.
_Avoid_: Updated at, created at

**Preview Summary**:
A short generated sentence that helps the user decide whether to open a Saved Item.
_Avoid_: Full summary, article replacement, abstract

**Stable Row Height**:
A consistent Saved Item row height that keeps scrolling smooth whether enrichment fields are present or missing.
_Avoid_: Variable-height feed

## Relationships

- A **Read-Later App** contains many **Saved Items**.
- A **Link** may be referenced by many **Saved Items** across Accounts.
- A **Saved Item** belongs to one **Account** and references one **Link**.
- A **Saved Item** optionally references one **Source**.
- A **Source** belongs to one **Account** and is unique by name within that Account.
- An **Account** may have many **Sources**.
- A **Source** is lazily registered by the API when a capture includes a `sourceName` not yet known for the Account.
- A **Link** has shared **Link Metadata** and **Link Enrichment**.
- The **V1 Read-Later MVP** includes native iOS, backend API, web companion, and shared API contract projects.
- The monorepo uses five **App Workspaces**: `apps/api`, `apps/web`, `apps/ios`, `apps/chrome-extension`, and `apps/raycast-plugin`.
- The backend API should be the **Backend Core**, adapted from bookmarks-core, rather than a separate core package plus API wrapper.
- The API uses Postgres through Drizzle for v1 deployment on a single VPS.
- The **API Contract** is generated from Effect route and schema definitions.
- The **REST API** is the client-facing shape of the **API Contract**.
- The API implements the **REST API** with **Effect HttpApi**.
- iOS uses **Hand-Written DTOs** with a hand-written API client.
- The public API and adapted backend domain use **Saved Item** terminology rather than bookmark terminology.
- The **Native iOS App** is a primary surface for the **Reading Queue** and **Library**.
- The **Native iOS App** is implemented as a **SwiftUI App** in v1.
- The **Native iOS App** should leave room for **Native Motion**, including Metal shader effects.
- **Enrichment Loading Motion** is the v1 use case for Metal shader effects.
- The **Web Companion** is the keyboard-driven desktop client for **Manual URL Capture**, **Token Settings**, and managing Saved Items with list navigation, single-key actions, and a **Command Palette**.
- V1 has one **Account** per Google email.
- Any Google email may create an **Account** in v1.
- An **Account** owns a private collection of **Saved Items**.
- An **App Session** authenticates the web app for an **Account**.
- **Prototype Auth** may be used before production **App Session** setup.
- A **Capture Token** authenticates non-interactive **Capture Channels** for an **Account**.
- **Capture Token** support is part of v1.
- A **Capture Token** starts as capture-only and does not grant **Read-List Access** in v1.
- Each **Account** has at most one **Capture Token** in v1.
- **Token Settings** creates, displays, and regenerates the **Capture Token** for an **Account** in the **Web Companion** only.
- A **Capture Token** can create **Saved Items** but cannot read the **Library**.
- A **Link** retains **Saved Metadata**, not the full original content.
- **Saved Metadata** is separated into **Link Metadata** and **Link Enrichment** so fetched page data and generated classification can evolve independently.
- A **Saved Item** retains user-specific state such as read state, last saved time, and overrides.
- Shared **Saved Metadata** should not be duplicated per **Account**.
- Saved Item list rows show title with a **Domain Subtitle**.
- **Saved Metadata** may include a **Preview Summary**.
- Saved Item list rows use **Stable Row Height**, showing **Preview Summary** when available without changing row rhythm.
- **Saved Metadata** may include an **External Image URL** loaded directly by iOS and web clients.
- Extracted page content may be used during **Enrichment** but is not persisted in v1.
- A **Link** may later receive AI-generated categorization and summarization.
- A **Saved Item** records which **Capture Channel** created it.
- A **Capture Channel** creates **Saved Items** through **One-Tap Capture**.
- The **Capture Endpoint** is exposed as `POST /v1/captures`.
- The **Capture Endpoint** returns the current **Saved Item** before asynchronous **Enrichment** finishes.
- The **Capture Endpoint** returns a **Capture Result** of created or updated.
- Capture is a behavior that creates or updates a **Saved Item**, not a separate persisted domain object in v1.
- The **iOS Share Extension** is the preferred iPhone **Capture Channel**.
- The **iOS Share Extension** saves into the signed-in **Account**.
- The **iOS Share Extension** saves and dismisses without capture-time filing UI.
- The **Chrome Extension** is a **Capture Channel** that saves the active tab URL.
- The **Chrome Extension** uses **One-Tap Capture** with no popup UI in the happy path.
- The **Chrome Extension** authenticates via a **Capture Token** configured in its options page.
- The **Chrome Extension** shows badge feedback for save results.
- The **Chrome Extension** redirects to its options page when no **Capture Token** is set.
- **Manual URL Capture** is a minimal paste-and-save UI in the web companion and native iOS app.
- **Clipboard Capture** is the preferred in-app **Manual URL Capture** entry point for the **Native iOS App**.
- **Clipboard Capture** shows a **Clipboard URL Preview** before saving a clipboard URL.
- **Clipboard Capture** requires explicit confirmation before saving a clipboard URL.
- **Clipboard Capture** opens empty **Manual URL Capture** when the clipboard does not contain a URL.
- **Clipboard URL Preview** is lightweight and on-device; backend **Enrichment** still happens only after capture.
- **Capture Capsule** is opened and closed by the same navigation action, which morphs between add and close states.
- **Capture Capsule** appears inline at the top of the **Reading Queue** and should not shift the navigation title, toolbar, or tab chrome.
- **Capture Capsule** uses one subtle editable URL field for both clipboard preview and manual entry.
- **Capture Capsule** follows the **Capture Endpoint** definition of a valid URL rather than introducing stricter client-only URL rules.
- **Capture Capsule** may disable saving for obviously empty or locally unparseable input, while the **Capture Endpoint** remains the final URL validation authority.
- **Capture Capsule** remains visible and locked while save confirmation is in flight.
- **Capture Capsule** collapses after successful capture and the Saved Item appears at the top of the **Reading Queue**.
- **Capture Capsule** keeps the entered URL visible with a compact inline error when capture fails.
- **Capture Capsule** creates a **Pending Capture** when the API is temporarily unavailable.
- The **iOS Share Extension** creates a **Pending Capture** when the API is temporarily unavailable.
- A **Pending Capture** appears in the **Reading Queue** until it syncs.
- **Pending Capture** sync uses the same native iOS behavior for **iOS Share Extension** and **Capture Capsule**.
- **Capture Capsule** collapses once a URL is accepted as a **Pending Capture**.
- A **Duplicate Save** moves the existing **Saved Item** to the top of the **Reading Queue**.
- A **Duplicate Save** does not create another **Saved Item**.
- A **Duplicate Save** sets the existing **Saved Item** to unread.
- A **Duplicate Save** updates the **Source** and **Capture Channel** to the latest capture.
- A **Duplicate Save** is detected per **Account** using **Normalized URL**.
- **Last Saved At** drives newest-first ordering for **Saved Items**.
- **Enrichment** happens after a **Saved Item** has already been saved.
- **Hard Metadata** may be collected during capture and does not require **AI Enrichment**.
- **AI Enrichment** is owned by the backend in v1.
- **Enrichment** runs through an **Enrichment Job**, not inside the save request.
- **Enrichment** is shared per **Link** rather than duplicated per **Account**.
- Clients see **Enrichment Status**, not detailed **Enrichment Job** stages.
- **Enrichment** may assign a **Type** and **Tag** to a **Link**.
- **Type** is assigned by hard rules in v1, not by **AI Enrichment**.
- **Tag** is chosen by **AI Enrichment** in v1 without hard-rule hints.
- **Type** is assigned with **Hard Metadata** during capture rather than waiting for an **Enrichment Job**.
- Saved Item list rows may show a calm **Type Icon** for the **Type**.
- A newly captured **Saved Item** appears immediately and later receives **Hydration** as **Enrichment** completes.
- If **Enrichment** fails, the **Saved Item** remains usable through a **Basic Link**.
- V1 UI does not show a visible error for failed **Enrichment Status**.
- A **Link** has at most one **Type**.
- A **Link** may have multiple **Tags** in v1.
- The API and persistence model should expose **Type** as a singular value and **Tags** as an array in v1.
- A **Link** always has a **Type** after capture.
- **Website** is the fallback **Type** when hard rules do not identify a more specific content kind.
- The v1 **Type** hard rules are intentionally simple: GitHub or GitLab URLs are Repository, YouTube, youtu.be, or Vimeo URLs are Video, URLs containing "blog" or "article" are Article, and everything else is Website.
- A **Link** may have no **Tag** when none is confidently extracted.
- A **Link** has no **Tag** when **AI Enrichment** is unavailable or disabled.
- **Tags** must come from a closed app-defined vocabulary in v1.
- The v1 **Tag** vocabulary is developer-oriented because the first Library use case is saving development-heavy material.
- The v1 **Tag** vocabulary is: AI, Tools, TypeScript, Security, Design, Backend, and Front-end.
- When multiple **Tags** could apply, **AI Enrichment** chooses all that match the user's likely retrieval intent.
- The **Reading Queue** presents all **Saved Items** in reverse capture order.
- The **Library** presents all **Saved Items** newest first with filtering and categorization controls.
- The **V1 Library** is a lightly different list view with **Type** and **Tag** filters.
- The **V1 Library** supports at most one active **Type** filter and one active **Tag** filter.
- The **V1 Library** may include a **No Tag Filter** for Saved Items without any **Tags**.
- V1 does not include manual assignment or editing of **Tag**.
- The **Native iOS App** has a **Queue Tab** and **Library Tab** in v1.
- V1 retrieval uses **V1 Library** filters rather than text search.
- The **Native iOS App** supports **Cached Viewing** and **Pending Capture** for native iOS capture flows in v1.
- V1 does not include reminders or push notifications.
- Each **Saved Item** has a **Read State**.
- **Unread Dot** is the v1 visual indicator for unread **Read State**.
- A **Saved Item** becomes read when the user opens it.
- Opening a **Saved Item** sends the user to its **Original URL** in the browser.
- Clients may open the known **Original URL** immediately while asynchronously notifying the API to update **Read State**.
- The **Open Action** is exposed as `POST /v1/saved-items/{id}/open`.
- A **Delete Action** removes a **Saved Item** without archive or trash behavior in v1.
- V1 has no Saved Item detail screen; list rows are the primary item surface.
- The **Command Palette** searches Saved Items by title and host, surfaces page navigation and action commands, and detects pasted URLs to offer capture.
- The **Command Palette** suppresses all global keyboard shortcuts while open and restores list selection state on close.
- The **Web Companion** uses app-level selection state in a root-level React context rather than DOM focus for keyboard list navigation.

## Flagged Ambiguities

These record the reasoning behind decisions that are not obvious from the definitions alone.

- `CapturedLink` from bookmarks-core should be removed for v1; resolved: capture does not need its own persisted domain record.
- iOS is the primary mobile client; the Web Companion is the primary desktop client with its own keyboard-first interaction model (see ADR 0010).
- The **Web Companion** should be separate from the API project; resolved: keep UI framework concerns out of the Effect backend.
- Defer Sign in with Apple until native distribution is production-worthy; use **Prototype Auth** during early validation.
- **Type** should not depend on AI in v1; resolved: use hard rules for type and AI only for tag and preview summary.
- **Tag** should not have a non-AI fallback in v1; resolved: no AI means no tag.
- "category" was too broad; resolved: use **Type** for content kind and **Tag** for subject area.
- AI should not invent arbitrary type or tag names per item; types and tags come from small app-defined fixed sets.
- "unknown" should not be a user-facing **Type**; resolved: use **Website** as the successful fallback instead.
- Tags are not user-managed preferences; resolved: changing the tag vocabulary is a product change.
- `generatedTags` as an array was considered but rejected for singular tag; resolved: use array `tags` after product decision.
- `generated_type` and `generated_tag` overstate implementation details in storage and API contracts; resolved: use `type` and `tags`.
- Enrichment should not be duplicated for every Account; resolved: shared **Link** records own enrichment metadata, while **Saved Items** own user-specific state and overrides.
- Newest-first ordering uses **Last Saved At**; resolved: metadata updates should not reshuffle the queue.
- **Source** is not a **Capture Channel**; resolved: Source is a device/environment recall cue (e.g. "Onno's iPhone"), Capture Channel is the mechanism (e.g. `ios-share-extension`). Both are stored on each Saved Item.
- **Source** is lazily registered via the capture endpoint, not eagerly; resolved: the API finds-or-creates a Source by name within the Account when a `sourceName` is provided.
- **Source** is deduplicated by name within an Account; resolved: reinstalls or re-setups reuse the existing Source if the auto-detected name matches.
- **Source** is nullable; resolved: old items and raw API captures without a source name have no Source.
