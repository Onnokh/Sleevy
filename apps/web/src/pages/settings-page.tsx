import { AccountPanel } from "../components/account/account"
import { ApiKeysPanel } from "../components/api-keys/api-keys"
import { SourceNamePanel } from "../components/source-name/source-name"
import { useTheme } from "../contexts/theme-context"

const themeOptions = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
] as const

export function SettingsPage() {
  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Settings</h1>
      </div>
      <div className="page-sections">
        <ThemePanel />
        <AccountPanel />
        <SourceNamePanel />
        <ApiKeysPanel />
      </div>
    </>
  )
}

function ThemePanel() {
  const { theme, setTheme } = useTheme()

  return (
    <section>
      <div className="section-header">
        <h2 className="section-title">Appearance</h2>
      </div>
      <div className="theme-control" role="radiogroup" aria-label="Theme">
        {themeOptions.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={theme === option.value}
            className="theme-option"
            data-active={theme === option.value}
            onClick={() => setTheme(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </section>
  )
}
