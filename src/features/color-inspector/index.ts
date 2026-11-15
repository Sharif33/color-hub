import { parseGradient, type Gradient } from "~/utils/gradient"

interface PageColor {
  r: number
  g: number
  b: number
  a: number
}

/**
 * Starts the hover inspector on the page, or stops it if it's running.
 * Hovering an element shows its text and rendered background colors, their
 * contrast (WCAG and APCA), border color and matching CSS variables. Clicking
 * pins the panel so its buttons can be used; Esc exits. Resolves whether the
 * inspector is now running.
 *
 * The UI lives in a closed shadow root under `[data-ecp-inspector]`, so page
 * styles can't reach it. Like every injected function, this one can't use
 * imports: color parsing, compositing and contrast math are copied here.
 */
const toggleInspectorInPage = (): boolean => {
  type InspectorWindow = Window & { __ecpInspector?: { stop: () => void } }
  const inspectorWindow = window as InspectorWindow
  if (inspectorWindow.__ecpInspector) {
    inspectorWindow.__ecpInspector.stop()
    return false
  }

  // --- Colors ---------------------------------------------------------------

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

  // Same keys as the color analyzer, so variables match the same way
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

  const toHex = (r: number, g: number, b: number) =>
    "#" +
    [r, g, b]
      .map((v) =>
        Math.max(0, Math.min(255, Math.round(v)))
          .toString(16)
          .padStart(2, "0")
      )
      .join("")
      .toUpperCase()

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

  // The element a node is drawn inside, across shadow root boundaries
  const flatParent = (el: Element): Element | null => {
    if (el.assignedSlot) return el.assignedSlot
    if (el.parentElement) return el.parentElement
    const parent = el.parentNode
    return parent instanceof ShadowRoot ? parent.host : null
  }

  // The colors as painted, the same way the WCAG analysis composites them:
  // through every ancestor's background and opacity, onto a white canvas.
  // Images are left out, except that `gradient` paints one color of a
  // gradient background over that element's background color
  const resolveRenderedColors = (
    el: Element,
    textColor: PageColor,
    gradient?: { node: Element; color: Layer }
  ) => {
    let text = premultiply(textColor)
    let background: Layer = [0, 0, 0, 0]
    for (let node: Element | null = el; node; node = flatParent(node)) {
      const styles = window.getComputedStyle(node)
      const layer = parseCssColor(styles.backgroundColor)
      const ownLayer: Layer = layer ? premultiply(layer) : [0, 0, 0, 0]
      const backgroundLayer =
        gradient && gradient.node === node
          ? over(gradient.color, ownLayer)
          : ownLayer
      text = over(text, backgroundLayer)
      background = over(background, backgroundLayer)
      const opacity = parseFloat(styles.opacity)
      if (!Number.isNaN(opacity) && opacity < 1) {
        text = fade(text, opacity)
        background = fade(background, opacity)
      }
    }
    const white: Layer = [255, 255, 255, 1]
    const t = over(text, white)
    const b = over(background, white)
    return {
      foreground: toHex(t[0], t[1], t[2]),
      background: toHex(b[0], b[1], b[2])
    }
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

  // Colors inside a gradient as rgb()/rgba(), which the extension can read
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

  // Each gradient layer of a background-image value, the same way the page
  // gradient scan reads them
  const gradientsIn = (value: string): string[] => {
    if (!value || value === "none" || !value.includes("gradient(")) return []
    const found: string[] = []
    // Older sites still use -webkit- gradients, which the extension reads too
    const start =
      /(?:-webkit-)?(?:repeating-)?(?:linear|radial|conic)-gradient\(/gi
    for (let match = start.exec(value); match; match = start.exec(value)) {
      const close = closingParen(value, match.index + match[0].length - 1)
      if (close === -1) break
      found.push(
        normalizeColors(value.slice(match.index, close + 1)).replace(
          /\s+/g,
          " "
        )
      )
      start.lastIndex = close + 1
    }
    return found
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

  const hexChannels = (hex: string) =>
    [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))

  const relativeLuminance = (hex: string) => {
    const [r, g, b] = hexChannels(hex).map((c) => {
      const n = c / 255
      return n <= 0.03928 ? n / 12.92 : Math.pow((n + 0.055) / 1.055, 2.4)
    })
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
  }
  const contrastRatio = (a: string, b: string) => {
    const [high, low] = [relativeLuminance(a), relativeLuminance(b)].sort(
      (x, y) => y - x
    )
    return (high + 0.05) / (low + 0.05)
  }

  // APCA-W3 0.0.98G-4g
  const apcaLc = (textHex: string, backgroundHex: string) => {
    const screenY = (hex: string) => {
      const [r, g, b] = hexChannels(hex).map((c) => Math.pow(c / 255, 2.4))
      const y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b
      return y > 0.022 ? y : y + Math.pow(0.022 - y, 1.414)
    }
    const text = screenY(textHex)
    const background = screenY(backgroundHex)
    if (Math.abs(background - text) < 0.0005) return 0
    if (background > text) {
      const sapc = (Math.pow(background, 0.56) - Math.pow(text, 0.57)) * 1.14
      return sapc < 0.1 ? 0 : (sapc - 0.027) * 100
    }
    const sapc = (Math.pow(background, 0.65) - Math.pow(text, 0.62)) * 1.14
    return sapc > -0.1 ? 0 : (sapc + 0.027) * 100
  }

  // Custom properties whose value is a color, by color key (see the color
  // analyzer for why matching is by value)
  const colorVariables = new Map<string, string[]>()
  {
    const names = new Set<string>()
    const addNames = (style: CSSStyleDeclaration) => {
      for (let i = 0; i < style.length; i += 1) {
        if (style[i].startsWith("--")) names.add(style[i])
      }
    }
    const visitRules = (rules: CSSRuleList) => {
      for (const rule of Array.from(rules)) {
        if (rule instanceof CSSStyleRule) addNames(rule.style)
        if ("cssRules" in rule) visitRules((rule as CSSGroupingRule).cssRules)
      }
    }
    for (const sheet of [
      ...Array.from(document.styleSheets),
      ...(document.adoptedStyleSheets ?? [])
    ]) {
      try {
        visitRules(sheet.cssRules)
      } catch {
        // Stylesheets from another origin can't be read
      }
    }
    addNames(document.documentElement.style)
    const bareHsl =
      /^-?[\d.]+(?:deg)?\s+[\d.]+%\s+[\d.]+%(?:\s*\/\s*[\d.]+%?)?$/
    const bareRgb = /^\d{1,3}(?:\s*,\s*|\s+)\d{1,3}(?:\s*,\s*|\s+)\d{1,3}$/
    const rootStyles = window.getComputedStyle(document.documentElement)
    for (const name of Array.from(names).slice(0, 5000)) {
      const value = rootStyles.getPropertyValue(name).trim()
      if (!value) continue
      const key = bareHsl.test(value)
        ? colorKey(`hsl(${value})`)
        : bareRgb.test(value)
          ? colorKey(`rgb(${value})`)
          : colorKey(value)
      if (key)
        colorVariables.set(key, [...(colorVariables.get(key) ?? []), name])
    }
  }

  const inputTypesWithoutText = [
    "checkbox",
    "radio",
    "range",
    "color",
    "hidden",
    "image",
    "file"
  ]
  const rendersText = (el: Element): boolean => {
    if (el instanceof SVGElement) return false
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

  const describeElement = (el: Element) => {
    const tag = el.tagName.toLowerCase()
    if (el.id) return `${tag}#${el.id}`
    const classes = Array.from(el.classList).slice(0, 2)
    const more = el.classList.length - classes.length
    return `${tag}${classes.map((name) => `.${name}`).join("")}${more > 0 ? ` +${more}` : ""}`
  }

  // --- UI -------------------------------------------------------------------

  const host = document.createElement("div")
  host.setAttribute("data-ecp-inspector", "true")
  host.style.cssText =
    "all: initial; position: fixed; inset: 0; pointer-events: none; z-index: 2147483647;"
  const shadow = host.attachShadow({ mode: "closed" })
  const style = document.createElement("style")
  style.textContent = `
    .box { position: fixed; display: none; box-sizing: border-box; border: 2px solid #2563eb; background: rgba(37, 99, 235, 0.08); border-radius: 2px; pointer-events: none; }
    .tip { position: fixed; display: none; box-sizing: border-box; width: 290px; padding: 10px 12px; font: 12px/1.4 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; color: #0f172a; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; box-shadow: 0 12px 30px rgba(15, 23, 42, 0.18); pointer-events: none; }
    .tip.pinned { pointer-events: auto; border-color: #93c5fd; }
    .head { display: flex; align-items: center; gap: 6px; margin-bottom: 6px; }
    .name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font: 600 11px ui-monospace, SFMono-Regular, Menlo, monospace; color: #334155; }
    .row { display: flex; align-items: center; gap: 8px; padding: 3px 0; }
    .label { width: 72px; flex-shrink: 0; color: #64748b; font-size: 11px; }
    .swatch { width: 14px; height: 14px; flex-shrink: 0; border-radius: 4px; border: 1px solid rgba(0, 0, 0, 0.15); }
    .strip { width: 96px; height: 14px; flex-shrink: 0; border-radius: 4px; border: 1px solid rgba(0, 0, 0, 0.15); }
    .mono { font: 600 11px ui-monospace, SFMono-Regular, Menlo, monospace; }
    .muted { color: #94a3b8; font-size: 10px; }
    .badge { border-radius: 999px; padding: 1px 6px; font-size: 10px; font-weight: 700; }
    .pass { background: #ecfdf5; color: #047857; }
    .fail { background: #fef2f2; color: #dc2626; }
    .vars { font: 10px ui-monospace, SFMono-Regular, Menlo, monospace; color: #475569; overflow-wrap: anywhere; }
    button { font: inherit; cursor: pointer; }
    .copy { margin-left: auto; padding: 1px 6px; white-space: nowrap; font-size: 10px; color: #334155; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 6px; }
    .copy:hover { background: #f8fafc; }
    .icon { padding: 0 6px; font-size: 14px; line-height: 18px; color: #64748b; background: none; border: 0; border-radius: 6px; }
    .icon:hover { background: #f1f5f9; }
    .actions { display: flex; gap: 6px; margin-top: 8px; }
    .primary { flex: 1; padding: 6px; font-weight: 600; color: #ffffff; background: #2563eb; border: 0; border-radius: 8px; }
    .primary:hover { background: #1d4ed8; }
    .hint { margin-top: 6px; color: #94a3b8; font-size: 10px; }
  `
  const box = document.createElement("div")
  box.className = "box"
  const tip = document.createElement("div")
  tip.className = "tip"
  shadow.append(style, box, tip)
  document.documentElement.appendChild(host)

  const make = (tag: string, className: string, text?: string): HTMLElement => {
    const el = document.createElement(tag)
    if (className) el.className = className
    if (text !== undefined) el.textContent = text
    return el
  }

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      // The async clipboard is missing on http pages
      const area = document.createElement("textarea")
      area.value = text
      shadow.appendChild(area)
      area.select()
      document.execCommand("copy")
      area.remove()
    }
  }

  let current: Element | null = null
  let pinned = false
  let pointer = { x: 0, y: 0 }

  const colorRow = (label: string, hex: string, names: string[] = []) => {
    const row = make("div", "row")
    const swatch = make("span", "swatch")
    swatch.style.background = hex
    row.append(make("span", "label", label), swatch, make("span", "mono", hex))
    if (names.length)
      row.append(make("span", "vars", names.slice(0, 2).join(" ")))
    const copy = make("button", "copy", "Copy")
    copy.addEventListener("click", () => {
      void copyText(hex).then(() => {
        copy.textContent = "Copied"
        setTimeout(() => (copy.textContent = "Copy"), 1200)
      })
    })
    if (pinned) row.append(copy)
    return row
  }

  // The element's first gradient, with buttons to copy it or edit it in
  // Gradient Studio once the panel is pinned
  const gradientRow = (gradients: string[], el: Element) => {
    const row = make("div", "row")
    const strip = make("span", "strip")
    strip.style.backgroundImage = gradients[0]
    row.append(make("span", "label", "Gradient"), strip)
    if (gradients.length > 1)
      row.append(make("span", "muted", `+${gradients.length - 1} more`))
    if (pinned) {
      const copy = make("button", "copy", "Copy")
      copy.title = "Copy the gradient's CSS"
      copy.addEventListener("click", () => {
        void copyText(gradients[0]).then(() => {
          copy.textContent = "Copied"
          setTimeout(() => (copy.textContent = "Copy"), 1200)
        })
      })
      const edit = make("button", "copy", "Edit")
      edit.title = "Edit in Gradient Studio"
      edit.style.marginLeft = "0"
      edit.addEventListener("click", () => {
        // The box the gradient paints: its tile when background-size sets
        // one, else the padding box. Lengths in it are worked out in this box
        const styles = window.getComputedStyle(el)
        const rect = el.getBoundingClientRect()
        const area = {
          width: el.clientWidth || rect.width,
          height: el.clientHeight || rect.height
        }
        const layer = Math.max(
          0,
          splitArgs(styles.backgroundImage).findIndex((part) =>
            /^(?:-webkit-)?(?:repeating-)?(?:linear|radial|conic)-gradient\(/i.test(
              part
            )
          )
        )
        const sizes = splitArgs(styles.backgroundSize)
        const [width = "auto", height = "auto"] = (
          sizes[layer % sizes.length] ?? ""
        ).split(/\s+/)
        const resolve = (value: string, whole: number) => {
          const n = parseFloat(value)
          if (!Number.isFinite(n) || n <= 0) return whole
          if (value.endsWith("%")) return (whole * n) / 100
          return value.endsWith("px") ? n : whole
        }
        void chrome.runtime.sendMessage({
          type: "OPEN_GRADIENT_STUDIO",
          css: gradients[0],
          width: Math.round(resolve(width, area.width)),
          height: Math.round(resolve(height, area.height)),
          viewportWidth: window.innerWidth,
          viewportHeight: window.innerHeight
        })
      })
      row.append(copy, edit)
    }
    return row
  }

  const render = () => {
    const el = current
    if (!el) return
    const styles = window.getComputedStyle(el)
    const textColor = parseCssColor(styles.color)
    const hasText = rendersText(el) && !!textColor && textColor.a > 0
    const shownText =
      hasText && textColor ? textColor : { r: 0, g: 0, b: 0, a: 0 }
    let { foreground, background } = resolveRenderedColors(el, shownText)
    // Text on a gradient is judged by the lowest-contrast color of the part
    // of the gradient behind it, as in the WCAG report
    let onGradient = false
    let gradientNode: Element | null = el
    while (
      gradientNode &&
      !window
        .getComputedStyle(gradientNode)
        .backgroundImage.includes("gradient(")
    )
      gradientNode = flatParent(gradientNode)
    if (hasText && gradientNode) {
      const colors = gradientColorsBehind(
        window.getComputedStyle(gradientNode).backgroundImage,
        gradientNode.getBoundingClientRect(),
        textBounds(el)
      )
      let worst = Infinity
      const backgrounds = new Set<string>()
      for (const color of colors) {
        const rendered = resolveRenderedColors(el, shownText, {
          node: gradientNode,
          color
        })
        backgrounds.add(rendered.background)
        const ratio = contrastRatio(rendered.foreground, rendered.background)
        if (ratio < worst) {
          worst = ratio
          foreground = rendered.foreground
          background = rendered.background
        }
      }
      onGradient = backgrounds.size > 1
    }

    tip.replaceChildren()
    const head = make("div", "head")
    head.append(make("span", "name", describeElement(el)))
    if (pinned) {
      const close = make("button", "icon", "×")
      close.title = "Unpin"
      close.addEventListener("click", () => {
        pinned = false
        tip.classList.remove("pinned")
        render()
      })
      head.append(close)
    }
    tip.append(head)

    if (hasText) {
      tip.append(
        colorRow(
          "Text",
          foreground,
          colorVariables.get(colorKey(styles.color) ?? "") ?? []
        )
      )
    }
    tip.append(
      colorRow(
        onGradient ? "Behind text" : "Background",
        background,
        onGradient
          ? []
          : colorVariables.get(colorKey(styles.backgroundColor) ?? "") ?? []
      )
    )
    if (onGradient)
      tip.append(
        make(
          "div",
          "hint",
          "On a gradient: this is its lowest-contrast color behind the text."
        )
      )

    const borderSides: Array<[string, string, string]> = [
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
    const drawnBorder = borderSides.find(
      ([borderStyle, width]) =>
        borderStyle !== "none" &&
        borderStyle !== "hidden" &&
        parseFloat(width) > 0
    )
    const border = drawnBorder ? parseCssColor(drawnBorder[2]) : null
    if (border && border.a > 0) {
      tip.append(colorRow("Border", toHex(border.r, border.g, border.b)))
    }

    const gradients = gradientsIn(styles.backgroundImage)
    if (gradients.length) tip.append(gradientRow(gradients, el))

    if (hasText) {
      const ratio = contrastRatio(foreground, background)
      const fontSize = parseFloat(styles.fontSize)
      const bold = parseInt(styles.fontWeight, 10) >= 700
      const large = fontSize >= 24 || (bold && fontSize >= 18.66)
      const aa = ratio >= (large ? 3 : 4.5)
      const aaa = ratio >= (large ? 4.5 : 7)
      const shown = (Math.floor(ratio * 100 + 1e-9) / 100).toFixed(2)

      const contrastRow = make("div", "row")
      contrastRow.append(
        make("span", "label", "Contrast"),
        make("span", "mono", `${shown}:1`),
        make("span", `badge ${aa ? "pass" : "fail"}`, `AA ${aa ? "✓" : "✗"}`),
        make("span", `badge ${aaa ? "pass" : "fail"}`, `AAA ${aaa ? "✓" : "✗"}`)
      )
      const apcaRow = make("div", "row")
      apcaRow.append(
        make("span", "label", "APCA"),
        make("span", "mono", `Lc ${apcaLc(foreground, background).toFixed(1)}`)
      )
      const sizeRow = make("div", "row")
      sizeRow.append(
        make("span", "label", "Text"),
        make(
          "span",
          "muted",
          `${Math.round(fontSize * 10) / 10}px · ${styles.fontWeight} · ${large ? "large" : "normal"} text`
        )
      )
      tip.append(contrastRow, apcaRow, sizeRow)

      if (pinned) {
        const actions = make("div", "actions")
        const open = make("button", "primary", "Open in Contrast Checker")
        open.addEventListener("click", () => {
          void chrome.runtime.sendMessage({
            type: "OPEN_CONTRAST_CHECKER",
            foreground,
            background,
            largeText: large
          })
        })
        actions.append(open)
        tip.append(actions)
      }
    } else {
      tip.append(
        make("div", "hint", "No text of its own, so no contrast to check.")
      )
    }

    tip.append(
      make(
        "div",
        "hint",
        pinned
          ? "Click another element to inspect it · Esc to exit"
          : "Click to pin · Esc to exit"
      )
    )
    place()
  }

  const place = () => {
    if (!current) return
    const rect = current.getBoundingClientRect()
    box.style.display = "block"
    box.style.left = `${rect.left}px`
    box.style.top = `${rect.top}px`
    box.style.width = `${rect.width}px`
    box.style.height = `${rect.height}px`
    tip.style.display = "block"
    const margin = 14
    const { width, height } = tip.getBoundingClientRect()
    let left = pointer.x + margin
    let top = pointer.y + margin
    if (left + width > window.innerWidth - 8) left = pointer.x - width - margin
    if (top + height > window.innerHeight - 8) top = pointer.y - height - margin
    tip.style.left = `${Math.max(8, left)}px`
    tip.style.top = `${Math.max(8, top)}px`
  }

  const isOwnEvent = (event: Event) => event.composedPath().includes(host)
  const targetOf = (event: Event): Element | null => {
    const target = event.composedPath()[0]
    return target instanceof Element ? target : null
  }

  const onMove = (event: MouseEvent) => {
    if (pinned || isOwnEvent(event)) return
    pointer = { x: event.clientX, y: event.clientY }
    const target = targetOf(event)
    if (!target) return
    if (target !== current) {
      current = target
      render()
    } else {
      place()
    }
  }

  // While inspecting, clicks pin the panel instead of reaching the page
  const swallow = (event: Event) => {
    if (isOwnEvent(event)) return
    event.preventDefault()
    event.stopImmediatePropagation()
  }
  const onClick = (event: MouseEvent) => {
    if (isOwnEvent(event)) return
    swallow(event)
    const target = targetOf(event)
    if (!target) return
    pointer = { x: event.clientX, y: event.clientY }
    current = target
    pinned = true
    tip.classList.add("pinned")
    render()
  }
  const onKey = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault()
      stop()
    }
  }
  const onScroll = () => {
    if (current) place()
  }

  const stop = () => {
    window.removeEventListener("mousemove", onMove, true)
    window.removeEventListener("click", onClick, true)
    window.removeEventListener("mousedown", swallow, true)
    window.removeEventListener("mouseup", swallow, true)
    window.removeEventListener("pointerdown", swallow, true)
    window.removeEventListener("keydown", onKey, true)
    window.removeEventListener("scroll", onScroll, true)
    host.remove()
    delete inspectorWindow.__ecpInspector
  }

  window.addEventListener("mousemove", onMove, true)
  window.addEventListener("click", onClick, true)
  window.addEventListener("mousedown", swallow, true)
  window.addEventListener("mouseup", swallow, true)
  window.addEventListener("pointerdown", swallow, true)
  window.addEventListener("keydown", onKey, true)
  window.addEventListener("scroll", onScroll, true)
  inspectorWindow.__ecpInspector = { stop }
  return true
}

/** Resolves whether the inspector is now running, or `null` if the page can't be scripted */
export const toggleColorInspector = async (
  tabId: number
): Promise<boolean | null> => {
  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId },
      func: toggleInspectorInPage
    })
    return result?.result === true
  } catch {
    return null
  }
}

/**
 * Validates an `OPEN_GRADIENT_STUDIO` message from the inspector (it comes
 * from page context) and returns the gradient to open, or null
 */
export const gradientFromMessage = (message: {
  css?: unknown
  width?: unknown
  height?: unknown
  viewportWidth?: unknown
  viewportHeight?: unknown
}): Gradient | null => {
  const { css } = message
  if (typeof css !== "string" || css.length > 10000) return null
  const size = (value: unknown) =>
    typeof value === "number" && Number.isFinite(value) && value > 0
      ? value
      : null
  const pair = (width: unknown, height: unknown) => {
    const w = size(width)
    const h = size(height)
    return w && h ? { width: w, height: h } : undefined
  }
  return parseGradient(css, {
    box: pair(message.width, message.height),
    viewport: pair(message.viewportWidth, message.viewportHeight)
  })
}

/** Validates an `OPEN_CONTRAST_CHECKER` message and builds the checker URL */
export const contrastCheckerUrl = (message: {
  foreground?: unknown
  background?: unknown
  largeText?: unknown
}): string | null => {
  const hex = (value: unknown) =>
    typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value)
      ? value.slice(1)
      : null
  const fg = hex(message.foreground)
  const bg = hex(message.background)
  if (!fg || !bg) return null
  return chrome.runtime.getURL(
    `contrast-checker.html?fg=${fg}&bg=${bg}${message.largeText === true ? "&large=1" : ""}`
  )
}
