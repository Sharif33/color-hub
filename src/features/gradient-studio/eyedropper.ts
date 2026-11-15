import { parseColor } from "~/utils/color-utils"

/**
 * Opens the browser's eyedropper. Resolves `#rrggbb`, or null when it's
 * cancelled or not supported. Unlike the popup's Pick Color, the color isn't
 * copied or added to the history
 */
export const pickScreenColor = async (): Promise<string | null> => {
  if (!("EyeDropper" in window)) return null
  try {
    // @ts-ignore EyeDropper isn't in TypeScript's DOM types yet
    const result = await new EyeDropper().open()
    return parseColor(result.sRGBHex)
  } catch (error) {
    // AbortError: the user pressed Esc
    if (!(error instanceof DOMException && error.name === "AbortError"))
      console.warn("EyeDropper failed:", error)
    return null
  }
}
