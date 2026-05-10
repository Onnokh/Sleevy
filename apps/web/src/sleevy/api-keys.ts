import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { authClient } from "../auth"

export type ApiKey = {
  readonly id: string
  readonly name: string | null
  readonly prefix: string | null
  readonly start: string | null
  readonly createdAt: string | Date
}

type CreateResult = {
  readonly key: string
}

const queryKey = ["api-keys"] as const

export function useApiKeys() {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      const result = await authClient.apiKey.list()
      if (result.error) throw new Error(result.error.message)
      return result.data.apiKeys as ApiKey[]
    },
    staleTime: 30_000,
  })

  const create = useMutation({
    mutationFn: async (name: string) => {
      const result = await authClient.apiKey.create({ name: name.trim() || undefined })
      if (result.error) throw new Error(result.error.message)
      return result.data as CreateResult
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey })
    },
  })

  const revoke = useMutation({
    mutationFn: async (keyId: string) => {
      const result = await authClient.apiKey.delete({ keyId })
      if (result.error) throw new Error(result.error.message)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey })
    },
  })

  return {
    keys: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    create,
    revoke,
  }
}
