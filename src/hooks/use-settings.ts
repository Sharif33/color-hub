import { useEffect, useState } from "react"

import {
  DEFAULT_SETTINGS,
  parseSettings,
  readSettings,
  SETTINGS_KEY,
  type Settings
} from "~lib/settings"

export const useSettings = (): Settings => {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)

  useEffect(() => {
    void readSettings().then(setSettings)

    const listener = (
      changes: { [key: string]: chrome.storage.StorageChange },
      area: string
    ) => {
      if (area !== "local") return
      if (changes[SETTINGS_KEY]) {
        setSettings(parseSettings(changes[SETTINGS_KEY].newValue))
      }
    }

    chrome.storage.onChanged.addListener(listener)
    return () => chrome.storage.onChanged.removeListener(listener)
  }, [])

  return settings
}
