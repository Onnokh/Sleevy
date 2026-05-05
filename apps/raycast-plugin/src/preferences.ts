import { getPreferenceValues } from "@raycast/api";
import { Preferences } from "./types";

export type SleevePreferences = {
  readonly apiUrl: string;
  readonly apiKey: string;
};

export function getSleevePreferences(): SleevePreferences {
  const preferences = getPreferenceValues<Preferences>();

  return {
    apiUrl: preferences.apiUrl.trim().replace(/\/+$/, ""),
    apiKey: preferences.apiKey.trim(),
  };
}
