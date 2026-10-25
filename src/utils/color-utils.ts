export interface ColorEntry {
  hex: string
  rgb: string
  hsl?: string
  timestamp: number
}

export interface HSV {
  h: number
  s: number
  v: number
}

export const DEFAULT_FOREGROUND = "#f8fafc"
export const DEFAULT_BACKGROUND = "#111827"

const clamp = (n: number, min: number, max: number) =>
  Math.min(max, Math.max(min, n))

const toHexByte = (n: number) =>
  clamp(Math.round(n), 0, 255).toString(16).padStart(2, "0")

export const rgbToHex = (r: number, g: number, b: number): string =>
  `#${toHexByte(r)}${toHexByte(g)}${toHexByte(b)}`

export const hslToRgb = (
  h: number,
  s: number,
  l: number
): { r: number; g: number; b: number } => {
  const hue = ((h % 360) + 360) % 360
  const sat = clamp(s, 0, 100) / 100
  const lit = clamp(l, 0, 100) / 100
  const a = sat * Math.min(lit, 1 - lit)
  const f = (n: number) => {
    const k = (n + hue / 30) % 12
    return lit - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)
  }
  return {
    r: Math.round(f(0) * 255),
    g: Math.round(f(8) * 255),
    b: Math.round(f(4) * 255)
  }
}

export const hslToHex = (h: number, s: number, l: number): string => {
  const { r, g, b } = hslToRgb(h, s, l)
  return rgbToHex(r, g, b)
}

export const rgbToHsl = (
  r: number,
  g: number,
  b: number
): { h: number; s: number; l: number } => {
  const rN = r / 255
  const gN = g / 255
  const bN = b / 255
  const max = Math.max(rN, gN, bN)
  const min = Math.min(rN, gN, bN)
  const l = (max + min) / 2

  if (max === min) return { h: 0, s: 0, l: Math.round(l * 100) }

  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h = 0
  switch (max) {
    case rN:
      h = ((gN - bN) / d + (gN < bN ? 6 : 0)) / 6
      break
    case gN:
      h = ((bN - rN) / d + 2) / 6
      break
    case bN:
      h = ((rN - gN) / d + 4) / 6
      break
  }
  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100)
  }
}

export const formatHsl = (r: number, g: number, b: number): string => {
  const { h, s, l } = rgbToHsl(r, g, b)
  return `hsl(${h}, ${s}%, ${l}%)`
}

// --- OKLab / OKLCH (Björn Ottosson's matrices, as used by CSS Color 4) ---

export interface Oklab {
  L: number
  a: number
  b: number
}

export interface Oklch {
  /** Lightness, 0–1 */
  l: number
  /** Chroma, 0 to about 0.32 inside sRGB */
  c: number
  /** Hue in degrees, 0–360 */
  h: number
}

const srgbToLinear = (channel: number) => {
  const n = channel / 255
  return n <= 0.04045 ? n / 12.92 : Math.pow((n + 0.055) / 1.055, 2.4)
}

// Out-of-gamut values are clipped to sRGB
const linearToSrgb = (value: number) => {
  const v = clamp(value, 0, 1)
  const n = v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055
  return clamp(Math.round(n * 255), 0, 255)
}

export const rgbToOklab = (r: number, g: number, b: number): Oklab => {
  const lr = srgbToLinear(r)
  const lg = srgbToLinear(g)
  const lb = srgbToLinear(b)
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb)
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb)
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb)
  return {
    L: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
  }
}

export const oklabToRgb = ({
  L,
  a,
  b
}: Oklab): { r: number; g: number; b: number } => {
  const l = Math.pow(L + 0.3963377774 * a + 0.2158037573 * b, 3)
  const m = Math.pow(L - 0.1055613458 * a - 0.0638541728 * b, 3)
  const s = Math.pow(L - 0.0894841775 * a - 1.291485548 * b, 3)
  return {
    r: linearToSrgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    g: linearToSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    b: linearToSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s)
  }
}

export const rgbToOklch = (r: number, g: number, b: number): Oklch => {
  const { L, a, b: bAxis } = rgbToOklab(r, g, b)
  const h = (Math.atan2(bAxis, a) * 180) / Math.PI
  return { l: L, c: Math.hypot(a, bAxis), h: (h + 360) % 360 }
}

export const oklchToRgb = ({
  l,
  c,
  h
}: Oklch): { r: number; g: number; b: number } => {
  const radians = (h * Math.PI) / 180
  return oklabToRgb({
    L: l,
    a: c * Math.cos(radians),
    b: c * Math.sin(radians)
  })
}

/**
 * `oklch(62.8% 0.25768 29.23)`. Chroma needs five decimals for every sRGB hex
 * to parse back to itself; with four, some dark channels come back off by one
 */
export const formatOklch = (r: number, g: number, b: number): string => {
  const { l, c, h } = rgbToOklch(r, g, b)
  const lightness = +(l * 100).toFixed(2)
  const chroma = +c.toFixed(5)
  // Grays come out with a tiny chroma from rounding in the matrices, which
  // would otherwise print an arbitrary hue
  if (chroma === 0) return `oklch(${lightness}% 0 0)`
  return `oklch(${lightness}% ${chroma} ${+h.toFixed(2)})`
}

// --- CIE Lab (D65) and CIEDE2000 color difference ---

export interface Lab {
  L: number
  a: number
  b: number
}

export const rgbToLab = (r: number, g: number, b: number): Lab => {
  const lr = srgbToLinear(r)
  const lg = srgbToLinear(g)
  const lb = srgbToLinear(b)
  const f = (t: number) =>
    t > 216 / 24389 ? Math.cbrt(t) : ((24389 / 27) * t + 16) / 116
  const x = f((0.4124564 * lr + 0.3575761 * lg + 0.1804375 * lb) / 0.95047)
  const y = f(0.2126729 * lr + 0.7151522 * lg + 0.072175 * lb)
  const z = f((0.0193339 * lr + 0.119192 * lg + 0.9503041 * lb) / 1.08883)
  return { L: 116 * y - 16, a: 500 * (x - y), b: 200 * (y - z) }
}

export const hexToLab = (hex: string): Lab => {
  const { r, g, b } = hexToRgb(hex)
  return rgbToLab(r, g, b)
}

const toDegrees = (radians: number) => (radians * 180) / Math.PI
const toRadians = (degrees: number) => (degrees * Math.PI) / 180

/**
 * CIEDE2000 color difference (Sharma, Wu & Dalal, 2005). About 1 is the
 * smallest difference most people notice side by side; 2–3 is noticeable at a
 * glance.
 */
export const deltaE2000 = (first: Lab, second: Lab): number => {
  const { L: L1, a: a1, b: b1 } = first
  const { L: L2, a: a2, b: b2 } = second
  const pow7 = (n: number) => Math.pow(n, 7)

  const meanC = (Math.hypot(a1, b1) + Math.hypot(a2, b2)) / 2
  const G = 0.5 * (1 - Math.sqrt(pow7(meanC) / (pow7(meanC) + pow7(25))))
  const a1p = (1 + G) * a1
  const a2p = (1 + G) * a2
  const C1p = Math.hypot(a1p, b1)
  const C2p = Math.hypot(a2p, b2)
  const hueOf = (b: number, ap: number) =>
    b === 0 && ap === 0 ? 0 : (toDegrees(Math.atan2(b, ap)) + 360) % 360
  const h1p = hueOf(b1, a1p)
  const h2p = hueOf(b2, a2p)

  const deltaLp = L2 - L1
  const deltaCp = C2p - C1p
  let deltahp = 0
  if (C1p * C2p !== 0) {
    deltahp = h2p - h1p
    if (deltahp > 180) deltahp -= 360
    else if (deltahp < -180) deltahp += 360
  }
  const deltaHp = 2 * Math.sqrt(C1p * C2p) * Math.sin(toRadians(deltahp / 2))

  const meanLp = (L1 + L2) / 2
  const meanCp = (C1p + C2p) / 2
  let meanhp = h1p + h2p
  if (C1p * C2p !== 0) {
    if (Math.abs(h1p - h2p) <= 180) meanhp /= 2
    else meanhp = (meanhp + (meanhp < 360 ? 360 : -360)) / 2
  }

  const T =
    1 -
    0.17 * Math.cos(toRadians(meanhp - 30)) +
    0.24 * Math.cos(toRadians(2 * meanhp)) +
    0.32 * Math.cos(toRadians(3 * meanhp + 6)) -
    0.2 * Math.cos(toRadians(4 * meanhp - 63))
  const deltaTheta = 30 * Math.exp(-Math.pow((meanhp - 275) / 25, 2))
  const RC = 2 * Math.sqrt(pow7(meanCp) / (pow7(meanCp) + pow7(25)))
  const SL =
    1 +
    (0.015 * Math.pow(meanLp - 50, 2)) /
      Math.sqrt(20 + Math.pow(meanLp - 50, 2))
  const SC = 1 + 0.045 * meanCp
  const SH = 1 + 0.015 * meanCp * T
  const RT = -Math.sin(toRadians(2 * deltaTheta)) * RC

  const l = deltaLp / SL
  const c = deltaCp / SC
  const h = deltaHp / SH
  return Math.sqrt(l * l + c * c + h * h + RT * c * h)
}

const RGB_RE =
  /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+%?))?\s*\)/i
const HSL_RE =
  /^hsla?\(\s*([\d.]+)[\s,]+([\d.]+)%?[\s,]+([\d.]+)%?(?:[\s,/]+([\d.]+%?))?\s*\)/i
const OKLCH_RE =
  /^oklch\(\s*([\d.]+)(%?)\s+([\d.]+)(%?)\s+([\d.]+|none)(?:deg)?\s*(?:\/\s*([\d.]+%?))?\s*\)/i
const HEX8_RE = /^#?([0-9a-fA-F]{8})$/
const HEX4_RE = /^#?([0-9a-fA-F]{4})$/
const HEX_RE = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/

export interface ParsedColor {
  hex: string
  alpha: number
}

const parseAlphaToken = (token: string | undefined): number => {
  if (!token) return 1
  return token.endsWith("%")
    ? clamp(parseFloat(token) / 100, 0, 1)
    : clamp(parseFloat(token), 0, 1)
}

/**
 * Parse a color string and return both the opaque hex and the alpha channel.
 * Supports hex (3/4/6/8), rgb(a), hsl(a) and oklch(). OKLCH colors outside
 * sRGB are clipped.
 */
export const parseColorWithAlpha = (input: string): ParsedColor | null => {
  const raw = input.trim()
  if (!raw) return null

  const rgbMatch = raw.match(RGB_RE)
  if (rgbMatch) {
    return {
      hex: rgbToHex(
        parseFloat(rgbMatch[1]),
        parseFloat(rgbMatch[2]),
        parseFloat(rgbMatch[3])
      ),
      alpha: parseAlphaToken(rgbMatch[4])
    }
  }

  const hslMatch = raw.match(HSL_RE)
  if (hslMatch) {
    return {
      hex: hslToHex(
        parseFloat(hslMatch[1]),
        parseFloat(hslMatch[2]),
        parseFloat(hslMatch[3])
      ),
      alpha: parseAlphaToken(hslMatch[4])
    }
  }

  const oklchMatch = raw.match(OKLCH_RE)
  if (oklchMatch) {
    const [, l, lPercent, c, cPercent, h, alpha] = oklchMatch
    // In CSS, 100% lightness is 1 and 100% chroma is 0.4
    const { r, g, b } = oklchToRgb({
      l: parseFloat(l) / (lPercent ? 100 : 1),
      c: cPercent ? (parseFloat(c) / 100) * 0.4 : parseFloat(c),
      h: h.toLowerCase() === "none" ? 0 : parseFloat(h)
    })
    return { hex: rgbToHex(r, g, b), alpha: parseAlphaToken(alpha) }
  }

  const hex8Match = raw.match(HEX8_RE)
  if (hex8Match) {
    const h = hex8Match[1]
    const hex = `#${h.slice(0, 6)}`.toLowerCase()
    const alpha = clamp(parseInt(h.slice(6, 8), 16) / 255, 0, 1)
    return { hex, alpha }
  }

  const hex4Match = raw.match(HEX4_RE)
  if (hex4Match) {
    const [r, g, b, a] = hex4Match[1]
    const hex = `#${r}${r}${g}${g}${b}${b}`.toLowerCase()
    const alpha = clamp(parseInt(`${a}${a}`, 16) / 255, 0, 1)
    return { hex, alpha }
  }

  const hexMatch = raw.match(HEX_RE)
  if (hexMatch) {
    const h = hexMatch[1]
    const full = h.length === 3 ? h.replace(/./g, "$&$&") : h
    return { hex: `#${full}`.toLowerCase(), alpha: 1 }
  }

  return null
}

/**
 * Attempts to parse a color string in hex, rgb(), hsl() or oklch() format.
 * Returns a normalized 7-char hex string, or `null` if unparseable.
 */
export const parseColor = (input: string): string | null => {
  const result = parseColorWithAlpha(input)
  return result ? result.hex : null
}

/**
 * Alpha-composite a foreground RGBA over an opaque background,
 * returning the resulting opaque hex.
 */
export const alphaBlend = (
  fgHex: string,
  fgAlpha: number,
  bgHex: string
): string => {
  if (fgAlpha >= 1) return fgHex
  const fg = hexToRgb(fgHex)
  const bg = hexToRgb(bgHex)
  const a = clamp(fgAlpha, 0, 1)
  return rgbToHex(
    Math.round(fg.r * a + bg.r * (1 - a)),
    Math.round(fg.g * a + bg.g * (1 - a)),
    Math.round(fg.b * a + bg.b * (1 - a))
  )
}

/**
 * Resolve a possibly translucent pair to the opaque colors that render:
 * the background over white, then the foreground over that result.
 */
export const blendColorPair = (
  fg: ParsedColor,
  bg: ParsedColor
): { foreground: string; background: string } => {
  const background = alphaBlend(bg.hex, bg.alpha, "#ffffff")
  return { foreground: alphaBlend(fg.hex, fg.alpha, background), background }
}

export const normalizeHex = (value: string, fallback: string): string =>
  parseColor(value) ?? fallback

export const normalizeWithAlpha = (
  value: string,
  fallback: string
): ParsedColor => {
  const parsed = parseColorWithAlpha(value)
  return parsed ?? { hex: fallback, alpha: 1 }
}

export const isValidPartialHex = (value: string): boolean => {
  if (!value.startsWith("#")) return false
  return /^#[0-9a-fA-F]{0,8}$/.test(value)
}

export const hexToRgb = (hex: string): { r: number; g: number; b: number } => {
  const value = normalizeHex(hex, DEFAULT_FOREGROUND).slice(1)
  const r = parseInt(value.slice(0, 2), 16)
  const g = parseInt(value.slice(2, 4), 16)
  const b = parseInt(value.slice(4, 6), 16)
  return { r, g, b }
}

export const getRelativeLuminance = ({
  r,
  g,
  b
}: {
  r: number
  g: number
  b: number
}): number => {
  const toLinear = (channel: number) => {
    const normalized = channel / 255
    return normalized <= 0.03928
      ? normalized / 12.92
      : Math.pow((normalized + 0.055) / 1.055, 2.4)
  }
  const R = toLinear(r)
  const G = toLinear(g)
  const B = toLinear(b)
  return 0.2126 * R + 0.7152 * G + 0.0722 * B
}

export const getContrastRatio = (
  foreground: string,
  background: string
): number => {
  const fgLum = getRelativeLuminance(hexToRgb(foreground))
  const bgLum = getRelativeLuminance(hexToRgb(background))
  const lighter = Math.max(fgLum, bgLum)
  const darker = Math.min(fgLum, bgLum)
  return (lighter + 0.05) / (darker + 0.05)
}

/** A translucent background is judged as it looks over white */
export const getReadableTextColor = (background: string): string => {
  const parsed = parseColorWithAlpha(background)
  const solid = parsed
    ? alphaBlend(parsed.hex, parsed.alpha, "#ffffff")
    : background
  const whiteRatio = getContrastRatio("#ffffff", solid)
  const blackRatio = getContrastRatio("#000000", solid)
  return whiteRatio >= blackRatio ? "#f8fafc" : "#0f172a"
}

export const withAlpha = (hex: string, alpha: number): string => {
  const { r, g, b } = hexToRgb(hex)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

export const uniqueNormalizedHexes = (values: string[]): string[] => {
  const seen = new Set<string>()
  const result: string[] = []
  values.forEach((value) => {
    const normalized = normalizeHex(value, "").toLowerCase()
    if (!/^#[0-9a-f]{6}$/.test(normalized)) return
    if (seen.has(normalized)) return
    seen.add(normalized)
    result.push(normalized)
  })
  return result
}

export const getHistoryHexes = (value: unknown): string[] => {
  if (!Array.isArray(value)) return []
  return uniqueNormalizedHexes(
    value.map((entry) => (entry as { hex?: string })?.hex || "").filter(Boolean)
  )
}

export const getWebpageHexes = (value: unknown): string[] => {
  if (!value || typeof value !== "object") return []
  const entries = Object.values(value as Record<string, unknown>)
  const hexes = entries.flatMap((domainColors) => {
    if (!Array.isArray(domainColors)) return []
    return domainColors
      .map((entry) => (entry as { hex?: string })?.hex || "")
      .filter(Boolean)
  })
  return uniqueNormalizedHexes(hexes)
}

// --- HSV conversions ---

export const hsvToRgb = (
  h: number,
  s: number,
  v: number
): { r: number; g: number; b: number } => {
  const sat = s / 100
  const val = v / 100
  const c = val * sat
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = val - c
  let r = 0
  let g = 0
  let b = 0

  if (h < 60) {
    r = c
    g = x
  } else if (h < 120) {
    r = x
    g = c
  } else if (h < 180) {
    g = c
    b = x
  } else if (h < 240) {
    g = x
    b = c
  } else if (h < 300) {
    r = x
    b = c
  } else {
    r = c
    b = x
  }

  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255)
  }
}

export const rgbToHsv = (r: number, g: number, b: number): HSV => {
  const rN = r / 255
  const gN = g / 255
  const bN = b / 255
  const max = Math.max(rN, gN, bN)
  const min = Math.min(rN, gN, bN)
  const d = max - min

  let h = 0
  if (d !== 0) {
    switch (max) {
      case rN:
        h = ((gN - bN) / d + (gN < bN ? 6 : 0)) * 60
        break
      case gN:
        h = ((bN - rN) / d + 2) * 60
        break
      case bN:
        h = ((rN - gN) / d + 4) * 60
        break
    }
  }

  const s = max === 0 ? 0 : (d / max) * 100
  const v = max * 100
  return { h, s, v }
}

export const getColorFromHsv = (hsv: HSV): ColorEntry => {
  const { r, g, b } = hsvToRgb(hsv.h, hsv.s, hsv.v)
  return {
    hex: rgbToHex(r, g, b),
    rgb: `rgb(${r}, ${g}, ${b})`,
    hsl: formatHsl(r, g, b),
    timestamp: Date.now()
  }
}

export const colorToHsv = (color: ColorEntry): HSV => {
  const { r, g, b } = hexToRgb(color.hex)
  return rgbToHsv(r, g, b)
}
