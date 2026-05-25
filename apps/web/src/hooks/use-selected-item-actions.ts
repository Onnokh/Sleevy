import { useEffect } from "react"

import type { ItemActions } from "../contexts/keyboard-nav-context"

type UseSelectedItemActionsOptions<T> = {
  readonly items: readonly T[]
  readonly selectedIndex: number
  readonly setListLength: (length: number) => void
  readonly setItemActions: (actions: ItemActions | null) => void
  readonly getItemActions: (item: T) => ItemActions
}

export function useSelectedItemActions<T>({
  items,
  selectedIndex,
  setListLength,
  setItemActions,
  getItemActions,
}: UseSelectedItemActionsOptions<T>) {
  const item = items[selectedIndex]

  useEffect(() => {
    setListLength(items.length)
  }, [items.length, setListLength])

  useEffect(() => {
    setItemActions(item ? getItemActions(item) : null)
    return () => setItemActions(null)
  }, [getItemActions, item, setItemActions])
}
