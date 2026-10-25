import { hexToRgb, formatHsl, type ColorEntry } from "~utils/color-utils"

export const pickOutsideBrowserColor = async (): Promise<ColorEntry | null> => {
  if (!("EyeDropper" in window)) {
    console.warn("EyeDropper is not supported in this context")
    return null
  }

  try {
    // @ts-ignore
    const eyeDropper = new EyeDropper()
    const result = await eyeDropper.open()
    const hex = result.sRGBHex.toUpperCase()
    const { r, g, b } = hexToRgb(hex)
    const color: ColorEntry = {
      hex,
      rgb: `rgb(${r}, ${g}, ${b})`,
      hsl: formatHsl(r, g, b),
      timestamp: Date.now()
    }

    try {
      await navigator.clipboard.writeText(hex)
    } catch (error) {
      console.warn("Clipboard write failed:", error)
    }

    try {
      chrome.runtime.sendMessage({ type: "COLOR_PICKED", color })
    } catch (error) {
      console.warn("Failed to send color message:", error)
    }

    return color
  } catch (error) {
    const isUserCancelled =
      error instanceof DOMException && error.name === "AbortError"
    if (!isUserCancelled) {
      console.warn("EyeDropper failed:", error)
    }
    return null
  }
}
