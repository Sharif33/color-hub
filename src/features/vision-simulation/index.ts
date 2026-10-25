export type VisionMode =
  | "protanopia"
  | "deuteranopia"
  | "tritanopia"
  | "achromatopsia"
  | "blurred"

export const VISION_MODES: Array<{
  value: VisionMode
  label: string
  description: string
}> = [
  {
    value: "protanopia",
    label: "Protanopia",
    description: "Red-blind"
  },
  {
    value: "deuteranopia",
    label: "Deuteranopia",
    description: "Green-blind"
  },
  {
    value: "tritanopia",
    label: "Tritanopia",
    description: "Blue-blind"
  },
  {
    value: "achromatopsia",
    label: "Achromatopsia",
    description: "No color"
  },
  {
    value: "blurred",
    label: "Blurred vision",
    description: "Low acuity"
  }
]

/**
 * feColorMatrix values, applied in linear RGB. Protanopia, deuteranopia and
 * tritanopia are Machado, Oliveira & Fernandes (2009) at full severity, as in
 * Chrome DevTools; achromatopsia keeps only luminance. The injected function
 * below has its own copy, because injected functions can't use imports.
 */
export const VISION_MATRICES: Record<Exclude<VisionMode, "blurred">, string> = {
  protanopia:
    "0.152286 1.052583 -0.204868 0 0 0.114503 0.786281 0.099216 0 0 -0.003882 -0.048116 1.051998 0 0 0 0 0 1 0",
  deuteranopia:
    "0.367322 0.860646 -0.227968 0 0 0.280085 0.672501 0.047413 0 0 -0.01182 0.04294 0.968881 0 0 0 0 0 1 0",
  tritanopia:
    "1.255528 -0.076749 -0.178779 0 0 -0.078411 0.930809 0.147602 0 0 0.004733 0.691367 0.3039 0 0 0 0 0 1 0",
  achromatopsia:
    "0.2126 0.7152 0.0722 0 0 0.2126 0.7152 0.0722 0 0 0.2126 0.7152 0.0722 0 0 0 0 0 1 0"
}

export const BLUR_FILTER = "blur(2px)"

/**
 * Filters the whole page, or removes the filter when `mode` is null. Marked
 * with `data-ecp-vision` so it can be found and removed; a reload also
 * clears it. Resolves the mode now applied.
 */
const applyVisionInPage = (mode: string | null): string | null => {
  document
    .querySelectorAll("[data-ecp-vision]")
    .forEach((node) => node.remove())
  if (!mode) return null

  const matrices: Record<string, string> = {
    protanopia:
      "0.152286 1.052583 -0.204868 0 0 0.114503 0.786281 0.099216 0 0 -0.003882 -0.048116 1.051998 0 0 0 0 0 1 0",
    deuteranopia:
      "0.367322 0.860646 -0.227968 0 0 0.280085 0.672501 0.047413 0 0 -0.01182 0.04294 0.968881 0 0 0 0 0 1 0",
    tritanopia:
      "1.255528 -0.076749 -0.178779 0 0 -0.078411 0.930809 0.147602 0 0 0.004733 0.691367 0.3039 0 0 0 0 0 1 0",
    achromatopsia:
      "0.2126 0.7152 0.0722 0 0 0.2126 0.7152 0.0722 0 0 0.2126 0.7152 0.0722 0 0 0 0 0 1 0"
  }
  const root = document.body ?? document.documentElement
  let filter = "blur(2px)"
  if (mode !== "blurred") {
    const values = matrices[mode]
    if (!values) return null
    const svgNs = "http://www.w3.org/2000/svg"
    const svg = document.createElementNS(svgNs, "svg")
    svg.setAttribute("data-ecp-vision", mode)
    svg.setAttribute("aria-hidden", "true")
    svg.style.cssText = "position:absolute;width:0;height:0;overflow:hidden"
    const filterElement = document.createElementNS(svgNs, "filter")
    filterElement.id = "ecp-vision-filter"
    filterElement.setAttribute("color-interpolation-filters", "linearRGB")
    const matrix = document.createElementNS(svgNs, "feColorMatrix")
    matrix.setAttribute("type", "matrix")
    matrix.setAttribute("values", values)
    filterElement.appendChild(matrix)
    svg.appendChild(filterElement)
    root.appendChild(svg)
    filter = "url(#ecp-vision-filter)"
  }
  const style = document.createElement("style")
  style.setAttribute("data-ecp-vision", mode)
  style.textContent = `html { filter: ${filter} !important; }`
  root.appendChild(style)
  return mode
}

const getVisionInPage = (): string | null =>
  document
    .querySelector("style[data-ecp-vision]")
    ?.getAttribute("data-ecp-vision") ?? null

const isVisionMode = (value: unknown): value is VisionMode =>
  VISION_MODES.some((mode) => mode.value === value)

/** Resolves the mode applied, or `null` when off or the page can't be scripted */
export const setVisionSimulation = async (
  tabId: number,
  mode: VisionMode | null
): Promise<VisionMode | null> => {
  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId },
      func: applyVisionInPage,
      args: [mode]
    })
    return isVisionMode(result?.result) ? result.result : null
  } catch {
    return null
  }
}

export const getVisionSimulation = async (
  tabId: number
): Promise<VisionMode | null> => {
  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId },
      func: getVisionInPage
    })
    return isVisionMode(result?.result) ? result.result : null
  } catch {
    return null
  }
}
