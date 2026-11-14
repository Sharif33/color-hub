import type { AnalyzedColor } from "~features/webpage-color-analyzer"

import { quantizePixels } from "./quantize"

// Wide enough to keep small UI elements, small enough to stay fast
const SAMPLE_WIDTH = 480

/**
 * The main colors of the visible part of `tab` (or the active tab), including
 * images, canvas and video that the CSS analysis can't see. Works in the
 * popup and in the background script. Resolves `null` when the tab can't be
 * captured.
 */
export const analyzeScreenshotColors = async (
  tab?: chrome.tabs.Tab
): Promise<AnalyzedColor[] | null> => {
  tab =
    tab ?? (await chrome.tabs.query({ active: true, currentWindow: true }))[0]
  if (!tab?.windowId) return null

  let dataUrl: string
  try {
    dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
      format: "png"
    })
  } catch (error) {
    console.warn("Capturing the tab failed:", error)
    return null
  }

  const blob = await (await fetch(dataUrl)).blob()
  const full = await createImageBitmap(blob)
  const scale = Math.min(1, SAMPLE_WIDTH / full.width)
  const width = Math.max(1, Math.round(full.width * scale))
  const height = Math.max(1, Math.round(full.height * scale))
  full.close()
  // Nearest-neighbor ("pixelated") resizing keeps exact colors; smoothing
  // would blend neighboring pixels into colors the page never paints
  const bitmap = await createImageBitmap(blob, {
    resizeWidth: width,
    resizeHeight: height,
    resizeQuality: "pixelated"
  })
  const canvas = new OffscreenCanvas(width, height)
  const context = canvas.getContext("2d", { willReadFrequently: true })
  if (!context) return null
  context.drawImage(bitmap, 0, 0)
  bitmap.close()
  const { data } = context.getImageData(0, 0, width, height)

  return quantizePixels(data).map((color) => ({
    hex: color.hex,
    rgb: `rgb(${color.r}, ${color.g}, ${color.b})`,
    count: color.pixels,
    selectors: [],
    coverage: color.coverage
  }))
}
