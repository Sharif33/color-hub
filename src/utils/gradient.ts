import {
  hexToRgb,
  oklabToRgb,
  oklchToRgb,
  parseColorWithAlpha,
  rgbToHex,
  rgbToOklab,
  rgbToOklch,
  type ParsedColor
} from "./color-utils"

export type GradientType = "linear" | "radial" | "conic"

/** CSS `<color-interpolation-method>` spaces the editor offers */
export type InterpolationSpace = "srgb" | "oklab" | "oklch"

/** Which way round the hue wheel a polar space goes */
export type HueMethod = "shorter" | "longer"

/** How color is spread between two stops. CSS itself only does `linear` */
export type GradientEasing = "linear" | "ease-in" | "ease-out" | "ease-in-out"

export type RadialShape = "circle" | "ellipse"

export interface GradientStop {
  /** `#rrggbb`, or `#rrggbbaa` for a translucent stop */
  color: string
  /** Percent along the gradient line, or around the circle for conic */
  position: number
}

export interface Gradient {
  type: GradientType
  /**
   * Degrees. Linear: the direction it goes, 0 is to top and 90 to right.
   * Conic: where the first stop starts, clockwise from the top
   */
  angle: number
  /** Radial only */
  shape: RadialShape
  /** Center of radial and conic gradients, in percent of the box */
  center: { x: number; y: number }
  stops: GradientStop[]
  space: InterpolationSpace
  /** Only used by OKLCH */
  hue: HueMethod
  easing: GradientEasing
  repeating: boolean
  /**
   * Opacity of a noise layer over the gradient, 0–100. Grain hides the
   * banding that large, subtle gradients show on 8-bit screens. 0 is none
   */
  grain: number
}

/** A sampled color: channels 0–255, alpha 0–1 */
export interface Rgba {
  r: number
  g: number
  b: number
  a: number
}

export const GRADIENT_TYPES: Array<{ value: GradientType; label: string }> = [
  { value: "linear", label: "Linear" },
  { value: "radial", label: "Radial" },
  { value: "conic", label: "Conic" }
]

export const INTERPOLATION_SPACES: Array<{
  value: InterpolationSpace
  label: string
  description: string
}> = [
  {
    value: "srgb",
    label: "sRGB",
    description: "Classic CSS. Can turn gray in the middle"
  },
  {
    value: "oklab",
    label: "OKLab",
    description: "Smooth and even. A good default"
  },
  {
    value: "oklch",
    label: "OKLCH",
    description: "Most vivid. Goes around the color wheel"
  }
]

export const GRADIENT_EASINGS: Array<{
  value: GradientEasing
  label: string
}> = [
  { value: "linear", label: "Linear" },
  { value: "ease-in", label: "Ease in" },
  { value: "ease-out", label: "Ease out" },
  { value: "ease-in-out", label: "Ease in-out" }
]

export const DEFAULT_GRADIENT: Gradient = {
  type: "linear",
  angle: 90,
  shape: "ellipse",
  center: { x: 50, y: 50 },
  stops: [
    { color: "#2563eb", position: 0 },
    { color: "#db2777", position: 100 }
  ],
  space: "oklab",
  hue: "shorter",
  easing: "linear",
  repeating: false,
  grain: 0
}

const clamp = (n: number, min: number, max: number) =>
  Math.min(max, Math.max(min, n))

/** Stops by position. Stops at the same position keep their order */
export const sortStops = (stops: GradientStop[]): GradientStop[] =>
  stops
    .map((stop, index) => ({ stop, index }))
    .sort((a, b) => a.stop.position - b.stop.position || a.index - b.index)
    .map(({ stop }) => stop)

// --- Interpolation, as CSS Color 4 does it ---

// Below this chroma a color is gray and its OKLCH hue is "powerless": it
// takes the other color's hue, as CSS Color 4 says. Chrome instead keeps the
// arbitrary hue its conversion gives grays (white to blue turns cyan), so
// gradientToCss writes grays as `oklch(L 0.001 H)` with the neighbor's hue
// to get the same result
const ACHROMATIC_CHROMA = 1e-4

interface Coords {
  /** [r, g, b] 0–1, [L, a, b] or [l, c, h]; h is NaN when powerless */
  values: [number, number, number]
  alpha: number
}

const toCoords = (color: string, space: InterpolationSpace): Coords => {
  const parsed = parseColorWithAlpha(color) ?? { hex: "#000000", alpha: 1 }
  const { r, g, b } = hexToRgb(parsed.hex)
  switch (space) {
    case "srgb":
      return { values: [r / 255, g / 255, b / 255], alpha: parsed.alpha }
    case "oklab": {
      const { L, a, b: bAxis } = rgbToOklab(r, g, b)
      return { values: [L, a, bAxis], alpha: parsed.alpha }
    }
    case "oklch": {
      const { l, c, h } = rgbToOklch(r, g, b)
      return {
        values: [l, c, c < ACHROMATIC_CHROMA ? NaN : h],
        alpha: parsed.alpha
      }
    }
  }
}

const fromCoords = (
  [x, y, z]: [number, number, number],
  space: InterpolationSpace
): { r: number; g: number; b: number } => {
  switch (space) {
    case "srgb":
      return {
        r: clamp(Math.round(x * 255), 0, 255),
        g: clamp(Math.round(y * 255), 0, 255),
        b: clamp(Math.round(z * 255), 0, 255)
      }
    case "oklab":
      return oklabToRgb({ L: x, a: y, b: z })
    case "oklch":
      return oklchToRgb({ l: x, c: y, h: ((z % 360) + 360) % 360 })
  }
}

/** Hue fixup from CSS Color 4, so the hue goes the requested way round */
const fixupHues = (h1: number, h2: number, method: HueMethod) => {
  const delta = h2 - h1
  if (method === "shorter") {
    if (delta > 180) h1 += 360
    else if (delta < -180) h2 += 360
  } else if (delta > 0 && delta < 180) h1 += 360
  else if (delta > -180 && delta <= 0) h2 += 360
  return [h1, h2]
}

/**
 * Mixes two colors `amount` (0–1) of the way from `from` to `to`, with
 * premultiplied alpha so a fade to `transparent` doesn't turn gray.
 */
const mixCoords = (
  from: Coords,
  to: Coords,
  amount: number,
  space: InterpolationSpace,
  hueMethod: HueMethod
): Rgba => {
  const a = from.values.slice() as [number, number, number]
  const b = to.values.slice() as [number, number, number]
  const polar = space === "oklch"
  if (polar) {
    if (Number.isNaN(a[2]) && Number.isNaN(b[2])) a[2] = b[2] = 0
    else if (Number.isNaN(a[2])) a[2] = b[2]
    else if (Number.isNaN(b[2])) b[2] = a[2]
    ;[a[2], b[2]] = fixupHues(a[2], b[2], hueMethod)
  }
  const alpha = from.alpha + (to.alpha - from.alpha) * amount
  // The hue isn't premultiplied
  const premultiplied = (index: number) => !polar || index < 2
  const mixed = a.map((start, index) => {
    const end = b[index]
    if (!premultiplied(index) || alpha === 0)
      return start + (end - start) * amount
    const value =
      start * from.alpha + (end * to.alpha - start * from.alpha) * amount
    return value / alpha
  }) as [number, number, number]
  return { ...fromCoords(mixed, space), a: alpha }
}

// cubic-bezier() timing functions, solved for x by bisection
const cubicBezier =
  (x1: number, y1: number, x2: number, y2: number) => (x: number) => {
    const at = (t: number, p1: number, p2: number) =>
      3 * (1 - t) * (1 - t) * t * p1 + 3 * (1 - t) * t * t * p2 + t * t * t
    let low = 0
    let high = 1
    for (let i = 0; i < 30; i += 1) {
      const mid = (low + high) / 2
      if (at(mid, x1, x2) < x) low = mid
      else high = mid
    }
    return at((low + high) / 2, y1, y2)
  }

const EASINGS: Record<GradientEasing, (x: number) => number> = {
  linear: (x) => x,
  "ease-in": cubicBezier(0.42, 0, 1, 1),
  "ease-out": cubicBezier(0, 0, 0.58, 1),
  "ease-in-out": cubicBezier(0.42, 0, 0.58, 1)
}

const toRgba = (color: string): Rgba => {
  const parsed = parseColorWithAlpha(color) ?? { hex: "#000000", alpha: 1 }
  return { ...hexToRgb(parsed.hex), a: parsed.alpha }
}

/**
 * The color at `position` percent along the gradient. Past the first or last
 * stop the gradient keeps that stop's color, as CSS does
 */
export const sampleGradient = (gradient: Gradient, position: number): Rgba => {
  const stops = sortStops(gradient.stops)
  if (stops.length === 0) return { r: 0, g: 0, b: 0, a: 0 }
  const first = stops[0].position
  const last = stops[stops.length - 1].position
  let t = position
  if (gradient.repeating && last > first) {
    t =
      first +
      ((((t - first) % (last - first)) + (last - first)) % (last - first))
  }
  if (t < first) return toRgba(stops[0].color)
  if (t >= last) return toRgba(stops[stops.length - 1].color)
  // At a hard stop (two stops at one position) the later stop's color wins
  const index = stops.findIndex((stop) => t < stop.position) - 1
  const from = stops[index]
  const to = stops[index + 1]
  const amount = EASINGS[gradient.easing](
    (t - from.position) / (to.position - from.position)
  )
  return mixCoords(
    toCoords(from.color, gradient.space),
    toCoords(to.color, gradient.space),
    amount,
    gradient.space,
    gradient.hue
  )
}

/** `#rrggbb`, or `#rrggbbaa` when translucent */
export const rgbaToHex = ({ r, g, b, a }: Rgba): string => {
  const hex = rgbToHex(r, g, b)
  if (a >= 0.999) return hex
  return (
    hex +
    Math.round(clamp(a, 0, 1) * 255)
      .toString(16)
      .padStart(2, "0")
  )
}

/** `count` evenly spaced samples from the first stop to the last */
export const sampleGradientColors = (
  gradient: Gradient,
  count: number
): Rgba[] => {
  const stops = sortStops(gradient.stops)
  const first = stops[0]?.position ?? 0
  const last = stops[stops.length - 1]?.position ?? 100
  return Array.from({ length: count }, (_, i) =>
    sampleGradient(
      gradient,
      count === 1 ? first : first + ((last - first) * i) / (count - 1)
    )
  )
}

interface SampleOptions {
  /** How far, in 8-bit steps, straight blends may stray from the curve */
  tolerance: number
  /** Gaps between two stops are halved at most this many times */
  maxDepth: number
}

// Where sampled stops stand in for a curve CSS can't draw (an easing or a
// hint), the blends between them stay within 2 steps: up to 64 per gap
const EXACT_SAMPLING: SampleOptions = { tolerance: 2, maxDepth: 6 }
// The sRGB fallback and other platforms can be a little rougher, which keeps
// long hue sweeps from needing a hundred stops
const FALLBACK_SAMPLING: SampleOptions = { tolerance: 4, maxDepth: 5 }

const colorDistance = (a: Rgba, b: Rgba) =>
  Math.max(
    Math.abs(a.r - b.r),
    Math.abs(a.g - b.g),
    Math.abs(a.b - b.b),
    Math.abs(a.a - b.a) * 255
  )

// What a sampled color becomes once it's written as a hex stop
const quantize = (color: Rgba): Rgba => toRgba(rgbaToHex(color))

/**
 * Points in (0, 1), in order, where `colorAt` has to be sampled so that
 * blending straight between the samples in `space` follows it. Gaps are
 * halved until the blend matches at their quarter points
 */
const samplePoints = (
  colorAt: (u: number) => Rgba,
  space: InterpolationSpace,
  { tolerance, maxDepth }: SampleOptions = EXACT_SAMPLING
): number[] => {
  const points: number[] = []
  const visit = (u0: number, c0: Rgba, u1: number, c1: Rgba, depth: number) => {
    const from = toCoords(rgbaToHex(c0), space)
    const to = toCoords(rgbaToHex(c1), space)
    const fits = [0.25, 0.5, 0.75].every(
      (f) =>
        colorDistance(
          colorAt(u0 + (u1 - u0) * f),
          mixCoords(from, to, f, space, "shorter")
        ) <= tolerance
    )
    if (fits || depth >= maxDepth) return
    const mid = (u0 + u1) / 2
    const color = quantize(colorAt(mid))
    visit(u0, c0, mid, color, depth + 1)
    points.push(mid)
    visit(mid, color, u1, c1, depth + 1)
  }
  visit(0, quantize(colorAt(0)), 1, quantize(colorAt(1)), 0)
  return points
}

/**
 * The stops plus sampled stops in each gap, so that blending in `space`
 * between them reproduces the gradient's easing and interpolation space.
 */
const expandStops = (
  gradient: Gradient,
  space: InterpolationSpace,
  options: SampleOptions = EXACT_SAMPLING
): GradientStop[] => {
  const stops = sortStops(gradient.stops)
  if (stops.length < 2) return stops
  const result: GradientStop[] = [stops[0]]
  for (let i = 0; i < stops.length - 1; i += 1) {
    const from = stops[i]
    const to = stops[i + 1]
    const length = to.position - from.position
    if (length > 0) {
      // The ends are the stops themselves: sampling exactly at a hard stop
      // would give the next gap's color
      const colorAt = (u: number) =>
        u === 0
          ? toRgba(from.color)
          : u === 1
            ? toRgba(to.color)
            : sampleGradient(gradient, from.position + length * u)
      for (const u of samplePoints(colorAt, space, options)) {
        result.push({
          color: rgbaToHex(colorAt(u)),
          position: from.position + length * u
        })
      }
    }
    result.push(to)
  }
  return result
}

/**
 * Stops that give the same gradient when blended straight in sRGB, for
 * platforms that can't blend in OKLab or ease (SwiftUI, Compose, Flutter,
 * Android, SVG). They also don't premultiply alpha, so a fully transparent
 * stop takes its neighbor's color; as black it would leave a gray fringe.
 */
export const srgbStops = (gradient: Gradient): GradientStop[] => {
  const stops =
    gradient.space === "srgb" && gradient.easing === "linear"
      ? sortStops(gradient.stops)
      : expandStops(gradient, "srgb", FALLBACK_SAMPLING)
  const rgba = stops.map((stop) => toRgba(stop.color))
  return stops.map((stop, index) => {
    if (rgba[index].a > 0) return stop
    const neighbor = rgba[index - 1]?.a > 0 ? rgba[index - 1] : rgba[index + 1]
    return neighbor?.a > 0
      ? { ...stop, color: rgbaToHex({ ...neighbor, a: 0 }) }
      : stop
  })
}

// --- Writing CSS ---

const formatNumber = (n: number) => `${+n.toFixed(2)}`

// A chroma too small to see, but enough that the hue is kept
const GRAY_CHROMA = 0.001

/**
 * Stops as `#hex 50%`. In OKLCH a gray has no hue of its own, and CSS Color 4
 * says it takes the other color's, so white to blue stays blue. Chrome
 * instead works out an arbitrary hue from the gray (white to blue turns
 * cyan), so grays are written with their neighbor's hue and a tiny chroma.
 * A gray between two hues is written twice, once with each.
 */
const formatStops = (stops: GradientStop[], space: InterpolationSpace) => {
  const format = (color: string, position: number) =>
    `${color} ${formatNumber(position)}%`
  const lch = stops.map((stop) => {
    const parsed = parseColorWithAlpha(stop.color)
    const { r, g, b } = hexToRgb(parsed?.hex ?? stop.color)
    return { ...rgbToOklch(r, g, b), alpha: parsed?.alpha ?? 1 }
  })
  const isGray = (index: number) => lch[index].c < ACHROMATIC_CHROMA
  return stops
    .flatMap((stop, index) => {
      const hex = format(stop.color.toLowerCase(), stop.position)
      if (space !== "oklch" || !isGray(index)) return [hex]
      const hues = [index - 1, index + 1]
        .filter((n) => n >= 0 && n < stops.length && !isGray(n))
        .map((n) => +lch[n].h.toFixed(2))
      if (hues.length === 0) return [hex]
      const { l, alpha } = lch[index]
      const opacity = alpha < 1 ? ` / ${+alpha.toFixed(3)}` : ""
      return Array.from(new Set(hues)).map((hue) =>
        format(
          `oklch(${formatNumber(l * 100)}% ${GRAY_CHROMA} ${hue}${opacity})`,
          stop.position
        )
      )
    })
    .join(", ")
}

const isCentered = (gradient: Gradient) =>
  gradient.center.x === 50 && gradient.center.y === 50

const formatCenter = (gradient: Gradient) =>
  `at ${formatNumber(gradient.center.x)}% ${formatNumber(gradient.center.y)}%`

export interface GradientCssOptions {
  /**
   * Write plain sRGB stops sampled from the gradient instead of an
   * `in oklch`-style method, for browsers that don't support one
   */
  srgbFallback?: boolean
}

/**
 * The gradient as a CSS `<image>`, e.g. `linear-gradient(90deg in oklab,
 * #2563eb 0%, #db2777 100%)`. Easing can't be said in CSS, so an eased
 * gradient is written with sampled stops in between.
 */
export const gradientToCss = (
  gradient: Gradient,
  { srgbFallback = false }: GradientCssOptions = {}
): string => {
  const space = srgbFallback ? "srgb" : gradient.space
  const expand = gradient.easing !== "linear" || space !== gradient.space
  const stops = expand
    ? expandStops(
        gradient,
        space,
        srgbFallback ? FALLBACK_SAMPLING : EXACT_SAMPLING
      )
    : sortStops(gradient.stops)
  // Sampled stops are close together, so the default (shorter) hue between
  // them already follows the longer way round
  const longer = gradient.hue === "longer" && !expand
  const method =
    space === "srgb"
      ? ""
      : `in ${space}${space === "oklch" && longer ? " longer hue" : ""}`

  const config: string[] = []
  switch (gradient.type) {
    case "linear":
      config.push(`${formatNumber(gradient.angle)}deg`)
      break
    case "radial":
      if (gradient.shape === "circle") config.push("circle")
      if (!isCentered(gradient)) config.push(formatCenter(gradient))
      break
    case "conic":
      if (gradient.angle !== 0)
        config.push(`from ${formatNumber(gradient.angle)}deg`)
      if (!isCentered(gradient)) config.push(formatCenter(gradient))
      break
  }
  if (method) config.push(method)

  const name = `${gradient.repeating ? "repeating-" : ""}${gradient.type}-gradient`
  const args = [config.join(" "), formatStops(stops, space)].filter(Boolean)
  return `${name}(${args.join(", ")})`
}

/**
 * A tiling noise texture (SVG turbulence, no image file) at `amount` percent
 * opacity, as a CSS `url()` to layer over the gradient
 */
export const grainLayer = (amount: number): string => {
  const svg =
    "<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'>" +
    "<filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/>" +
    "<feColorMatrix type='saturate' values='0'/></filter>" +
    `<rect width='100%' height='100%' filter='url(%23n)' opacity='${+(amount / 100).toFixed(2)}'/></svg>`
  return `url("data:image/svg+xml,${svg.replace(/</g, "%3C").replace(/>/g, "%3E")}")`
}

/**
 * The `background-image` value: the grain (if any) over the gradient
 */
export const backgroundImageCss = (
  gradient: Gradient,
  options: GradientCssOptions = {}
): string => {
  const css = gradientToCss(gradient, options)
  return gradient.grain > 0 ? `${grainLayer(gradient.grain)}, ${css}` : css
}

/** Whether `gradientToCss` needs a fallback for browsers before 2023 */
export const needsSrgbFallback = (gradient: Gradient) =>
  gradient.space !== "srgb"

// --- Parsing CSS ---

/** Resolves one CSS color; the default handles what `parseColorWithAlpha` does */
export type ColorResolver = (value: string) => ParsedColor | null

interface Size {
  width: number
  height: number
}

export interface ParseGradientOptions {
  resolve?: ColorResolver
  /**
   * The size of the box the gradient paints, in px: its tile, when
   * `background-size` sets one. Corner directions (`to top right`), lengths
   * in stop positions and centers, and radial sizes depend on it. Without it
   * a corner is taken as 45° (right for a square), and lengths and radial
   * sizes can't be used
   */
  box?: Size
  /** The viewport, in px, for `vw` and `vh` */
  viewport?: Size
}

const defaultResolver: ColorResolver = (value) =>
  value.trim().toLowerCase() === "transparent"
    ? { hex: "#000000", alpha: 0 }
    : parseColorWithAlpha(value)

/** Splits on commas that aren't inside parentheses */
const splitTopLevel = (value: string, separator = ","): string[] => {
  const parts: string[] = []
  let depth = 0
  let current = ""
  for (const char of value) {
    if (char === "(") depth += 1
    else if (char === ")") depth -= 1
    if (char === separator && depth === 0) {
      parts.push(current.trim())
      current = ""
    } else current += char
  }
  if (current.trim()) parts.push(current.trim())
  return parts
}

/** Splits on whitespace that isn't inside parentheses */
const splitWords = (value: string): string[] =>
  splitTopLevel(value.replace(/\s+/g, " "), " ").filter(Boolean)

const ANGLE_RE = /^(-?[\d.]+)(deg|grad|rad|turn)$/i

const parseAngle = (value: string): number | null => {
  const match = value.match(ANGLE_RE)
  if (!match) return value === "0" ? 0 : null
  const n = parseFloat(match[1])
  switch (match[2].toLowerCase()) {
    case "grad":
      return n * 0.9
    case "rad":
      return (n * 180) / Math.PI
    case "turn":
      return n * 360
    default:
      return n
  }
}

const SIDE_ANGLES: Record<string, number> = {
  top: 0,
  "top right": 45,
  right: 90,
  "bottom right": 135,
  bottom: 180,
  "bottom left": 225,
  left: 270,
  "top left": 315
}

/**
 * `to right` and so on. A corner's angle depends on the box: the gradient
 * line is at right angles to the diagonal between the other two corners
 */
const parseSide = (
  words: string[],
  box: ParseGradientOptions["box"]
): number | null => {
  const sides = words.map((word) => word.toLowerCase())
  if (
    sides.length === 0 ||
    sides.length > 2 ||
    !sides.every((side) => ["top", "bottom", "left", "right"].includes(side))
  )
    return null
  const key = [
    sides.find((side) => side === "top" || side === "bottom"),
    sides.find((side) => side === "left" || side === "right")
  ]
    .filter(Boolean)
    .join(" ")
  const angle = SIDE_ANGLES[key]
  if (angle === undefined || !key.includes(" ")) return angle ?? null
  if (!box || box.width <= 0 || box.height <= 0) return angle
  const corner = (Math.atan2(box.height, box.width) * 180) / Math.PI
  const corners: Record<string, number> = {
    "top right": corner,
    "bottom right": 180 - corner,
    "bottom left": 180 + corner,
    "top left": 360 - corner
  }
  return corners[key]
}

// em and rem are taken at the browser's default font size. Computed styles
// already have them in px, so this only matters for pasted CSS
const DEFAULT_FONT_SIZE = 16

/** A `<length-percentage>`: px plus a percentage of some reference length */
interface Length {
  px: number
  percent: number
}

const LENGTH_RE =
  /^(-?(?:\d+\.?\d*|\.\d+)(?:e-?\d+)?)(px|%|r?em|vw|vh|vmin|vmax)?$/

/**
 * Reads `12px`, `40%`, `2em`, `5vw`, or a `calc()` adding and subtracting
 * them, which computed styles keep (`calc(100% - 20px)`). Null for anything
 * else, and for viewport units without a viewport
 */
const parseLength = (word: string, viewport?: Size): Length | null => {
  const value = word.trim().toLowerCase()
  const calc = value.match(/^(?:calc)?\((.*)\)$/)
  if (calc) {
    // calc() needs spaces around + and -, so they're words of their own
    const total: Length = { px: 0, percent: 0 }
    let sign = 1
    let expectTerm = true
    for (const part of splitWords(calc[1])) {
      if (!expectTerm && (part === "+" || part === "-")) {
        sign = part === "-" ? -1 : 1
        expectTerm = true
        continue
      }
      const term = expectTerm ? parseLength(part, viewport) : null
      if (!term) return null
      total.px += sign * term.px
      total.percent += sign * term.percent
      expectTerm = false
    }
    return expectTerm ? null : total
  }
  const match = value.match(LENGTH_RE)
  if (!match) return null
  const n = parseFloat(match[1])
  switch (match[2]) {
    case undefined:
      return n === 0 ? { px: 0, percent: 0 } : null
    case "%":
      return { px: 0, percent: n }
    case "px":
      return { px: n, percent: 0 }
    case "em":
    case "rem":
      return { px: n * DEFAULT_FONT_SIZE, percent: 0 }
    default: {
      if (!viewport) return null
      const unit = {
        vw: viewport.width,
        vh: viewport.height,
        vmin: Math.min(viewport.width, viewport.height),
        vmax: Math.max(viewport.width, viewport.height)
      }[match[2]]
      return unit === undefined ? null : { px: (n * unit) / 100, percent: 0 }
    }
  }
}

/** `length` in px, with its percentage taken of `reference` px */
const lengthToPx = (length: Length, reference: number) =>
  length.px + (length.percent / 100) * reference

/** `length` in percent of `reference` px. Null if it has px and no reference */
const lengthToPercent = (
  length: Length,
  reference: number | null
): number | null => {
  if (length.px === 0) return length.percent
  if (!reference || reference <= 0) return null
  return length.percent + (length.px / reference) * 100
}

const POSITION_KEYWORDS = new Map([
  ["left", 0],
  ["top", 0],
  ["center", 50],
  ["right", 100],
  ["bottom", 100]
])

/**
 * `at <position>`, in percent of the box: keywords, percentages, and
 * lengths when the box is known. What can't be read is centered.
 */
const parseCenter = (
  words: string[],
  box: Size | undefined,
  viewport: Size | undefined
): { x: number; y: number } => {
  const values = words.map((word) => word.toLowerCase())
  const isVertical = (word: string) => word === "top" || word === "bottom"
  const isHorizontal = (word: string) => word === "left" || word === "right"
  // In percent of `size`, the box's width or height
  const toPercent = (word: string, size: number | undefined) => {
    const length = parseLength(word, viewport)
    return length ? lengthToPercent(length, size ?? null) : null
  }

  if (values.length <= 2) {
    let [x = "center", y = "center"] = values
    // A lone keyword sets its own axis; `top left` names the vertical first
    if (values.length === 1 ? isVertical(x) : isVertical(x) || isHorizontal(y))
      [x, y] = [y, x]
    return {
      x: POSITION_KEYWORDS.get(x) ?? toPercent(x, box?.width) ?? 50,
      y: POSITION_KEYWORDS.get(y) ?? toPercent(y, box?.height) ?? 50
    }
  }

  // Three or four values: sides, each with an optional offset from it, as in
  // `right 10px top 20%`
  const center = { x: 50, y: 50 }
  for (let i = 0; i < values.length; i += 1) {
    const side = values[i]
    const next = values[i + 1]
    const offset =
      next !== undefined && !POSITION_KEYWORDS.has(next) ? next : null
    if (offset !== null) i += 1
    if (!isHorizontal(side) && !isVertical(side)) continue
    const axis = isHorizontal(side) ? "x" : "y"
    const distance =
      offset === null
        ? 0
        : toPercent(offset, axis === "x" ? box?.width : box?.height) ?? 0
    center[axis] = side === "left" || side === "top" ? distance : 100 - distance
  }
  return center
}

const RADIAL_SIZES = [
  "closest-side",
  "closest-corner",
  "farthest-side",
  "farthest-corner"
]

/**
 * The radii, in px, of a radial gradient's ending shape. `size` is the size
 * as written: a keyword, one or two lengths, or nothing (the farthest
 * corner). Null when it can't be worked out
 */
const radialRadii = (
  shape: RadialShape,
  size: string[],
  center: { x: number; y: number },
  box: Size,
  viewport?: Size
): { x: number; y: number } | null => {
  const cx = (center.x / 100) * box.width
  const cy = (center.y / 100) * box.height
  const sidesX = [Math.abs(cx), Math.abs(box.width - cx)]
  const sidesY = [Math.abs(cy), Math.abs(box.height - cy)]
  const near = { x: Math.min(...sidesX), y: Math.min(...sidesY) }
  const far = { x: Math.max(...sidesX), y: Math.max(...sidesY) }
  const keyword = size[0] ?? "farthest-corner"

  if (RADIAL_SIZES.includes(keyword)) {
    if (shape === "circle") {
      const radius =
        keyword === "closest-side"
          ? Math.min(near.x, near.y)
          : keyword === "farthest-side"
            ? Math.max(far.x, far.y)
            : keyword === "closest-corner"
              ? Math.hypot(near.x, near.y)
              : Math.hypot(far.x, far.y)
      return { x: radius, y: radius }
    }
    if (keyword === "closest-side") return near
    if (keyword === "farthest-side") return far
    // Through a corner, an ellipse keeps the shape it has at the matching
    // side size (closest-corner like closest-side, farthest-corner like
    // farthest-side), which makes it √2 times as big
    const side = keyword === "closest-corner" ? near : far
    return { x: side.x * Math.SQRT2, y: side.y * Math.SQRT2 }
  }

  const lengths = size.slice(0, 2).map((word) => parseLength(word, viewport))
  if (lengths.length === 0 || lengths.some((length) => !length)) return null
  const [width, height = width] = lengths as Length[]
  if (shape === "circle") {
    const radius = lengthToPx(width, box.width)
    return { x: radius, y: radius }
  }
  return {
    x: lengthToPx(width, box.width),
    y: lengthToPx(height, box.height)
  }
}

const INTERPOLATION_ALIASES: Record<string, InterpolationSpace> = {
  srgb: "srgb",
  "srgb-linear": "srgb",
  "display-p3": "srgb",
  "a98-rgb": "srgb",
  "prophoto-rgb": "srgb",
  rec2020: "srgb",
  oklab: "oklab",
  lab: "oklab",
  xyz: "oklab",
  "xyz-d50": "oklab",
  "xyz-d65": "oklab",
  oklch: "oklch",
  lch: "oklch",
  hsl: "oklch",
  hwb: "oklch"
}

/**
 * Reads `in <space> [<method> hue]` out of `words`. Spaces the editor doesn't
 * have are mapped to the closest one: lab to OKLab, lch, hsl and hwb to OKLCH
 */
const takeInterpolation = (
  words: string[]
): { space: InterpolationSpace; hue: HueMethod } | null => {
  const index = words.findIndex((word) => word.toLowerCase() === "in")
  if (index === -1) return null
  const space = INTERPOLATION_ALIASES[words[index + 1]?.toLowerCase() ?? ""]
  let length = 2
  let hue: HueMethod = "shorter"
  if (words[index + 3]?.toLowerCase() === "hue") {
    // `increasing` and `decreasing` go a fixed way round; `longer` is the
    // closest the editor has to them when they don't match shorter
    hue = words[index + 2].toLowerCase() === "shorter" ? "shorter" : "longer"
    length = 4
  }
  words.splice(index, length)
  return space ? { space, hue } : null
}

interface ParsedStop {
  color: ParsedColor
  positions: Array<number | null>
}

/**
 * A color stop `<color> [<pos> [<pos>]]`, or a hint (a lone position).
 * `lineLength` is the length in px of the gradient line (linear) or ray
 * (radial) when it's known, for positions given as lengths
 */
const parseStopArgument = (
  value: string,
  type: GradientType,
  resolve: ColorResolver,
  lineLength: number | null = null,
  viewport?: Size
): ParsedStop | { hint: number } | null => {
  const words = splitWords(value)
  const toPercent = (word: string): number | null => {
    if (type === "conic") {
      const angle = parseAngle(word)
      if (angle !== null) return (angle / 360) * 100
    }
    const length = parseLength(word, viewport)
    return length ? lengthToPercent(length, lineLength) : null
  }
  if (words.length === 1) {
    const hint = toPercent(words[0])
    if (hint !== null) return { hint }
  }
  // The color comes first in computed styles, but CSS allows it last too
  const colorIndex = words.findIndex((word) => resolve(word) !== null)
  if (colorIndex === -1) return null
  const color = resolve(words[colorIndex])!
  const positions = words
    .filter((_, index) => index !== colorIndex)
    .slice(0, 2)
    .map(toPercent)
  return { color, positions: positions.length ? positions : [null] }
}

const toHexColor = ({ hex, alpha }: ParsedColor) =>
  rgbaToHex({ ...hexToRgb(hex), a: alpha })

/**
 * Turns parsed stops into positioned stops the way CSS does: missing first
 * and last positions are 0% and 100%, a position before an earlier one moves
 * up to it, and stops without one are spread evenly between their neighbors.
 */
const resolveStops = (
  parsed: Array<ParsedStop | { hint: number }>,
  space: InterpolationSpace,
  hue: HueMethod
): GradientStop[] => {
  const entries: Array<{ color: string; position: number | null } | number> = []
  for (const item of parsed) {
    if ("hint" in item) entries.push(item.hint)
    else
      for (const position of item.positions)
        entries.push({ color: toHexColor(item.color), position })
  }
  const stops = entries.filter(
    (entry): entry is { color: string; position: number | null } =>
      typeof entry !== "number"
  )
  if (stops.length === 0) return []
  if (stops[0].position === null) stops[0].position = 0
  if (stops[stops.length - 1].position === null)
    stops[stops.length - 1].position = 100

  let max = -Infinity
  for (const stop of stops) {
    if (stop.position === null) continue
    stop.position = Math.max(stop.position, max)
    max = stop.position
  }
  for (let i = 0; i < stops.length; i += 1) {
    if (stops[i].position !== null) continue
    const start = i - 1
    let end = i
    while (stops[end].position === null) end += 1
    const from = stops[start].position!
    const to = stops[end].position!
    for (let k = i; k < end; k += 1)
      stops[k].position = from + ((to - from) * (k - start)) / (end - start)
    i = end
  }

  // A hint moves the halfway color to its position, and CSS bends the blend
  // to get there (a power curve). Sampled stops along the curve stand in
  const result: GradientStop[] = []
  entries.forEach((entry, index) => {
    if (typeof entry !== "number") {
      result.push(entry as GradientStop)
      return
    }
    const before = entries
      .slice(0, index)
      .reverse()
      .find((item) => typeof item !== "number") as GradientStop | undefined
    const after = entries
      .slice(index + 1)
      .find((item) => typeof item !== "number") as GradientStop | undefined
    if (!before || !after) return
    const length = after.position - before.position
    if (length <= 0) return
    const hint =
      (clamp(entry, before.position, after.position) - before.position) / length
    // A hint on a stop makes a hard edge there
    if (hint === 0) {
      result.push({ color: after.color, position: before.position })
      return
    }
    if (hint === 1) {
      result.push({ color: before.color, position: after.position })
      return
    }
    const exponent = Math.log(0.5) / Math.log(hint)
    const from = toCoords(before.color, space)
    const to = toCoords(after.color, space)
    const colorAt = (u: number) =>
      mixCoords(from, to, Math.pow(u, exponent), space, hue)
    for (const u of samplePoints(colorAt, space)) {
      result.push({
        color: rgbaToHex(colorAt(u)),
        position: before.position + length * u
      })
    }
  })
  return result
}

const GRADIENT_RE =
  /^(repeating-)?(linear|radial|conic)-gradient\(([\s\S]*)\)$/i

const LEGACY_RE =
  /^-webkit-(repeating-)?(linear|radial)-gradient\(([\s\S]*)\)$/i

const OPPOSITE_SIDES = new Map([
  ["top", "bottom"],
  ["bottom", "top"],
  ["left", "right"],
  ["right", "left"]
])

const LEGACY_SIZES = new Map([
  ["cover", "farthest-corner"],
  ["contain", "closest-side"]
])

/**
 * A `-webkit-` gradient, which older sites still use, in today's syntax, or
 * null when it isn't one. Its direction names where it starts (`top` is
 * today's `to bottom`), its angles start at 3 o'clock and go
 * counterclockwise, and a radial one takes its position, and its shape and
 * size, as arguments of their own.
 *
 * A corner such as `left top` points straight along the diagonal, unlike
 * today's `to right bottom`, so its angle depends on `box` (square without
 * it, where the two agree).
 */
const unprefixGradient = (value: string, box?: Size): string | null => {
  const match = value.trim().match(LEGACY_RE)
  if (!match) return null
  const [, repeating = "", rawType, body] = match
  const type = rawType.toLowerCase()
  const args = splitTopLevel(body)
  const wordsOf = (arg: string | undefined) =>
    splitWords(arg ?? "").map((word) => word.toLowerCase())
  const isLength = (word: string) => parseLength(word) !== null

  if (type === "linear") {
    const words = wordsOf(args[0])
    const angle = words.length === 1 ? parseAngle(words[0]) : null
    const sides = words.map((word) => OPPOSITE_SIDES.get(word))
    if (angle !== null) args[0] = `${90 - angle}deg`
    else if (sides.length === 2 && sides.every(Boolean)) {
      const to = sides.join(" ")
      // From the named corner to the opposite one
      const width = box && box.width > 0 ? box.width : 1
      const height = box && box.height > 0 ? box.height : 1
      const x = to.includes("right") ? width : to.includes("left") ? -width : 0
      const y = to.includes("bottom")
        ? height
        : to.includes("top")
          ? -height
          : 0
      const degrees = (Math.atan2(x, -y) * 180) / Math.PI
      args[0] =
        x !== 0 && y !== 0
          ? `${formatNumber((degrees + 360) % 360)}deg`
          : `to ${to}`
    } else if (sides.length === 1 && sides[0]) args[0] = `to ${sides[0]}`
  } else {
    // A position, then a shape and size; either can be left out
    const config: string[] = []
    const position = wordsOf(args[0])
    const hasPosition =
      args.length > 2 &&
      position.length > 0 &&
      position.every((word) => POSITION_KEYWORDS.has(word) || isLength(word))
    if (hasPosition) args.shift()
    const shape = wordsOf(args[0])
    const hasShape =
      args.length > 2 &&
      shape.length > 0 &&
      shape.every(
        (word) =>
          word === "circle" ||
          word === "ellipse" ||
          RADIAL_SIZES.includes(word) ||
          LEGACY_SIZES.has(word) ||
          isLength(word)
      )
    if (hasShape) {
      args.shift()
      config.push(shape.map((word) => LEGACY_SIZES.get(word) ?? word).join(" "))
    }
    if (hasPosition) config.push(`at ${position.join(" ")}`)
    if (config.length > 0) args.unshift(config.join(" "))
  }
  return `${repeating}${type}-gradient(${args.join(", ")})`
}

// More than any editor needs; it keeps a bad URL or file reasonable. A
// pasted gradient can reach it, as each color hint becomes sampled stops
const MAX_STORED_STOPS = 100

/**
 * At most MAX_STORED_STOPS stops. More are thinned out evenly, keeping the
 * first and the last, so the gradient keeps its ends
 */
const thinStops = (stops: GradientStop[]): GradientStop[] => {
  if (stops.length <= MAX_STORED_STOPS) return stops
  const sorted = sortStops(stops)
  const step = (sorted.length - 1) / (MAX_STORED_STOPS - 1)
  return Array.from(
    { length: MAX_STORED_STOPS },
    (_, i) => sorted[Math.round(i * step)]
  )
}

/**
 * Parses one CSS gradient, such as an element's computed `background-image`.
 * Returns null for anything else.
 *
 * Lengths (px, em, vw, `calc()`) in stop positions and centers, and radial
 * sizes, need `box`. Without it such stops are spread evenly like ones
 * without a position, and such centers are centered.
 *
 * The editor's radial gradients always reach the farthest corner (the CSS
 * default), so another size is kept by scaling the stops: a stop at 100% of
 * a `closest-side` circle moves in to where that circle ends. That's exact
 * for circles, and for ellipses shaped like the default one (farthest-side,
 * and any keyword size on a centered gradient). Other ellipses keep their
 * width.
 *
 * `-webkit-` gradients are read as their unprefixed equivalent.
 */
export const parseGradient = (
  value: string,
  { resolve = defaultResolver, box, viewport }: ParseGradientOptions = {}
): Gradient | null => {
  const match = (unprefixGradient(value, box) ?? value)
    .trim()
    .match(GRADIENT_RE)
  if (!match) return null
  const repeating = Boolean(match[1])
  const type = match[2].toLowerCase() as GradientType
  const args = splitTopLevel(match[3])
  if (args.length === 0) return null

  const gradient: Gradient = {
    ...DEFAULT_GRADIENT,
    type,
    repeating,
    angle: type === "linear" ? 180 : 0,
    center: { x: 50, y: 50 },
    space: "srgb",
    hue: "shorter",
    easing: "linear"
  }

  // The size of a radial gradient, as written
  let radialSize: string[] = []

  // The first argument configures the gradient unless it's a color stop
  const first = parseStopArgument(args[0], type, resolve)
  if (first === null || "hint" in first) {
    const configWords = splitWords(args[0])
    args.shift()
    const interpolation = takeInterpolation(configWords)
    if (interpolation) {
      gradient.space = interpolation.space
      gradient.hue = interpolation.hue
    }
    const words = configWords
    const atIndex = words.findIndex((word) => word.toLowerCase() === "at")
    if (atIndex !== -1)
      gradient.center = parseCenter(words.slice(atIndex + 1), box, viewport)
    const before = atIndex === -1 ? words : words.slice(0, atIndex)
    if (type === "linear") {
      if (before[0]?.toLowerCase() === "to") {
        gradient.angle = parseSide(before.slice(1), box) ?? 180
      } else if (before[0]) {
        gradient.angle = parseAngle(before[0]) ?? 180
      }
    } else if (type === "radial") {
      const lower = before.map((word) => word.toLowerCase())
      radialSize = lower.filter(
        (word) => word !== "circle" && word !== "ellipse"
      )
      // One length is a circle's radius; two are an ellipse's
      gradient.shape =
        lower.includes("circle") ||
        (!lower.includes("ellipse") &&
          radialSize.length === 1 &&
          !RADIAL_SIZES.includes(radialSize[0]))
          ? "circle"
          : "ellipse"
    } else {
      const fromIndex = before.findIndex(
        (word) => word.toLowerCase() === "from"
      )
      if (fromIndex !== -1)
        gradient.angle = parseAngle(before[fromIndex + 1] ?? "") ?? 0
    }
  }

  // Stop positions given as lengths are measured along the gradient line
  // (linear) or ray (radial), so they need its length in px
  let lineLength: number | null = null
  // What radial stop positions are multiplied by to keep the size
  let scale = 1
  if (box && box.width > 0 && box.height > 0) {
    if (type === "linear") {
      // The line runs through the center at the angle, long enough that the
      // corners are at 0% and 100%
      const radians = (gradient.angle * Math.PI) / 180
      lineLength =
        Math.abs(box.width * Math.sin(radians)) +
        Math.abs(box.height * Math.cos(radians))
    } else if (type === "radial") {
      const { shape, center } = gradient
      const ending = radialRadii(shape, radialSize, center, box, viewport)
      const standard = radialRadii(shape, [], center, box)
      // The ray runs from the center to the ending shape's right edge
      if (ending && standard && ending.x > 0 && standard.x > 0) {
        lineLength = ending.x
        scale = ending.x / standard.x
      }
    }
  }

  const parsed = args.map((arg) =>
    parseStopArgument(arg, type, resolve, lineLength, viewport)
  )
  if (parsed.some((item) => item === null)) return null
  const stops = resolveStops(
    parsed as Array<ParsedStop | { hint: number }>,
    gradient.space,
    gradient.hue
  )
  if (stops.length < 2) return null
  return {
    ...gradient,
    stops: thinStops(
      scale === 1
        ? stops
        : stops.map((stop) => ({
            ...stop,
            position: Math.round(stop.position * scale * 100) / 100
          }))
    )
  }
}

/**
 * Every gradient in a `background-image` value, which can hold several
 * layers (the first is on top) and `url()` images between them.
 */
export const parseGradients = (
  value: string,
  options: ParseGradientOptions = {}
): Gradient[] =>
  splitTopLevel(value)
    .map((layer) => parseGradient(layer, options))
    .filter((gradient): gradient is Gradient => gradient !== null)

const FUNCTION_START_RE =
  /(?:-webkit-)?(?:repeating-)?(?:linear|radial|conic)-gradient\(/gi

/**
 * The gradient functions in a piece of CSS, in order, e.g. from a pasted
 * `background: linear-gradient(...);` declaration or several of them.
 */
export const findGradientFunctions = (text: string): string[] => {
  const found: string[] = []
  // Where the last function found ends. A match before it is nested inside
  // that function, so it's part of it, not a gradient of its own
  let end = 0
  for (const match of Array.from(text.matchAll(FUNCTION_START_RE))) {
    const start = match.index ?? 0
    if (start < end) continue
    let depth = 0
    for (let i = start + match[0].length - 1; i < text.length; i += 1) {
      if (text[i] === "(") depth += 1
      else if (text[i] === ")") depth -= 1
      if (depth === 0) {
        found.push(text.slice(start, i + 1))
        end = i + 1
        break
      }
    }
  }
  return found
}

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value)

const oneOf = <T extends string>(
  value: unknown,
  options: Array<{ value: T }>,
  fallback: T
): T =>
  options.some((option) => option.value === value) ? (value as T) : fallback

/** A gradient read from a URL or from storage, or null when it isn't one */
export const normalizeGradient = (value: unknown): Gradient | null => {
  if (!value || typeof value !== "object") return null
  const raw = value as Record<string, unknown>
  if (!Array.isArray(raw.stops)) return null
  // Read a bounded number, then thin them, so a long list keeps its end
  const valid = raw.stops.slice(0, MAX_STORED_STOPS * 10).flatMap((stop) => {
    if (!stop || typeof stop !== "object") return []
    const { color, position } = stop as Record<string, unknown>
    const parsed = typeof color === "string" ? parseColorWithAlpha(color) : null
    if (!parsed || !isFiniteNumber(position)) return []
    return [{ color: toHexColor(parsed), position: clamp(position, -100, 200) }]
  })
  if (valid.length < 2) return null
  const stops = thinStops(valid)
  const center = (
    raw.center && typeof raw.center === "object" ? raw.center : {}
  ) as Record<string, unknown>
  return {
    type: oneOf(raw.type, GRADIENT_TYPES, DEFAULT_GRADIENT.type),
    angle: isFiniteNumber(raw.angle)
      ? ((raw.angle % 360) + 360) % 360
      : DEFAULT_GRADIENT.angle,
    shape: raw.shape === "circle" ? "circle" : "ellipse",
    // A center can be outside the box, e.g. a glow rising from below it
    center: {
      x: isFiniteNumber(center.x) ? clamp(center.x, -100, 200) : 50,
      y: isFiniteNumber(center.y) ? clamp(center.y, -100, 200) : 50
    },
    stops,
    space: oneOf(raw.space, INTERPOLATION_SPACES, DEFAULT_GRADIENT.space),
    hue: raw.hue === "longer" ? "longer" : "shorter",
    easing: oneOf(raw.easing, GRADIENT_EASINGS, "linear"),
    repeating: raw.repeating === true,
    grain: isFiniteNumber(raw.grain) ? clamp(raw.grain, 0, 100) : 0
  }
}
