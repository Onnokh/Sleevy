import { useDeleteItem, useMarkAsRead, useSavedItems, useSetReadState } from "../sleevy/saved-items"
import { SavedCard } from "../components/saved-card/saved-card"
import { getChannelGroup, useSourceFilter } from "../components/source-filter/source-filter"

export function LibraryPage() {
  const savedItemsQuery = useSavedItems()
  const deleteMutation = useDeleteItem()
  const markAsReadMutation = useMarkAsRead()
  const setReadStateMutation = useSetReadState()
  const { activeSource, activeType, activeTopic } = useSourceFilter()

  const allItems = savedItemsQuery.data?.savedItems ?? []
  const items = allItems.filter((item) =>
    (!activeSource || getChannelGroup(item.captureChannel) === activeSource)
    && (!activeType || item.type === activeType)
    && (!activeTopic || (item.topicOverride ?? item.topic) === activeTopic)
  )

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
