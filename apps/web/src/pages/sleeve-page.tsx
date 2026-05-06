import { useDeleteItem, useMarkAsRead, useSavedItems, useSetReadState } from "../sleeve/saved-items"
import { CaptureForm } from "../components/capture-form/capture-form"
import { SavedCard } from "../components/saved-card/saved-card"

export function SleevePage() {
  const savedItemsQuery = useSavedItems()
  const deleteMutation = useDeleteItem()
  const markAsReadMutation = useMarkAsRead()
  const setReadStateMutation = useSetReadState()

  const items = (savedItemsQuery.data?.savedItems ?? []).filter((item) => !item.isRead)

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Your Sleeve</h1>
        <CaptureForm />
      </div>

      {savedItemsQuery.isLoading ? <p>Loading...</p> : null}
      {savedItemsQuery.isError ? <p>Could not load saved items.</p> : null}

      {!savedItemsQuery.isLoading && !savedItemsQuery.isError ? (
        items.length === 0 ? (
          <p>Your sleeve is empty. Save something above.</p>
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
