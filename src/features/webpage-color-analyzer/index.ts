export interface AnalyzedColor {
  hex: string
  rgb: string
  count: number
  selectors: string[]
}

interface PageColor {
  r: number
  g: number
  b: number
  a: number
}

const highlightColorInPage = (targetRgb: string) => {
  // Computed styles keep oklch(), lab() and color() as written, so anything
  // that isn't rgb() is resolved to sRGB by painting it on a 1×1 canvas
  const canvas = document.createElement("canvas")
  canvas.width = canvas.height = 1
  const canvasCtx = canvas.getContext("2d", { willReadFrequently: true })
  const parsedColors = new Map<string, PageColor | null>()
  const parseCssColor = (value: string): PageColor | null => {
    const cached = parsedColors.get(value)
    if (cached !== undefined) return cached
    let parsed: PageColor | null = null
    const rgbMatch = value
      .replace(/\s+/g, "")
      .match(/^rgba?\(([\d.]+),([\d.]+),([\d.]+)(?:,([\d.]+))?\)$/i)
    if (rgbMatch) {
      const channel = (n: string) =>
        Math.max(0, Math.min(255, Math.round(parseFloat(n))))
      parsed = {
        r: channel(rgbMatch[1]),
        g: channel(rgbMatch[2]),
        b: channel(rgbMatch[3]),
        a: rgbMatch[4] ? parseFloat(rgbMatch[4]) : 1
      }
    } else if (canvasCtx) {
      // Paint without the "/ alpha" part so the channels read back exactly
      const alphaMatch = value.match(/\/\s*([\d.]+)(%?)\s*\)$/)
      canvasCtx.clearRect(0, 0, 1, 1)
      canvasCtx.fillStyle = "rgba(0, 0, 0, 0)"
      canvasCtx.fillStyle = value.replace(/\/[^/)]*\)$/, ")")
      canvasCtx.fillRect(0, 0, 1, 1)
      const [r, g, b, a] = canvasCtx.getImageData(0, 0, 1, 1).data
      // A value the canvas can't parse leaves the transparent fill in place
      if (a > 0) {
        const alpha = alphaMatch
          ? parseFloat(alphaMatch[1]) / (alphaMatch[2] ? 100 : 1)
          : a / 255
        parsed = { r, g, b, a: alpha }
      }
    }
    parsedColors.set(value, parsed)
    return parsed
  }

  const normalizeRgb = (value: string): string | null => {
    const color = parseCssColor(value)
    if (!color || color.a === 0) return null
    return `rgb(${color.r}, ${color.g}, ${color.b})`
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
  // Overlays are absolute inside the root so they move with the page when it
  // scrolls. Offsetting by the root's own position covers a positioned <body>
  const rootRect = root.getBoundingClientRect()
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
    overlay.style.position = "absolute"
    overlay.style.left = `${rect.left - rootRect.left}px`
    overlay.style.top = `${rect.top - rootRect.top}px`
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
  // Computed styles keep oklch(), lab() and color() as written, so anything
  // that isn't rgb() is resolved to sRGB by painting it on a 1×1 canvas
  const canvas = document.createElement("canvas")
  canvas.width = canvas.height = 1
  const canvasCtx = canvas.getContext("2d", { willReadFrequently: true })
  const parsedColors = new Map<string, PageColor | null>()
  const parseCssColor = (value: string): PageColor | null => {
    const cached = parsedColors.get(value)
    if (cached !== undefined) return cached
    let parsed: PageColor | null = null
    const rgbMatch = value
      .replace(/\s+/g, "")
      .match(/^rgba?\(([\d.]+),([\d.]+),([\d.]+)(?:,([\d.]+))?\)$/i)
    if (rgbMatch) {
      const channel = (n: string) =>
        Math.max(0, Math.min(255, Math.round(parseFloat(n))))
      parsed = {
        r: channel(rgbMatch[1]),
        g: channel(rgbMatch[2]),
        b: channel(rgbMatch[3]),
        a: rgbMatch[4] ? parseFloat(rgbMatch[4]) : 1
      }
    } else if (canvasCtx) {
      // Paint without the "/ alpha" part so the channels read back exactly
      const alphaMatch = value.match(/\/\s*([\d.]+)(%?)\s*\)$/)
      canvasCtx.clearRect(0, 0, 1, 1)
      canvasCtx.fillStyle = "rgba(0, 0, 0, 0)"
      canvasCtx.fillStyle = value.replace(/\/[^/)]*\)$/, ")")
      canvasCtx.fillRect(0, 0, 1, 1)
      const [r, g, b, a] = canvasCtx.getImageData(0, 0, 1, 1).data
      // A value the canvas can't parse leaves the transparent fill in place
      if (a > 0) {
        const alpha = alphaMatch
          ? parseFloat(alphaMatch[1]) / (alphaMatch[2] ? 100 : 1)
          : a / 255
        parsed = { r, g, b, a: alpha }
      }
    }
    parsedColors.set(value, parsed)
    return parsed
  }

  const normalizeRgb = (value: string): string | null => {
    const color = parseCssColor(value)
    if (!color || color.a === 0) return null
    return `rgb(${color.r}, ${color.g}, ${color.b})`
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

/** Resolves `null` when the page can't be scripted. */
export const analyzeWebpageColors = async (): Promise<
  AnalyzedColor[] | null
> => {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs?.[0]
      if (!tab?.id) {
        resolve(null)
        return
      }

      chrome.scripting.executeScript(
        {
          target: { tabId: tab.id },
          func: extractColorsInPage
        },
        (results) => {
          if (chrome.runtime.lastError || !results?.[0]) {
            resolve(null)
            return
          }
          resolve((results[0].result ?? []) as AnalyzedColor[])
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
        () => {
          // Reading lastError stops "Unchecked runtime.lastError" console noise
          void chrome.runtime.lastError
          resolve()
        }
      )
    })
  })
}

export interface ContrastPair {
  foreground: string
  background: string
  /** WCAG large text (≥ 24px, or ≥ 18.66px bold), judged at 3:1 / 4.5:1 */
  largeText: boolean
  count: number
  selectors: string[]
}

export interface WCAGAnalysisData {
  url: string
  title: string
  timestamp: number
  pairs: ContrastPair[]
}

const extractContrastPairsInPage = (): ContrastPair[] => {
  // Computed styles keep oklch(), lab() and color() as written, so anything
  // that isn't rgb() is resolved to sRGB by painting it on a 1×1 canvas
  const canvas = document.createElement("canvas")
  canvas.width = canvas.height = 1
  const canvasCtx = canvas.getContext("2d", { willReadFrequently: true })
  const parsedColors = new Map<string, PageColor | null>()
  const parseCssColor = (value: string): PageColor | null => {
    const cached = parsedColors.get(value)
    if (cached !== undefined) return cached
    let parsed: PageColor | null = null
    const rgbMatch = value
      .replace(/\s+/g, "")
      .match(/^rgba?\(([\d.]+),([\d.]+),([\d.]+)(?:,([\d.]+))?\)$/i)
    if (rgbMatch) {
      const channel = (n: string) =>
        Math.max(0, Math.min(255, Math.round(parseFloat(n))))
      parsed = {
        r: channel(rgbMatch[1]),
        g: channel(rgbMatch[2]),
        b: channel(rgbMatch[3]),
        a: rgbMatch[4] ? parseFloat(rgbMatch[4]) : 1
      }
    } else if (canvasCtx) {
      // Paint without the "/ alpha" part so the channels read back exactly
      const alphaMatch = value.match(/\/\s*([\d.]+)(%?)\s*\)$/)
      canvasCtx.clearRect(0, 0, 1, 1)
      canvasCtx.fillStyle = "rgba(0, 0, 0, 0)"
      canvasCtx.fillStyle = value.replace(/\/[^/)]*\)$/, ")")
      canvasCtx.fillRect(0, 0, 1, 1)
      const [r, g, b, a] = canvasCtx.getImageData(0, 0, 1, 1).data
      // A value the canvas can't parse leaves the transparent fill in place
      if (a > 0) {
        const alpha = alphaMatch
          ? parseFloat(alphaMatch[1]) / (alphaMatch[2] ? 100 : 1)
          : a / 255
        parsed = { r, g, b, a: alpha }
      }
    }
    parsedColors.set(value, parsed)
    return parsed
  }

  // Premultiplied RGBA, so compositing is a weighted sum
  type Layer = [number, number, number, number]
  const premultiply = ({ r, g, b, a }: PageColor): Layer => [
    r * a,
    g * a,
    b * a,
    a
  ]
  // Porter-Duff "source over": `top` painted onto `bottom`
  const over = (top: Layer, bottom: Layer): Layer =>
    top.map((v, i) => v + bottom[i] * (1 - top[3])) as Layer
  const fade = (layer: Layer, opacity: number): Layer =>
    layer.map((v) => v * opacity) as Layer
  const toHex = (layer: Layer): string =>
    "#" +
    layer
      .slice(0, 3)
      .map((v) =>
        Math.max(0, Math.min(255, Math.round(v)))
          .toString(16)
          .padStart(2, "0")
      )
      .join("")
      .toUpperCase()

  const elementLayers = new Map<
    Element,
    { background: Layer; opacity: number }
  >()
  const getElementLayer = (el: Element) => {
    let layer = elementLayers.get(el)
    if (!layer) {
      const styles = window.getComputedStyle(el)
      const background = parseCssColor(styles.backgroundColor)
      const opacity = parseFloat(styles.opacity)
      layer = {
        background: background ? premultiply(background) : [0, 0, 0, 0],
        opacity: Number.isNaN(opacity) ? 1 : opacity
      }
      elementLayers.set(el, layer)
    }
    return layer
  }

  // Composite the text and the backgrounds behind it the way the browser
  // paints them: each ancestor's background sits under everything inside it,
  // its opacity fades that whole group, and the page canvas is white.
  // Background images are not taken into account.
  const resolveRenderedColors = (el: Element, textColor: PageColor) => {
    let text = premultiply(textColor)
    let background: Layer = [0, 0, 0, 0]
    for (let node: Element | null = el; node; node = node.parentElement) {
      const layer = getElementLayer(node)
      text = over(text, layer.background)
      background = over(background, layer.background)
      if (layer.opacity < 1) {
        text = fade(text, layer.opacity)
        background = fade(background, layer.opacity)
      }
    }
    const white: Layer = [255, 255, 255, 1]
    return {
      foreground: toHex(over(text, white)),
      background: toHex(over(background, white))
    }
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
      largeText: boolean
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
    const textColor = parseCssColor(styles.color)
    if (!textColor || textColor.a === 0) continue

    const { foreground: fgHex, background: bgHex } = resolveRenderedColors(
      el,
      textColor
    )
    if (fgHex === bgHex) continue

    const fontSize = parseFloat(styles.fontSize)
    const isBold = parseInt(styles.fontWeight, 10) >= 700
    const largeText = fontSize >= 24 || (isBold && fontSize >= 18.66)

    const key = `${fgHex}|${bgHex}|${largeText}`
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
        largeText,
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

/** Resolves `null` when the page can't be scripted. */
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
            // Keep the previous report instead of overwriting it with nothing
            if (chrome.runtime.lastError || !results?.[0]) {
              resolve(null)
              return
            }
            const pairs = (results[0].result ?? []) as ContrastPair[]
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
        () => {
          // Reading lastError stops "Unchecked runtime.lastError" console noise
          void chrome.runtime.lastError
          resolve()
        }
      )
    })
  })
}
