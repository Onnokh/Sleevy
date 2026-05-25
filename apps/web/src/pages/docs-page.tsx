import { useState } from "react"
import spec from "../../public/openapi.json"

type Schema = { type?: string; enum?: string[]; anyOf?: Schema[]; items?: Schema; $ref?: string; properties?: Record<string, Schema>; required?: string[]; additionalProperties?: boolean }
type Parameter = { name: string; in: string; required?: boolean; schema?: Schema }
type Operation = { tags?: string[]; operationId?: string; parameters?: Parameter[]; requestBody?: { required?: boolean; content?: Record<string, { schema: Schema }> }; responses: Record<string, { description: string; content?: Record<string, { schema: Schema }> }> }

const schemaOrder = [
  "FolderDto",
  "FoldersResponse",
  "FolderNamePayload",
  "FolderAssignmentPayload",
  "SavedItemDto",
  "CapturePayload",
  "CaptureCreated",
  "CaptureUpdated",
  "SavedItemsResponse",
  "SavedItemReadStatePayload",
  "HealthResponse",
]

const methodOrder = ["get", "post", "put", "patch", "delete"] as const
const methodColors: Record<string, string> = { get: "#6ee7a2", post: "#ff9da4", put: "#f3c087", patch: "#f3c087", delete: "#ff5f57" }

const groups = buildGroups()

function buildGroups() {
  const map = new Map<string, { method: string; path: string; op: Operation }[]>()
  for (const [path, methods] of Object.entries(spec.paths)) {
    for (const method of methodOrder) {
      const op = (methods as Record<string, Operation>)[method]
      if (!op) continue
      const tag = op.tags?.[0] ?? "other"
      if (!map.has(tag)) map.set(tag, [])
      map.get(tag)!.push({ method, path, op })
    }
  }
  return map
}

const friendlyNames: Record<string, string> = {
  SavedItemDto: "SavedItem",
  SavedItemsResponse: "SavedItemList",
  SavedItemReadStatePayload: "ReadState",
  SavedItemNotFoundError: "NotFound",
  FolderDto: "Folder",
  FoldersResponse: "FolderList",
  FolderNamePayload: "FolderName",
  FolderAssignmentPayload: "FolderAssignment",
  InvalidFolderNameError: "InvalidFolderName",
  FolderNotFoundError: "FolderNotFound",
  FolderNameConflictError: "FolderNameConflict",
  CapturePayload: "CaptureRequest",
  CaptureCreated: "CaptureCreated",
  CaptureUpdated: "CaptureUpdated",
  InvalidUrlError: "InvalidUrl",
  RateLimitExceeded: "RateLimitExceeded",
  Unauthorized: "Unauthorized",
  HealthResponse: "Health",
  "<No Content>": "No Content",
}

function displayName(raw: string): string {
  return friendlyNames[raw] ?? raw
}

function typeLabel(s: Schema): string {
  if (s.$ref) return displayName(s.$ref.split("/").pop()!)
  if (s.anyOf) {
    const types = s.anyOf.map(typeLabel)
    return types.includes("null") ? `${types.find((t) => t !== "null")} | null` : types.join(" | ")
  }
  if (s.type === "array") return `${s.items ? typeLabel(s.items) : "any"}[]`
  if (s.enum) return s.enum.map((v) => `"${v}"`).join(" | ")
  return s.type ?? "any"
}

function schemaAnchor(raw: string): string | null {
  const friendly = friendlyNames[raw]
  return friendly && schemaOrder.includes(raw) ? `schema-${friendly}` : null
}

function TypeLabel({ schema: s }: { schema: Schema }) {
  if (s.$ref) {
    const raw = s.$ref.split("/").pop()!
    const anchor = schemaAnchor(raw)
    const label = displayName(raw)
    if (anchor) return <a className="docs-type-link" href={`#${anchor}`}>{label}</a>
    return <>{label}</>
  }
  return <>{typeLabel(s)}</>
}

function ParamList({ label, params }: { label: string; params: Parameter[] }) {
  if (params.length === 0) return null
  return (
    <div className="docs-detail">
      <span className="docs-detail-label">{label}</span>
      {params.map((p) => (
        <span key={p.name} className="docs-param">
          <code>{p.name}</code>
          <code className="docs-param-type">{p.schema ? typeLabel(p.schema) : "string"}</code>
          {p.required && <span className="docs-required">required</span>}
        </span>
      ))}
    </div>
  )
}

function Endpoint({ method, path, op }: { method: string; path: string; op: Operation }) {
  const [open, setOpen] = useState(false)
  const bodySchema = op.requestBody?.content?.["application/json"]?.schema
  const bodyRef = bodySchema?.$ref?.split("/").pop()
  const pathParams = op.parameters?.filter((p) => p.in === "path") ?? []
  const queryParams = op.parameters?.filter((p) => p.in === "query") ?? []
  const successCodes = Object.entries(op.responses).filter(([code]) => code.startsWith("2"))
  const errorCodes = Object.entries(op.responses).filter(([code]) => !code.startsWith("2"))

  return (
    <div className="docs-endpoint" data-open={open || undefined}>
      <button className="docs-endpoint-header" onClick={() => setOpen(!open)} type="button">
        <span className="docs-method" style={{ color: methodColors[method] }}>{method.toUpperCase()}</span>
        <span className="docs-path">{path}</span>
        <svg className="docs-chevron" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" /></svg>
      </button>
      {open && (
        <div className="docs-endpoint-body">
          <ParamList label="Path" params={pathParams} />
          <ParamList label="Query" params={queryParams} />
          {bodyRef && (
            <div className="docs-detail">
              <span className="docs-detail-label">Body</span>
              <code><TypeLabel schema={bodySchema!} /></code>
            </div>
          )}
          <div className="docs-detail">
            <span className="docs-detail-label">Returns</span>
            {successCodes.map(([code, res]) => {
              const resSchema = res.content?.["application/json"]?.schema
              return (
                <span key={code} className="docs-return">
                  <span className="docs-status docs-status-ok">{code}</span>
                  {resSchema ? <code><TypeLabel schema={resSchema} /></code> : <span>{displayName(res.description)}</span>}
                </span>
              )
            })}
          </div>
          {errorCodes.length > 0 && (
            <div className="docs-detail">
              <span className="docs-detail-label">Errors</span>
              {errorCodes.map(([code, res]) => (
                <span key={code} className="docs-return">
                  <span className="docs-status docs-status-err">{code}</span>
                  <span>{displayName(res.description)}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function SchemaDefinition({ name, schema }: { name: string; schema: Schema }) {
  const friendly = displayName(name)
  const [open, setOpen] = useState(false)
  if (!schema.properties) return null
  const entries = Object.entries(schema.properties)

  return (
    <div className="docs-schema-def" id={`schema-${friendly}`}>
      <button className="docs-schema-header" onClick={() => setOpen(!open)} type="button">
        <span className="docs-schema-name">{friendly}</span>
        <span className="docs-schema-count">{entries.length} {entries.length === 1 ? "field" : "fields"}</span>
        <svg className="docs-chevron" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" /></svg>
      </button>
      {open && (
        <div className="docs-schema-body">
          {entries.map(([field, prop]) => (
            <div key={field} className="docs-field">
              <code className="docs-field-name">{field}</code>
              <code className="docs-field-type"><TypeLabel schema={prop} /></code>
              {schema.required?.includes(field) && <span className="docs-required">required</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function SideNav() {
  return (
    <nav className="docs-sidenav" aria-label="API sections">
      {[...groups.entries()].map(([tag, endpoints]) => (
        <div key={tag} className="docs-sidenav-group">
          <a href={`#${tag}`} className="docs-sidenav-heading">{tag}</a>
          {endpoints.map(({ method, path }) => (
            <a key={`${method}-${path}`} href={`#${tag}`} className="docs-sidenav-item">
              <span className="docs-sidenav-method" style={{ color: methodColors[method] }}>{method.toUpperCase()}</span>
              <span>{path}</span>
            </a>
          ))}
        </div>
      ))}
      <div className="docs-sidenav-group">
        <a href="#schemas" className="docs-sidenav-heading">schemas</a>
        {schemaOrder.map((name) => (
          <a key={name} href={`#schema-${displayName(name)}`} className="docs-sidenav-item">
            {displayName(name)}
          </a>
        ))}
      </div>
    </nav>
  )
}

export function DocsPage() {
  return (
    <div className="docs-page">
      <div className="docs-layout">
        <SideNav />
        <section className="docs-reference" aria-label="Sleevy API Reference">
          <div className="docs-header">
            <h1>{spec.info.title}</h1>
            <span className="docs-version">v{spec.info.version}</span>
          </div>
          <p className="docs-description">{spec.info.description}</p>
          <p className="docs-base">Base URL: <code>https://api.sleevy.app</code></p>
          <p className="docs-auth">
            All endpoints except <code>/health</code> require an <code>Authorization: Bearer &lt;API_KEY&gt;</code> header.
          </p>
          {[...groups.entries()].map(([tag, endpoints]) => (
            <div key={tag} className="docs-group" id={tag}>
              <h2 className="docs-group-title">{tag}</h2>
              {endpoints.map(({ method, path, op }) => (
                <Endpoint key={`${method}-${path}`} method={method} path={path} op={op} />
              ))}
            </div>
          ))}
          <div className="docs-group" id="schemas">
            <h2 className="docs-group-title">Schemas</h2>
            {schemaOrder.map((name) => {
              const schema = (spec.components.schemas as Record<string, Schema>)[name]
              if (!schema) return null
              return <SchemaDefinition key={name} name={name} schema={schema} />
            })}
          </div>
        </section>
      </div>
    </div>
  )
}
