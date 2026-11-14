import type { AnalyzedColor } from "~features/webpage-color-analyzer"

// Kept apart from the React hooks, so the background script can use it

export const PALETTE_PENDING_KEY = "PALETTE_PENDING"

/** An analysis opened in Palette Studio before it was saved */
export interface PendingPalette {
  /** Key it would be saved under (a hostname); null for pages without one */
  domain: string | null
  url: string
  title: string
  timestamp: number
  colors: AnalyzedColor[]
}

export const openPaletteStudio = (params: Record<string, string> = {}) => {
  const query = new URLSearchParams(params).toString()
  const url = chrome.runtime.getURL(
    `tabs/palette-studio.html${query ? `?${query}` : ""}`
  )
  void chrome.tabs.create({ url })
}

/** Stores `colors` as the pending palette and opens it in Palette Studio */
export const openPendingPalette = async (
  pending: PendingPalette,
  view?: string
) => {
  await chrome.storage.local.set({ [PALETTE_PENDING_KEY]: pending })
  openPaletteStudio({ pending: "1", ...(view ? { view } : {}) })
}

/** The hostname a page's palette is saved under, or null without one */
export const hostnameOf = (url: string | undefined): string | null => {
  if (!url) return null
  try {
    return new URL(url).hostname || null
  } catch {
    return null
  }
}
