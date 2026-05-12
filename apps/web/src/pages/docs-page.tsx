import "@scalar/api-reference-react/style.css"
import { ApiReferenceReact } from "@scalar/api-reference-react"
import { useEffect } from "react"

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4001"

export function DocsPage() {
  useEffect(() => {
    const root = document.querySelector(".docs-reference")
    if (!root) return

    const hideScalarUpsells = () => {
      root
        .querySelectorAll<HTMLElement>(
          [
            "[aria-label='API Client']",
            "a[href^='https://www.scalar.com']",
            "button",
            "[role='group']",
            "[role='textbox']",
          ].join(","),
        )
        .forEach((element) => {
          const text = element.textContent ?? ""
          const isScalarUpsell =
            element.getAttribute("aria-label") === "API Client" ||
            element.matches("a[href^='https://www.scalar.com']") ||
            text.includes("Ask AI") ||
            text.includes("Powered by Scalar") ||
            text.includes("Generate MCP") ||
            text.includes("VS Code") ||
            text.includes("Cursor")

          if (isScalarUpsell) {
            element.style.display = "none"
          }
        })
    }

    hideScalarUpsells()
    const observer = new MutationObserver(hideScalarUpsells)
    observer.observe(root, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [])

  return (
    <div className="docs-page">
      <section className="docs-reference" aria-label="Sleevy API Reference">
        <ApiReferenceReact
          configuration={{
            url: `${apiBaseUrl}/openapi.json`,
            theme: "default",
            layout: "modern",
            showDeveloperTools: "never",
            hideClientButton: true,
            hideDownloadButton: false,
            hideTestRequestButton: true,
            hideSearch: true,
            hiddenClients: true,
            mcp: { disabled: true },
            telemetry: false,
            customCss: `
              a[href="https://www.scalar.com"],
              a[href^="https://www.scalar.com"],
              [aria-label="Developer Tools"],
              button[aria-label="Ask AI"] {
                display: none !important;
              }
            `,
            metaData: {
              title: "Sleevy API Reference",
            },
          }}
        />
      </section>
    </div>
  )
}
