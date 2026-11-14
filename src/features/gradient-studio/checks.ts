import { VISION_MATRICES } from "~features/vision-simulation"
import { apcaContrast } from "~utils/apca"
import {
  alphaBlend,
  deltaE2000,
  getContrastRatio,
  hexToLab,
  hexToRgb,
  rgbToHex,
  rgbToOklch
} from "~utils/color-utils"
import {
  rgbaToHex,
  sampleGradient,
  sortStops,
  type Gradient
} from "~utils/gradient"

// --- Text contrast ---

/** Positions checked along the gradient; one per half percent */
const CONTRAST_SAMPLES = 201

export interface GradientContrast {
  /** Lowest WCAG ratio anywhere on the gradient, and where (0–100) */
  worst: { ratio: number; position: number; background: string }
  best: { ratio: number; position: number }
  /** Smallest |APCA Lc| along the gradient */
  weakestLc: number
  /** Ranges (0–100) where the ratio is under `threshold` */
  failing: Array<[number, number]>
}

/**
 * Text in `textColor` over every part of the gradient. Translucent stops are
 * judged over white, like the WCAG report judges the page.
 */
export const checkTextContrast = (
  gradient: Gradient,
  textColor: string,
  threshold: number
): GradientContrast => {
  const stops = sortStops(gradient.stops)
  const first = stops[0]?.position ?? 0
  const last = stops[stops.length - 1]?.position ?? 100
  let worst = { ratio: Infinity, position: 0, background: "#ffffff" }
  let best = { ratio: 0, position: 0 }
  let weakestLc = Infinity
  const failing: Array<[number, number]> = []
  let failStart: number | null = null
  for (let i = 0; i < CONTRAST_SAMPLES; i += 1) {
    // A repeating gradient goes round its stops; other gradients hold their
    // end colors outside them, so the stops' span is enough
    const position = first + ((last - first) * i) / (CONTRAST_SAMPLES - 1)
    const sample = sampleGradient(gradient, position)
    const background = alphaBlend(
      rgbToHex(sample.r, sample.g, sample.b),
      sample.a,
      "#ffffff"
    )
    const ratio = getContrastRatio(textColor, background)
    if (ratio < worst.ratio) worst = { ratio, position, background }
    if (ratio > best.ratio) best = { ratio, position }
    weakestLc = Math.min(
      weakestLc,
      Math.abs(apcaContrast(textColor, background))
    )
    if (ratio < threshold && failStart === null) failStart = position
    if (ratio >= threshold && failStart !== null) {
      failing.push([failStart, position])
      failStart = null
    }
  }
  if (failStart !== null) failing.push([failStart, last])
  return { worst, best, weakestLc, failing }
}

/** White or near-black, whichever has the better worst case */
export const bestTextColor = (gradient: Gradient): string => {
  const white = checkTextContrast(gradient, "#ffffff", 4.5).worst.ratio
  const black = checkTextContrast(gradient, "#0f172a", 4.5).worst.ratio
  return white >= black ? "#ffffff" : "#0f172a"
}

// --- Lint ---

export type LintFix = "use-oklch" | "add-grain" | "add-middle-stop"

export interface LintIssue {
  id: string
  message: string
  /** A one-click fix, when there is one */
  fix?: { kind: LintFix; label: string; afterStop?: number }
}

const chromaOf = (hex: string) => {
  const { r, g, b } = hexToRgb(hex)
  return rgbToOklch(r, g, b).c
}

const opaque = (color: string) => color.slice(0, 7)

// feColorMatrix rows applied in linear RGB, as the page simulation does
const simulate = (hex: string, matrix: number[]) => {
  const toLinear = (c: number) => {
    const n = c / 255
    return n <= 0.04045 ? n / 12.92 : Math.pow((n + 0.055) / 1.055, 2.4)
  }
  const toSrgb = (v: number) => {
    const n = Math.min(1, Math.max(0, v))
    return (
      (n <= 0.0031308 ? 12.92 * n : 1.055 * Math.pow(n, 1 / 2.4) - 0.055) * 255
    )
  }
  const { r, g, b } = hexToRgb(hex)
  const [lr, lg, lb] = [r, g, b].map(toLinear)
  const row = (i: number) =>
    toSrgb(matrix[i] * lr + matrix[i + 1] * lg + matrix[i + 2] * lb)
  return rgbToHex(row(0), row(5), row(10))
}

const VISION_LABELS: Record<string, string> = {
  protanopia: "protanopia (red-blind)",
  deuteranopia: "deuteranopia (green-blind)",
  tritanopia: "tritanopia (blue-blind)"
}

/**
 * Problems worth a look: a gray middle where two colorful stops blend,
 * stops too alike to tell apart, ends that look the same with color
 * blindness, and banding in a subtle gradient
 */
export const lintGradient = (gradient: Gradient): LintIssue[] => {
  const issues: LintIssue[] = []
  const stops = sortStops(gradient.stops)

  for (let i = 0; i < stops.length - 1; i += 1) {
    const from = stops[i]
    const to = stops[i + 1]
    if (to.position <= from.position) continue
    const a = opaque(from.color)
    const b = opaque(to.color)
    const middle = opaque(
      rgbaToHex(sampleGradient(gradient, (from.position + to.position) / 2))
    )
    const ends = Math.min(chromaOf(a), chromaOf(b))
    // Both ends are colorful, and the middle loses more than 40% of that
    if (ends > 0.06 && chromaOf(middle) < ends * 0.6) {
      issues.push({
        id: `muddy-${i}`,
        message: `Stops ${i + 1} and ${i + 2} turn grayish where they blend.`,
        fix:
          gradient.space === "oklch"
            ? {
                kind: "add-middle-stop",
                label: "Add a vivid middle stop",
                afterStop: i
              }
            : { kind: "use-oklch", label: "Blend in OKLCH" }
      })
    }
    const difference = deltaE2000(hexToLab(a), hexToLab(b))
    // Translucent stops can share a color and still differ in opacity
    if (difference < 2 && a === from.color && b === to.color) {
      issues.push({
        id: `same-${i}`,
        message: `Stops ${i + 1} and ${i + 2} look the same (ΔE ${difference.toFixed(1)}).`
      })
    }
  }

  const first = opaque(stops[0]?.color ?? "#000000")
  const last = opaque(stops[stops.length - 1]?.color ?? "#000000")
  const normal = deltaE2000(hexToLab(first), hexToLab(last))
  if (normal > 15) {
    for (const [mode, values] of Object.entries(VISION_MATRICES)) {
      if (!(mode in VISION_LABELS)) continue
      const matrix = values.split(/\s+/).map(Number)
      const seen = deltaE2000(
        hexToLab(simulate(first, matrix)),
        hexToLab(simulate(last, matrix))
      )
      if (seen < 8) {
        issues.push({
          id: `vision-${mode}`,
          message: `With ${VISION_LABELS[mode]}, the two ends look alike (ΔE ${seen.toFixed(1)}).`
        })
      }
    }
  }

  // Fewer than about 48 levels from end to end show as bands on a large area
  const range = (["r", "g", "b"] as const).map((key) => {
    const values = stops.map((stop) => hexToRgb(opaque(stop.color))[key])
    return Math.max(...values) - Math.min(...values)
  })
  const levels = Math.max(...range)
  if (gradient.grain === 0 && levels > 0 && levels < 48) {
    issues.push({
      id: "banding",
      message: `Only ${levels} shades from end to end, so it can show bands on a large area.`,
      fix: { kind: "add-grain", label: "Add grain" }
    })
  }
  return issues
}
