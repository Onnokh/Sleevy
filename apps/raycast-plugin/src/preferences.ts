import { getPreferenceValues } from "@raycast/api";

export type SleevyPreferences = {
  readonly apiUrl: string;
  readonly webUrl?: string;
  readonly apiKey?: string;
  readonly sourceName?: string;
};

export function getSleevyPreferences(): SleevyPreferences {
  const preferences = getPreferenceValues<{
    apiUrl: string;
    webUrl?: string;
    apiKey?: string;
    sourceName?: string;
  }>();

  return {
    apiUrl: preferences.apiUrl.trim().replace(/\/+$/, ""),
    ...(preferences.webUrl?.trim()
      ? { webUrl: preferences.webUrl.trim().replace(/\/+$/, "") }
      : {}),
    ...(preferences.apiKey?.trim() ? { apiKey: preferences.apiKey.trim() } : {}),
    ...(preferences.sourceName?.trim()
      ? { sourceName: preferences.sourceName.trim() }
      : {}),
  };
}
