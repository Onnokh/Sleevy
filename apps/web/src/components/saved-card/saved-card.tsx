import { type MouseEvent, useRef } from "react"
import clsx from "clsx"
import { differenceInHours, differenceInMinutes, format } from "date-fns"

import type { SavedItem } from "../../sleevy/saved-items"
import { ContextMenu, type ContextMenuItem } from "../ui/context-menu/context-menu"
import styles from "./saved-card.module.scss"

type Props = {
  readonly item: SavedItem
  readonly isSelected?: boolean
  readonly pendingDelete?: boolean
  readonly onDelete: (id: string) => void
  readonly onOpen: (id: string) => void
  readonly onSetReadState: (id: string, isRead: boolean) => void
}

function faviconUrl(host: string) {
  return `https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://${host}&size=64`
}

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null

  const now = new Date()
  const minutes = differenceInMinutes(now, date)
  if (minutes < 1) return "now"
  if (minutes < 60) return `${minutes}m`

  const hours = differenceInHours(now, date)
  if (hours < 24) return `${hours}h`

  return format(date, date.getFullYear() === now.getFullYear() ? "MMM d" : "MMM d, yyyy")
}

export function SavedCard({ item, isSelected, pendingDelete, onDelete, onOpen, onSetReadState }: Props) {
  const rowRef = useRef<HTMLDivElement>(null)
  const wasSelectedRef = useRef(false)

  if (isSelected && !wasSelectedRef.current) {
    rowRef.current?.scrollIntoView({ block: "nearest" })
  }
  wasSelectedRef.current = isSelected ?? false

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(item.originalUrl)
    } catch {
      /* clipboard not available */
    }
  }

  const openLink = () => {
    if (!item.isRead) onOpen(item.id)
    window.open(item.originalUrl, "_blank", "noreferrer")
  }

  const onMenuArea = (e: MouseEvent) => {
    e.stopPropagation()
  }

  const items: readonly ContextMenuItem[] = [
    { key: "open", label: "Open", href: item.originalUrl },
    { key: "read", label: item.isRead ? "Mark Unread" : "Mark Read", onClick: () => onSetReadState(item.id, !item.isRead) },
    { key: "copy", label: "Copy URL", onClick: copyUrl },
    { key: "delete", label: "Delete", destructive: true, onClick: () => onDelete(item.id) },
  ]

  const date = formatDate(item.lastSavedAt)

  if (pendingDelete) {
    return (
      <div ref={rowRef} className={clsx(styles.row, styles.selected, styles.deleteConfirm)}>
        <span className={styles.deletePrompt}>
          Delete this item? <kbd className={styles.kbd}>y</kbd> yes <kbd className={styles.kbd}>n</kbd> no
        </span>
      </div>
    )
  }

  return (
    <div
      ref={rowRef}
      className={clsx(styles.row, isSelected && styles.selected)}
      role="link"
      tabIndex={0}
      title={item.previewSummary}
      onClick={openLink}
      onKeyDown={(e) => { if (e.key === "Enter") openLink() }}
    >
      <img
        className={styles.favicon}
        src={faviconUrl(item.host)}
        alt=""
        width={28}
        height={28}
        loading="lazy"
      />

      <div className={styles.body}>
        <span className={styles.title}>{item.title ?? item.host}</span>
        <span className={styles.host}>{item.host}</span>
      </div>

      {date && <span className={clsx(styles.date, !item.isRead && styles.unreadDate)}>{date}</span>}

      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
      <div className={styles["menu-wrapper"]} onClick={onMenuArea}>
        <ContextMenu
          items={items}
          triggerClassName={styles["menu-trigger"]}
        />
      </div>
    </div>
  )
}
