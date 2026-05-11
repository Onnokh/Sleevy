import { useEffect, useState } from "react"
import { Library } from "lucide-react"

import { type SavedItemSort, useDeleteItem, useMarkAsRead, useSavedItems, useSetReadState } from "../sleevy/saved-items"
import { SavedCard } from "../components/saved-card/saved-card"
import { getSourceGroup, useSourceFilter } from "../components/source-filter/source-filter"
import { useKeyboardNav } from "../contexts/keyboard-nav-context"

export function LibraryPage() {
  const [sort, setSort] = useState<SavedItemSort>("newest")
  const savedItemsQuery = useSavedItems(sort)
  const deleteMutation = useDeleteItem()
  const markAsReadMutation = useMarkAsRead()
  const setReadStateMutation = useSetReadState()
  const { activeSource, activeType, activeTag } = useSourceFilter()
  const { selectedIndex, setSelectedIndex, setListLength, setItemActions, pendingDelete } = useKeyboardNav()

  const activeFilters = [
    activeType ? { label: "Type", value: activeType } : null,
    activeTag ? { label: "Tag", value: activeTag } : null,
    activeSource ? { label: "Source", value: activeSource } : null,
  ].filter((filter): filter is { label: string; value: string } => filter !== null)

  const allItems = savedItemsQuery.data?.savedItems ?? []
  const items = allItems.filter((item) =>
    (!activeSource || getSourceGroup(item) === activeSource)
    && (!activeType || item.type === activeType)
    && (!activeTag || item.tags.includes(activeTag as (typeof item.tags)[number]))
  )

  useEffect(() => {
    setListLength(items.length)
    if (selectedIndex >= items.length) setSelectedIndex(Math.max(items.length - 1, -1))
  }, [items.length, selectedIndex, setListLength, setSelectedIndex])

  useEffect(() => {
    const item = items[selectedIndex]
    if (!item) {
      setItemActions(null)
      return
    }
    setItemActions({
      onOpen: () => {
        if (!item.isRead) markAsReadMutation.mutate(item.id)
        window.open(item.originalUrl, "_blank", "noreferrer")
      },
      onToggleRead: () => setReadStateMutation.mutate({ id: item.id, isRead: !item.isRead }),
      onCopyUrl: () => void navigator.clipboard.writeText(item.originalUrl).catch(() => {}),
      onDelete: () => deleteMutation.mutate(item.id),
    })
  }, [items, selectedIndex, markAsReadMutation, setReadStateMutation, deleteMutation, setItemActions])

  useEffect(() => {
    setSelectedIndex(-1)
    return () => {
      setListLength(0)
      setItemActions(null)
    }
  }, [setSelectedIndex, setListLength, setItemActions])

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">
          <span>Library</span>
          {activeFilters.length > 0 && (
            <span className="page-title-filters">
              {activeFilters.map((filter) => (
                <span className="page-title-filter" key={`${filter.label}:${filter.value}`}>
                  <span className="page-title-filter-label">{filter.label}</span>
                  <span className="page-title-filter-value">{filter.value}</span>
                </span>
              ))}
            </span>
          )}
        </h1>
        <label className="library-sort">
          <span>Sort</span>
          <select
            aria-label="Sort library"
            value={sort}
            onChange={(event) => setSort(event.target.value as SavedItemSort)}
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="title">Title A-Z</option>
            <option value="unread">Unread first</option>
          </select>
        </label>
      </div>

      {savedItemsQuery.isLoading ? <p>Loading...</p> : null}
      {savedItemsQuery.isError ? <p>Could not load saved items.</p> : null}

      {!savedItemsQuery.isLoading && !savedItemsQuery.isError ? (
        items.length === 0 ? (
          <div className="empty-state">
            <span className="empty-state-icon" aria-hidden="true">
              <Library size={28} strokeWidth={1.75} />
            </span>
            <p>No saved items yet.</p>
          </div>
        ) : (
          <ul className="item-list">
            {items.map((item, index) => (
              <li key={item.id}>
                <SavedCard item={item} isSelected={index === selectedIndex} pendingDelete={index === selectedIndex && pendingDelete} onDelete={(id) => deleteMutation.mutate(id)} onOpen={(id) => markAsReadMutation.mutate(id)} onSetReadState={(id, isRead) => setReadStateMutation.mutate({ id, isRead })} />
              </li>
            ))}
          </ul>
        )
      ) : null}
    </>
  )
}
