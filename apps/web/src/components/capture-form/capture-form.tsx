import { useCapture } from "../../sleeve/saved-items"
import { Button } from "../ui/button/button"
import { InputField } from "../ui/input-field/input-field"

export function CaptureForm() {
  const capture = useCapture()

  return (
    <>
      <form onSubmit={capture.submit} className="capture-form">
        <InputField
          type="url"
          inputMode="url"
          placeholder="https://example.com/article"
          value={capture.url}
          onChange={(event) => capture.setUrl(event.target.value)}
        />
        <Button type="submit" disabled={capture.isPending || !capture.url.trim()}>
          {capture.isPending ? "Saving..." : "Save"}
        </Button>
      </form>
      {capture.formError ? <pre>{capture.formError}</pre> : null}
    </>
  )
}
