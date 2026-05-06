import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { type FormEvent, useState } from "react"

import { apiFetch } from "./api"

export type SavedItem = {
  readonly id: string
  readonly originalUrl: string
  readonly host: string
  readonly title?: string
  readonly description?: string
  readonly siteName?: string
  readonly imageUrl?: string
  readonly previewSummary?: string
  readonly enrichmentStatus: "pending" | "enriched" | "failed"
  readonly isRead: boolean
  readonly lastSavedAt: string
}

type SavedItemsResponse = {
  readonly savedItems: SavedItem[]
}

type CaptureResponse = {
  readonly savedItem: SavedItem
  readonly captureResult: "created" | "updated"
}

const queryKey = ["saved-items"] as const

export function useSavedItems() {
  return useQuery({
    queryKey,
    queryFn: () => apiFetch<SavedItemsResponse>("/v1/saved-items"),
    staleTime: 30_000,
  })
}

export function useCapture() {
  const queryClient = useQueryClient()
  const [url, setUrl] = useState("")
  const [formError, setFormError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: (inputUrl: string) =>
      apiFetch<CaptureResponse>("/v1/captures", {
        method: "POST",
        body: JSON.stringify({ url: inputUrl }),
      }),
    onSuccess: () => {
      setUrl("")
      setFormError(null)
      void queryClient.invalidateQueries({ queryKey })
    },
    onError: (cause) => {
      setFormError(cause instanceof Error ? cause.message : "Capture failed.")
    },
  })

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmed = url.trim()
    if (!trimmed) {
      setFormError("Paste a URL first.")
      return
    }
    setFormError(null)
    mutation.mutate(trimmed)
  }

  return { url, setUrl, formError, isPending: mutation.isPending, submit }
}

export function useMarkAsRead() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(`/v1/saved-items/${id}/open`, { method: "POST" }),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey })
      const previous = queryClient.getQueryData<SavedItemsResponse>(queryKey)
      if (previous) {
        queryClient.setQueryData<SavedItemsResponse>(queryKey, {
          savedItems: previous.savedItems.map((item) =>
            item.id === id ? { ...item, isRead: true } : item,
          ),
        })
      }
      return { previous }
    },
    onError: (_err, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous)
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey }),
  })
}

export function useDeleteItem() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(`/v1/saved-items/${id}`, { method: "DELETE" }),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey })
      const previous = queryClient.getQueryData<SavedItemsResponse>(queryKey)
      if (previous) {
        queryClient.setQueryData<SavedItemsResponse>(queryKey, {
          savedItems: previous.savedItems.filter((item) => item.id !== id),
        })
      }
      return { previous }
    },
    onError: (_err, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous)
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey }),
  })
}
