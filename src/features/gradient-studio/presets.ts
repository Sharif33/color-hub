import { DEFAULT_GRADIENT, type Gradient } from "~/utils/gradient"

const preset = (
  name: string,
  colors: string[],
  patch: Partial<Gradient> = {}
): { name: string; gradient: Gradient } => ({
  name,
  gradient: {
    ...DEFAULT_GRADIENT,
    space: "oklch",
    ...patch,
    stops: colors.map((color, index) => ({
      color,
      position: Math.round((index / (colors.length - 1)) * 1000) / 10
    }))
  }
})

/** Starting points, chosen to look good blended in OKLab or OKLCH */
export const PRESETS = [
  preset("Sunrise", ["#fde68a", "#fb923c", "#e11d48"], { angle: 135 }),
  preset("Lagoon", ["#a7f3d0", "#22d3ee", "#2563eb"], { angle: 120 }),
  preset("Aurora", ["#22c55e", "#06b6d4", "#8b5cf6"], { angle: 160 }),
  preset("Ember", ["#1c1917", "#9a3412", "#f97316"], { angle: 0 }),
  preset("Grape", ["#f0abfc", "#a855f7", "#3b0764"], { angle: 200 }),
  preset("Citrus", ["#fef08a", "#a3e635", "#16a34a"], { angle: 45 }),
  preset("Peach", ["#ffe4e6", "#fda4af", "#fb7185"], {
    type: "radial",
    space: "oklab"
  }),
  preset("Night sky", ["#312e81", "#1e1b4b", "#020617"], {
    type: "radial",
    center: { x: 50, y: 0 },
    space: "oklab"
  }),
  preset("Steel", ["#f8fafc", "#94a3b8", "#334155"], {
    angle: 180,
    space: "oklab"
  }),
  preset("Rainbow", ["#ef4444", "#ef4444"], {
    type: "conic",
    angle: 0,
    hue: "longer"
  }),
  preset("Fade to black", ["#000000cc", "#00000000"], {
    angle: 0,
    space: "oklab",
    easing: "ease-in-out"
  })
]
