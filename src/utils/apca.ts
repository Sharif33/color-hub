import { hexToRgb } from "./color-utils"

// APCA-W3 0.0.98G-4g, the contrast method in the WCAG 3 draft
// (https://github.com/Myndex/apca-w3). Constants are from the reference code
const MAIN_TRC = 2.4
const NORM_BG = 0.56
const NORM_TXT = 0.57
const REV_TXT = 0.62
const REV_BG = 0.65
const BLK_THRS = 0.022
const BLK_CLMP = 1.414
const SCALE = 1.14
const LO_OFFSET = 0.027
const DELTA_Y_MIN = 0.0005
const LO_CLIP = 0.1

// APCA's screen luminance uses a plain 2.4 power curve, not the piecewise
// sRGB curve that WCAG 2 luminance uses
const screenLuminance = (hex: string): number => {
  const { r, g, b } = hexToRgb(hex)
  const y =
    0.2126729 * Math.pow(r / 255, MAIN_TRC) +
    0.7151522 * Math.pow(g / 255, MAIN_TRC) +
    0.072175 * Math.pow(b / 255, MAIN_TRC)
  // Soft-clamp near black, where screens flare
  return y > BLK_THRS ? y : y + Math.pow(BLK_THRS - y, BLK_CLMP)
}

/**
 * APCA lightness contrast (Lc) of opaque text on an opaque background, from
 * about -108 to 106. Positive is dark text on a light background, negative is
 * light text on a dark background. The order of the arguments matters.
 */
export const apcaContrast = (
  textHex: string,
  backgroundHex: string
): number => {
  const text = screenLuminance(textHex)
  const background = screenLuminance(backgroundHex)
  if (Math.abs(background - text) < DELTA_Y_MIN) return 0

  if (background > text) {
    const sapc =
      (Math.pow(background, NORM_BG) - Math.pow(text, NORM_TXT)) * SCALE
    return sapc < LO_CLIP ? 0 : (sapc - LO_OFFSET) * 100
  }
  const sapc = (Math.pow(background, REV_BG) - Math.pow(text, REV_TXT)) * SCALE
  return sapc > -LO_CLIP ? 0 : (sapc + LO_OFFSET) * 100
}

export interface ApcaLevel {
  /** The |Lc| a use needs */
  minimum: number
  label: string
  description: string
}

/** APCA's simplified ("bronze") guidance, strictest first */
export const APCA_LEVELS: ApcaLevel[] = [
  {
    minimum: 90,
    label: "Preferred body text",
    description: "Columns of body text, 18px and up at normal weight"
  },
  {
    minimum: 75,
    label: "Body text",
    description: "Minimum for body text, 18px normal or 16px medium"
  },
  {
    minimum: 60,
    label: "Content text",
    description: "Other readable text, 24px normal or 16px bold"
  },
  {
    minimum: 45,
    label: "Headlines",
    description: "Large text: 36px normal or 24px bold, and fine icons"
  },
  {
    minimum: 30,
    label: "Spot text and UI",
    description: "Placeholders, captions, and solid non-text elements"
  },
  {
    minimum: 15,
    label: "Discernible",
    description: "Dividers and large non-text shapes; invisible below this"
  }
]

/** The strictest use a contrast is good enough for, or null below Lc 15 */
export const getApcaLevel = (lc: number): ApcaLevel | null =>
  APCA_LEVELS.find((level) => Math.abs(lc) >= level.minimum) ?? null

/** Lc to one decimal, keeping the sign that gives the polarity */
export const formatLc = (lc: number): string => lc.toFixed(1)
