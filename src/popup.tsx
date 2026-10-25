import { useCallback, useEffect, useRef, useState } from "react"

import "~style.css"

import {
  AlertTriangle,
  BrushCleaning,
  ChevronDown,
  ChevronRight,
  Heart,
  History,
  NotepadText,
  Palette,
  Pipette,
  ScanEye,
  TestTubes,
  X
} from "lucide-react"

import ColorHubLogo from "~components/color hub/logo"

import { ColorHistoryPanel } from "./features/color-history/ColorHistoryPanel"
import { useColorHistory } from "./features/color-history/useColorHistory"
import { ColorPickerPanel } from "./features/color-picker/ColorPickerPanel"
import { useColorPicker } from "./features/color-picker/useColorPicker"
import { pickOutsideBrowserColor } from "./features/pick-outside-browser-color"
import { AnalyzerPanel } from "./features/webpage-color-analyzer/AnalyzerPanel"
import { analyzeWebpageContrastPairs } from "./features/webpage-color-analyzer"
import { useWebpageAnalyzer } from "./features/webpage-color-analyzer/useWebpageAnalyzer"
import {
  colorToHsv,
  getColorFromHsv,
  hsvToRgb,
  type ColorEntry
} from "~utils/color-utils"
import { isRestrictedUrl } from "./utils/restricted-urls"

function IndexPopup() {
  const [currentColor, setCurrentColor] = useState<ColorEntry | null>(null)
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const [outsidePickActive, setOutsidePickActive] = useState(false)
  const [pageRestricted, setPageRestricted] = useState(false)
  const [expandedFeatures, setExpandedFeatures] = useState<string | null>(null)
  const colorPicker = useColorPicker({ h: 220, s: 66, v: 16 })

  const getCurrentColorFromHsv = useCallback((): ColorEntry => {
    return getColorFromHsv(colorPicker.hsv)
  }, [colorPicker.hsv])

  useEffect(() => {
    setCurrentColor(getCurrentColorFromHsv())
  }, [colorPicker.hsv, getCurrentColorFromHsv])

  const { colorHistory, setColorHistory, lastPickedColor } = useColorHistory({
    onPickedColor: (picked, source) => {
      const nextHsv = colorToHsv(picked)
      if (nextHsv) colorPicker.setHsv(nextHsv)
      setCurrentColor(picked)
      if (source === "storage") {
        void copyToClipboard(picked.hex, "hex")
      }
    }
  })

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
      const url = tab?.url || tab?.pendingUrl || ""
      setPageRestricted(isRestrictedUrl(url))
    })
  }, [])

  const analyzer = useWebpageAnalyzer({
    onAnalyzeFailed: () => setPageRestricted(true),
    onSelectColor: (color) => {
      if (activeTabIdRef.current !== null) {
        highlightedTabIdRef.current = activeTabIdRef.current
        portRef.current?.postMessage({
          highlightedTabId: activeTabIdRef.current
        })
      }
      const nextHsv = colorToHsv({
        hex: color.hex,
        rgb: color.rgb,
        hsl: undefined,
        timestamp: Date.now()
      })
      if (nextHsv) colorPicker.setHsv(nextHsv)
      setCurrentColor({
        hex: color.hex,
        rgb: color.rgb,
        hsl: undefined,
        timestamp: Date.now()
      })
    }
  })

  const activateOutsidePicker = async () => {
    setOutsidePickActive(true)
    await pickOutsideBrowserColor()
    setOutsidePickActive(false)
    window.close()
  }

  // save() and cancel() clear the page highlights themselves
  const handleAnalyzerSave = async () => {
    // On failure keep the results open so the user can retry
    if (!(await analyzer.save())) return
    analyzer.cancel()
    setExpandedFeatures("saved-webpage-colors")
  }

  const handleAnalyzerCancel = () => {
    analyzer.cancel()
  }

  const openContrastChecker = () => {
    const url = chrome.runtime.getURL("tabs/contrast-checker.html")
    chrome.tabs.create({ url })
  }

  const [isAnalyzingWCAG, setIsAnalyzingWCAG] = useState(false)

  const analyzeWCAGContrast = async () => {
    setIsAnalyzingWCAG(true)
    try {
      const data = await analyzeWebpageContrastPairs()
      if (!data) {
        setPageRestricted(true)
        return
      }
      const url = chrome.runtime.getURL("tabs/wcag-contrast-analyzer.html")
      chrome.tabs.create({ url })
    } catch (error) {
      console.warn("WCAG analysis failed:", error)
    } finally {
      setIsAnalyzingWCAG(false)
    }
  }

  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedField(field)
      setTimeout(() => setCopiedField(null), 1500)
    } catch (error) {
      console.warn("Clipboard write failed:", error)
    }
  }

  const clearLastPickedColor = async () => {
    await chrome.storage.local.remove("lastPickedColor")
  }

  const handleAddToHistory = () => {
    if (!currentColor) return
    const hex = currentColor.hex.toLowerCase()
    const updated = [
      currentColor,
      ...colorHistory.filter((c) => c.hex.toLowerCase() !== hex)
    ].slice(0, 35)
    setColorHistory(updated)
    chrome.storage.local.set({ colorHistory: updated })
  }

  const clearHistory = () => {
    const confirmed = confirm(
      "Are you sure you want to clear the color history?"
    )
    if (!confirmed) return
    setColorHistory([])
    chrome.storage.local.set({ colorHistory: [] })
  }

  const { r, g, b } = hsvToRgb(
    colorPicker.hsv.h,
    colorPicker.hsv.s,
    colorPicker.hsv.v
  )

  const FEATURES = [
    {
      label: "Pick Color",
      icon: Pipette,
      onClick: activateOutsidePicker,
      disabled: false
    },
    {
      label: "Analyze Webpage Colors",
      icon: BrushCleaning,
      onClick: analyzer.analyze,
      disabled: analyzer.isAnalyzing || pageRestricted
    },
    {
      label: "Color Contrast Checker",
      icon: TestTubes,
      onClick: openContrastChecker,
      disabled: false
    },
    {
      label: isAnalyzingWCAG ? "Analyzing…" : "Analyze WCAG Contrast",
      icon: ScanEye,
      onClick: analyzeWCAGContrast,
      disabled: isAnalyzingWCAG || pageRestricted
    },
    {
      label: "Picked Color History",
      icon: History,
      onClick: () => {
        setExpandedFeatures(
          expandedFeatures === "color-history" ? null : "color-history"
        )
      },
      disabled: false,
      secondaryIcon:
        expandedFeatures === "color-history" ? ChevronDown : ChevronRight
    },
    {
      label: "Saved Webpage Colors",
      icon: NotepadText,
      onClick: () => {
        setExpandedFeatures(
          expandedFeatures === "saved-webpage-colors"
            ? null
            : "saved-webpage-colors"
        )
      },
      disabled: Object.keys(analyzer.savedWebpageColors).length === 0,
      secondaryIcon:
        expandedFeatures === "saved-webpage-colors" ? ChevronDown : ChevronRight
    },
    {
      label: "Color Picker Panel",
      icon: Palette,
      secondaryIcon:
        expandedFeatures === "color-picker" ? ChevronDown : ChevronRight,
      onClick: () => {
        setExpandedFeatures(
          expandedFeatures === "color-picker" ? null : "color-picker"
        )
      },
      disabled: false
    }
  ]

  const renderColorHistory = () => {
    return (
      <ColorHistoryPanel
        colorHistory={colorHistory}
        onPick={(color, index) => {
          const nextHsv = colorToHsv(color)
          if (nextHsv) colorPicker.setHsv(nextHsv)
          setCurrentColor(color)
          copyToClipboard(color.hex, `history-${index}`)
        }}
        onClear={clearHistory}
      />
    )
  }

  if (outsidePickActive) {
    return (
      <div className="w-[220px] bg-gray-100 px-2 py-1 font-sans text-sm">
        <div className="text-sm font-semibold">Pick colors from anywhere</div>
      </div>
    )
  }

  return (
    <div className="w-[300px] bg-gray-100 font-sans">
      <div className="bg-gray-900 flex items-center gap-1 p-3">
        <ColorHubLogo className="text-white/90" />
      </div>
      <div className="flex flex-col gap-3">
        {lastPickedColor && (
          <div className="px-3 pt-3 font-mono flex items-center justify-between gap-2">
            <span className="text-[11px] text-gray-700  tracking-wide flex items-center gap-1">
              <History className="size-3" />
              Last Picked
            </span>

            <span className="inline-flex items-center gap-2">
              <span className="inline-flex items-center gap-2">
                <span
                  className="h-4 w-4 rounded border border-gray-300"
                  style={{ backgroundColor: lastPickedColor.hex }}
                />
                {lastPickedColor.hex}
              </span>
              <button
                type="button"
                title="Clear last picked color"
                onClick={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  void clearLastPickedColor()
                }}
                className="inline-flex items-center justify-center rounded text-gray-500 hover:text-red-600">
                <X className="size-3" />
              </button>
            </span>
          </div>
        )}
        <div className="flex-1 flex flex-col gap-3">
          {/* New / Current Color */}
          <div className="flex flex-col gap-2">
            <div className="flex flex-col w-full">
              {FEATURES.map(
                ({
                  label,
                  icon: Icon,
                  onClick,
                  disabled,
                  secondaryIcon: SecondaryIcon
                }) => (
                  <button
                    key={label}
                    type="button"
                    onClick={onClick}
                    disabled={disabled}
                    className="w-full px-3 py-2 text-sm cursor-pointer hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 flex items-center justify-between gap-1 border-b border-dashed border-gray-300">
                    <span className="inline-flex items-center gap-1.5">
                      <Icon className="size-3" />
                      {label}
                    </span>
                    {disabled && <AlertTriangle className="size-3" />}
                    {!disabled && SecondaryIcon && (
                      <SecondaryIcon className="size-3" />
                    )}
                  </button>
                )
              )}
            </div>
          </div>
        </div>

        <div
          className={`flex flex-col items-center gap-2 px-3 w-full ${expandedFeatures === "color-picker" ? "block" : "hidden"}`}>
          <ColorPickerPanel
            hsv={colorPicker.hsv}
            currentColor={currentColor}
            gradientRef={colorPicker.gradientRef}
            hueRef={colorPicker.hueRef}
            onGradientMouseDown={(e) => {
              colorPicker.setIsDraggingGradient(true)
              colorPicker.handleGradientInteraction(e)
            }}
            onHueMouseDown={(e) => {
              colorPicker.setIsDraggingHue(true)
              colorPicker.handleHueInteraction(e)
            }}
            onCopy={copyToClipboard}
            onColorChange={colorPicker.setHsv}
            onAddToHistory={handleAddToHistory}
            firstHistoryColor={colorHistory[0] || null}
            copiedField={copiedField}
            r={r}
            g={g}
            b={b}
          />
          <div className="w-full">{renderColorHistory()}</div>
        </div>

        {expandedFeatures === "color-history" && (
          <div className="px-3">{renderColorHistory()}</div>
        )}

        <AnalyzerPanel
          showSavedWebpageColors={expandedFeatures === "saved-webpage-colors"}
          analyzedColors={analyzer.analyzedColors}
          selectedAnalyzedColor={analyzer.selectedAnalyzedColor}
          isAnalyzing={analyzer.isAnalyzing}
          isSaving={analyzer.isSaving}
          saveError={analyzer.saveError}
          savedWebpageColors={analyzer.savedWebpageColors}
          showAnalyzeButton={false}
          onAnalyze={analyzer.analyze}
          onSelectColor={analyzer.selectColor}
          onSave={handleAnalyzerSave}
          onCancel={handleAnalyzerCancel}
          onDeleteDomain={analyzer.deleteDomain}
          onCopy={copyToClipboard}
          onPickSaved={(color, key) => {
            const nextHsv = colorToHsv({
              hex: color.hex,
              rgb: color.rgb,
              hsl: undefined,
              timestamp: Date.now()
            })
            if (nextHsv) colorPicker.setHsv(nextHsv)
            setCurrentColor({
              hex: color.hex,
              rgb: color.rgb,
              hsl: undefined,
              timestamp: Date.now()
            })
            copyToClipboard(color.hex, `saved-${key}`)
          }}
        />
      </div>
      {/* footer */}
      <div className="p-3 text-xs text-gray-500 flex items-center justify-center gap-1">
        <Heart className="size-3" fill="currentColor" /> by{" "}
        <a
          href="https://github.com/Sharif33"
          className="text-sky-500 hover:underline underline-offset-2"
          target="_blank"
          rel="noopener noreferrer">
          Sharif Rashed
        </a>
      </div>
    </div>
  )
}

export default IndexPopup
