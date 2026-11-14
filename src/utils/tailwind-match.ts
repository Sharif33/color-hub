import { TAILWIND_V3, TAILWIND_V4 } from "~lib/tailwind-palettes"

import { deltaE2000, hexToLab, parseColor, type Lab } from "./color-utils"

export type TailwindVersion = "v3" | "v4"

export const TAILWIND_VERSIONS: TailwindVersion[] = ["v4", "v3"]

export const isTailwindVersion = (value: unknown): value is TailwindVersion =>
  value === "v3" || value === "v4"

export interface TailwindMatch {
  /** Class color name, e.g. `blue-500` */
  name: string
  /** The Tailwind color as sRGB hex. v4 colors outside sRGB are clipped */
  hex: string
  deltaE: number
}

interface PaletteEntry {
  name: string
  hex: string
  lab: Lab
}

const palettes: Partial<Record<TailwindVersion, PaletteEntry[]>> = {}

const getPalette = (version: TailwindVersion): PaletteEntry[] => {
  const cached = palettes[version]
  if (cached) return cached
  const source = version === "v3" ? TAILWIND_V3 : TAILWIND_V4
  const entries = Object.entries(source).flatMap(([name, value]) => {
    const hex = parseColor(value)
    return hex ? [{ name, hex, lab: hexToLab(hex) }] : []
  })
  palettes[version] = entries
  return entries
}

/** The perceptually closest Tailwind palette color (CIEDE2000). */
export const nearestTailwindColor = (
  hex: string,
  version: TailwindVersion
): TailwindMatch => {
  const lab = hexToLab(hex)
  let best: TailwindMatch = { name: "", hex: "", deltaE: Infinity }
  for (const entry of getPalette(version)) {
    const deltaE = deltaE2000(lab, entry.lab)
    if (deltaE < best.deltaE)
      best = { name: entry.name, hex: entry.hex, deltaE }
  }
  return best
}

/** Below 0.5 the colors are indistinguishable, so the match counts as exact */
export const isExactTailwindMatch = (match: TailwindMatch) => match.deltaE < 0.5
