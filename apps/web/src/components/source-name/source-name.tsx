import { type FormEvent, useState } from "react"

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
    <section>
      <div className="section-header">
        <h2 className="section-title">Source Name</h2>
      </div>
      <form onSubmit={submit} className="capture-form">
        <InputField
          type="text"
          placeholder="e.g. Work Laptop, Home PC"
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
        <Button type="submit">{saved ? "Saved" : "Save"}</Button>
      </form>
    </section>
  )
}
