# Folder Organization Implementation Guide

This document turns [ADR 0014](../adr/0014-folder-organization-and-api-scopes.md) into an implementation plan for the API, Web Companion, and Native iOS App. Implement the complete API and shared contract first, then ship web and iOS consumers one at a time against that stable API.

## Product Contract

- A **Folder** is a user-created flat Library destination, separate from Tags.
- Each Saved Item belongs to zero or one Folder.
- The Library root displays Saved Items without a Folder; it is not labeled `No Folder` in product UI.
- A Folder View displays both read and unread Saved Items.
- Folder Views support existing Type and Tag filtering behavior.
- Global retrieval remains global: the web Command Palette and iOS Search Tab search across filed and unfiled items.
- Ordinary first-party one-tap capture does not ask for a Folder.
- Moving one Saved Item at a time is in scope; bulk filing is deferred.

## Delivery Order

1. API, shared contract, and persistence.
2. Web Companion.
3. Native iOS App.

Do not start a consumer against an incomplete folder API. Existing clients must remain operational while newer consumers begin using folder fields and endpoints.

## API Contract

### Data Shapes

Add a lightweight Folder shape to `@sleevy/contract`:

```ts
type FolderDto = {
  readonly id: string
  readonly name: string
}
```

Every Saved Item response must include a nullable Folder summary:

```ts
type SavedItemDto = {
  // existing fields
  readonly folder: FolderDto | null
}
```

Examples:

```json
{ "folder": { "id": "folder-id", "name": "Merge Requests" } }
```

```json
{ "folder": null }
```

Add Folder request/response schemas:

```ts
type FolderNamePayload = { readonly name: string }
type FolderAssignmentPayload = { readonly folderId: string | null }
type FoldersResponse = { readonly folders: readonly FolderDto[] }
```

Extend capture payload on the wire:

```ts
type CapturePayload = {
  // existing fields
  readonly folderId?: string | null
}
```

Although `folderId` is optional for old clients, its capture semantics are:

| Payload state | Created Saved Item | Duplicate Save |
| --- | --- | --- |
| `folderId: "id"` | Assign to Folder | Move to Folder |
| `folderId: null` | No Folder | Move to Library root |
| omitted | No Folder | Move to Library root |

Extend Saved Item list query:

```ts
type SavedItemsQuery = {
  readonly sort?: SavedItemSort
  readonly folder?: string // Folder id or "none"
}
```

Query behavior:

| Request | Result |
| --- | --- |
| `GET /v1/saved-items` | All Saved Items, for global retrieval and current compatibility |
| `GET /v1/saved-items?folder=none` | Library root items only |
| `GET /v1/saved-items?folder={id}` | Items in one Folder View only |

### Endpoints

Add these endpoints:

| Endpoint | Scope for API keys | Purpose |
| --- | --- | --- |
| `GET /v1/folders` | `folders:read` | List Folder `id` and `name`, alphabetical |
| `POST /v1/folders` | `folders:write` | Create a Folder |
| `PATCH /v1/folders/{id}` | `folders:write` | Rename a Folder |
| `DELETE /v1/folders/{id}` | `folders:delete` | Delete a Folder; Saved Items become unfiled |
| `PUT /v1/saved-items/{id}/folder` | `saved-items:write` | Replace Folder membership with `folderId` or `null` |

Existing endpoints change additively:

| Endpoint | Change |
| --- | --- |
| `POST /v1/captures` | Accept optional `folderId`; `saved-items:capture` is sufficient to use a known ID |
| `GET /v1/saved-items` | Accept optional `folder`; return nullable `folder` summary |
| Existing Saved Item mutation responses | Return nullable `folder` summary |

App Sessions are accepted by the same REST endpoints and are not limited by API Key scopes under the existing authentication model.

### Errors

Add typed errors to the shared contract and Effect HttpApi definition:

| Error | Status | Used for |
| --- | --- | --- |
| `InvalidFolderNameError` | `400` | Trimmed name is empty or exceeds 80 characters |
| `FolderNotFoundError` | `404` | Folder is absent or belongs to another Account |
| `FolderNameConflictError` | `409` | Normalized name conflicts on create or rename |

Use `FolderNotFoundError` consistently for folder CRUD, `PUT` assignment, capture assignment, and `GET /v1/saved-items?folder={id}`. Do not disclose whether an inaccessible Folder exists in another Account.

### Scopes

Extend `V1_SCOPES`:

```ts
"folders:read"
"folders:write"
"folders:delete"
```

Authorization rules:

| Operation | Required API Key Scope |
| --- | --- |
| List Folder destinations | `folders:read` |
| Create or rename Folder records | `folders:write` |
| Delete Folder records | `folders:delete` |
| Assign Folder during capture | `saved-items:capture` only |
| Move an existing Saved Item | `saved-items:write` only |

Do not require `folders:read` to assign a known Folder ID. Do not silently grant new folder scopes to existing connected clients unless their product behavior needs them.

## Persistence

### Tables

Add `folders`:

```text
folders
  id          text primary key
  user_id     text not null references user(id) on delete cascade
  name        text not null
  created_at  timestamptz not null default now()
  updated_at  timestamptz not null default now()
```

Add to `saved_items`:

```text
folder_id text null references folders(id) on delete set null
```

### Constraints And Indexes

- Trim Folder names before persistence.
- Reject blank names and names longer than 80 characters in the service/API validation layer.
- Preserve user-facing casing in `folders.name`.
- Enforce Account-unique case-insensitive names using a unique expression index on `(user_id, lower(name))`.
- Index `saved_items.folder_id` with `user_id` for Folder View reads.
- Keep `folder_id` nullable; deleting a Folder relies on `ON DELETE SET NULL`.

### Domain And Repository Shape

Add `FolderId` and `Folder` domain types. Extend `SavedItem` with optional internal `folderId`, and extend `SavedItemWithLink` with optional joined `folder`.

Recommended API modules:

```text
apps/api/src/modules/folders/FolderRepository.ts
apps/api/src/api/FoldersHandlers.ts
```

Extend existing modules:

| File | Change |
| --- | --- |
| `apps/api/src/modules/persistence/schema.ts` | Folder table, `folderId`, relations, indexes |
| `apps/api/src/domain/SavedItem.ts` | Folder domain types and Saved Item membership |
| `apps/api/src/modules/saved-items/SavedItemRepository.ts` | Join Folder, list by folder selector, set membership |
| `apps/api/src/modules/saved-items/SavedItemIntake.ts` | Validate and apply capture Folder destination |
| `apps/api/src/api/ApiContract.ts` | DTO mapping, errors, endpoints, query schemas |
| `apps/api/src/api/ApiHandlers.ts` | Register Folder handlers |
| `apps/api/src/runtime/AppLayer.ts` | Provide Folder repository |
| `apps/api/src/modules/auth/Scopes.ts` | New Folder scopes |
| `apps/api/src/modules/connect/ConnectClients.ts` | Grant scopes only to clients that actually request folder capabilities |

### Database Migration

Generate one Drizzle migration for the API phase. It must:

1. Create `folders`.
2. Create the case-insensitive unique Folder name index.
3. Add nullable `saved_items.folder_id`.
4. Add its foreign key with `ON DELETE SET NULL`.
5. Add Folder View query indexes.

No backfill is required: existing Saved Items start with `folder_id = NULL`.

## API Implementation Flow

1. Update `packages/contract/src/index.ts` with DTOs, payloads, queries, and typed errors.
2. Update authorization scopes and API contract endpoints.
3. Add persistence schema and generate the migration.
4. Implement Folder repository and handlers.
5. Extend Saved Item joins/DTO conversion to always emit `folder`.
6. Extend list retrieval with `folder=none` and `folder={id}`.
7. Extend capture so omitted, null, and invalid Folder input follow the table above.
8. Implement `PUT /v1/saved-items/{id}/folder`.
9. Regenerate or refresh OpenAPI documentation and sync generated Raycast contract artifacts where repository hooks expect it.

## Web Companion

### Navigation And Routes

- `/library` becomes the Library home and fetches `GET /v1/saved-items?folder=none`.
- Add `/library/folders/{id}` for Folder Views and fetch `GET /v1/saved-items?folder={id}`.
- Do not expose `/library/no-folder`; the root is the unfiled destination.
- Keep the Command Palette's account-wide retrieval based on `GET /v1/saved-items` without a folder selector.

### Data Layer

Add folder query and mutations beside the existing Saved Item hooks:

```text
apps/web/src/sleevy/folders.ts
```

Responsibilities:

- `useFolders()`
- `useCreateFolder()`
- `useRenameFolder()`
- `useDeleteFolder()`
- `useMoveSavedItemToFolder()`
- Folder-aware Saved Item query keys so root, Folder Views, and all-item retrieval do not overwrite one another
- Cache invalidation after folder create/rename/delete/move and after capture

### UI

Use the existing sidebar:

- Add a `Folders` section under Library navigation.
- Add a create control beside the section heading.
- Sort user-created Folder destinations alphabetically.
- Add per-Folder contextual rename/delete actions.
- Delete confirmation copy must state that saved items are kept in the Library.
- Add `Move to Folder` to each Saved Item action menu, including moving back to Library home.
- Make Folder rows drop targets and Saved Item rows draggable.
- Retain a non-drag move action for keyboard and accessible operation.

### Web Verification

- Typecheck and build.
- Verify Library root only renders unfiled items.
- Verify Folder route direct loading and back/navigation behavior.
- Verify create, rename, duplicate-name conflict, invalid-name validation, delete, move, and drag-and-drop.
- Verify delete keeps items and returns them to `/library`.
- Verify Command Palette still finds items in Folders.
- Verify existing Inbox behavior is unaffected by Folder membership.

## Native iOS App

### Model And Store

Add:

```swift
struct FolderSummary: Codable, Equatable, Identifiable {
    let id: String
    let name: String
}

struct Folder: Codable, Equatable, Identifiable {
    let id: String
    let name: String
}
```

Update `SavedItem` with:

```swift
let folder: FolderSummary?
```

Although the API field is always present, it decodes naturally as optional because `null` means unfiled.

Extend `ReadingListStore` or extract a Library-focused store to:

- Fetch Folders.
- Fetch Library root using `?folder=none`.
- Fetch Folder View items using `?folder={id}`.
- Create, rename, and delete Folders.
- Move an item using `PUT /v1/saved-items/{id}/folder`.
- Refresh root and relevant Folder View state after moves or deletes.

Keep Inbox and Search backed by all-item behavior; Folder membership must not limit global search.

### Navigation And UI

- On the Library root, place a horizontally scrollable Folder section above the list.
- The root list contains only unfiled Saved Items.
- Selecting a Folder pushes a native Folder View in the Library navigation stack.
- Folder Views retain existing sort and Type/Tag filtering behavior.
- Add a toolbar action to create a Folder.
- Add native context menu actions on Folder destinations for rename and delete.
- Delete confirmation must communicate only that Saved Items are kept in the Library.
- Add a native item action presenting a Folder picker and an option to move back to the Library root.
- Do not add Folder selection to one-tap capture, Clipboard Capture, or the Share Extension.

### iOS Verification

- Add decoding tests for `"folder": null` and an embedded Folder summary.
- Verify Library root loading, Folder View loading, move, rename, delete, and error presentation.
- Verify deleted Folder items return to Library root.
- Verify read/unread actions do not remove items from Folder Views.
- Verify Inbox and Search still retrieve items regardless of Folder membership.
- Verify existing capture and pending-capture workflows remain functional.

## Compatibility And Rollout

This feature extends `/v1`; it does not introduce API versioning.

Compatible behavior:

- Existing clients ignore the added `folder` response field.
- Existing captures remain valid because `folderId` is optional on the request wire shape.
- Existing `GET /v1/saved-items` remains an all-items request when no `folder` selector is provided.
- Existing API keys continue to use existing Saved Item actions without receiving Folder management scopes.

Accepted behavioral change:

- Once Folder support is deployed, a duplicate capture from an older client that omits `folderId` moves that Saved Item to the Library root.

Rollout:

1. Deploy API schema migration and API/contract support.
2. Confirm existing iOS, Chrome, Raycast, and Web operations still succeed.
3. Ship Web Companion folder UI.
4. Ship Native iOS App folder UI.
5. Add Folder features to capture integrations later only when desired; their existing one-tap behavior remains operational.

## Completion Checklist

### API

- [ ] Contract schemas and OpenAPI expose Folder support.
- [ ] Migration creates Folder storage and nullable membership.
- [ ] CRUD, assignment, capture filing, and Folder View query endpoints behave as specified.
- [ ] Scope enforcement matches the authorization table.
- [ ] `400`, `404`, and `409` typed errors are client-consumable.
- [ ] Existing clients remain operational after deployment.

### Web

- [ ] Library root and Folder routes match the navigation model.
- [ ] Folder management and delete-copy behavior are present.
- [ ] Single-item move works through menu and drag-and-drop.
- [ ] Command Palette remains global.

### iOS

- [ ] Library root and pushed Folder Views match the navigation model.
- [ ] Native Folder management and item move controls are present.
- [ ] Search remains global.
- [ ] Codable and interaction verification cover Folder responses and transitions.
