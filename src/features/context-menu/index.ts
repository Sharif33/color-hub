import { toggleColorInspector } from "~features/color-inspector"
import {
  hostnameOf,
  openPendingPalette
} from "~features/palette-studio/pending"
import { analyzeScreenshotColors } from "~features/screenshot-colors"
import {
  setVisionSimulation,
  VISION_MODES,
  type VisionMode
} from "~features/vision-simulation"
import {
  analyzeWebpageColors,
  analyzeWebpageContrastPairs
} from "~features/webpage-color-analyzer"
import { parseColor } from "~utils/color-utils"

const ROOT = "color-hub"
const ANALYZE_COLORS = "analyze-colors"
const SCREENSHOT_COLORS = "screenshot-colors"
const ANALYZE_CONTRAST = "analyze-contrast"
const INSPECT = "inspect-colors"
const VISION = "simulate-vision"
const VISION_OFF = "vision-off"
const VISION_PREFIX = "vision-"
const CHECK_SELECTION = "check-selection"
const CONTRAST_CHECKER = "contrast-checker"

// Pages that can't be scripted (chrome://, extension stores) don't get the
// menu at all. file:// pages need "Allow access to file URLs"
const DOCUMENT_URL_PATTERNS = ["http://*/*", "https://*/*", "file:///*"]

const ALL_CONTEXTS: chrome.contextMenus.ContextType[] = [
  "page",
  "frame",
  "selection",
  "link",
  "image",
  "video",
  "audio",
  "editable"
]

/** Context menus persist, so this runs on install and update only */
export const registerContextMenus = () => {
  chrome.contextMenus.removeAll(() => {
    const create = (properties: chrome.contextMenus.CreateProperties) =>
      chrome.contextMenus.create(
        {
          contexts: ALL_CONTEXTS,
          documentUrlPatterns: DOCUMENT_URL_PATTERNS,
          ...properties
        },
        // Reading lastError stops "Unchecked runtime.lastError" console noise
        () => void chrome.runtime.lastError
      )

    create({ id: ROOT, title: "Color Hub" })
    create({
      id: CHECK_SELECTION,
      parentId: ROOT,
      title: "Check contrast of “%s”",
      contexts: ["selection"]
    })
    create({ id: INSPECT, parentId: ROOT, title: "Inspect element colors" })
    create({ id: ANALYZE_COLORS, parentId: ROOT, title: "Analyze page colors" })
    create({
      id: SCREENSHOT_COLORS,
      parentId: ROOT,
      title: "Extract colors from screenshot"
    })
    create({
      id: ANALYZE_CONTRAST,
      parentId: ROOT,
      title: "Analyze WCAG contrast"
    })
    create({ id: VISION, parentId: ROOT, title: "Simulate vision" })
    create({ id: VISION_OFF, parentId: VISION, title: "Normal vision (off)" })
    VISION_MODES.forEach((mode) =>
      create({
        id: `${VISION_PREFIX}${mode.value}`,
        parentId: VISION,
        title: mode.label
      })
    )
    create({
      id: CONTRAST_CHECKER,
      parentId: ROOT,
      title: "Open Contrast Checker"
    })
  })
}

const openContrastChecker = (foreground?: string) => {
  const query = foreground ? `?fg=${foreground.slice(1)}` : ""
  void chrome.tabs.create({
    url: chrome.runtime.getURL(`tabs/contrast-checker.html${query}`)
  })
}

const openPageColors = async (tab: chrome.tabs.Tab, screenshot: boolean) => {
  const colors = screenshot
    ? await analyzeScreenshotColors(tab)
    : (await analyzeWebpageColors(tab))?.colors
  if (!colors) return
  const domain = hostnameOf(tab.url)
  await openPendingPalette({
    domain: domain && screenshot ? `${domain} (screenshot)` : domain,
    url: tab.url ?? "",
    title: tab.title ?? "",
    timestamp: Date.now(),
    colors
  })
}

export const handleContextMenuClick = async (
  info: chrome.contextMenus.OnClickData,
  tab?: chrome.tabs.Tab
) => {
  const id = String(info.menuItemId)
  try {
    if (id === CONTRAST_CHECKER) return openContrastChecker()
    if (id === CHECK_SELECTION) {
      // A selected color (e.g. "#2563eb" in some code) becomes the foreground
      const color = parseColor(
        (info.selectionText ?? "").trim().replace(/;$/, "")
      )
      return openContrastChecker(color ?? undefined)
    }
    if (!tab?.id) return
    if (id === ANALYZE_COLORS) return await openPageColors(tab, false)
    if (id === SCREENSHOT_COLORS) return await openPageColors(tab, true)
    if (id === ANALYZE_CONTRAST) {
      const report = await analyzeWebpageContrastPairs(tab)
      if (report) {
        void chrome.tabs.create({
          url: chrome.runtime.getURL("tabs/wcag-contrast-analyzer.html")
        })
      }
      return
    }
    if (id === INSPECT) return void (await toggleColorInspector(tab.id))
    if (id === VISION_OFF) return void (await setVisionSimulation(tab.id, null))
    if (id.startsWith(VISION_PREFIX)) {
      const mode = id.slice(VISION_PREFIX.length) as VisionMode
      return void (await setVisionSimulation(tab.id, mode))
    }
  } catch (error) {
    // Pages that can't be scripted fail quietly; the action does nothing
    console.warn(`Color Hub menu action "${id}" failed:`, error)
  }
}
