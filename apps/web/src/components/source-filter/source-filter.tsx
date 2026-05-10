import { createContext, useContext, useState, type ReactNode } from "react"

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

const typeLabels: Record<string, string> = {
  article: "Articles",
  video: "Videos",
  website: "Websites",
  repository: "Repositories",
}

const topicLabels: Record<string, string> = {
  ai: "AI",
  tools: "Tools",
  typescript: "TypeScript",
  security: "Security",
  design: "Design",
  backend: "Backend",
  "front-end": "Front-end",
}

function FilterSection({
  heading,
  activeValue,
  setActiveValue,
  entries,
  totalCount,
  allLabel,
}: {
  heading: string
  activeValue: string | null
  setActiveValue: (value: string | null) => void
  entries: [string, number, string][]
  totalCount: number
  allLabel: string
}) {
  if (entries.length === 0) return null

  return (
    <div className={styles.section}>
      <h3 className={styles.heading}>{heading}</h3>
      <ul className={styles.list}>
        <li>
          <button
            type="button"
            className={`${styles.item} ${activeValue === null ? styles.active : ""}`}
            onClick={() => setActiveValue(null)}
          >
            <span className={styles.name}>{allLabel}</span>
            <span className={styles.count}>{totalCount}</span>
          </button>
        </li>
        {entries.map(([value, count, label]) => (
          <li key={value}>
            <button
              type="button"
              className={`${styles.item} ${activeValue === value ? styles.active : ""}`}
              onClick={() => setActiveValue(activeValue === value ? null : value)}
            >
              <span className={styles.name}>{label}</span>
              <span className={styles.count}>{count}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function SourceFilterList() {
  const { data } = useSavedItems()
  const { activeSource, setActiveSource } = useSourceFilter()

  const items = data?.savedItems ?? []
  const sourceCounts = new Map<string, number>()
  for (const item of items) {
    if (item.sourceName) {
      sourceCounts.set(item.sourceName, (sourceCounts.get(item.sourceName) ?? 0) + 1)
    }
  }

  const entries: [string, number, string][] = [...sourceCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => [name, count, name])

  return (
    <FilterSection
      heading="Sources"
      activeValue={activeSource}
      setActiveValue={setActiveSource}
      entries={entries}
      totalCount={items.length}
      allLabel="All sources"
    />
  )
}

export function TypeFilterList() {
  const { data } = useSavedItems()
  const { activeType, setActiveType } = useSourceFilter()

  const items = data?.savedItems ?? []
  const typeCounts = new Map<string, number>()
  for (const item of items) {
    typeCounts.set(item.type, (typeCounts.get(item.type) ?? 0) + 1)
  }

  const entries: [string, number, string][] = [...typeCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([type, count]) => [type, count, typeLabels[type] ?? type])

  return (
    <FilterSection
      heading="Types"
      activeValue={activeType}
      setActiveValue={setActiveType}
      entries={entries}
      totalCount={items.length}
      allLabel="All types"
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

  const entries: [string, number, string][] = [...topicCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([topic, count]) => [topic, count, topicLabels[topic] ?? topic])

  return (
    <FilterSection
      heading="Topics"
      activeValue={activeTopic}
      setActiveValue={setActiveTopic}
      entries={entries}
      totalCount={items.length}
      allLabel="All topics"
    />
  )
}
