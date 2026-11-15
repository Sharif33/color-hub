import { parseColorWithAlpha, type ParsedColor } from "~/utils/color-utils"
import {
  findGradientFunctions,
  parseGradient,
  type Gradient
} from "~/utils/gradient"

let context: CanvasRenderingContext2D | null | undefined

const NOT_COLORS = ["inherit", "initial", "unset", "revert", "currentcolor"]

/**
 * Any color the browser understands, such as `rebeccapurple`, `lab()` or
 * `color(display-p3 …)`. It's painted on a 1×1 canvas to read it back, so
 * colors outside sRGB are clipped. Needs a document (extension pages only).
 */
export const resolveCssColor = (value: string): ParsedColor | null => {
  const input = value.trim()
  if (!input) return null
  if (input.toLowerCase() === "transparent") return { hex: "#000000", alpha: 0 }
  const quick = parseColorWithAlpha(input)
  if (quick) return quick
  if (NOT_COLORS.includes(input.toLowerCase())) return null
  if (!CSS.supports("color", input)) return null

  if (context === undefined) {
    const canvas = document.createElement("canvas")
    canvas.width = canvas.height = 1
    context = canvas.getContext("2d", { willReadFrequently: true })
  }
  if (!context) return null
  // Paint without the "/ alpha" part so the channels read back exactly
  const alphaMatch = input.match(/\/\s*([\d.]+)(%?)\s*\)$/)
  context.clearRect(0, 0, 1, 1)
  context.fillStyle = "#000000"
  context.fillStyle = input.replace(/\/[^/)]*\)$/, ")")
  context.fillRect(0, 0, 1, 1)
  const [r, g, b] = context.getImageData(0, 0, 1, 1).data
  const hex = `#${[r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("")}`
  const alpha = alphaMatch
    ? Math.min(1, parseFloat(alphaMatch[1]) / (alphaMatch[2] ? 100 : 1))
    : 1
  return { hex, alpha }
}

/**
 * The gradient in pasted CSS, e.g. a `background:` line copied from a
 * stylesheet. When there are several (a fallback and the real one), the last
 * one that parses wins, as it would in CSS. Lengths and radial sizes are
 * worked out in `box`: the box it will be shown in, as the CSS doesn't say
 * what box it was written for.
 */
export const parsePastedGradient = (
  text: string,
  box?: { width: number; height: number }
): Gradient | null => {
  const functions = findGradientFunctions(text)
  const viewport = { width: window.innerWidth, height: window.innerHeight }
  for (const fn of functions.reverse()) {
    const gradient = parseGradient(fn, {
      resolve: resolveCssColor,
      box,
      viewport
    })
    if (gradient) return gradient
  }
  return null
}
