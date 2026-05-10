import { useDeleteItem, useMarkAsRead, useSavedItems, useSetReadState } from "../sleevy/saved-items"
import { SavedCard } from "../components/saved-card/saved-card"
import { useSourceFilter } from "../components/source-filter/source-filter"

export function LibraryPage() {
  const savedItemsQuery = useSavedItems()
  const deleteMutation = useDeleteItem()
  const markAsReadMutation = useMarkAsRead()
  const setReadStateMutation = useSetReadState()
  const { activeSource } = useSourceFilter()

  const allItems = savedItemsQuery.data?.savedItems ?? []
  const items = activeSource ? allItems.filter((item) => item.sourceName === activeSource) : allItems

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
            {items.map((item) => (
              <li key={item.id}>
                <SavedCard item={item} onDelete={(id) => deleteMutation.mutate(id)} onOpen={(id) => markAsReadMutation.mutate(id)} onSetReadState={(id, isRead) => setReadStateMutation.mutate({ id, isRead })} />
              </li>
            ))}
          </ul>
        )
      ) : null}
    </>
  )
}
