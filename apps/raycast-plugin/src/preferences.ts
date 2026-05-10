import { getPreferenceValues } from "@raycast/api";
import { Preferences } from "./types";

export type SleevyPreferences = {
  readonly apiUrl: string;
  readonly apiKey: string;
};

export function getSleevyPreferences(): SleevyPreferences {
  const preferences = getPreferenceValues<Preferences>();

  return {
    apiUrl: preferences.apiUrl.trim().replace(/\/+$/, ""),
    apiKey: preferences.apiKey.trim(),
  };
}
