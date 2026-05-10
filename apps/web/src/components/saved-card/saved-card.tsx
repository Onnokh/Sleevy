import { type MouseEvent } from "react"

import type { SavedItem } from "../../sleevy/saved-items"
import { ContextMenu, type ContextMenuItem } from "../ui/context-menu/context-menu"
import styles from "./saved-card.module.scss"

type Props = {
  readonly item: SavedItem
  readonly onDelete: (id: string) => void
  readonly onOpen: (id: string) => void
  readonly onSetReadState: (id: string, isRead: boolean) => void
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

export function SavedCard({ item, onDelete, onOpen, onSetReadState }: Props) {
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

  return (
    <div
      className={styles.row}
      role="link"
      tabIndex={0}
      title={item.previewSummary}
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
        <div className={styles.meta}>
          <span className={styles.host}>{item.host}</span>
          {item.type && <span className={styles.badge}>{item.type}</span>}
          {(item.topicOverride ?? item.topic) && (
            <span className={styles.badge}>{item.topicOverride ?? item.topic}</span>
          )}
          {item.sourceName && <span className={styles.badge}>{item.sourceName}</span>}
        </div>
      </div>

      {date && <span className={styles.date}>{date}</span>}

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
