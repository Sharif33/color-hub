import { isColorFormat, type ColorFormat } from "~utils/color-formats"
import { isTailwindVersion, type TailwindVersion } from "~utils/tailwind-match"

export interface Settings {
  /** Format used when clicking a color copies it */
  copyFormat: ColorFormat
  /** Palette used to name colors after their nearest Tailwind color */
  tailwindVersion: TailwindVersion
}

export const SETTINGS_KEY = "settings"

export const DEFAULT_SETTINGS: Settings = {
  copyFormat: "hex",
  tailwindVersion: "v4"
}

/** Fills in defaults for missing or invalid fields. */
export const parseSettings = (value: unknown): Settings => {
  const raw = (value && typeof value === "object" ? value : {}) as Record<
    string,
    unknown
  >
  return {
    copyFormat: isColorFormat(raw.copyFormat)
      ? raw.copyFormat
      : DEFAULT_SETTINGS.copyFormat,
    tailwindVersion: isTailwindVersion(raw.tailwindVersion)
      ? raw.tailwindVersion
      : DEFAULT_SETTINGS.tailwindVersion
  }
}

export const readSettings = async (): Promise<Settings> => {
  const result = await chrome.storage.local.get([SETTINGS_KEY])
  return parseSettings(result[SETTINGS_KEY])
}

export const updateSettings = async (patch: Partial<Settings>) => {
  const current = await readSettings()
  await chrome.storage.local.set({ [SETTINGS_KEY]: { ...current, ...patch } })
}
