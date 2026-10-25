import {
  formatOklch,
  hexToRgb,
  parseColorWithAlpha,
  rgbToHex,
  rgbToHsl
} from "./color-utils"

export type ColorFormat =
  | "hex"
  | "rgb"
  | "hsl"
  | "oklch"
  | "tailwind"
  | "swiftui"
  | "uikit"
  | "compose"

export const COLOR_FORMATS: Array<{ value: ColorFormat; label: string }> = [
  { value: "hex", label: "HEX" },
  { value: "rgb", label: "RGB" },
  { value: "hsl", label: "HSL" },
  { value: "oklch", label: "OKLCH" },
  { value: "tailwind", label: "Tailwind" },
  { value: "swiftui", label: "SwiftUI" },
  { value: "uikit", label: "UIKit" },
  { value: "compose", label: "Compose / Flutter" }
]

export const isColorFormat = (value: unknown): value is ColorFormat =>
  COLOR_FORMATS.some((format) => format.value === value)

export const getColorFormatLabel = (format: ColorFormat): string =>
  COLOR_FORMATS.find((entry) => entry.value === format)?.label ?? format

// Three decimals keep every 8-bit channel distinct (a step is 0.0039)
const toUnit = (channel: number) => +(channel / 255).toFixed(3)

const toHexByte = (n: number) =>
  Math.round(n).toString(16).padStart(2, "0").toUpperCase()

/**
 * Write a hex color as code in the given format. `#RRGGBBAA` colors keep
 * their alpha in every format.
 */
export const formatColor = (hex: string, format: ColorFormat): string => {
  const parsed = parseColorWithAlpha(hex)
  const { r, g, b } = hexToRgb(parsed?.hex ?? hex)
  // Two decimals: an alpha byte reads back as e.g. 0.10196 for 10%
  const alpha = +(parsed?.alpha ?? 1).toFixed(2)
  const translucent = alpha < 1
  switch (format) {
    case "hex":
      return hex
    case "rgb":
      return translucent
        ? `rgba(${r}, ${g}, ${b}, ${alpha})`
        : `rgb(${r}, ${g}, ${b})`
    case "hsl": {
      const { h, s, l } = rgbToHsl(r, g, b)
      return translucent
        ? `hsla(${h}, ${s}%, ${l}%, ${alpha})`
        : `hsl(${h}, ${s}%, ${l}%)`
    }
    case "oklch": {
      const oklch = formatOklch(r, g, b)
      return translucent ? oklch.replace(/\)$/, ` / ${alpha})`) : oklch
    }
    case "tailwind": {
      // An arbitrary value, used as bg-[#1e293b], text-[#1e293b] and so on
      const suffix = translucent ? toHexByte(alpha * 255).toLowerCase() : ""
      return `[${rgbToHex(r, g, b)}${suffix}]`
    }
    case "swiftui":
      return `Color(red: ${toUnit(r)}, green: ${toUnit(g)}, blue: ${toUnit(b)}${
        translucent ? `, opacity: ${alpha}` : ""
      })`
    case "uikit":
      return `UIColor(red: ${toUnit(r)}, green: ${toUnit(g)}, blue: ${toUnit(b)}, alpha: ${alpha})`
    case "compose":
      return `Color(0x${toHexByte(alpha * 255)}${rgbToHex(r, g, b).slice(1).toUpperCase()})`
  }
}
