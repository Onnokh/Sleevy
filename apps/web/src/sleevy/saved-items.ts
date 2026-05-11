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

export const linkTypes = ["article", "video", "website", "repository"] as const
export type LinkType = (typeof linkTypes)[number]

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
      const previous = queryClient.getQueryData<SavedItemsResponse>(queryKey)
      if (previous) {
        queryClient.setQueryData<SavedItemsResponse>(queryKey, {
          savedItems: previous.savedItems.map((item) =>
            item.id === id ? { ...item, isRead } : item,
          ),
        })
      }
      return { previous }
    },
    onError: (_err, _vars, context) => {
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
