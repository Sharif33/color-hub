export interface AnalyzedColor {
  hex: string
  rgb: string
  count: number
  selectors: string[]
}

const highlightColorInPage = (targetRgb: string) => {
  const normalizeRgb = (value: string): string | null => {
    const rgbMatch = value
      .replace(/\s+/g, "")
      .match(/^rgba?\((\d+),(\d+),(\d+)(?:,(\d*\.?\d+))?\)$/i)
    if (!rgbMatch) return null
    const r = Math.max(0, Math.min(255, parseInt(rgbMatch[1], 10)))
    const g = Math.max(0, Math.min(255, parseInt(rgbMatch[2], 10)))
    const b = Math.max(0, Math.min(255, parseInt(rgbMatch[3], 10)))
    const a = rgbMatch[4] ? parseFloat(rgbMatch[4]) : 1
    if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return null
    if (a === 0) return null
    return `rgb(${r}, ${g}, ${b})`
  }

  const clearHighlights = () => {
    const existing = document.querySelectorAll(
      "[data-ecp-highlight=\"true\"]"
    )
    existing.forEach((node) => node.remove())
  }

  const ensureOverlayRoot = () => {
    const existing = document.getElementById("ecp-highlight-root")
    if (existing) return existing
    const root = document.createElement("div")
    root.id = "ecp-highlight-root"
    root.style.position = "absolute"
    root.style.top = "0"
    root.style.left = "0"
    root.style.width = "0"
    root.style.height = "0"
    root.style.pointerEvents = "none"
    root.style.zIndex = "2147483647"
    document.body.appendChild(root)
    return root
  }

  clearHighlights()
  const root = ensureOverlayRoot()
  const nodes = Array.from(document.querySelectorAll("*"))
  const limit = Math.min(nodes.length, 2000)

  let firstMatchRect: DOMRect | null = null

  for (let i = 0; i < limit; i += 1) {
    const el = nodes[i] as HTMLElement
    const styles = window.getComputedStyle(el)
    const candidates = [
      styles.color,
      styles.backgroundColor,
      styles.borderTopColor,
      styles.borderRightColor,
      styles.borderBottomColor,
      styles.borderLeftColor
    ]

    let matches = false
    for (const candidate of candidates) {
      if (!candidate || candidate === "transparent") continue
      const normalized = normalizeRgb(candidate)
      if (!normalized) continue
      if (normalized === targetRgb) {
        matches = true
        break
      }
    }

    if (!matches) continue
    const rect = el.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) continue
    if (!firstMatchRect) firstMatchRect = rect

    const overlay = document.createElement("div")
    overlay.setAttribute("data-ecp-highlight", "true")
    overlay.style.position = "fixed"
    overlay.style.left = `${rect.left}px`
    overlay.style.top = `${rect.top}px`
    overlay.style.width = `${rect.width}px`
    overlay.style.height = `${rect.height}px`
    overlay.style.border = "2px solid #ff4d4f"
    overlay.style.boxSizing = "border-box"
    overlay.style.background = "rgba(255,77,79,0.08)"
    overlay.style.pointerEvents = "none"
    overlay.style.borderRadius = "2px"
    root.appendChild(overlay)
  }

  if (firstMatchRect) {
    window.scrollBy({
      top: firstMatchRect.top - 80,
      left: 0,
      behavior: "smooth"
    })
  }
}

const clearHighlightsInPage = () => {
  const existing = document.querySelectorAll("[data-ecp-highlight=\"true\"]")
  existing.forEach((node) => node.remove())
  const root = document.getElementById("ecp-highlight-root")
  if (root) root.remove()
}

const extractColorsInPage = () => {
  const normalizeRgb = (value: string): string | null => {
    const rgbMatch = value
      .replace(/\s+/g, "")
      .match(/^rgba?\((\d+),(\d+),(\d+)(?:,(\d*\.?\d+))?\)$/i)
    if (!rgbMatch) return null
    const r = Math.max(0, Math.min(255, parseInt(rgbMatch[1], 10)))
    const g = Math.max(0, Math.min(255, parseInt(rgbMatch[2], 10)))
    const b = Math.max(0, Math.min(255, parseInt(rgbMatch[3], 10)))
    const a = rgbMatch[4] ? parseFloat(rgbMatch[4]) : 1
    if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return null
    if (a === 0) return null
    return `rgb(${r}, ${g}, ${b})`
  }

  const rgbToHex = (rgb: string): string => {
    const match = rgb
      .replace(/\s+/g, "")
      .match(/^rgb\((\d+),(\d+),(\d+)\)$/i)
    if (!match) return "#000000"
    const r = parseInt(match[1], 10)
    const g = parseInt(match[2], 10)
    const b = parseInt(match[3], 10)
    return (
      "#" +
      [r, g, b]
        .map((x) => x.toString(16).padStart(2, "0"))
        .join("")
        .toUpperCase()
    )
  }

  const colorCounts = new Map<
    string,
    { count: number; selectors: Set<string> }
  >()
  const nodes = Array.from(document.querySelectorAll("*"))
  const limit = Math.min(nodes.length, 2000)
  const maxSelectorsPerColor = 20

  const buildSelector = (el: Element): string => {
    const tag = el.tagName.toLowerCase()
    const id = el.id ? `#${el.id}` : ""
    const classList = Array.from(el.classList).slice(0, 6)
    const classes = classList.length ? `.${classList.join(".")}` : ""
    return `${tag}${id}${classes}`.trim()
  }

  for (let i = 0; i < limit; i += 1) {
    const el = nodes[i]
    const styles = window.getComputedStyle(el)
    const candidates = [
      styles.color,
      styles.backgroundColor,
      styles.borderTopColor,
      styles.borderRightColor,
      styles.borderBottomColor,
      styles.borderLeftColor
    ]

    for (const candidate of candidates) {
      if (!candidate || candidate === "transparent") continue
      const normalized = normalizeRgb(candidate)
      if (!normalized) continue
      const existing = colorCounts.get(normalized)
      const selector = buildSelector(el)
      if (existing) {
        existing.count += 1
        if (
          selector &&
          existing.selectors.size < maxSelectorsPerColor
        ) {
          existing.selectors.add(selector)
        }
      } else {
        const selectors = new Set<string>()
        if (selector) selectors.add(selector)
        colorCounts.set(normalized, { count: 1, selectors })
      }
    }
  }

  return Array.from(colorCounts.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 24)
    .map(([rgb, data]) => ({
      rgb,
      hex: rgbToHex(rgb),
      count: data.count,
      selectors: Array.from(data.selectors)
    }))
}

export const analyzeWebpageColors = async (): Promise<AnalyzedColor[]> => {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs?.[0]
      if (!tab?.id) {
        resolve([])
        return
      }

      chrome.scripting.executeScript(
        {
          target: { tabId: tab.id },
          func: extractColorsInPage
        },
        (results) => {
          const colors = (results?.[0]?.result ?? []) as AnalyzedColor[]
          resolve(colors)
        }
      )
    })
  })
}

export const highlightWebpageColor = async (color: AnalyzedColor) => {
  return new Promise<void>((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs?.[0]
      if (!tab?.id) {
        resolve()
        return
      }

      chrome.scripting.executeScript(
        {
          target: { tabId: tab.id },
          func: highlightColorInPage,
          args: [color.rgb]
        },
        () => resolve()
      )
    })
  })
}

export const clearWebpageHighlights = async () => {
  return new Promise<void>((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs?.[0]
      if (!tab?.id) {
        resolve()
        return
      }

      chrome.scripting.executeScript(
        {
          target: { tabId: tab.id },
          func: clearHighlightsInPage
        },
        () => resolve()
      )
    })
  })
}
