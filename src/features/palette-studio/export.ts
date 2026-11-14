import type { AnalyzedColor } from "~features/webpage-color-analyzer"
import { formatColor } from "~utils/color-formats"
import { hexToRgb, parseColorWithAlpha } from "~utils/color-utils"
import {
  nearestTailwindColor,
  type TailwindVersion
} from "~utils/tailwind-match"

export type ExportFormat =
  | "css"
  | "scss"
  | "tailwind-v4"
  | "tailwind-v3"
  | "dtcg"

export const EXPORT_FORMATS: Array<{
  value: ExportFormat
  label: string
  description: string
  extension: string
}> = [
  {
    value: "css",
    label: "CSS variables",
    description: "Custom properties on :root",
    extension: "css"
  },
  {
    value: "scss",
    label: "SCSS",
    description: "Sass variables",
    extension: "scss"
  },
  {
    value: "tailwind-v4",
    label: "Tailwind v4",
    description: "An @theme block for your CSS",
    extension: "css"
  },
  {
    value: "tailwind-v3",
    label: "Tailwind v3",
    description: "theme.extend.colors for tailwind.config.js",
    extension: "js"
  },
  {
    value: "dtcg",
    label: "Design tokens",
    description: "W3C Design Tokens (DTCG 2025.10) JSON",
    extension: "tokens.json"
  }
]

/** How color values are written, in the formats that are text */
export type ExportValueFormat = "hex" | "rgb" | "hsl" | "oklch"

export const EXPORT_VALUE_FORMATS: Array<{
  value: ExportValueFormat
  label: string
}> = [
  { value: "hex", label: "HEX" },
  { value: "rgb", label: "RGB" },
  { value: "hsl", label: "HSL" },
  { value: "oklch", label: "OKLCH" }
]

export interface NamedColor {
  name: string
  color: AnalyzedColor
  /** Where the name came from */
  source: "variable" | "tailwind" | "index"
}

/** Below this ΔE a color is named after its Tailwind match */
const TAILWIND_NAME_MAX_DELTA_E = 2

const toIdentifier = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")

/**
 * Token names: the color's CSS variable, else its Tailwind name when it's
 * close (ΔE < 2), else `palette-N`. Repeated names get a numeric suffix.
 */
export const nameColors = (
  colors: AnalyzedColor[],
  tailwindVersion: TailwindVersion
): NamedColor[] => {
  const used = new Set<string>()
  return colors.map((color, index) => {
    let base = ""
    let source: NamedColor["source"] = "index"
    const variable = color.variables?.[0]
    if (variable) {
      base = toIdentifier(variable)
      source = "variable"
    }
    if (!base) {
      const match = nearestTailwindColor(color.hex, tailwindVersion)
      if (match.deltaE < TAILWIND_NAME_MAX_DELTA_E) {
        const alpha = parseColorWithAlpha(color.hex)?.alpha ?? 1
        base =
          alpha < 1
            ? `${match.name}-alpha-${Math.round(alpha * 100)}`
            : match.name
        source = "tailwind"
      }
    }
    if (!base) {
      base = `palette-${index + 1}`
      source = "index"
    }
    let name = base
    for (let n = 2; used.has(name); n += 1) name = `${base}-${n}`
    used.add(name)
    return { name, color, source }
  })
}

const describe = (color: AnalyzedColor): string => {
  const uses = `${color.count} ${color.count === 1 ? "use" : "uses"}`
  return color.properties?.length
    ? `${uses}: ${color.properties.join(", ")}`
    : uses
}

// DTCG 2025.10 color value: sRGB components from 0 to 1, plus a hex fallback
const toDtcgValue = (hex: string) => {
  const parsed = parseColorWithAlpha(hex)
  const { r, g, b } = hexToRgb(parsed?.hex ?? hex)
  const unit = (n: number) => +(n / 255).toFixed(4)
  const alpha = +(parsed?.alpha ?? 1).toFixed(2)
  return {
    colorSpace: "srgb",
    components: [unit(r), unit(g), unit(b)],
    ...(alpha < 1 ? { alpha } : {}),
    hex: (parsed?.hex ?? hex).toLowerCase()
  }
}

export interface ExportOptions {
  format: ExportFormat
  valueFormat: ExportValueFormat
  /** Where the palette came from, for the header comment */
  source: string
}

export const exportPalette = (
  named: NamedColor[],
  { format, valueFormat, source }: ExportOptions
): string => {
  const value = (color: AnalyzedColor) =>
    valueFormat === "hex"
      ? color.hex.toLowerCase()
      : formatColor(color.hex, valueFormat)
  const header = `Colors from ${source}, exported by Color Hub`

  switch (format) {
    case "css":
      return [
        `/* ${header} */`,
        ":root {",
        ...named.map(({ name, color }) => `  --${name}: ${value(color)};`),
        "}",
        ""
      ].join("\n")
    case "scss":
      return [
        `// ${header}`,
        ...named.map(({ name, color }) => `$${name}: ${value(color)};`),
        ""
      ].join("\n")
    case "tailwind-v4":
      return [
        `/* ${header} */`,
        "@theme {",
        ...named.map(
          ({ name, color }) => `  --color-${name}: ${value(color)};`
        ),
        "}",
        ""
      ].join("\n")
    case "tailwind-v3":
      return [
        `// ${header}`,
        "/** @type {import('tailwindcss').Config} */",
        "module.exports = {",
        "  theme: {",
        "    extend: {",
        "      colors: {",
        named
          .map(
            ({ name, color }) =>
              `        ${JSON.stringify(name)}: ${JSON.stringify(value(color))}`
          )
          .join(",\n"),
        "      }",
        "    }",
        "  }",
        "}",
        ""
      ].join("\n")
    case "dtcg": {
      const tokens = Object.fromEntries(
        named.map(({ name, color }) => [
          name,
          {
            $type: "color",
            $value: toDtcgValue(color.hex),
            $description: describe(color)
          }
        ])
      )
      return `${JSON.stringify({ color: tokens }, null, 2)}\n`
    }
  }
}
