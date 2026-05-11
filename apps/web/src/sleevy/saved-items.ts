import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { type FormEvent, useState } from "react"

import { getSourceName } from "../components/source-name/source-name"
import { apiFetch } from "./api"

function detectSourceName(): string {
  const custom = getSourceName()
  if (custom) return custom
  const ua = navigator.userAgent
  if (ua.includes("Macintosh") || ua.includes("Mac OS")) return "macOS"
  if (ua.includes("Windows")) return "Windows"
  if (ua.includes("Linux")) return "Linux"
  return "Desktop"
}

const linkTypes = ["article", "video", "website", "repository"] as const
type LinkType = (typeof linkTypes)[number]

const topics = ["ai", "tools", "typescript", "security", "design", "backend", "front-end"] as const
export type Topic = (typeof topics)[number]

const captureChannels = ["chrome-extension", "ios-app", "ios-share-extension", "raycast", "web-companion", "api"] as const
type CaptureChannel = (typeof captureChannels)[number]

const enrichmentStatuses = ["pending", "enriched", "failed"] as const
type EnrichmentStatus = (typeof enrichmentStatuses)[number]

export type SavedItem = {
  readonly id: string
  readonly linkId: string
  readonly originalUrl: string
  readonly normalizedUrl: string
  readonly host: string
  readonly title?: string
  readonly description?: string
  readonly siteName?: string
  readonly faviconUrl?: string
  readonly faviconLightUrl?: string
  readonly faviconDarkUrl?: string
  readonly imageUrl?: string
  readonly canonicalUrl?: string
  readonly previewSummary?: string
  readonly type: LinkType
  readonly tags: Topic[]
  readonly enrichmentStatus: EnrichmentStatus
  readonly sourceName?: string
  readonly captureChannel?: CaptureChannel
  readonly isRead: boolean
  readonly lastSavedAt: string
}

export const savedItemSorts = ["newest", "oldest", "title", "unread"] as const
export type SavedItemSort = (typeof savedItemSorts)[number]

type SavedItemsResponse = {
  readonly savedItems: SavedItem[]
}

type CaptureResponse = {
  readonly savedItem: SavedItem
  readonly captureResult: "created" | "updated"
}

const queryKey = ["saved-items"] as const
const savedItemsQueryKey = (sort: SavedItemSort) => [...queryKey, sort] as const

const updateSavedItemsCaches = (
  queryClient: ReturnType<typeof useQueryClient>,
  updater: (response: SavedItemsResponse) => SavedItemsResponse,
) => {
  const queries = queryClient.getQueryCache().findAll({ queryKey })
  for (const query of queries) {
    queryClient.setQueryData<SavedItemsResponse>(query.queryKey, (previous) =>
      previous ? updater(previous) : previous,
    )
  }
}

export function useSavedItems(sort: SavedItemSort = "newest") {
  return useQuery({
    queryKey: savedItemsQueryKey(sort),
    queryFn: () => apiFetch<SavedItemsResponse>(`/v1/saved-items?sort=${encodeURIComponent(sort)}`),
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
        body: JSON.stringify({
          url: inputUrl,
          captureChannel: "web-companion" as const,
          sourceName: detectSourceName(),
        }),
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

  const captureUrl = (inputUrl: string, onCaptured?: () => void) => {
    const trimmed = inputUrl.trim()
    if (!trimmed) {
      setFormError("Paste a URL first.")
      return
    }
    setFormError(null)
    mutation.mutate(trimmed, { onSuccess: onCaptured })
  }

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    captureUrl(url)
  }

  const reset = () => {
    setUrl("")
    setFormError(null)
  }

  return { url, setUrl, formError, isPending: mutation.isPending, submit, captureUrl, reset }
}

export function useMarkAsRead() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(`/v1/saved-items/${id}/open`, { method: "POST" }),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey })
      const previous = queryClient.getQueriesData<SavedItemsResponse>({ queryKey })
      updateSavedItemsCaches(queryClient, (response) => ({
        savedItems: response.savedItems.map((item) =>
          item.id === id ? { ...item, isRead: true } : item,
        ),
      }))
      return { previous }
    },
    onError: (_err, _id, context) => {
      if (context?.previous) {
        for (const [key, data] of context.previous) {
          queryClient.setQueryData(key, data)
        }
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey }),
  })
}

type SetReadStateInput = { readonly id: string; readonly isRead: boolean }

export function useSetReadState() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, isRead }: SetReadStateInput) =>
      apiFetch<void>(`/v1/saved-items/${id}/read`, {
        method: "POST",
        body: JSON.stringify({ isRead }),
      }),
    onMutate: async ({ id, isRead }) => {
      await queryClient.cancelQueries({ queryKey })
      const previous = queryClient.getQueriesData<SavedItemsResponse>({ queryKey })
      updateSavedItemsCaches(queryClient, (response) => ({
        savedItems: response.savedItems.map((item) =>
          item.id === id ? { ...item, isRead } : item,
        ),
      }))
      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        for (const [key, data] of context.previous) {
          queryClient.setQueryData(key, data)
        }
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
      const previous = queryClient.getQueriesData<SavedItemsResponse>({ queryKey })
      updateSavedItemsCaches(queryClient, (response) => ({
        savedItems: response.savedItems.filter((item) => item.id !== id),
      }))
      return { previous }
    },
    onError: (_err, _id, context) => {
      if (context?.previous) {
        for (const [key, data] of context.previous) {
          queryClient.setQueryData(key, data)
        }
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey }),
  })
}
