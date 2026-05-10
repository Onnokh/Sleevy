import { createContext, useContext, useState, type ReactNode } from "react"

import { useSavedItems } from "../../sleevy/saved-items"
import styles from "./source-filter.module.scss"

type SourceFilterContextValue = {
  readonly activeSource: string | null
  readonly setActiveSource: (source: string | null) => void
}

const SourceFilterContext = createContext<SourceFilterContextValue>({
  activeSource: null,
  setActiveSource: () => {},
})

export function useSourceFilter() {
  return useContext(SourceFilterContext)
}

export function SourceFilterProvider({ children }: { children: ReactNode }) {
  const [activeSource, setActiveSource] = useState<string | null>(null)
  return (
    <SourceFilterContext.Provider value={{ activeSource, setActiveSource }}>
      {children}
    </SourceFilterContext.Provider>
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

  if (sourceCounts.size === 0) return null

  const sources = [...sourceCounts.entries()].sort((a, b) => b[1] - a[1])

  return (
    <div className={styles.section}>
      <h3 className={styles.heading}>Sources</h3>
      <ul className={styles.list}>
        <li>
          <button
            type="button"
            className={`${styles.item} ${activeSource === null ? styles.active : ""}`}
            onClick={() => setActiveSource(null)}
          >
            <span className={styles.name}>All sources</span>
            <span className={styles.count}>{items.length}</span>
          </button>
        </li>
        {sources.map(([name, count]) => (
          <li key={name}>
            <button
              type="button"
              className={`${styles.item} ${activeSource === name ? styles.active : ""}`}
              onClick={() => setActiveSource(activeSource === name ? null : name)}
            >
              <span className={styles.name}>{name}</span>
              <span className={styles.count}>{count}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
