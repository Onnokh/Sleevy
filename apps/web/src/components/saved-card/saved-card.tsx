import clsx from "clsx"
import { useEffect, useId, useRef, useState, type MouseEvent } from "react"

import styles from "./saved-card.module.scss"

type SavedCardItem = {
  readonly id: string
  readonly originalUrl: string
  readonly host: string
  readonly title?: string
  readonly description?: string
  readonly imageUrl?: string
  readonly previewSummary?: string
  readonly enrichmentStatus: "pending" | "enriched" | "failed"
  readonly isRead: boolean
  readonly lastSavedAt: string
}

type Props = {
  readonly item: SavedCardItem
  readonly onDelete: (id: string) => void
}

function faviconUrl(host: string) {
  return `https://www.google.com/s2/favicons?domain=${host}&sz=64`
}

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null

  const now = new Date()
  const isThisYear = date.getFullYear() === now.getFullYear()

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    ...(isThisYear ? {} : { year: "numeric" }),
  }).format(date)
}

export function SavedCard({ item, onDelete }: Props) {
  const menuId = useId()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const buttonRef = useRef<HTMLButtonElement | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!isMenuOpen) return
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node | null
      if (!target) return
      if (menuRef.current?.contains(target)) return
      if (buttonRef.current?.contains(target)) return
      setIsMenuOpen(false)
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsMenuOpen(false)
    }
    document.addEventListener("pointerdown", onPointerDown)
    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.removeEventListener("pointerdown", onPointerDown)
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [isMenuOpen])

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(item.originalUrl)
    } catch {
      /* clipboard not available */
    }
    setIsMenuOpen(false)
  }

  const openLink = () => {
    window.open(item.originalUrl, "_blank", "noreferrer")
  }

  const onMenuArea = (e: MouseEvent) => {
    e.stopPropagation()
  }

  const date = formatDate(item.lastSavedAt)

  return (
    <div
      className={clsx(styles.row, isMenuOpen && styles["row-active"])}
      role="link"
      tabIndex={0}
      onClick={openLink}
      onKeyDown={(e) => { if (e.key === "Enter") openLink() }}
    >
      <div className={styles.indicator}>
        {!item.isRead && <span className={styles.dot} />}
      </div>

      <img
        className={styles.favicon}
        src={faviconUrl(item.host)}
        alt=""
        width={32}
        height={32}
        loading="lazy"
      />

      <div className={styles.body}>
        <span className={styles.title}>{item.title ?? item.host}</span>
        <span className={styles.host}>{item.host}</span>
      </div>

      {date && <span className={styles.date}>{date}</span>}

      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
      <div onClick={onMenuArea}>
        <button
          type="button"
          ref={buttonRef}
          className={styles["menu-trigger"]}
          aria-haspopup="menu"
          aria-expanded={isMenuOpen}
          aria-controls={menuId}
          onClick={() => setIsMenuOpen((v) => !v)}
        >
          ···
        </button>

        {isMenuOpen ? (
          <div ref={menuRef} id={menuId} role="menu" className={styles.menu}>
            <a
              href={item.originalUrl}
              target="_blank"
              rel="noreferrer"
              role="menuitem"
              className={styles["menu-item"]}
              onClick={() => setIsMenuOpen(false)}
            >
              Open
            </a>
            <button
              type="button"
              role="menuitem"
              className={styles["menu-item"]}
              onClick={copyUrl}
            >
              Copy URL
            </button>
            <button
              type="button"
              role="menuitem"
              className={clsx(styles["menu-item"], styles.destructive)}
              onClick={() => {
                setIsMenuOpen(false)
                onDelete(item.id)
              }}
            >
              Delete
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
