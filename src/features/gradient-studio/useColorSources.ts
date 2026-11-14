import { useEffect, useState } from "react"

import { getHistoryHexes, uniqueNormalizedHexes } from "~utils/color-utils"

export interface ColorSource {
  id: string
  label: string
  colors: string[]
}

const toSources = (history: unknown, saved: unknown): ColorSource[] => {
  const sources: ColorSource[] = [
    { id: "history", label: "Color history", colors: getHistoryHexes(history) }
  ]
  if (saved && typeof saved === "object") {
    for (const [domain, colors] of Object.entries(saved)) {
      if (!Array.isArray(colors)) continue
      sources.push({
        id: `palette:${domain}`,
        label: domain,
        colors: uniqueNormalizedHexes(
          colors.map((color) => (color as { hex?: string })?.hex ?? "")
        )
      })
    }
  }
  return sources
}

/** The color history and each saved palette, as lists of opaque hex colors */
export const useColorSources = (): ColorSource[] => {
  const [sources, setSources] = useState<ColorSource[]>(() =>
    toSources(null, null)
  )

  useEffect(() => {
    let history: unknown = null
    let saved: unknown = null
    chrome.storage.local.get(["colorHistory", "WEBPAGES_COLORS"], (result) => {
      history = result.colorHistory
      saved = result.WEBPAGES_COLORS
      setSources(toSources(history, saved))
    })
    const listener = (
      changes: { [key: string]: chrome.storage.StorageChange },
      area: string
    ) => {
      if (area !== "local") return
      if (changes.colorHistory) history = changes.colorHistory.newValue
      if (changes.WEBPAGES_COLORS) saved = changes.WEBPAGES_COLORS.newValue
      if (changes.colorHistory || changes.WEBPAGES_COLORS)
        setSources(toSources(history, saved))
    }
    chrome.storage.onChanged.addListener(listener)
    return () => chrome.storage.onChanged.removeListener(listener)
  }, [])

  return sources
}
