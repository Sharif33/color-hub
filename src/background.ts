import { contrastCheckerUrl } from "~features/color-inspector"
import {
  handleContextMenuClick,
  registerContextMenus
} from "~features/context-menu"
import { COLOR_HISTORY_LIMIT } from "~lib/constants"
import { hexToRgb } from "~utils/color-utils"

import { isRestrictedUrl } from "./utils/restricted-urls"

export {}

interface ColorEntry {
  hex: string
  rgb: string
  hsl?: string
  timestamp: number
}

void initializeBadgeState()

// Listen for color picked events from injected script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "COLOR_PICKED" && message.color) {
    void savePickedColor(message.color as ColorEntry)
    sendResponse({ success: true })
  }
  // From the hover inspector, running in the page
  if (message.type === "OPEN_CONTRAST_CHECKER") {
    const url = contrastCheckerUrl(message)
    if (url) void chrome.tabs.create({ url })
  }
  return false
})

chrome.runtime.onInstalled.addListener(() => {
  void initializeBadgeState()
  registerContextMenus()
})

chrome.contextMenus.onClicked.addListener((info, tab) => {
  void handleContextMenuClick(info, tab)
})

chrome.runtime.onStartup.addListener(() => {
  void initializeBadgeState()
})

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local") return
  if (!Object.prototype.hasOwnProperty.call(changes, "lastPickedColor")) return
  const nextColor =
    (changes.lastPickedColor?.newValue as ColorEntry | undefined) ?? null
  void updateBadgeColor(nextColor)
})

// The popup reports the tab it highlighted. Querying the active tab on
// disconnect would miss it when the popup closed because the user switched tabs
chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== "popup") return
  let highlightedTabId: number | null = null
  port.onMessage.addListener((message) => {
    if (typeof message?.highlightedTabId === "number") {
      highlightedTabId = message.highlightedTabId
    }
  })
  port.onDisconnect.addListener(() => {
    if (highlightedTabId !== null) void clearWebpageHighlights(highlightedTabId)
  })
})

async function clearWebpageHighlights(tabId: number) {
  try {
    const tab = await chrome.tabs.get(tabId)
    const url = tab.url || tab.pendingUrl || ""
    if (isRestrictedUrl(url)) {
      return
    }
    const func = () => {
      const existing = document.querySelectorAll('[data-ecp-highlight="true"]')
      existing.forEach((node) => node.remove())
      const root = document.getElementById("ecp-highlight-root")
      if (root) root.remove()
    }
    // Highlights are drawn in iframes too. If some frame can't be scripted,
    // still clear the top frame
    await chrome.scripting
      .executeScript({ target: { tabId, allFrames: true }, func })
      .catch(() => chrome.scripting.executeScript({ target: { tabId }, func }))
  } catch (error) {
    console.error("Error clearing highlights:", error)
  }
}

async function savePickedColor(color: ColorEntry) {
  try {
    const data = await chrome.storage.local.get(["colorHistory"])
    const history: ColorEntry[] = Array.isArray(data.colorHistory)
      ? data.colorHistory
      : []
    // Picked colors are uppercase and picker colors lowercase, so compare both ways
    const hex = color.hex.toLowerCase()
    const updated = [
      color,
      ...history.filter((c) => c.hex.toLowerCase() !== hex)
    ].slice(0, COLOR_HISTORY_LIMIT)

    await chrome.storage.local.set({
      colorHistory: updated,
      lastPickedColor: color
    })
  } catch (error) {
    console.error("Error saving picked color:", error)
  }
}

async function initializeBadgeState() {
  try {
    const data = await chrome.storage.local.get(["lastPickedColor"])
    const color = (data.lastPickedColor as ColorEntry | undefined) ?? null
    await updateBadgeColor(color)
  } catch (error) {
    console.error("Error initializing badge:", error)
  }
}

async function updateBadgeColor(color: ColorEntry | null) {
  try {
    if (!color?.hex) {
      await chrome.action.setBadgeText({ text: "" })
      await chrome.action.setTitle({ title: "Color Hub" })
      return
    }

    const { r, g, b } = hexToRgb(color.hex)
    const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
    const textColor: [number, number, number, number] =
      luminance > 0.6 ? [0, 0, 0, 255] : [255, 255, 255, 255]

    await chrome.action.setBadgeText({ text: " " })
    await chrome.action.setBadgeBackgroundColor({ color: [r, g, b, 255] })
    await chrome.action.setBadgeTextColor({ color: textColor })
    await chrome.action.setTitle({
      title: `Color Hub • Last picked ${color.hex}`
    })
  } catch (error) {
    console.error("Error updating badge:", error)
  }
}
