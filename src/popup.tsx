import { Pipette } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"

import "~style.css"

import { HistoryScreen } from "~features/color-history/HistoryScreen"
import { useColorHistory } from "~features/color-history/useColorHistory"
import { toggleColorInspector } from "~features/color-inspector"
import { AdjustScreen } from "~features/color-picker/AdjustScreen"
import { useColorPicker } from "~features/color-picker/useColorPicker"
import { openPaletteStudio } from "~features/palette-studio/pending"
import { pickOutsideBrowserColor } from "~features/pick-outside-browser-color"
import { ColorHero } from "~features/popup/ColorHero"
import { useConfirm } from "~features/popup/ConfirmDialog"
import { HomeScreen } from "~features/popup/HomeScreen"
import {
  getVisionSimulation,
  setVisionSimulation,
  VISION_MODES,
  type VisionMode
} from "~features/vision-simulation"
import { VisionScreen } from "~features/vision-simulation/VisionScreen"
import {
  analyzeWebpageContrastPairs,
  type AnalyzedColor
} from "~features/webpage-color-analyzer"
import { PageColorsScreen } from "~features/webpage-color-analyzer/PageColorsScreen"
import { SavedPalettesScreen } from "~features/webpage-color-analyzer/SavedPalettesScreen"
import { useWebpageAnalyzer } from "~features/webpage-color-analyzer/useWebpageAnalyzer"
import { useSettings } from "~hooks/use-settings"
import { cn } from "~lib/cn"
import { COLOR_HISTORY_LIMIT } from "~lib/constants"
import { formatColor } from "~utils/color-formats"
import {
  colorToHsv,
  getColorFromHsv,
  hsvToRgb,
  type ColorEntry
} from "~utils/color-utils"
import { isRestrictedUrl } from "~utils/restricted-urls"

type Screen = "home" | "adjust" | "history" | "results" | "saved" | "vision"

// Native form controls and scrollbars follow the popup's light or dark theme.
// Only the popup does this; the extension's tab pages are light
document.documentElement.style.colorScheme = "light dark"

const toColorEntry = (color: { hex: string; rgb: string }): ColorEntry => ({
  hex: color.hex,
  rgb: color.rgb,
  hsl: undefined,
  timestamp: Date.now()
})

function IndexPopup() {
  const [screen, setScreen] = useState<Screen>("home")
  const [currentColor, setCurrentColor] = useState<ColorEntry | null>(null)
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const [outsidePickActive, setOutsidePickActive] = useState(false)
  const [pageRestricted, setPageRestricted] = useState(false)
  const [activeTabId, setActiveTabId] = useState<number | null>(null)
  const [visionMode, setVisionMode] = useState<VisionMode | null>(null)
  const [isAnalyzingContrast, setIsAnalyzingContrast] = useState(false)
  // False until a color is picked, chosen or adjusted, so a first launch
  // shows "No color yet" instead of the picker's starting color
  const [hasColor, setHasColor] = useState(false)
  const colorPicker = useColorPicker({ h: 220, s: 66, v: 16 })
  const { copyFormat, tailwindVersion } = useSettings()
  const { confirm, confirmDialog, isConfirming } = useConfirm()

  const getCurrentColorFromHsv = useCallback((): ColorEntry => {
    return getColorFromHsv(colorPicker.hsv)
  }, [colorPicker.hsv])

  useEffect(() => {
    setCurrentColor(getCurrentColorFromHsv())
  }, [colorPicker.hsv, getCurrentColorFromHsv])

  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedField(field)
      setTimeout(() => setCopiedField(null), 1500)
    } catch (error) {
      console.warn("Clipboard write failed:", error)
    }
  }

  const showColor = (color: ColorEntry) => {
    colorPicker.setHsv(colorToHsv(color))
    setCurrentColor(color)
    setHasColor(true)
  }

  // Makes `color` the current color and copies it in the default format
  const selectAndCopy = (color: ColorEntry, field: string) => {
    showColor(color)
    void copyToClipboard(formatColor(color.hex, copyFormat), field)
  }

  const { colorHistory, setColorHistory, lastPickedColor } = useColorHistory({
    onPickedColor: (picked, source) => {
      showColor(picked)
      if (source === "storage") {
        void copyToClipboard(formatColor(picked.hex, copyFormat), "hero-hex")
      }
    }
  })

  // Without a last picked color (it was removed), show the newest history
  // color rather than nothing
  useEffect(() => {
    if (!hasColor && colorHistory.length > 0) showColor(colorHistory[0])
  }, [colorHistory, hasColor])

  // The background clears page highlights when this port disconnects (the
  // popup closed). It only knows which tab to clean up if we tell it
  const portRef = useRef<chrome.runtime.Port | null>(null)
  const activeTabIdRef = useRef<number | null>(null)
  const highlightedTabIdRef = useRef<number | null>(null)

  useEffect(() => {
    let closed = false
    const connect = () => {
      const port = chrome.runtime.connect({ name: "popup" })
      const connectedAt = Date.now()
      portRef.current = port
      if (highlightedTabIdRef.current !== null) {
        port.postMessage({ highlightedTabId: highlightedTabIdRef.current })
      }
      // An idle service worker can be stopped, which drops the port without
      // the popup closing. Reconnect so cleanup still happens on close. A port
      // that drops at once means nothing is listening, so don't retry in a
      // tight loop (the worker is only stopped after being idle for 30s)
      port.onDisconnect.addListener(() => {
        void chrome.runtime.lastError
        if (!closed && Date.now() - connectedAt > 1000) connect()
      })
    }
    connect()
    return () => {
      closed = true
      portRef.current?.disconnect()
    }
  }, [])

  useEffect(() => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs?.[0]
      activeTabIdRef.current = tab?.id ?? null
      setActiveTabId(tab?.id ?? null)
      const url = tab?.url || tab?.pendingUrl || ""
      const restricted = isRestrictedUrl(url)
      setPageRestricted(restricted)
      // The simulation outlives the popup, so show what's on
      if (tab?.id !== undefined && !restricted) {
        void getVisionSimulation(tab.id).then(setVisionMode)
      }
    })
  }, [])

  const analyzer = useWebpageAnalyzer({
    onAnalyzeFailed: () => {
      setPageRestricted(true)
      setScreen("home")
    },
    onSelectColor: (color) => {
      if (activeTabIdRef.current !== null) {
        highlightedTabIdRef.current = activeTabIdRef.current
        portRef.current?.postMessage({
          highlightedTabId: activeTabIdRef.current
        })
      }
      showColor(toColorEntry(color))
    }
  })

  const goHome = () => setScreen("home")

  const pickFromScreen = async () => {
    setOutsidePickActive(true)
    await pickOutsideBrowserColor()
    setOutsidePickActive(false)
    window.close()
  }

  const runPageColors = () => {
    setScreen("results")
    void analyzer.analyze()
  }

  const runScreenshotColors = () => {
    setScreen("results")
    void analyzer.analyzeScreenshot()
  }

  // Leaving the results discards them and clears the page highlights
  const closeResults = () => {
    analyzer.cancel()
    goHome()
  }

  const saveResults = async () => {
    // On failure keep the results open so the user can retry
    if (!(await analyzer.save())) return
    analyzer.cancel()
    setScreen("saved")
  }

  const runContrastReport = async () => {
    setIsAnalyzingContrast(true)
    try {
      const data = await analyzeWebpageContrastPairs()
      if (!data) {
        setPageRestricted(true)
        return
      }
      chrome.tabs.create({
        url: chrome.runtime.getURL("tabs/wcag-contrast-analyzer.html")
      })
    } catch (error) {
      console.warn("WCAG analysis failed:", error)
    } finally {
      setIsAnalyzingContrast(false)
    }
  }

  const startInspector = async () => {
    if (activeTabId === null) return
    const running = await toggleColorInspector(activeTabId)
    if (running === null) setPageRestricted(true)
    // Close so the page can be hovered
    else if (running) window.close()
  }

  const changeVision = async (mode: VisionMode | null) => {
    if (activeTabId === null) return
    setVisionMode(mode)
    setVisionMode(await setVisionSimulation(activeTabId, mode))
  }

  const addToHistory = () => {
    if (!currentColor) return
    setHasColor(true)
    const hex = currentColor.hex.toLowerCase()
    const updated = [
      currentColor,
      ...colorHistory.filter((c) => c.hex.toLowerCase() !== hex)
    ].slice(0, COLOR_HISTORY_LIMIT)
    setColorHistory(updated)
    chrome.storage.local.set({ colorHistory: updated })
  }

  const clearHistory = async () => {
    const count = colorHistory.length
    const confirmed = await confirm({
      title: "Clear color history?",
      message: `All ${count} ${count === 1 ? "color" : "colors"} in your history will be removed. Saved palettes aren't affected.`,
      confirmLabel: "Clear history",
      destructive: true
    })
    if (!confirmed) return
    setColorHistory([])
    chrome.storage.local.set({ colorHistory: [] })
  }

  const deletePalette = async (domain: string) => {
    const count = analyzer.savedWebpageColors[domain]?.length ?? 0
    const confirmed = await confirm({
      title: `Delete the ${domain} palette?`,
      message: `Its ${count} ${count === 1 ? "color" : "colors"} will be removed from Color Hub. This can't be undone.`,
      confirmLabel: "Delete palette",
      destructive: true
    })
    if (confirmed) await analyzer.deleteDomain(domain)
  }

  const { r, g, b } = hsvToRgb(
    colorPicker.hsv.h,
    colorPicker.hsv.s,
    colorPicker.hsv.v
  )
  const currentHex = hasColor && currentColor ? currentColor.hex : null

  if (outsidePickActive) {
    return (
      <div className="flex w-[360px] items-center gap-3 bg-white p-4 font-sans text-slate-900 dark:bg-slate-900 dark:text-slate-100">
        <Pipette className="size-5 shrink-0 text-blue-600 dark:text-blue-400" />
        <div>
          <p className="text-sm font-semibold">Pick a color</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Click anywhere on your screen. Press Esc to cancel.
          </p>
        </div>
      </div>
    )
  }

  const renderScreen = () => {
    switch (screen) {
      case "adjust":
        return (
          <AdjustScreen
            hsv={colorPicker.hsv}
            currentColor={currentColor}
            gradientRef={colorPicker.gradientRef}
            hueRef={colorPicker.hueRef}
            onGradientMouseDown={(e) => {
              setHasColor(true)
              colorPicker.setIsDraggingGradient(true)
              colorPicker.handleGradientInteraction(e)
            }}
            onHueMouseDown={(e) => {
              setHasColor(true)
              colorPicker.setIsDraggingHue(true)
              colorPicker.handleHueInteraction(e)
            }}
            redraw={colorPicker.redraw}
            onCopy={copyToClipboard}
            onColorChange={(hsv) => {
              setHasColor(true)
              colorPicker.setHsv(hsv)
            }}
            onAddToHistory={addToHistory}
            copiedField={copiedField}
            tailwindVersion={tailwindVersion}
            onBack={goHome}
            r={r}
            g={g}
            b={b}
          />
        )
      case "history":
        return (
          <HistoryScreen
            history={colorHistory}
            lastPicked={lastPickedColor}
            copiedField={copiedField}
            onPick={(color, index) => selectAndCopy(color, `history-${index}`)}
            onClearHistory={() => void clearHistory()}
            onClearLastPicked={() =>
              void chrome.storage.local.remove("lastPickedColor")
            }
            onBack={goHome}
          />
        )
      case "results":
        return (
          <PageColorsScreen
            source={analyzer.analysisSource}
            domain={analyzer.analyzedDomain}
            colors={analyzer.analyzedColors}
            selected={analyzer.selectedAnalyzedColor}
            isAnalyzing={analyzer.isAnalyzing}
            truncatedScan={analyzer.truncatedScan}
            isSaving={analyzer.isSaving}
            saveError={analyzer.saveError}
            copyFormat={copyFormat}
            tailwindVersion={tailwindVersion}
            copiedField={copiedField}
            onCopy={copyToClipboard}
            onSelect={analyzer.selectColor}
            onSave={() => void saveResults()}
            onOpenInStudio={(view) => void analyzer.openInStudio(view)}
            onBack={closeResults}
          />
        )
      case "saved":
        return (
          <SavedPalettesScreen
            palettes={analyzer.savedWebpageColors}
            copiedField={copiedField}
            onPickColor={(color: AnalyzedColor, field) =>
              selectAndCopy(toColorEntry(color), field)
            }
            onOpenInStudio={(domain) =>
              openPaletteStudio(domain ? { domain } : {})
            }
            onDelete={(domain) => void deletePalette(domain)}
            onBack={goHome}
          />
        )
      case "vision":
        return (
          <VisionScreen
            mode={visionMode}
            onChange={(mode) => void changeVision(mode)}
            onBack={goHome}
          />
        )
      case "home":
        return (
          <HomeScreen
            hero={
              <ColorHero
                hex={currentHex}
                copyFormat={copyFormat}
                tailwindVersion={tailwindVersion}
                copiedField={copiedField}
                onCopy={copyToClipboard}
              />
            }
            history={colorHistory}
            savedPaletteCount={Object.keys(analyzer.savedWebpageColors).length}
            pageRestricted={pageRestricted}
            isAnalyzing={analyzer.isAnalyzing}
            isAnalyzingContrast={isAnalyzingContrast}
            visionLabel={
              VISION_MODES.find((mode) => mode.value === visionMode)?.label ??
              "Off"
            }
            copiedField={copiedField}
            onPick={() => void pickFromScreen()}
            onAdjust={() => setScreen("adjust")}
            onPickRecent={(color, index) =>
              selectAndCopy(color, `recent-${index}`)
            }
            onOpenHistory={() => setScreen("history")}
            onPageColors={runPageColors}
            onScreenshotColors={runScreenshotColors}
            onContrastReport={() => void runContrastReport()}
            onInspect={() => void startInspector()}
            onVision={() => setScreen("vision")}
            onOpenSaved={() => setScreen("saved")}
            onOpenStudio={() => openPaletteStudio()}
            onOpenChecker={() =>
              chrome.tabs.create({
                url: chrome.runtime.getURL("tabs/contrast-checker.html")
              })
            }
            onOpenSettings={() => chrome.runtime.openOptionsPage()}
          />
        )
    }
  }

  return (
    <div
      className={cn(
        "w-[360px] bg-white font-sans text-slate-900 antialiased dark:bg-slate-900 dark:text-slate-100",
        // The popup is only as tall as its content; give a dialog room to
        // show on a short screen
        isConfirming && "min-h-[260px]"
      )}>
      <div
        key={screen}
        className={screen === "home" ? "" : "motion-safe:animate-screen-in"}>
        {renderScreen()}
      </div>
      {confirmDialog}
    </div>
  )
}

export default IndexPopup
