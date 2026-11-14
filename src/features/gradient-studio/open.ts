import type { Gradient } from "~utils/gradient"

// Kept apart from the React components, so the popup and the background
// script can open the studio without loading them

export const GRADIENT_STUDIO_PAGE = "tabs/gradient-studio.html"

/** `#rrggbb` as the `color` parameter, which has no `#` */
export const colorParam = (hex: string) => hex.replace(/^#/, "").toLowerCase()

// base64url, so the gradient fits in a URL without escaping
export const encodeGradient = (gradient: Gradient): string =>
  btoa(JSON.stringify(gradient))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")

/** The parsed JSON, or null. Check it with `normalizeGradient` */
export const decodeGradient = (value: string): unknown => {
  try {
    return JSON.parse(atob(value.replace(/-/g, "+").replace(/_/g, "/")))
  } catch {
    return null
  }
}

/**
 * Opens Gradient Studio in a new tab. `color` (hex without `#`) starts a
 * gradient from that color; `g` (from `encodeGradient`) opens a gradient.
 */
export const openGradientStudio = (
  params: { color?: string; g?: string } = {}
) => {
  const query = new URLSearchParams(
    Object.entries(params).filter(([, value]) => value) as string[][]
  ).toString()
  void chrome.tabs.create({
    url: chrome.runtime.getURL(
      `${GRADIENT_STUDIO_PAGE}${query ? `?${query}` : ""}`
    )
  })
}
