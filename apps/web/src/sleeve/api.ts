const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4001"

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    credentials: "include",
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
  })

  if (!response.ok) {
    throw new Error(await response.text())
  }

  const text = await response.text()
  return text ? (JSON.parse(text) as T) : (undefined as T)
}
