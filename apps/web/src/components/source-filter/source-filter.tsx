import { createContext, useContext, useState, type ReactNode } from "react"
import { Link } from "@tanstack/react-router"
import { Inbox, Library, Hash } from "lucide-react"

import { useSavedItems } from "../../sleevy/saved-items"
import styles from "./source-filter.module.scss"

type SidebarFilters = {
  readonly activeSource: string | null
  readonly setActiveSource: (source: string | null) => void
  readonly activeType: string | null
  readonly setActiveType: (type: string | null) => void
  readonly activeTopic: string | null
  readonly setActiveTopic: (topic: string | null) => void
}

const SidebarFiltersContext = createContext<SidebarFilters>({
  activeSource: null,
  setActiveSource: () => {},
  activeType: null,
  setActiveType: () => {},
  activeTopic: null,
  setActiveTopic: () => {},
})

export function useSourceFilter() {
  return useContext(SidebarFiltersContext)
}

export function SourceFilterProvider({ children }: { children: ReactNode }) {
  const [activeSource, setActiveSource] = useState<string | null>(null)
  const [activeType, setActiveType] = useState<string | null>(null)
  const [activeTopic, setActiveTopic] = useState<string | null>(null)
  return (
    <SidebarFiltersContext.Provider value={{ activeSource, setActiveSource, activeType, setActiveType, activeTopic, setActiveTopic }}>
      {children}
    </SidebarFiltersContext.Provider>
  )
}

const channelGroups: Record<string, string> = {
  "ios-app": "iOS",
  "ios-share-extension": "iOS",
  "chrome-extension": "Browser",
  "web-companion": "Browser",
  "raycast": "Raycast",
  "api": "API",
}

export function getChannelGroup(channel?: string): string | undefined {
  if (!channel) return undefined
  return channelGroups[channel] ?? channel
}

function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

type SidebarItem = {
  readonly key: string
  readonly label: string
  readonly count: number
  readonly icon?: ReactNode
  readonly to?: string
  readonly exact?: boolean
}

function SidebarSection({ heading, items, activeValue, onSelect }: {
  heading: string
  items: SidebarItem[]
  activeValue?: string | null
  onSelect?: (value: string | null) => void
}) {
  if (items.length === 0) return null

  return (
    <div className={styles.section}>
      <h3 className={styles.heading}>{heading}</h3>
      <ul className={styles.list}>
        {items.map((item) => {
          const isActive = activeValue !== undefined
            ? activeValue === item.key
            : undefined
          const className = `${styles.item} ${isActive ? styles.active : ""}`

          const content = (
            <>
              {item.icon && <span className={styles.icon}>{item.icon}</span>}
              <span className={styles.name}>{item.label}</span>
              <span className={styles.count}>{formatCount(item.count)}</span>
            </>
          )

          return (
            <li key={item.key}>
              {item.to ? (
                <Link
                  to={item.to}
                  className={styles.item}
                  activeOptions={item.exact ? { exact: true } : undefined}
                  activeProps={{ className: `${styles.item} ${styles.active}` }}
                >
                  {content}
                </Link>
              ) : (
                <button
                  type="button"
                  className={className}
                  onClick={() => onSelect?.(activeValue === item.key ? null : item.key)}
                >
                  {content}
                </button>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export function LibraryNav() {
  const { data } = useSavedItems()
  const items = data?.savedItems ?? []
  const unreadCount = items.filter((i) => !i.isRead).length
  const readCount = items.filter((i) => i.isRead).length

  return (
    <SidebarSection
      heading="Sleeve"
      items={[
        { key: "inbox", label: "Inbox", count: unreadCount, icon: <Inbox size={14} />, to: "/", exact: true },
        { key: "library", label: "Library", count: readCount, icon: <Library size={14} />, to: "/library" },
      ]}
    />
  )
}

export function TopicFilterList() {
  const { data } = useSavedItems()
  const { activeTopic, setActiveTopic } = useSourceFilter()

  const items = data?.savedItems ?? []
  const topicCounts = new Map<string, number>()
  for (const item of items) {
    const topic = item.topicOverride ?? item.topic
    if (topic) {
      topicCounts.set(topic, (topicCounts.get(topic) ?? 0) + 1)
    }
  }

  const entries: SidebarItem[] = [...topicCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([topic, count]) => ({ key: topic, label: topic, count, icon: <Hash size={14} /> }))

  return (
    <SidebarSection
      heading="Tags"
      items={entries}
      activeValue={activeTopic}
      onSelect={setActiveTopic}
    />
  )
}

export function SourceFilterList() {
  const { data } = useSavedItems()
  const { activeSource, setActiveSource } = useSourceFilter()

  const items = data?.savedItems ?? []
  const groupCounts = new Map<string, number>()
  for (const item of items) {
    const group = getChannelGroup(item.captureChannel)
    if (group) {
      groupCounts.set(group, (groupCounts.get(group) ?? 0) + 1)
    }
  }

  const entries: SidebarItem[] = [...groupCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ key: name, label: name, count }))

  return (
    <SidebarSection
      heading="Sources"
      items={entries}
      activeValue={activeSource}
      onSelect={setActiveSource}
    />
  )
}
