import { type FormEvent, useState } from "react"
import { Check, Save } from "lucide-react"

import { Button } from "../ui/button/button"
import { InputField } from "../ui/input-field/input-field"

const STORAGE_KEY = "sleeve:sourceName"

export function getSourceName(): string {
  return localStorage.getItem(STORAGE_KEY) || ""
}

export function SourceNamePanel() {
  const [value, setValue] = useState(() => getSourceName())
  const [saved, setSaved] = useState(false)

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmed = value.trim()
    if (trimmed) {
      localStorage.setItem(STORAGE_KEY, trimmed)
    } else {
      localStorage.removeItem(STORAGE_KEY)
    }
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <section className="settings-section">
      <div className="section-header">
        <div>
          <h2 className="section-title">Source Name</h2>
          <p className="section-description">Shown on new captures</p>
        </div>
      </div>
      <form onSubmit={submit} className="settings-form">
        <InputField
          type="text"
          placeholder="e.g. Work Laptop, Home PC"
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
        <Button type="submit" aria-label={saved ? "Saved" : "Save source name"} title={saved ? "Saved" : "Save"}>
          {saved ? <Check size={16} aria-hidden="true" /> : <Save size={16} aria-hidden="true" />}
        </Button>
      </form>
    </section>
  )
}
