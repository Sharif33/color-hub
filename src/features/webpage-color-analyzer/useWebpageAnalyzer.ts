import { useEffect, useState } from "react"

import {
  analyzePageGradients,
  highlightPageGradient,
  type PageGradient
} from "~features/page-gradients"
import { openPendingPalette } from "~features/palette-studio/pending"
import { analyzeScreenshotColors } from "~features/screenshot-colors"

import type { AnalyzedColor } from "./index"
import {
  analyzeWebpageColors,
  clearWebpageHighlights,
  highlightWebpageColor
} from "./index"

interface UseWebpageAnalyzerOptions {
  onSelectColor: (color: AnalyzedColor) => void
  /** Called when a gradient's elements are highlighted on the page */
  onHighlightGradient?: () => void
  /** Called when the active page can't be scripted. */
  onAnalyzeFailed?: () => void
}

export const useWebpageAnalyzer = ({
  onSelectColor,
  onHighlightGradient,
  onAnalyzeFailed
}: UseWebpageAnalyzerOptions) => {
  const [analyzedColors, setAnalyzedColors] = useState<AnalyzedColor[]>([])
  const [analyzedGradients, setAnalyzedGradients] = useState<PageGradient[]>([])
  const [selectedGradient, setSelectedGradient] = useState<PageGradient | null>(
    null
  )
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [selectedAnalyzedColor, setSelectedAnalyzedColor] =
    useState<AnalyzedColor | null>(null)
  const [analyzedDomain, setAnalyzedDomain] = useState<string | null>(null)
  // A screenshot palette is saved separately from the page's CSS palette
  const [analysisSource, setAnalysisSource] = useState<"css" | "screenshot">(
    "css"
  )
  // Set when the scan stopped before checking every element
  const [truncatedScan, setTruncatedScan] = useState<{
    scanned: number
    total: number
  } | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [savedWebpageColors, setSavedWebpageColors] = useState<
    Record<string, AnalyzedColor[]>
  >({})

  useEffect(() => {
    chrome.storage.local.get(["WEBPAGES_COLORS"], (result) => {
      setSavedWebpageColors(result.WEBPAGES_COLORS || {})
    })
  }, [])

  useEffect(() => {
    const listener = (
      changes: { [key: string]: chrome.storage.StorageChange },
      area: string
    ) => {
      if (area !== "local") return
      if (changes.WEBPAGES_COLORS?.newValue) {
        setSavedWebpageColors(changes.WEBPAGES_COLORS.newValue || {})
      }
    }
    chrome.storage.onChanged.addListener(listener)
    return () => chrome.storage.onChanged.removeListener(listener)
  }, [])

  const getActiveHostname = () =>
    new Promise<string | null>((resolve) => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tab = tabs?.[0]
        if (!tab?.url) {
          resolve(null)
          return
        }
        try {
          const url = new URL(tab.url)
          resolve(url.hostname)
        } catch {
          resolve(null)
        }
      })
    })

  const analyze = async () => {
    setIsAnalyzing(true)
    setSaveError(null)
    const domain = await getActiveHostname()
    const [analysis, gradientAnalysis] = await Promise.all([
      analyzeWebpageColors(),
      analyzePageGradients()
    ])
    setIsAnalyzing(false)
    if (!analysis) {
      onAnalyzeFailed?.()
      return
    }
    const { colors, scanned, total } = analysis
    setAnalyzedColors(colors)
    setAnalyzedGradients(gradientAnalysis?.gradients ?? [])
    setSelectedGradient(null)
    setSelectedAnalyzedColor(colors[0] ?? null)
    setAnalyzedDomain(domain)
    setAnalysisSource("css")
    setTruncatedScan(scanned < total ? { scanned, total } : null)
  }

  const analyzeScreenshot = async () => {
    setIsAnalyzing(true)
    setSaveError(null)
    // Highlight overlays would be captured too
    await clearWebpageHighlights()
    const domain = await getActiveHostname()
    const colors = await analyzeScreenshotColors()
    setIsAnalyzing(false)
    if (!colors) {
      onAnalyzeFailed?.()
      return
    }
    setAnalyzedColors(colors)
    // A screenshot has pixels, not CSS, so it has no gradients to list
    setAnalyzedGradients([])
    setSelectedGradient(null)
    setSelectedAnalyzedColor(colors[0] ?? null)
    setAnalyzedDomain(domain ? `${domain} (screenshot)` : null)
    setAnalysisSource("screenshot")
    setTruncatedScan(null)
  }

  const selectColor = async (color: AnalyzedColor) => {
    setSelectedAnalyzedColor(color)
    setSelectedGradient(null)
    // Screenshot colors aren't CSS values, so there's nothing to highlight
    if (analysisSource === "css") void highlightWebpageColor(color)
    onSelectColor(color)
  }

  /** Outlines the elements that use `gradient` on the page */
  const selectGradient = (gradient: PageGradient) => {
    setSelectedGradient(gradient)
    void highlightPageGradient(gradient)
    onHighlightGradient?.()
  }

  /** Resolves `false` when the storage write fails. */
  const save = async (): Promise<boolean> => {
    // A page without a hostname (e.g. file://) has nothing to save under.
    // That isn't a failed write, so the popup still closes the results
    if (!analyzedDomain || analyzedColors.length === 0) return true
    setIsSaving(true)
    setSaveError(null)
    try {
      const existing = await chrome.storage.local.get(["WEBPAGES_COLORS"])
      const next = {
        ...(existing.WEBPAGES_COLORS || {}),
        [analyzedDomain]: analyzedColors
      }
      await chrome.storage.local.set({ WEBPAGES_COLORS: next })
    } catch (error) {
      console.warn("Saving webpage colors failed:", error)
      setSaveError("Couldn't save these colors. Please try again.")
      return false
    } finally {
      setIsSaving(false)
    }
    void clearWebpageHighlights()
    return true
  }

  /** Opens the current results in Palette Studio without saving them */
  const openInStudio = async (view?: string) => {
    const tab = await new Promise<chrome.tabs.Tab | undefined>((resolve) =>
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) =>
        resolve(tabs?.[0])
      )
    )
    await openPendingPalette(
      {
        domain: analyzedDomain,
        url: tab?.url ?? "",
        title: tab?.title ?? "",
        timestamp: Date.now(),
        colors: analyzedColors
      },
      view
    )
  }

  const cancel = () => {
    setAnalyzedColors([])
    setAnalyzedGradients([])
    setSelectedGradient(null)
    setSelectedAnalyzedColor(null)
    setAnalyzedDomain(null)
    setTruncatedScan(null)
    setSaveError(null)
    void clearWebpageHighlights()
  }

  /** Deletes without asking; callers confirm first */
  const deleteDomain = async (domain: string) => {
    const existing = await chrome.storage.local.get(["WEBPAGES_COLORS"])
    const next = { ...(existing.WEBPAGES_COLORS || {}) }
    delete next[domain]
    await chrome.storage.local.set({ WEBPAGES_COLORS: next })
  }

  return {
    analyzedColors,
    analyzedGradients,
    selectedGradient,
    selectedAnalyzedColor,
    isAnalyzing,
    analyzedDomain,
    analysisSource,
    truncatedScan,
    isSaving,
    saveError,
    savedWebpageColors,
    analyze,
    analyzeScreenshot,
    selectColor,
    selectGradient,
    save,
    cancel,
    openInStudio,
    deleteDomain
  }
}
