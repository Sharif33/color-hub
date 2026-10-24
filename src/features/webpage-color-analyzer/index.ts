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

export interface ContrastPair {
  foreground: string
  background: string
  count: number
  selectors: string[]
}

export interface WCAGAnalysisData {
  url: string
  title: string
  timestamp: number
  pairs: ContrastPair[]
}

const extractContrastPairsInPage = (): Array<{
  foreground: string
  background: string
  count: number
  selectors: string[]
}> => {
  const normalizeRgb = (value: string): string | null => {
    const rgbMatch = value
      .replace(/\s+/g, "")
      .match(/^rgba?\((\d+),(\d+),(\d+)(?:,(\d*\.?\d+))?\)$/i)
    if (!rgbMatch) return null
    const r = Math.max(0, Math.min(255, parseInt(rgbMatch[1], 10)))
    const g = Math.max(0, Math.min(255, parseInt(rgbMatch[2], 10)))
    const b = Math.max(0, Math.min(255, parseInt(rgbMatch[3], 10)))
    const alpha = rgbMatch[4] ? parseFloat(rgbMatch[4]) : 1
    if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return null
    if (alpha === 0) return null
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

  const isTransparent = (value: string): boolean => {
    if (!value || value === "transparent") return true
    const m = value.replace(/\s+/g, "").match(/^rgba?\(\d+,\d+,\d+,?(\d*\.?\d+)?\)$/i)
    if (!m) return false
    const a = m[1] !== undefined ? parseFloat(m[1]) : 1
    return a === 0
  }

  const getEffectiveBg = (el: Element): string => {
    let current: Element | null = el
    while (current) {
      const bg = window.getComputedStyle(current).backgroundColor
      if (!isTransparent(bg)) {
        const normalized = normalizeRgb(bg)
        if (normalized) return normalized
      }
      current = current.parentElement
    }
    return "rgb(255, 255, 255)"
  }

  const buildRawSelector = (el: Element): string => {
    const tag = el.tagName.toLowerCase()
    const id = (el.id || "").trim()
    if (id) return `${tag}#${id}`

    const classList = Array.from(el.classList)
      .map((name) => name.trim())
      .filter(Boolean)
    const classes = classList.length ? `.${classList.join(".")}` : ""
    return `${tag}${classes}`.trim()
  }

  const buildReadableSelector = (el: Element): string => {
    const tag = el.tagName.toLowerCase()
    const shorten = (value: string, max = 28): string =>
      value.length > max ? `${value.slice(0, max)}...` : value

    const id = (el.id || "").trim()
    if (id) return `${tag}#${shorten(id)}`

    const classList = Array.from(el.classList)
      .map((name) => name.trim())
      .filter(Boolean)

    if (classList.length > 0) {
      const topClasses = classList.slice(0, 2).map((name) => shorten(name, 20))
      const remainingCount = classList.length - topClasses.length
      const classPart = `.${topClasses.join(".")}`
      return remainingCount > 0
        ? `${tag}${classPart} (+${remainingCount} classes)`
        : `${tag}${classPart}`
    }

    const ariaLabel = (el.getAttribute("aria-label") || "").trim()
    if (ariaLabel) {
      return `${tag}[aria-label="${shorten(ariaLabel.replace(/"/g, "'"), 24)}"]`
    }

    return tag
  }

  const pairs = new Map<
    string,
    {
      foreground: string
      background: string
      count: number
      selectors: Map<string, string>
    }
  >()

  const textSelectors =
    "p, h1, h2, h3, h4, h5, h6, a, span, li, td, th, label, button"
  const nodes = Array.from(document.querySelectorAll(textSelectors))
  const limit = Math.min(nodes.length, 1200)

  for (let i = 0; i < limit; i++) {
    const el = nodes[i]
    const hasText =
      el.childNodes.length > 0 &&
      Array.from(el.childNodes).some(
        (n) => n.nodeType === Node.TEXT_NODE && (n.textContent ?? "").trim().length > 0
      )
    if (!hasText) continue

    const styles = window.getComputedStyle(el)
    const fgRgb = normalizeRgb(styles.color)
    if (!fgRgb) continue

    const bgRgb = getEffectiveBg(el)
    if (fgRgb === bgRgb) continue

    const fgHex = rgbToHex(fgRgb)
    const bgHex = rgbToHex(bgRgb)
    const key = `${fgHex}|${bgHex}`
    const rawSelector = buildRawSelector(el)
    const readableSelector = buildReadableSelector(el)

    if (pairs.has(key)) {
      const existing = pairs.get(key)!
      existing.count++
      if (rawSelector) existing.selectors.set(rawSelector, readableSelector)
    } else {
      const selectors = new Map<string, string>()
      if (rawSelector) selectors.set(rawSelector, readableSelector)
      pairs.set(key, {
        foreground: fgHex,
        background: bgHex,
        selectors,
        count: 1
      })
    }
  }

  return Array.from(pairs.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 100)
    .map((pair) => ({
      ...pair,
      selectors: Array.from(pair.selectors.values())
    }))
}

export const analyzeWebpageContrastPairs =
  async (): Promise<WCAGAnalysisData | null> => {
    return new Promise((resolve) => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tab = tabs?.[0]
        if (!tab?.id) {
          resolve(null)
          return
        }

        const url = tab.url ?? ""
        const title = tab.title ?? ""

        chrome.scripting.executeScript(
          {
            target: { tabId: tab.id },
            func: extractContrastPairsInPage
          },
          async (results) => {
            const pairs = (results?.[0]?.result ?? []) as ContrastPair[]
            const data: WCAGAnalysisData = {
              url,
              title,
              timestamp: Date.now(),
              pairs
            }
            await chrome.storage.local.set({ WCAG_ANALYSIS_PENDING: data })
            resolve(data)
          }
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
