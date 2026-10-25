import { useCallback, useEffect, useState } from "react"

import type { AnalyzedColor } from "~features/webpage-color-analyzer"

import { PALETTE_PENDING_KEY, type PendingPalette } from "./pending"

export { openPaletteStudio } from "./pending"
export type { PendingPalette } from "./pending"

export type SavedPalettes = Record<string, AnalyzedColor[]>

export const usePalettes = () => {
  const [saved, setSaved] = useState<SavedPalettes>({})
  const [pending, setPending] = useState<PendingPalette | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    chrome.storage.local.get(
      ["WEBPAGES_COLORS", PALETTE_PENDING_KEY],
      (result) => {
        setSaved(result.WEBPAGES_COLORS || {})
        setPending(result[PALETTE_PENDING_KEY] ?? null)
        setLoaded(true)
      }
    )

    const listener = (
      changes: { [key: string]: chrome.storage.StorageChange },
      area: string
    ) => {
      if (area !== "local") return
      if (changes.WEBPAGES_COLORS) {
        setSaved(changes.WEBPAGES_COLORS.newValue || {})
      }
      if (changes[PALETTE_PENDING_KEY]) {
        setPending(changes[PALETTE_PENDING_KEY].newValue ?? null)
      }
    }
    chrome.storage.onChanged.addListener(listener)
    return () => chrome.storage.onChanged.removeListener(listener)
  }, [])

  /** Saves the pending palette under its domain. Resolves the domain, or null */
  const savePending = useCallback(async (): Promise<string | null> => {
    if (!pending?.domain) return null
    const existing = await chrome.storage.local.get(["WEBPAGES_COLORS"])
    await chrome.storage.local.set({
      WEBPAGES_COLORS: {
        ...(existing.WEBPAGES_COLORS || {}),
        [pending.domain]: pending.colors
      }
    })
    await chrome.storage.local.remove(PALETTE_PENDING_KEY)
    return pending.domain
  }, [pending])

  return { saved, pending, loaded, savePending }
}
