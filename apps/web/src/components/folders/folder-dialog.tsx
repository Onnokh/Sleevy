import * as Dialog from "@radix-ui/react-dialog"
import { type FormEvent, useState } from "react"

import { Button } from "../ui/button/button"
import { InputField } from "../ui/input-field/input-field"
import styles from "./folder-dialog.module.scss"

type NameDialogProps = {
  readonly open: boolean
  readonly title: string
  readonly initialName?: string
  readonly submitLabel: string
  readonly isPending: boolean
  readonly error: string | null
  readonly onClose: () => void
  readonly onSubmit: (name: string) => void
}

export function FolderNameDialog({
  open,
  title,
  initialName = "",
  submitLabel,
  isPending,
  error,
  onClose,
  onSubmit,
}: NameDialogProps) {
  const [name, setName] = useState(initialName)

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    onSubmit(name)
  }

  return (
    <Dialog.Root open={open} onOpenChange={(nextOpen) => { if (!nextOpen) onClose() }}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content className={styles.content}>
          <Dialog.Title className={styles.title}>{title}</Dialog.Title>
          <form className={styles.form} onSubmit={submit}>
            <InputField
              autoFocus
              maxLength={80}
              placeholder="Folder name"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
            {error ? <p className={styles.error}>{error}</p> : null}
            <div className={styles.actions}>
              <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
              <Button type="submit" disabled={isPending || !name.trim()}>
                {isPending ? "Saving..." : submitLabel}
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

type DeleteDialogProps = {
  readonly folderName: string | null
  readonly isPending: boolean
  readonly error: string | null
  readonly onClose: () => void
  readonly onDelete: () => void
}

export function FolderDeleteDialog({ folderName, isPending, error, onClose, onDelete }: DeleteDialogProps) {
  return (
    <Dialog.Root open={folderName !== null} onOpenChange={(nextOpen) => { if (!nextOpen) onClose() }}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content className={styles.content}>
          <Dialog.Title className={styles.title}>Delete {folderName}?</Dialog.Title>
          <Dialog.Description className={styles.description}>
            Saved items in this folder are kept in your Library.
          </Dialog.Description>
          {error ? <p className={styles.error}>{error}</p> : null}
          <div className={styles.actions}>
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="button" className={styles.destructive} disabled={isPending} onClick={onDelete}>
              {isPending ? "Deleting..." : "Delete Folder"}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
