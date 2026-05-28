/*
 * Plain async Rybbit client for server-side custom events.
 *
 * Deliberately dependency-free (no Effect) so it can be called both from the
 * Analytics Effect service and directly from better-auth database hooks, which
 * are plain async functions. It never throws and never rejects: analytics must
 * not be able to affect a user request or an authentication flow.
 */

export type RybbitConfig = {
  readonly enabled: boolean
  readonly apiUrl: string
  readonly siteId: string
  readonly apiKey: string
}

export type RybbitEvent = {
  readonly name: string
  readonly userId: string
  readonly properties?: Record<string, string | number | boolean>
}

const TIMEOUT_MS = 3_000

const isConfigured = (config: RybbitConfig) =>
  config.enabled &&
  config.apiUrl.length > 0 &&
  config.siteId.length > 0 &&
  config.apiKey.length > 0

export const trackEvent = async (
  config: RybbitConfig,
  event: RybbitEvent,
): Promise<void> => {
  if (!isConfigured(config)) return

  try {
    const response = await fetch(`${config.apiUrl}/api/track`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${config.apiKey}`,
        "content-type": "application/json",
      },
      body: globalThis.JSON.stringify({
        site_id: config.siteId,
        type: "custom_event",
        event_name: event.name,
        user_id: event.userId,
        properties: globalThis.JSON.stringify(event.properties ?? {}),
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })

    if (!response.ok) {
      console.debug(`[rybbit] track "${event.name}" failed with ${response.status}`)
    }
  } catch (cause) {
    console.debug(`[rybbit] track "${event.name}" errored`, cause)
  }
}
