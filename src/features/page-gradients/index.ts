import { getActiveTab, runInAllFrames } from "~/features/webpage-color-analyzer"
import { parseGradient, type Gradient } from "~/utils/gradient"

// Kept free of React, like the other page modules

export interface PageGradient {
  /** One gradient function as the page computes it, colors as rgb()/rgba() */
  css: string
  /** Elements (and ::before/::after) that paint it */
  count: number
  selectors: string[]
  /**
   * The box it paints on the first element using it: that element's tile
   * when `background-size` sets one. Corner angles, lengths and radial sizes
   * are worked out in it
   */
  box: { width: number; height: number }
  /** The frame's viewport, for vw and vh */
  viewport: { width: number; height: number }
}

/** One frame's gradients, before merging and ranking */
interface GradientScan {
  entries: PageGradient[]
  scanned: number
  total: number
}

export interface GradientAnalysis {
  gradients: PageGradient[]
  scanned: number
  total: number
}

const MAX_PAGE_GRADIENTS = 24
const MAX_SELECTORS_PER_GRADIENT = 20

const mergeGradientScans = (scans: GradientScan[]): GradientAnalysis => {
  const merged = new Map<string, PageGradient>()
  for (const scan of scans) {
    for (const entry of scan.entries) {
      const existing = merged.get(entry.css)
      if (!existing) {
        merged.set(entry.css, { ...entry, selectors: [...entry.selectors] })
        continue
      }
      existing.count += entry.count
      for (const selector of entry.selectors) {
        if (existing.selectors.length >= MAX_SELECTORS_PER_GRADIENT) break
        if (!existing.selectors.includes(selector))
          existing.selectors.push(selector)
      }
    }
  }
  return {
    gradients: Array.from(merged.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, MAX_PAGE_GRADIENTS),
    scanned: scans.reduce((sum, scan) => sum + scan.scanned, 0),
    total: scans.reduce((sum, scan) => sum + scan.total, 0)
  }
}

/**
 * Finds the gradients in the page's backgrounds, including `::before` and
 * `::after`. Without `highlightKey` it returns them; with a
 * `PageGradient.css` value it outlines the elements that use that gradient
 * instead. Self-contained, like every injected function: the color parsing
 * and the element walk are copied from the color analyzer.
 */
const scanGradientsInPage = (highlightKey: string | null): GradientScan => {
  interface PageColor {
    r: number
    g: number
    b: number
    a: number
  }
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

  // Colors inside the gradient as rgb()/rgba(), which the extension can read
  const colorFunction =
    /^(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color|color-mix)$/i
  const normalizeColors = (text: string): string => {
    const name = /([a-z-]+)\(/gi
    let out = ""
    let last = 0
    for (let match = name.exec(text); match; match = name.exec(text)) {
      if (!colorFunction.test(match[1])) continue
      const open = match.index + match[1].length
      const close = closingParen(text, open)
      if (close === -1) break
      const color = parseCssColor(text.slice(match.index, close + 1))
      if (color) {
        const alpha = Math.round(color.a * 1000) / 1000
        out +=
          text.slice(last, match.index) +
          (alpha >= 1
            ? `rgb(${color.r}, ${color.g}, ${color.b})`
            : `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha})`)
        last = close + 1
      }
      name.lastIndex = close + 1
    }
    return out + text.slice(last)
  }

  // Splits on commas outside parentheses: the layers of a background value
  const splitLayers = (value: string): string[] => {
    const layers: string[] = []
    let depth = 0
    let current = ""
    for (const char of value) {
      if (char === "(") depth += 1
      else if (char === ")") depth -= 1
      if (char === "," && depth === 0) {
        layers.push(current.trim())
        current = ""
      } else current += char
    }
    layers.push(current.trim())
    return layers
  }

  // Older sites still use -webkit- gradients, which the extension reads too
  const GRADIENT_LAYER =
    /^(?:-webkit-)?(?:repeating-)?(?:linear|radial|conic)-gradient\(/i

  // The gradient layers of a background-image value, with their place in it
  // (which background-size goes with them); url() layers are left out
  const gradientsIn = (
    value: string
  ): Array<{ css: string; layer: number }> => {
    if (!value || value === "none" || !value.includes("gradient(")) return []
    return splitLayers(value).flatMap((layer, index) =>
      GRADIENT_LAYER.test(layer)
        ? [{ css: normalizeColors(layer).replace(/\s+/g, " "), layer: index }]
        : []
    )
  }

  // The box a layer paints: its tile when background-size sets one, else the
  // whole area. A gradient has no size of its own, so auto, cover and
  // contain all fill the area
  const tileBox = (
    backgroundSize: string,
    layer: number,
    area: { width: number; height: number }
  ) => {
    const sizes = splitLayers(backgroundSize)
    const [width = "auto", height = "auto"] = (
      sizes[layer % sizes.length] ?? ""
    ).split(/\s+/)
    const resolve = (value: string, whole: number) => {
      const n = parseFloat(value)
      if (!Number.isFinite(n) || n <= 0) return whole
      if (value.endsWith("%")) return (whole * n) / 100
      return value.endsWith("px") ? n : whole
    }
    return {
      width: Math.round(resolve(width, area.width)),
      height: Math.round(resolve(height, area.height))
    }
  }

  const isRendered = (el: Element): boolean => {
    if (el.id === "ecp-highlight-root" || el.hasAttribute("data-ecp-highlight"))
      return false
    if (typeof el.checkVisibility !== "function") return true
    return el.checkVisibility({
      checkVisibilityCSS: true,
      visibilityProperty: true
    } as CheckVisibilityOptions)
  }

  // Gradients found inside an iframe say which one
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
      globalThis as unknown as {
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

  interface FoundGradient {
    css: string
    /** "", "::before" or "::after" */
    pseudo: string
    /** Its box; measured only when it's needed, as it costs a layout read */
    box: () => { width: number; height: number }
  }

  // An element's gradients, with ::before and ::after (when they're drawn)
  const elementGradients = (el: Element): FoundGradient[] => {
    // The padding box, where backgrounds are sized by default. Inline
    // elements have no client size, so they use their bounding box
    const elementArea = () => {
      const rect = el.getBoundingClientRect()
      return {
        width: el.clientWidth || rect.width,
        height: el.clientHeight || rect.height
      }
    }
    const found: FoundGradient[] = []
    const add = (styles: CSSStyleDeclaration, pseudo: string) => {
      for (const { css, layer } of gradientsIn(styles.backgroundImage)) {
        found.push({
          css,
          pseudo,
          box: () => {
            const area = elementArea()
            // A pseudo-element's own size, when it has one
            if (pseudo) {
              const width = parseFloat(styles.width)
              const height = parseFloat(styles.height)
              if (width > 0 && height > 0) {
                area.width = width
                area.height = height
              }
            }
            return tileBox(styles.backgroundSize, layer, area)
          }
        })
      }
    }
    add(window.getComputedStyle(el), "")
    for (const pseudo of ["::before", "::after"]) {
      const styles = window.getComputedStyle(el, pseudo)
      if (styles.content === "none" || styles.content === "normal") continue
      add(styles, pseudo)
    }
    return found
  }

  // Very large pages are cut short by time, so the popup stays responsive
  const { elements: nodes, total } = collectElements(50000)
  const deadline = performance.now() + 1500
  let scanned = 0

  if (highlightKey !== null) {
    document
      .querySelectorAll('[data-ecp-highlight="true"]')
      .forEach((node) => node.remove())
    let root = document.getElementById("ecp-highlight-root")
    if (!root) {
      root = document.createElement("div")
      root.id = "ecp-highlight-root"
      root.style.cssText =
        "position: absolute; top: 0; left: 0; width: 0; height: 0; pointer-events: none; z-index: 2147483647;"
      document.body.appendChild(root)
    }
    const rootRect = root.getBoundingClientRect()
    let firstMatchRect: DOMRect | null = null
    for (
      ;
      scanned < nodes.length && performance.now() < deadline;
      scanned += 1
    ) {
      const el = nodes[scanned]
      if (!isRendered(el)) continue
      if (!elementGradients(el).some(({ css }) => css === highlightKey))
        continue
      const rect = el.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) continue
      if (!firstMatchRect) firstMatchRect = rect
      const overlay = document.createElement("div")
      overlay.setAttribute("data-ecp-highlight", "true")
      overlay.style.cssText = `position: absolute; left: ${rect.left - rootRect.left}px; top: ${rect.top - rootRect.top}px; width: ${rect.width}px; height: ${rect.height}px; border: 2px solid #ff4d4f; box-sizing: border-box; background: rgba(255,77,79,0.08); pointer-events: none; border-radius: 2px;`
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

  const viewport = { width: window.innerWidth, height: window.innerHeight }
  const found = new Map<string, PageGradient>()
  for (; scanned < nodes.length && performance.now() < deadline; scanned += 1) {
    const el = nodes[scanned]
    if (!isRendered(el)) continue
    const gradients = elementGradients(el)
    if (gradients.length === 0) continue
    const selector = buildSelector(el)
    for (const { css, pseudo, box } of gradients) {
      let entry = found.get(css)
      if (!entry) {
        entry = { css, count: 0, selectors: [], box: box(), viewport }
        found.set(css, entry)
      }
      entry.count += 1
      if (
        entry.selectors.length < 20 &&
        !entry.selectors.includes(selector + pseudo)
      )
        entry.selectors.push(selector + pseudo)
    }
  }
  return { entries: Array.from(found.values()), scanned, total }
}

/** The gradients `tab` (or the active tab) uses. Null when it can't be scripted */
export const analyzePageGradients = async (
  tab?: chrome.tabs.Tab
): Promise<GradientAnalysis | null> => {
  tab = tab ?? (await getActiveTab()) ?? undefined
  if (!tab?.id) return null
  const scans = await runInAllFrames(tab.id, scanGradientsInPage, [null])
  return scans ? mergeGradientScans(scans) : null
}

/** Outlines the elements that use `gradient`, like a selected page color */
export const highlightPageGradient = async (gradient: PageGradient) => {
  const tab = await getActiveTab()
  if (!tab?.id) return
  await runInAllFrames(tab.id, scanGradientsInPage, [gradient.css])
}

/** The gradient in the editor's terms, or null if it can't be read */
export const toEditableGradient = (gradient: PageGradient): Gradient | null =>
  parseGradient(gradient.css, {
    box:
      gradient.box.width > 0 && gradient.box.height > 0
        ? gradient.box
        : undefined,
    viewport: gradient.viewport
  })
