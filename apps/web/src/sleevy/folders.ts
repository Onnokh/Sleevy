import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import type { FolderDto, FoldersResponse } from "@sleevy/contract"

import { apiFetch } from "./api"
import { savedItemsQueryKey } from "./saved-items"

export type Folder = FolderDto.Encoded
type FoldersResponseJson = FoldersResponse.Encoded

const foldersQueryKey = ["folders"] as const
export const SAVED_ITEM_DRAG_TYPE = "application/x-sleevy-saved-item"

export function useFolders() {
  return useQuery({
    queryKey: foldersQueryKey,
    queryFn: () => apiFetch<FoldersResponseJson>("/v1/folders"),
    staleTime: 30_000,
  })
}

export function useCreateFolder() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (name: string) =>
      apiFetch<Folder>("/v1/folders", {
        method: "POST",
        body: JSON.stringify({ name }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: foldersQueryKey }),
  })
}

export function useRenameFolder() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, name }: { readonly id: string; readonly name: string }) =>
      apiFetch<Folder>(`/v1/folders/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify({ name }),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: foldersQueryKey })
      void queryClient.invalidateQueries({ queryKey: savedItemsQueryKey })
    },
  })
}

export function useDeleteFolder() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(`/v1/folders/${encodeURIComponent(id)}`, { method: "DELETE" }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: foldersQueryKey })
      void queryClient.invalidateQueries({ queryKey: savedItemsQueryKey })
    },
  })
}

export function useMoveSavedItemToFolder() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ itemId, folderId }: { readonly itemId: string; readonly folderId: string | null }) =>
      apiFetch<void>(`/v1/saved-items/${encodeURIComponent(itemId)}/folder`, {
        method: "PUT",
        body: JSON.stringify({ folderId }),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: savedItemsQueryKey })
    },
  })
}
