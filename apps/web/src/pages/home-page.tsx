import { authClient } from "../auth"
import { Logo } from "../Logo"

const captureMethods = [
  {
    title: "Raycast Plugin",
    body: "Capture from your launcher and keep moving.",
    action: "Install Extension",
    icon: "/Raycast.png",
  },
  {
    title: "Native Share",
    body: "Tap the share button on any page or link, pick Sleeve, and it lands in your queue.",
    action: null,
    icon: "/IOS26.png",
  },
  {
    title: "Chrome Extension",
    body: "Click the Sleeve icon in your toolbar. The current tab is captured instantly.",
    action: "Install Extension",
    icon: "/chrome.png",
  },
  {
    title: "Web Companion",
    body: "Paste a URL into the web app and hit save when you are already browsing on desktop.",
    action: "Login",
    icon: "/app-icon.png",
  },
]

const companionFeatures = [
  {
    eyebrow: "sync",
    title: "Save on one, read on the other",
    body: "They sync before you can open your inbox, your items are everywhere.",
  },
  {
    eyebrow: "filter",
    title: "Tags, sources, full-text",
    body: "Filter your queue by tag or capture source.",
  },
  {
    eyebrow: "keyboard",
    title: "Fully driveable from the keys",
    body: "j/k to navigate, o to open, n to capture and fuzzy find from the command palette.",
  },
]

export function HomePage() {
  const { data: session } = authClient.useSession()
  const appButtonLabel = session ? "Companion" : "Login"

  return (
    <main className="marketing-page">
      <nav className="marketing-nav" aria-label="Primary">
        <a className="marketing-brand" href="/" aria-label="Sleevy home">
          <Logo size={42} />
        </a>
        <div className="marketing-nav-actions">
          <a className="marketing-nav-link disabled" href="#docs">Docs</a>
          <a className="marketing-login" href="/inbox">{appButtonLabel}</a>
        </div>
      </nav>

      <section className="marketing-hero">
        <div className="marketing-copy">
          <h1>
            <span>Sleeve it.</span>
            <span>Read it later.</span>
          </h1>
          <p>
            One tap to save. Every device in sync. A read-later app you can script, automate, and extend.
          </p>
          <p>
            In development.
          </p>
          <div className="marketing-actions">
            <a className="marketing-app-store disabled" href="/inbox" aria-label="Download on the App Store">
              <img src="/AppStore.png" alt="Download on the App Store" />
            </a>
            <a className="marketing-docs-link disabled" id="docs" href="/inbox">Read the docs</a>
          </div>
        </div>

        <div className="marketing-device" aria-label="Sleevy mobile app preview">
          <img className="marketing-gradient" src="/gradient.png" alt="" />
          <div className="marketing-phone">
            <img src="/app.jfif" alt="" />
          </div>
        </div>
      </section>

      <section className="capture-section">
        <p className="marketing-eyebrow">one-click capture</p>
        <h2>Save from wherever you are.</h2>
        <div className="capture-grid">
          {captureMethods.map((method) => (
            <article className="capture-card" key={method.title}>
              <img src={method.icon} alt="" />
              <h3>{method.title}</h3>
              <p>{method.body}</p>
              {method.action ? <a className={method.action === "Install Extension" ? "disabled" : undefined} href="/inbox">{method.action}</a> : null}
            </article>
          ))}
        </div>
      </section>

      <section className="companion-section">
        <p className="marketing-eyebrow">companion</p>
        <h2>Web Companion.</h2>
        <div className="companion-preview" aria-label="Sleevy web companion preview">
          <img src="/screenshot.png" alt="" />
        </div>
        <div className="companion-features">
          {companionFeatures.map((feature) => (
            <article key={feature.title}>
              <span>{feature.eyebrow}</span>
              <h3>{feature.title}</h3>
              <p>{feature.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="api-section">
        <div className="api-copy">
          <p className="marketing-eyebrow">API</p>
          <h2>Built to extend.</h2>
          <p>
            Sleeve exposes a capture API with personal access tokens. Anything that can make an HTTP request can save to
            your queue.
          </p>
          <ul>
            <li>Personal tokens with scoped permissions per device or script</li>
            <li>Simple JSON over HTTPS, no SDK required</li>
            <li>Webhooks for archive, tag, and read events</li>
            <li>Rate-limited per token</li>
          </ul>
        </div>
        <div className="api-code" aria-label="API example">
          <div>
            <span>curl</span>
            <span className="disabled">node</span>
          </div>
          <pre>{`curl -X POST https://sleevy.app/api/capture \\
  -H "Authorization: Bearer $SLEEVE_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"url":"https://example.com"}'`}</pre>
        </div>
      </section>

      <div className="marketing-footer-band" />
    </main>
  )
}
