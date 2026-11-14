/** A CSS use of a color, recorded for each element that paints with it */
export type ColorProperty =
  | "text"
  | "background"
  | "border"
  | "outline"
  | "decoration"
  | "fill"
  | "stroke"
  | "shadow"
  | "gradient"

export interface AnalyzedColor {
  /** `#RRGGBB`, or `#RRGGBBAA` for a translucent color */
  hex: string
  /** `rgb(r, g, b)`, or `rgba(r, g, b, a)` for a translucent color */
  rgb: string
  count: number
  selectors: string[]
  /** Most used first. Missing in colors saved before 1.2 */
  properties?: ColorProperty[]
  /**
   * Custom properties on :root (or body) whose value is this color, e.g.
   * `--primary`. Matched by value, so a variable is listed even where an
   * element got the color some other way. Missing before 1.2
   */
  variables?: string[]
  /** Share of the screen, from 0 to 1, for colors taken from a screenshot */
  coverage?: number
}

interface PageColor {
  r: number
  g: number
  b: number
  a: number
}

/** One frame's colors, before merging and ranking */
interface ColorScan {
  entries: Array<{
    key: string
    hex: string
    count: number
    selectors: string[]
    properties: Array<[ColorProperty, number]>
    variables: string[]
  }>
  /** Elements checked, and elements found. Fewer checked means cut short */
  scanned: number
  total: number
}

export interface ColorAnalysis {
  colors: AnalyzedColor[]
  scanned: number
  total: number
}

const MAX_ANALYZED_COLORS = 40
const MAX_SELECTORS_PER_COLOR = 20
const MAX_VARIABLES_PER_COLOR = 8

/** Adds up the colors found in each frame and keeps the most used. */
const mergeColorScans = (scans: ColorScan[]): ColorAnalysis => {
  const merged = new Map<
    string,
    {
      hex: string
      count: number
      selectors: Set<string>
      properties: Map<ColorProperty, number>
      variables: Set<string>
    }
  >()
  for (const scan of scans) {
    for (const entry of scan.entries) {
      let color = merged.get(entry.key)
      if (!color) {
        color = {
          hex: entry.hex,
          count: 0,
          selectors: new Set(),
          properties: new Map(),
          variables: new Set()
        }
        merged.set(entry.key, color)
      }
      color.count += entry.count
      for (const selector of entry.selectors) {
        if (color.selectors.size >= MAX_SELECTORS_PER_COLOR) break
        color.selectors.add(selector)
      }
      for (const name of entry.variables) {
        if (color.variables.size >= MAX_VARIABLES_PER_COLOR) break
        color.variables.add(name)
      }
      for (const [property, count] of entry.properties) {
        color.properties.set(
          property,
          (color.properties.get(property) ?? 0) + count
        )
      }
    }
  }
  const colors = Array.from(merged.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, MAX_ANALYZED_COLORS)
    .map(([key, color]) => ({
      rgb: key,
      hex: color.hex,
      count: color.count,
      selectors: Array.from(color.selectors),
      properties: Array.from(color.properties.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([property]) => property),
      variables: Array.from(color.variables)
    }))
  return {
    colors,
    scanned: scans.reduce((sum, scan) => sum + scan.scanned, 0),
    total: scans.reduce((sum, scan) => sum + scan.total, 0)
  }
}

/**
 * Runs `func` in every frame of the tab, iframes included. If that fails
 * (some frames can't be scripted), runs it in the top frame only. Resolves
 * `null` when the page can't be scripted at all.
 */
export const runInAllFrames = <Args extends unknown[], Result>(
  tabId: number,
  func: (...args: Args) => Result,
  args: Args
): Promise<Result[] | null> =>
  new Promise((resolve) => {
    const run = (allFrames: boolean, onFailure: () => void) => {
      chrome.scripting.executeScript(
        { target: { tabId, allFrames }, func, args },
        (results) => {
          if (chrome.runtime.lastError || !results?.length) {
            onFailure()
            return
          }
          resolve(
            results
              .map((result) => result.result as Result | null | undefined)
              .filter((result): result is Result => result != null)
          )
        }
      )
    }
    run(true, () => run(false, () => resolve(null)))
  })

export const getActiveTab = (): Promise<chrome.tabs.Tab | null> =>
  new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      resolve(tabs?.[0] ?? null)
    })
  })

/**
 * Finds the colors the page's elements paint with. Without `highlightKey` it
 * returns the most used colors. With an `AnalyzedColor.rgb` value it outlines
 * the elements that use that color instead, so highlights always match counts
 */
const scanColorsInPage = (highlightKey: string | null): ColorScan => {
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

  // Translucent colors keep their alpha, so a 10% black shadow isn't counted
  // as black text. Alpha is rounded so 0.1 and 0.100000001 are one color
  const colorKey = (value: string): string | null => {
    const color = parseCssColor(value)
    if (!color) return null
    const alpha = Math.round(color.a * 100) / 100
    if (alpha <= 0) return null
    const { r, g, b } = color
    return alpha >= 1
      ? `rgb(${r}, ${g}, ${b})`
      : `rgba(${r}, ${g}, ${b}, ${alpha})`
  }

  const keyToHex = (key: string): string => {
    const [r, g, b, a] = (key.match(/[\d.]+/g) ?? []).map(Number)
    const bytes = a === undefined ? [r, g, b] : [r, g, b, Math.round(a * 255)]
    return (
      "#" +
      bytes
        .map((n) => n.toString(16).padStart(2, "0"))
        .join("")
        .toUpperCase()
    )
  }

  // Colors inside gradients and shadows, which computed styles write as rgb()
  // or as the color function the page used
  const colorFunctionRe =
    /(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\((?:[^()]|\([^()]*\))*\)/gi
  const keysIn = (value: string): string[] =>
    value && value !== "none"
      ? (value.match(colorFunctionRe) ?? [])
          .map(colorKey)
          .filter((key): key is string => key !== null)
      : []

  const inputTypesWithoutText = [
    "checkbox",
    "radio",
    "range",
    "color",
    "hidden",
    "image",
    "file"
  ]
  // `color` only paints text, so it only counts for elements with their own
  // text. Colors that reach borders or SVG through currentColor are counted
  // there, already resolved
  const rendersText = (el: Element): boolean => {
    if (el instanceof HTMLInputElement)
      return !inputTypesWithoutText.includes(el.type)
    if (el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement)
      return true
    for (const node of Array.from(el.childNodes)) {
      if (node.nodeType === Node.TEXT_NODE && node.textContent?.trim())
        return true
    }
    return false
  }

  const isDrawn = (style: string, width: string) =>
    style !== "none" && style !== "hidden" && parseFloat(width) > 0

  const collectColors = (
    el: Element,
    styles: CSSStyleDeclaration
  ): Array<[string, ColorProperty]> => {
    const found: Array<[string, ColorProperty]> = []
    const add = (key: string | null, property: ColorProperty) => {
      if (!key) return
      if (found.some(([k, p]) => k === key && p === property)) return
      found.push([key, property])
    }

    // SVG shapes and SVG text paint with fill and stroke, not color
    if (
      el instanceof SVGGeometryElement ||
      el instanceof SVGTextContentElement
    ) {
      if (!styles.fill.startsWith("url(")) add(colorKey(styles.fill), "fill")
      if (
        !styles.stroke.startsWith("url(") &&
        parseFloat(styles.strokeWidth) > 0
      )
        add(colorKey(styles.stroke), "stroke")
    } else if (rendersText(el)) {
      const text = colorKey(styles.color)
      add(text, "text")
      // An underline in the text's own color is just the text color again
      if (styles.textDecorationLine !== "none") {
        const decoration = colorKey(styles.textDecorationColor)
        if (decoration !== text) add(decoration, "decoration")
      }
    }

    add(colorKey(styles.backgroundColor), "background")
    // Every element has border colors (currentcolor by default), but they only
    // show where a border is drawn
    const borders: Array<[string, string, string]> = [
      [styles.borderTopStyle, styles.borderTopWidth, styles.borderTopColor],
      [
        styles.borderRightStyle,
        styles.borderRightWidth,
        styles.borderRightColor
      ],
      [
        styles.borderBottomStyle,
        styles.borderBottomWidth,
        styles.borderBottomColor
      ],
      [styles.borderLeftStyle, styles.borderLeftWidth, styles.borderLeftColor]
    ]
    for (const [style, width, color] of borders) {
      if (isDrawn(style, width)) add(colorKey(color), "border")
    }
    if (isDrawn(styles.outlineStyle, styles.outlineWidth))
      add(colorKey(styles.outlineColor), "outline")
    for (const key of keysIn(styles.backgroundImage)) add(key, "gradient")
    for (const key of [
      ...keysIn(styles.boxShadow),
      ...keysIn(styles.textShadow)
    ])
      add(key, "shadow")
    return found
  }

  // Skips <head>, display: none and visibility: hidden subtrees, and our own
  // highlight overlays
  const isRendered = (el: Element): boolean => {
    if (el.id === "ecp-highlight-root" || el.hasAttribute("data-ecp-highlight"))
      return false
    if (typeof el.checkVisibility !== "function") return true
    return el.checkVisibility({
      checkVisibilityCSS: true,
      visibilityProperty: true
    } as CheckVisibilityOptions)
  }

  // Colors found inside an iframe say which one
  const framePrefix =
    window === window.top
      ? ""
      : `iframe(${location.hostname || location.protocol}) › `

  const buildSelector = (el: Element): string => {
    const tag = el.tagName.toLowerCase()
    const id = el.id ? `#${el.id}` : ""
    const classList = Array.from(el.classList).slice(0, 6)
    const classes = classList.length ? `.${classList.join(".")}` : ""
    return `${framePrefix}${tag}${id}${classes}`.trim()
  }

  // Elements in document order, including inside shadow roots. Extensions
  // can open closed shadow roots too, through chrome.dom
  const collectElements = (cap: number) => {
    const elements: Element[] = []
    let total = 0
    const dom = (
      globalThis as {
        chrome?: {
          dom?: { openOrClosedShadowRoot?: (el: Element) => ShadowRoot | null }
        }
      }
    ).chrome?.dom
    const shadowRootOf = (el: Element): ShadowRoot | null => {
      if (!(el instanceof HTMLElement)) return null
      try {
        return dom?.openOrClosedShadowRoot?.(el) ?? el.shadowRoot
      } catch {
        return el.shadowRoot
      }
    }
    const visit = (root: Document | ShadowRoot) => {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT)
      let node = walker.nextNode()
      // Past the cap, keep walking to count what the scan leaves out
      while (node) {
        const el = node as Element
        total += 1
        if (elements.length < cap) elements.push(el)
        const shadowRoot = shadowRootOf(el)
        if (shadowRoot) visit(shadowRoot)
        node = walker.nextNode()
      }
    }
    visit(document)
    return { elements, total }
  }

  // Very large pages are cut short by time, so the popup stays responsive
  const { elements: nodes, total } = collectElements(50000)
  const limit = nodes.length
  const deadline = performance.now() + 1500
  let scanned = 0

  if (highlightKey !== null) {
    const existing = document.querySelectorAll('[data-ecp-highlight="true"]')
    existing.forEach((node) => node.remove())
    let root = document.getElementById("ecp-highlight-root")
    if (!root) {
      root = document.createElement("div")
      root.id = "ecp-highlight-root"
      root.style.position = "absolute"
      root.style.top = "0"
      root.style.left = "0"
      root.style.width = "0"
      root.style.height = "0"
      root.style.pointerEvents = "none"
      root.style.zIndex = "2147483647"
      document.body.appendChild(root)
    }
    // Overlays are absolute inside the root so they move with the page when
    // it scrolls. Offsetting by the root's own position covers a positioned
    // <body>
    const rootRect = root.getBoundingClientRect()
    let firstMatchRect: DOMRect | null = null

    for (; scanned < limit && performance.now() < deadline; scanned += 1) {
      const el = nodes[scanned]
      if (!isRendered(el)) continue
      const colors = collectColors(el, window.getComputedStyle(el))
      if (!colors.some(([key]) => key === highlightKey)) continue
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
    return { entries: [], scanned, total }
  }

  // Custom properties whose value is a color, by color key. Computed styles
  // don't say which variable an element used, so colors are matched to
  // variables by value
  const collectColorVariables = (): Map<string, string[]> => {
    const names = new Set<string>()
    const addNames = (style: CSSStyleDeclaration) => {
      for (let i = 0; i < style.length; i += 1) {
        if (style[i].startsWith("--")) names.add(style[i])
      }
    }
    const visitRules = (rules: CSSRuleList) => {
      for (const rule of Array.from(rules)) {
        if (rule instanceof CSSStyleRule) addNames(rule.style)
        // @media, @supports, @layer, @container and nested rules
        if ("cssRules" in rule) visitRules((rule as CSSGroupingRule).cssRules)
      }
    }
    const sheets = [
      ...Array.from(document.styleSheets),
      ...(document.adoptedStyleSheets ?? [])
    ]
    for (const sheet of sheets) {
      try {
        visitRules(sheet.cssRules)
      } catch {
        // Stylesheets from another origin can't be read
      }
    }
    addNames(document.documentElement.style)

    // Design systems often store bare channels and wrap them where used, e.g.
    // `--primary: 222 47% 11%` with `hsl(var(--primary))`
    const bareHsl =
      /^-?[\d.]+(?:deg)?\s+[\d.]+%\s+[\d.]+%(?:\s*\/\s*[\d.]+%?)?$/
    const bareRgb = /^\d{1,3}(?:\s*,\s*|\s+)\d{1,3}(?:\s*,\s*|\s+)\d{1,3}$/
    const variableColorKey = (value: string): string | null => {
      if (bareHsl.test(value)) return colorKey(`hsl(${value})`)
      if (bareRgb.test(value)) return colorKey(`rgb(${value})`)
      return colorKey(value)
    }

    // Variables set on body (and not on :root) are found there
    const scopes = [document.documentElement, document.body]
      .filter((el): el is HTMLElement => el !== null)
      .map((el) => window.getComputedStyle(el))
    const byKey = new Map<string, string[]>()
    for (const name of Array.from(names).slice(0, 5000)) {
      for (const scope of scopes) {
        // Computed values have var() references already substituted
        const value = scope.getPropertyValue(name).trim()
        if (!value) continue
        const key = variableColorKey(value)
        if (key) {
          const list = byKey.get(key) ?? []
          list.push(name)
          byKey.set(key, list)
        }
        break
      }
    }
    return byKey
  }
  const colorVariables = collectColorVariables()

  const colorCounts = new Map<
    string,
    {
      count: number
      selectors: Set<string>
      properties: Map<ColorProperty, number>
    }
  >()
  const maxSelectorsPerColor = 20

  for (; scanned < limit && performance.now() < deadline; scanned += 1) {
    const el = nodes[scanned]
    if (!isRendered(el)) continue
    const colors = collectColors(el, window.getComputedStyle(el))
    if (colors.length === 0) continue
    const selector = buildSelector(el)
    for (const [key, property] of colors) {
      let entry = colorCounts.get(key)
      if (!entry) {
        entry = { count: 0, selectors: new Set(), properties: new Map() }
        colorCounts.set(key, entry)
      }
      entry.count += 1
      entry.properties.set(property, (entry.properties.get(property) ?? 0) + 1)
      if (selector && entry.selectors.size < maxSelectorsPerColor) {
        entry.selectors.add(selector)
      }
    }
  }

  return {
    entries: Array.from(colorCounts.entries()).map(([key, data]) => ({
      key,
      hex: keyToHex(key),
      count: data.count,
      selectors: Array.from(data.selectors),
      properties: Array.from(data.properties.entries()),
      variables: colorVariables.get(key) ?? []
    })),
    scanned,
    total
  }
}

const clearHighlightsInPage = () => {
  const existing = document.querySelectorAll('[data-ecp-highlight="true"]')
  existing.forEach((node) => node.remove())
  const root = document.getElementById("ecp-highlight-root")
  if (root) root.remove()
}

/** Analyzes `tab`, or the active tab. Resolves `null` when it can't be scripted */
export const analyzeWebpageColors = async (
  tab?: chrome.tabs.Tab
): Promise<ColorAnalysis | null> => {
  tab = tab ?? (await getActiveTab()) ?? undefined
  if (!tab?.id) return null
  const scans = await runInAllFrames(tab.id, scanColorsInPage, [null])
  return scans ? mergeColorScans(scans) : null
}

export const highlightWebpageColor = async (color: AnalyzedColor) => {
  const tab = await getActiveTab()
  if (!tab?.id) return
  await runInAllFrames(tab.id, scanColorsInPage, [color.rgb])
}

export interface ContrastPair {
  foreground: string
  background: string
  /** WCAG large text (≥ 24px, or ≥ 18.66px bold), judged at 3:1 / 4.5:1 */
  largeText: boolean
  /**
   * The text is on a gradient, and `background` is the gradient's
   * lowest-contrast color behind it. Missing before 1.3
   */
  onGradient?: boolean
  count: number
  selectors: string[]
}

export interface WCAGAnalysisData {
  url: string
  title: string
  timestamp: number
  pairs: ContrastPair[]
  /** Text elements checked and found. Missing in reports from before 1.2 */
  scanned?: number
  total?: number
}

/** One frame's pairs, before merging and ranking */
interface ContrastScan {
  pairs: ContrastPair[]
  scanned: number
  total: number
}

const MAX_CONTRAST_PAIRS = 100

const mergeContrastScans = (
  scans: ContrastScan[]
): Pick<WCAGAnalysisData, "pairs" | "scanned" | "total"> => {
  const merged = new Map<string, ContrastPair>()
  for (const scan of scans) {
    for (const pair of scan.pairs) {
      const key = `${pair.foreground}|${pair.background}|${pair.largeText}`
      const existing = merged.get(key)
      if (existing) {
        existing.count += pair.count
        existing.selectors = Array.from(
          new Set([...existing.selectors, ...pair.selectors])
        )
        if (pair.onGradient) existing.onGradient = true
      } else {
        merged.set(key, { ...pair, selectors: [...pair.selectors] })
      }
    }
  }
  return {
    pairs: Array.from(merged.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, MAX_CONTRAST_PAIRS),
    scanned: scans.reduce((sum, scan) => sum + scan.scanned, 0),
    total: scans.reduce((sum, scan) => sum + scan.total, 0)
  }
}

const extractContrastPairsInPage = (): ContrastScan => {
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

  // WCAG 2 contrast ratio of two opaque hex colors
  const contrastOf = (a: string, b: string) => {
    const luminance = (hex: string) => {
      const [r, g, b] = [1, 3, 5].map((i) => {
        const n = parseInt(hex.slice(i, i + 2), 16) / 255
        return n <= 0.03928 ? n / 12.92 : Math.pow((n + 0.055) / 1.055, 2.4)
      })
      return 0.2126 * r + 0.7152 * g + 0.0722 * b
    }
    const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x)
    return (high + 0.05) / (low + 0.05)
  }

  // The index of the ")" that closes the "(" at `open`
  const closingParen = (text: string, open: number): number => {
    let depth = 0
    for (let i = open; i < text.length; i += 1) {
      if (text[i] === "(") depth += 1
      else if (text[i] === ")") {
        depth -= 1
        if (depth === 0) return i
      }
    }
    return -1
  }

  // Splits on commas outside parentheses
  const splitArgs = (text: string): string[] => {
    const parts: string[] = []
    let depth = 0
    let current = ""
    for (const char of text) {
      if (char === "(") depth += 1
      else if (char === ")") depth -= 1
      if (char === "," && depth === 0) {
        parts.push(current.trim())
        current = ""
      } else current += char
    }
    if (current.trim()) parts.push(current.trim())
    return parts
  }

  /**
   * The colors the top gradient of a `background-image` shows behind
   * `textRect`, premultiplied. For a linear gradient that's the stretch of
   * it under the text; for radial, conic and repeating gradients, all of its
   * colors. Blends are worked out in sRGB, so a gradient blended `in oklch`
   * comes out close, not exact. Empty when there's no gradient to read.
   */
  const gradientColorsBehind = (
    value: string,
    box: DOMRect,
    textRect: DOMRect
  ): Layer[] => {
    const start =
      /(-webkit-)?(repeating-)?(linear|radial|conic)-gradient\(/i.exec(value)
    if (!start) return []
    const open = start.index + start[0].length - 1
    const close = closingParen(value, open)
    if (close === -1) return []
    const args = splitArgs(value.slice(open + 1, close))
    const colorStart =
      /^(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color|color-mix)\(/i
    const config = args.length && !colorStart.test(args[0]) ? args.shift()! : ""
    const linear = start[3].toLowerCase() === "linear" && !start[2]
    // A -webkit- gradient names the side it starts from (`top` is today's
    // `to bottom`), and its angles start at 3 o'clock, counterclockwise
    const legacy = Boolean(start[1])
    const opposite: Record<string, string> = {
      top: "bottom",
      bottom: "top",
      left: "right",
      right: "left"
    }

    // The direction as an angle, 0 pointing up. A corner's angle depends on
    // the box: the line is at right angles to the other diagonal
    let angle = 180
    if (linear) {
      const side = legacy
        ? config.match(/^\s*((?:top|bottom|left|right)(?:\s+[a-z]+)?)\s*$/i)
        : config.match(/\bto\s+([a-z\s]+?)(?:\s+in\s|$)/i)
      const degrees = config.match(/(-?[\d.]+)(deg|turn|rad|grad)/i)
      if (side) {
        const words = side[1]
          .toLowerCase()
          .split(/\s+/)
          .map((word) => (legacy ? opposite[word] ?? word : word))
        const v = words.includes("top")
          ? "top"
          : words.includes("bottom")
            ? "bottom"
            : ""
        const h = words.includes("left")
          ? "left"
          : words.includes("right")
            ? "right"
            : ""
        const corner = (Math.atan2(box.height, box.width) * 180) / Math.PI
        const corners: Record<string, number> = {
          "top right": corner,
          "bottom right": 180 - corner,
          "bottom left": 180 + corner,
          "top left": 360 - corner
        }
        // An old -webkit- corner points straight along the diagonal
        const diagonal =
          (Math.atan2(
            h === "right" ? box.width : -box.width,
            v === "bottom" ? -box.height : box.height
          ) *
            180) /
          Math.PI
        angle =
          v && h
            ? legacy
              ? diagonal
              : corners[`${v} ${h}`]
            : v === "top"
              ? 0
              : v === "bottom"
                ? 180
                : h === "left"
                  ? 270
                  : 90
      } else if (degrees) {
        const n = parseFloat(degrees[1])
        const unit = degrees[2].toLowerCase()
        const degreesValue =
          unit === "turn"
            ? n * 360
            : unit === "rad"
              ? (n * 180) / Math.PI
              : unit === "grad"
                ? n * 0.9
                : n
        angle = legacy ? 90 - degreesValue : degreesValue
      }
    }
    const radians = (angle * Math.PI) / 180
    const dx = Math.sin(radians)
    const dy = -Math.cos(radians)
    // Long enough that the corners are at 0% and 100%
    const length = Math.abs(box.width * dx) + Math.abs(box.height * dy) || 1

    // Splits on spaces outside parentheses, so a calc() stays one word
    const splitSpaces = (text: string): string[] => {
      const words: string[] = []
      let depth = 0
      let current = ""
      for (const char of text) {
        if (char === "(") depth += 1
        else if (char === ")") depth -= 1
        if (depth === 0 && /\s/.test(char)) {
          if (current) words.push(current)
          current = ""
        } else current += char
      }
      if (current) words.push(current)
      return words
    }

    // A stop position as a fraction of the gradient: %, px (linear only),
    // deg or turn, or a calc() adding and subtracting them, which computed
    // styles keep as written. Null when it can't be read, which spreads the
    // stop out like one without a position
    const toFraction = (word: string): number | null => {
      const calc = word.match(/^calc\((.*)\)$/i)
      const terms = calc ? calc[1].trim().split(/\s+([+-])\s+/) : [word]
      let total = 0
      for (let i = 0; i < terms.length; i += 2) {
        const term = terms[i].match(/^(-?[\d.]+)(%|px|deg|turn)?$/i)
        if (!term) return null
        const n = parseFloat(term[1])
        const unit = (term[2] ?? "").toLowerCase()
        const fraction =
          unit === "%"
            ? n / 100
            : unit === "px"
              ? linear
                ? n / length
                : null
              : unit === "deg"
                ? n / 360
                : unit === "turn"
                  ? n
                  : n === 0
                    ? 0
                    : null
        if (fraction === null || !Number.isFinite(fraction)) return null
        total += (i > 0 && terms[i - 1] === "-" ? -1 : 1) * fraction
      }
      return total
    }

    const stops: Array<{ color: Layer; at: number | null }> = []
    for (const arg of args) {
      const colorMatch = colorStart.exec(arg)
      // A color hint; the blend around it is taken as straight
      if (!colorMatch) continue
      const end = closingParen(arg, colorMatch[0].length - 1)
      const color = parseCssColor(arg.slice(0, end + 1))
      if (!color) return []
      const positions = splitSpaces(arg.slice(end + 1))
        .slice(0, 2)
        .map(toFraction)
      for (const at of positions.length ? positions : [null])
        stops.push({ color: premultiply(color), at })
    }
    if (stops.length === 0) return []
    // Missing positions, filled in the way CSS does
    if (stops[0].at === null) stops[0].at = 0
    if (stops[stops.length - 1].at === null) stops[stops.length - 1].at = 1
    let max = 0
    for (const stop of stops) {
      if (stop.at === null) continue
      stop.at = Math.max(stop.at, max)
      max = stop.at
    }
    for (let i = 1; i < stops.length; i += 1) {
      if (stops[i].at !== null) continue
      let j = i
      while (stops[j].at === null) j += 1
      const from = stops[i - 1].at as number
      const to = stops[j].at as number
      for (let k = i; k < j; k += 1)
        stops[k].at = from + ((to - from) * (k - i + 1)) / (j - i + 1)
      i = j
    }
    const at = (index: number) => stops[index].at as number
    const colorAt = (t: number): Layer => {
      if (t <= at(0)) return stops[0].color
      for (let i = 1; i < stops.length; i += 1) {
        if (t < at(i)) {
          const u = (t - at(i - 1)) / (at(i) - at(i - 1) || 1)
          return stops[i - 1].color.map(
            (v, k) => v + (stops[i].color[k] - v) * u
          ) as Layer
        }
      }
      return stops[stops.length - 1].color
    }

    if (!linear) {
      // Every stop, and halfway between neighbors
      return stops.flatMap((stop, i) =>
        i === 0 ? [stop.color] : [colorAt((at(i - 1) + at(i)) / 2), stop.color]
      )
    }
    // Where the text's corners fall along the gradient line
    const cx = box.left + box.width / 2
    const cy = box.top + box.height / 2
    const along = [
      [textRect.left, textRect.top],
      [textRect.right, textRect.top],
      [textRect.left, textRect.bottom],
      [textRect.right, textRect.bottom]
    ].map(([x, y]) => ((x - cx) * dx + (y - cy) * dy) / length + 0.5)
    const low = Math.min(1, Math.max(0, Math.min(...along)))
    const high = Math.max(low, Math.min(1, Math.max(...along)))
    const points = [low, high]
    for (let i = 0; i < stops.length; i += 1)
      if (at(i) > low && at(i) < high) points.push(at(i))
    for (let i = 1; i < 8; i += 1) points.push(low + ((high - low) * i) / 8)
    return points.map(colorAt)
  }

  // Where the element's own text is drawn: its text nodes' bounds, which
  // for a block can be much narrower than the block itself
  const textBounds = (el: Element): DOMRect => {
    const range = document.createRange()
    let bounds: DOMRect | null = null
    for (const node of Array.from(el.childNodes)) {
      if (node.nodeType !== Node.TEXT_NODE || !node.textContent?.trim())
        continue
      range.selectNodeContents(node)
      const rect = range.getBoundingClientRect()
      if (rect.width === 0 && rect.height === 0) continue
      bounds = bounds
        ? new DOMRect(
            Math.min(bounds.left, rect.left),
            Math.min(bounds.top, rect.top),
            Math.max(bounds.right, rect.right) -
              Math.min(bounds.left, rect.left),
            Math.max(bounds.bottom, rect.bottom) -
              Math.min(bounds.top, rect.top)
          )
        : rect
    }
    return bounds ?? el.getBoundingClientRect()
  }

  const elementLayers = new Map<
    Element,
    { background: Layer; opacity: number; hasGradient: boolean; image: string }
  >()
  const getElementLayer = (el: Element) => {
    let layer = elementLayers.get(el)
    if (!layer) {
      const styles = window.getComputedStyle(el)
      const background = parseCssColor(styles.backgroundColor)
      const opacity = parseFloat(styles.opacity)
      layer = {
        background: background ? premultiply(background) : [0, 0, 0, 0],
        opacity: Number.isNaN(opacity) ? 1 : opacity,
        hasGradient: styles.backgroundImage.includes("gradient("),
        image: styles.backgroundImage
      }
      elementLayers.set(el, layer)
    }
    return layer
  }

  // The element a node is drawn inside: across shadow root boundaries, and
  // for slotted content, the slot it's shown in
  const flatParent = (el: Element): Element | null => {
    if (el.assignedSlot) return el.assignedSlot
    if (el.parentElement) return el.parentElement
    const parent = el.parentNode
    return parent instanceof ShadowRoot ? parent.host : null
  }

  // Composite the text and the backgrounds behind it the way the browser
  // paints them: each ancestor's background sits under everything inside it,
  // its opacity fades that whole group, and the page canvas is white. Images
  // are left out, except that `gradient` paints one color of a gradient
  // background over that element's background color.
  const resolveRenderedColors = (
    el: Element,
    textColor: PageColor,
    gradient?: { node: Element; color: Layer }
  ) => {
    let text = premultiply(textColor)
    let background: Layer = [0, 0, 0, 0]
    for (let node: Element | null = el; node; node = flatParent(node)) {
      const layer = getElementLayer(node)
      const fill =
        gradient && gradient.node === node
          ? over(gradient.color, layer.background)
          : layer.background
      text = over(text, fill)
      background = over(background, fill)
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

  // Pairs found inside an iframe say which one
  const framePrefix =
    window === window.top
      ? ""
      : `iframe(${location.hostname || location.protocol}) › `

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

  const buildReadableSelector = (el: Element): string =>
    framePrefix + buildElementLabel(el)

  const buildElementLabel = (el: Element): string => {
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
      onGradient: boolean
      count: number
      selectors: Map<string, string>
    }
  >()

  const inputTypesWithoutText = [
    "checkbox",
    "radio",
    "range",
    "color",
    "hidden",
    "image",
    "file"
  ]
  // Any element with its own text, not only common text tags, so text
  // directly inside a <div> is checked too
  const rendersText = (el: Element): boolean => {
    if (el instanceof SVGElement) return false
    if (el instanceof HTMLInputElement)
      return !inputTypesWithoutText.includes(el.type) && el.value !== ""
    if (el instanceof HTMLTextAreaElement) return el.value !== ""
    if (el instanceof HTMLSelectElement) return true
    for (const node of Array.from(el.childNodes)) {
      if (node.nodeType === Node.TEXT_NODE && node.textContent?.trim())
        return true
    }
    return false
  }

  // Skips <head>, display: none and visibility: hidden subtrees
  const isRendered = (el: Element): boolean => {
    if (typeof el.checkVisibility !== "function") return true
    return el.checkVisibility({
      checkVisibilityCSS: true,
      visibilityProperty: true
    } as CheckVisibilityOptions)
  }

  // Elements in document order, including inside shadow roots. Extensions
  // can open closed shadow roots too, through chrome.dom
  const collectElements = (cap: number) => {
    const elements: Element[] = []
    let total = 0
    const dom = (
      globalThis as {
        chrome?: {
          dom?: { openOrClosedShadowRoot?: (el: Element) => ShadowRoot | null }
        }
      }
    ).chrome?.dom
    const shadowRootOf = (el: Element): ShadowRoot | null => {
      if (!(el instanceof HTMLElement)) return null
      try {
        return dom?.openOrClosedShadowRoot?.(el) ?? el.shadowRoot
      } catch {
        return el.shadowRoot
      }
    }
    const visit = (root: Document | ShadowRoot) => {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT)
      let node = walker.nextNode()
      // Past the cap, keep walking to count what the scan leaves out
      while (node) {
        const el = node as Element
        total += 1
        if (elements.length < cap) elements.push(el)
        const shadowRoot = shadowRootOf(el)
        if (shadowRoot) visit(shadowRoot)
        node = walker.nextNode()
      }
    }
    visit(document)
    return { elements, total }
  }

  // Very large pages are cut short by time, so the popup stays responsive
  const { elements: nodes, total } = collectElements(50000)
  const limit = nodes.length
  const deadline = performance.now() + 1500
  let scanned = 0

  for (; scanned < limit && performance.now() < deadline; scanned += 1) {
    const el = nodes[scanned]
    if (!rendersText(el) || !isRendered(el)) continue

    const styles = window.getComputedStyle(el)
    const textColor = parseCssColor(styles.color)
    if (!textColor || textColor.a === 0) continue

    let { foreground: fgHex, background: bgHex } = resolveRenderedColors(
      el,
      textColor
    )
    // On a gradient, judge the text by the lowest-contrast color of the part
    // of the gradient behind it, not by the color under the gradient
    let onGradient = false
    let gradientNode: Element | null = el
    while (gradientNode && !getElementLayer(gradientNode).hasGradient)
      gradientNode = flatParent(gradientNode)
    if (gradientNode) {
      const colors = gradientColorsBehind(
        getElementLayer(gradientNode).image,
        gradientNode.getBoundingClientRect(),
        textBounds(el)
      )
      let worst = Infinity
      const backgrounds = new Set<string>()
      for (const color of colors) {
        const rendered = resolveRenderedColors(el, textColor, {
          node: gradientNode,
          color
        })
        backgrounds.add(rendered.background)
        const ratio = contrastOf(rendered.foreground, rendered.background)
        if (ratio < worst) {
          worst = ratio
          fgHex = rendered.foreground
          bgHex = rendered.background
        }
      }
      // An opaque background between the text and the gradient hides it
      onGradient = backgrounds.size > 1
    }
    // Text in its background's color is usually hidden on purpose, but on a
    // gradient it's text that vanishes where the colors meet
    if (fgHex === bgHex && !onGradient) continue

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
      if (onGradient) existing.onGradient = true
    } else {
      const selectors = new Map<string, string>()
      if (rawSelector) selectors.set(rawSelector, readableSelector)
      pairs.set(key, {
        foreground: fgHex,
        background: bgHex,
        largeText,
        onGradient,
        selectors,
        count: 1
      })
    }
  }

  return {
    pairs: Array.from(pairs.values()).map((pair) => ({
      ...pair,
      selectors: Array.from(pair.selectors.values())
    })),
    scanned,
    total
  }
}

/**
 * Analyzes `tab`, or the active tab, and stores the report for the report
 * page. Resolves `null` when it can't be scripted
 */
export const analyzeWebpageContrastPairs = async (
  tab?: chrome.tabs.Tab
): Promise<WCAGAnalysisData | null> => {
  tab = tab ?? (await getActiveTab()) ?? undefined
  if (!tab?.id) return null
  const scans = await runInAllFrames(tab.id, extractContrastPairsInPage, [])
  // Keep the previous report instead of overwriting it with nothing
  if (!scans) return null
  const data: WCAGAnalysisData = {
    url: tab.url ?? "",
    title: tab.title ?? "",
    timestamp: Date.now(),
    ...mergeContrastScans(scans)
  }
  await chrome.storage.local.set({ WCAG_ANALYSIS_PENDING: data })
  return data
}

export const clearWebpageHighlights = async () => {
  const tab = await getActiveTab()
  if (!tab?.id) return
  await runInAllFrames(tab.id, clearHighlightsInPage, [])
}
