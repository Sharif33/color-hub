import {
  hexToRgb,
  oklchToRgb,
  rgbToHex,
  rgbToOklab,
  rgbToOklch,
  type Oklch
} from "~/utils/color-utils"
import {
  DEFAULT_GRADIENT,
  sortStops,
  type Gradient,
  type GradientStop
} from "~/utils/gradient"

/**
 * The OKLCH color as sRGB hex. Out-of-gamut colors keep their lightness and
 * hue and lose chroma until they fit, instead of having channels clipped
 * (which shifts the hue)
 */
export const oklchToHex = (color: Oklch): string => {
  const l = Math.min(1, Math.max(0, color.l))
  const fits = (c: number) => {
    const { r, g, b } = oklchToRgb({ l, c, h: color.h })
    const back = rgbToOklab(r, g, b)
    const radians = (color.h * Math.PI) / 180
    return (
      Math.hypot(
        back.L - l,
        back.a - c * Math.cos(radians),
        back.b - c * Math.sin(radians)
      ) < 0.004
    )
  }
  let c = Math.max(0, color.c)
  if (!fits(c)) {
    let low = 0
    let high = c
    for (let i = 0; i < 14; i += 1) {
      const mid = (low + high) / 2
      if (fits(mid)) low = mid
      else high = mid
    }
    c = low
  }
  const { r, g, b } = oklchToRgb({ l, c, h: color.h })
  return rgbToHex(r, g, b)
}

export const hexToOklch = (hex: string): Oklch => {
  const { r, g, b } = hexToRgb(hex)
  return rgbToOklch(r, g, b)
}

const wrapHue = (h: number) => ((h % 360) + 360) % 360
const clamp = (n: number, min: number, max: number) =>
  Math.min(max, Math.max(min, n))
const random = (min: number, max: number) => min + Math.random() * (max - min)

/**
 * A first gradient for one color: from it to a slightly lighter color 60°
 * round the hue wheel. A gray goes to a lighter or darker gray instead
 */
export const starterGradient = (hex: string): Gradient => {
  const { l, c, h } = hexToOklch(hex)
  const second =
    c < 0.02
      ? { l: l > 0.5 ? l - 0.35 : l + 0.35, c, h }
      : { l: Math.min(0.95, l + 0.08), c, h: (h + 60) % 360 }
  return {
    ...DEFAULT_GRADIENT,
    stops: [
      { color: hex.toLowerCase(), position: 0 },
      { color: oklchToHex(second), position: 100 }
    ]
  }
}

/**
 * A stop for between `a` and `b` that keeps their colorfulness: their
 * halfway hue and lightness at the higher of their chromas
 */
export const vividMiddle = (a: string, b: string): string => {
  const from = hexToOklch(a)
  const to = hexToOklch(b)
  let delta = to.h - from.h
  if (delta > 180) delta -= 360
  if (delta < -180) delta += 360
  return oklchToHex({
    l: (from.l + to.l) / 2,
    c: Math.max(from.c, to.c),
    h: wrapHue(from.h + delta / 2)
  })
}

// --- Ideas from one color ---

export type Harmony =
  | "analogous"
  | "complementary"
  | "triadic"
  | "monochrome"
  | "random"

export const HARMONIES: Array<{
  value: Harmony
  label: string
  title: string
}> = [
  {
    value: "analogous",
    label: "Analogous",
    title: "Neighboring hues: calm and close"
  },
  {
    value: "complementary",
    label: "Complementary",
    title: "The opposite hue: strong contrast"
  },
  {
    value: "triadic",
    label: "Triadic",
    title: "Three hues a third of the wheel apart"
  },
  {
    value: "monochrome",
    label: "Monochrome",
    title: "One hue, light to dark"
  },
  { value: "random", label: "Random", title: "Any hues" }
]

/**
 * `count` colors in a harmony around `base`. Hues are picked in OKLCH, so
 * colors of the same lightness look equally bright, and each call varies a
 * little so a shuffle gives new ideas
 */
export const harmonyColors = (
  base: string,
  harmony: Harmony,
  count: number
): string[] => {
  const start = hexToOklch(base)
  // A gray has no hue to build on; give it some color so harmonies show
  const chroma = start.c < 0.03 ? random(0.1, 0.16) : start.c
  const hue = start.c < 0.03 ? random(0, 360) : start.h
  const at = (index: number) => (count === 1 ? 0 : index / (count - 1))

  const hues: number[] = []
  const lightness: number[] = []
  switch (harmony) {
    case "analogous": {
      const span = random(40, 80)
      for (let i = 0; i < count; i += 1) {
        hues.push(hue + span * at(i) - span / 3)
        lightness.push(start.l + random(-0.06, 0.08))
      }
      break
    }
    case "complementary":
      for (let i = 0; i < count; i += 1) {
        hues.push(hue + 180 * at(i) + random(-12, 12))
        // Lighter toward the middle keeps the blend from going muddy
        lightness.push(start.l + Math.sin(Math.PI * at(i)) * random(0.05, 0.15))
      }
      break
    case "triadic":
      for (let i = 0; i < count; i += 1) {
        hues.push(hue + 240 * at(i) + random(-10, 10))
        lightness.push(start.l + random(-0.05, 0.08))
      }
      break
    case "monochrome": {
      const light = random(0.86, 0.95)
      const dark = random(0.22, 0.38)
      for (let i = 0; i < count; i += 1) {
        hues.push(hue + random(-6, 6))
        lightness.push(light + (dark - light) * at(i))
      }
      break
    }
    case "random": {
      const from = random(0, 360)
      const span = random(60, 220) * (Math.random() < 0.5 ? -1 : 1)
      for (let i = 0; i < count; i += 1) {
        hues.push(from + span * at(i))
        lightness.push(random(0.5, 0.85))
      }
      break
    }
  }

  return hues.map((h, i) => {
    // The base color itself starts every harmony except random
    if (i === 0 && harmony !== "random" && harmony !== "monochrome")
      return base.toLowerCase()
    const l = clamp(lightness[i], 0.15, 0.97)
    // Very light and very dark colors can't hold much chroma
    const c =
      harmony === "monochrome"
        ? chroma * (1 - Math.abs(l - 0.6) * 1.2)
        : chroma * random(0.85, 1.15)
    return oklchToHex({ l, c: Math.max(0, c), h: wrapHue(h) })
  })
}

/** `count` colors picked from a palette, ordered light to dark */
export const paletteColors = (palette: string[], count: number): string[] => {
  const pool = Array.from(new Set(palette.map((hex) => hex.toLowerCase())))
  const picked: string[] = []
  while (picked.length < count && pool.length > 0) {
    picked.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0])
  }
  return picked.sort((a, b) => hexToOklch(b).l - hexToOklch(a).l)
}

/**
 * The gradient with new stop colors, spaced evenly. Stops in `locked` (by
 * order of position) keep their color, and their place if it's still there
 */
export const withColors = (
  gradient: Gradient,
  colors: string[],
  locked: Set<number> = new Set()
): Gradient => {
  const current = sortStops(gradient.stops)
  const last = colors.length - 1
  const stops: GradientStop[] = colors.map((color, index) => ({
    color: locked.has(index) && current[index] ? current[index].color : color,
    position: last === 0 ? 0 : Math.round((index / last) * 1000) / 10
  }))
  return { ...gradient, stops }
}

const DIRECTIONS = [0, 45, 90, 135, 180, 225, 270, 315]

export const randomAngle = () =>
  DIRECTIONS[Math.floor(Math.random() * DIRECTIONS.length)]

// --- Mesh backgrounds ---

export interface MeshGradient {
  /** Shows where no blob reaches */
  base: string
  blobs: Array<{ color: string; x: number; y: number; size: number }>
}

/**
 * A mesh made of soft radial blobs of `colors` on the darkest (or lightest)
 * one. CSS has no mesh gradient, so this is how they're usually built
 */
export const generateMesh = (colors: string[], dark = true): MeshGradient => {
  const sorted = [...colors].sort((a, b) => hexToOklch(a).l - hexToOklch(b).l)
  const base = dark ? sorted[0] : sorted[sorted.length - 1]
  const rest = colors.filter((color) => color !== base)
  const blobs = (rest.length ? rest : colors).map((color, index, list) => {
    // Spread the blobs round the box so they don't pile up in one place
    const angle = (index / list.length) * Math.PI * 2 + random(-0.5, 0.5)
    const distance = random(15, 42)
    return {
      color,
      x: Math.round(clamp(50 + Math.cos(angle) * distance, 0, 100)),
      y: Math.round(clamp(50 + Math.sin(angle) * distance, 0, 100)),
      size: Math.round(random(45, 70))
    }
  })
  return { base, blobs }
}

export const meshToCss = (mesh: MeshGradient) => ({
  backgroundColor: mesh.base,
  backgroundImage: mesh.blobs
    .map(
      (blob) =>
        `radial-gradient(at ${blob.x}% ${blob.y}%, ${blob.color} 0%, transparent ${blob.size}%)`
    )
    .join(", ")
})

export const meshDeclarations = (mesh: MeshGradient): string => {
  const css = meshToCss(mesh)
  return `background-color: ${css.backgroundColor};\nbackground-image: ${css.backgroundImage};`
}
