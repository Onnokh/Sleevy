import { useEffect } from "react"

import { useDeleteItem, useMarkAsRead, useSavedItems, useSetReadState } from "../sleevy/saved-items"
import { SavedCard } from "../components/saved-card/saved-card"
import { getSourceGroup, useSourceFilter } from "../components/source-filter/source-filter"
import { useKeyboardNav } from "../contexts/keyboard-nav-context"

export function LibraryPage() {
  const savedItemsQuery = useSavedItems()
  const deleteMutation = useDeleteItem()
  const markAsReadMutation = useMarkAsRead()
  const setReadStateMutation = useSetReadState()
  const { activeSource, activeType, activeTag } = useSourceFilter()
  const { selectedIndex, setSelectedIndex, setListLength, setItemActions, pendingDelete } = useKeyboardNav()

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
        <h1 className="page-title">Library</h1>
      </div>

      {savedItemsQuery.isLoading ? <p>Loading...</p> : null}
      {savedItemsQuery.isError ? <p>Could not load saved items.</p> : null}

      {!savedItemsQuery.isLoading && !savedItemsQuery.isError ? (
        items.length === 0 ? (
          <p>No saved items yet.</p>
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
