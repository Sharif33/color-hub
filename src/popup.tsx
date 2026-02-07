import { useCallback, useEffect, useRef, useState } from "react"

import "~style.css"

import { pickOutsideBrowserColor } from "./features/pick-outside-browser-color"
import { startPickPageColor } from "./features/pick-page-color"
import {
  analyzeWebpageColors,
  clearWebpageHighlights,
  highlightWebpageColor,
  type AnalyzedColor
} from "./features/webpage-color-analyzer"
import {
  colorToHsv,
  getColorFromHsv,
  hsvToRgb,
  rgbToHsl
} from "./popup/color-utils"
import type { ColorEntry, HSV } from "./popup/types"

function IndexPopup() {
  const [colorHistory, setColorHistory] = useState<ColorEntry[]>([])
  const [currentColor, setCurrentColor] = useState<ColorEntry | null>(null)
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const [hsv, setHsv] = useState<HSV>({ h: 220, s: 66, v: 16 })
  const [outsidePickActive, setOutsidePickActive] = useState(false)
  const [analyzedColors, setAnalyzedColors] = useState<AnalyzedColor[]>([])
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [selectedAnalyzedColor, setSelectedAnalyzedColor] =
    useState<AnalyzedColor | null>(null)
  const [analyzedDomain, setAnalyzedDomain] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [savedWebpageColors, setSavedWebpageColors] = useState<
    Record<string, AnalyzedColor[]>
  >({})

  const gradientRef = useRef<HTMLCanvasElement>(null)
  const hueRef = useRef<HTMLCanvasElement>(null)
  const [isDraggingGradient, setIsDraggingGradient] = useState(false)
  const [isDraggingHue, setIsDraggingHue] = useState(false)

  const getCurrentColorFromHsv = useCallback((): ColorEntry => {
    return getColorFromHsv(hsv)
  }, [hsv])

  const drawGradient = useCallback(() => {
    const canvas = gradientRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const { width, height } = canvas
    const hueColor = hsvToRgb(hsv.h, 100, 100)
    ctx.fillStyle = `rgb(${hueColor.r}, ${hueColor.g}, ${hueColor.b})`
    ctx.fillRect(0, 0, width, height)

    const whiteGradient = ctx.createLinearGradient(0, 0, width, 0)
    whiteGradient.addColorStop(0, "rgba(255, 255, 255, 1)")
    whiteGradient.addColorStop(1, "rgba(255, 255, 255, 0)")
    ctx.fillStyle = whiteGradient
    ctx.fillRect(0, 0, width, height)

    const blackGradient = ctx.createLinearGradient(0, 0, 0, height)
    blackGradient.addColorStop(0, "rgba(0, 0, 0, 0)")
    blackGradient.addColorStop(1, "rgba(0, 0, 0, 1)")
    ctx.fillStyle = blackGradient
    ctx.fillRect(0, 0, width, height)
  }, [hsv.h])

  const drawHueSlider = useCallback(() => {
    const canvas = hueRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const { height } = canvas
    const gradient = ctx.createLinearGradient(0, 0, 0, height)
    gradient.addColorStop(0, "#ff0000")
    gradient.addColorStop(0.17, "#ff00ff")
    gradient.addColorStop(0.33, "#0000ff")
    gradient.addColorStop(0.5, "#00ffff")
    gradient.addColorStop(0.67, "#00ff00")
    gradient.addColorStop(0.83, "#ffff00")
    gradient.addColorStop(1, "#ff0000")
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, canvas.width, height)
  }, [])

  const handleGradientInteraction = (
    e: React.MouseEvent<HTMLCanvasElement>
  ) => {
    const canvas = gradientRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width))
    const y = Math.max(0, Math.min(e.clientY - rect.top, rect.height))
    setHsv((prev) => ({
      ...prev,
      s: (x / rect.width) * 100,
      v: (1 - y / rect.height) * 100
    }))
  }

  const handleHueInteraction = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = hueRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const y = Math.max(0, Math.min(e.clientY - rect.top, rect.height))
    setHsv((prev) => ({ ...prev, h: (y / rect.height) * 360 }))
  }

  useEffect(() => {
    setCurrentColor(getCurrentColorFromHsv())
  }, [hsv, getCurrentColorFromHsv])

  useEffect(() => {
    drawGradient()
    drawHueSlider()
  }, [drawGradient, drawHueSlider])

  useEffect(() => {
    chrome.storage.local.get(["colorHistory", "lastPickedColor"], (result) => {
      if (Array.isArray(result.colorHistory))
        setColorHistory(result.colorHistory)
      if (result.lastPickedColor?.hex) {
        const picked = result.lastPickedColor as ColorEntry
        const nextHsv = colorToHsv(picked)
        if (nextHsv) setHsv(nextHsv)
        setCurrentColor(picked)
        void copyToClipboard(picked.hex, "hex")
        chrome.storage.local.remove("lastPickedColor")
      }
    })

    const listener = (
      changes: { [key: string]: chrome.storage.StorageChange },
      area: string
    ) => {
      if (area !== "local") return
      if (changes.colorHistory?.newValue)
        setColorHistory(changes.colorHistory.newValue)
      if (changes.lastPickedColor?.newValue) {
        const picked = changes.lastPickedColor.newValue as ColorEntry
        const nextHsv = colorToHsv(picked)
        if (nextHsv) setHsv(nextHsv)
        setCurrentColor(picked)
        void copyToClipboard(picked.hex, "hex")
        chrome.storage.local.remove("lastPickedColor")
      }
      if (changes.WEBPAGES_COLORS?.newValue) {
        setSavedWebpageColors(changes.WEBPAGES_COLORS.newValue || {})
      }
    }
    chrome.storage.onChanged.addListener(listener)
    return () => chrome.storage.onChanged.removeListener(listener)
  }, [])

  useEffect(() => {
    chrome.storage.local.get(["WEBPAGES_COLORS"], (result) => {
      setSavedWebpageColors(result.WEBPAGES_COLORS || {})
    })
  }, [])

  useEffect(() => {
    const port = chrome.runtime.connect({ name: "popup" })
    return () => {
      port.disconnect()
    }
  }, [])

  useEffect(() => {
    const handleUnload = () => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tab = tabs?.[0]
        if (!tab?.id) return
        chrome.runtime.sendMessage({
          type: "CLEAR_WEBPAGE_HIGHLIGHTS",
          tabId: tab.id
        })
      })
    }
    window.addEventListener("beforeunload", handleUnload)
    window.addEventListener("unload", handleUnload)
    return () => {
      window.removeEventListener("beforeunload", handleUnload)
      window.removeEventListener("unload", handleUnload)
      handleUnload()
    }
  }, [])

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingGradient) {
        const canvas = gradientRef.current
        if (!canvas) return
        const rect = canvas.getBoundingClientRect()
        const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width))
        const y = Math.max(0, Math.min(e.clientY - rect.top, rect.height))
        setHsv((prev) => ({
          ...prev,
          s: (x / rect.width) * 100,
          v: (1 - y / rect.height) * 100
        }))
      }
      if (isDraggingHue) {
        const canvas = hueRef.current
        if (!canvas) return
        const rect = canvas.getBoundingClientRect()
        const y = Math.max(0, Math.min(e.clientY - rect.top, rect.height))
        setHsv((prev) => ({ ...prev, h: (y / rect.height) * 360 }))
      }
    }
    const handleMouseUp = () => {
      setIsDraggingGradient(false)
      setIsDraggingHue(false)
    }
    window.addEventListener("mousemove", handleMouseMove)
    window.addEventListener("mouseup", handleMouseUp)
    return () => {
      window.removeEventListener("mousemove", handleMouseMove)
      window.removeEventListener("mouseup", handleMouseUp)
    }
  }, [isDraggingGradient, isDraggingHue])

  const activatePicker = () => {
    startPickPageColor(() => window.close())
  }

  const activateOutsidePicker = async () => {
    setOutsidePickActive(true)
    await pickOutsideBrowserColor()
    setOutsidePickActive(false)
    window.close()
  }

  const activateAnalyzer = async () => {
    setIsAnalyzing(true)
    const domain = await new Promise<string | null>((resolve) => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tab = tabs?.[0]
        if (!tab?.url) {
          resolve(null)
          return
        }
        try {
          const url = new URL(tab.url)
          resolve(url.hostname)
        } catch {
          resolve(null)
        }
      })
    })
    const colors = await analyzeWebpageColors()
    setAnalyzedColors(colors)
    setSelectedAnalyzedColor(colors[0] ?? null)
    setAnalyzedDomain(domain)
    setIsAnalyzing(false)
  }

  const handleSaveAnalyzed = async () => {
    if (!analyzedDomain || analyzedColors.length === 0) return
    setIsSaving(true)
    const existing = await chrome.storage.local.get(["WEBPAGES_COLORS"])
    const next = {
      ...(existing.WEBPAGES_COLORS || {}),
      [analyzedDomain]: analyzedColors
    }
    await chrome.storage.local.set({ WEBPAGES_COLORS: next })
    setIsSaving(false)
    void clearWebpageHighlights()
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs?.[0]
      if (!tab?.id) return
      chrome.runtime.sendMessage({
        type: "CLEAR_WEBPAGE_HIGHLIGHTS",
        tabId: tab.id
      })
    })
  }

  const handleCancelAnalyzed = () => {
    setAnalyzedColors([])
    setSelectedAnalyzedColor(null)
    setAnalyzedDomain(null)
    void clearWebpageHighlights()
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs?.[0]
      if (!tab?.id) return
      chrome.runtime.sendMessage({
        type: "CLEAR_WEBPAGE_HIGHLIGHTS",
        tabId: tab.id
      })
    })
  }

  const handleDeleteSavedDomain = async (domain: string) => {
    const existing = await chrome.storage.local.get(["WEBPAGES_COLORS"])
    const next = { ...(existing.WEBPAGES_COLORS || {}) }
    delete next[domain]
    await chrome.storage.local.set({ WEBPAGES_COLORS: next })
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

  const handleAddToHistory = () => {
    if (!currentColor) return
    const updated = [
      currentColor,
      ...colorHistory.filter((c) => c.hex !== currentColor.hex)
    ].slice(0, 35)
    setColorHistory(updated)
    chrome.storage.local.set({ colorHistory: updated })
  }

  const clearHistory = () => {
    setColorHistory([])
    chrome.storage.local.set({ colorHistory: [] })
  }

  const { r, g, b } = hsvToRgb(hsv.h, hsv.s, hsv.v)

  if (outsidePickActive) {
    return (
      <div className="w-[220px] bg-gray-200 px-2 py-1 font-sans text-sm">
        <div className="text-sm font-semibold">Pick colors from anywhere</div>
      </div>
    )
  }

  return (
    <div className="w-[460px] bg-gray-200 p-3 font-sans text-sm">
      <div className="flex gap-4">
        {/* LEFT: Color Picker */}
        <div className="flex gap-2">
          {/* Gradient Square */}
          <div className="flex flex-col gap-2">
            <div className="relative">
              <canvas
                ref={gradientRef}
                width={200}
                height={200}
                className="cursor-crosshair block"
                onMouseDown={(e) => {
                  setIsDraggingGradient(true)
                  handleGradientInteraction(e)
                }}
              />
              <div
                className="absolute w-3.5 h-3.5 border-2 border-white rounded-full shadow pointer-events-none"
                style={{
                  left: `${(hsv.s / 100) * 200 - 7}px`,
                  top: `${(1 - hsv.v / 100) * 200 - 7}px`
                }}
              />
            </div>
            {/* Bottom: RGB and HSL display */}
            <div className="flex flex-col gap-1">
              <input
                type="text"
                value={currentColor?.rgb || ""}
                readOnly
                onClick={() =>
                  currentColor && copyToClipboard(currentColor.rgb, "rgb-full")
                }
                className="flex-1 px-2 py-1 border border-gray-400 font-mono text-xs cursor-pointer bg-white"
              />
              <input
                type="text"
                value={currentColor?.hsl || rgbToHsl(r, g, b)}
                readOnly
                onClick={() =>
                  copyToClipboard(
                    currentColor?.hsl || rgbToHsl(r, g, b),
                    "hsl-full"
                  )
                }
                className="flex-1 px-2 py-1 border border-gray-400 font-mono text-xs cursor-pointer bg-white"
              />

              <input
                type="text"
                value={currentColor?.hex || ""}
                readOnly
                onClick={() =>
                  currentColor && copyToClipboard(currentColor.hex, "hex")
                }
                className="w-full px-1 py-0.5 border border-gray-400 cursor-pointer bg-white"
              />
              {copiedField && <span className="text-green-600 text-xs">✓</span>}
            </div>
          </div>

          {/* Hue Slider */}
          <div className="relative">
            <canvas
              ref={hueRef}
              width={20}
              height={200}
              className="cursor-pointer block"
              onMouseDown={(e) => {
                setIsDraggingHue(true)
                handleHueInteraction(e)
              }}
            />
            <div
              className="absolute w-6 h-1.5 border border-gray-700 pointer-events-none -left-0.5"
              style={{ top: `${(hsv.h / 360) * 200 - 3}px` }}>
              <div className="absolute -left-1.5 top-0 border-y-[3px] border-y-transparent border-l-[5px] border-l-gray-700" />
              <div className="absolute -right-1.5 top-0 border-y-[3px] border-y-transparent border-r-[5px] border-r-gray-700" />
            </div>
          </div>
        </div>

        {/* RIGHT: Color Info & History */}
        <div className="flex-1 flex flex-col gap-3">
          {/* New / Current Color */}
          <div className="flex flex-col gap-2">
            <div className="flex flex-col gap-1 w-full">
              <button
                onClick={activatePicker}
                className="w-full px-3 py-1 bg-white border border-gray-400 rounded text-xs cursor-pointer hover:bg-gray-50">
                Pick Page Color
              </button>
              <button
                onClick={activateOutsidePicker}
                className="w-full px-3 py-1 bg-white border border-gray-400 rounded text-xs cursor-pointer hover:bg-gray-50">
                Pick Outside Browser
              </button>
              <button
                onClick={handleAddToHistory}
                className="w-full px-3 py-1 bg-white border border-gray-400 rounded text-xs cursor-pointer hover:bg-gray-50">
                Add to History
              </button>
              <button
                onClick={activateAnalyzer}
                className="w-full px-3 py-1 bg-white border border-gray-400 rounded text-xs cursor-pointer hover:bg-gray-50"
                disabled={isAnalyzing}>
                {isAnalyzing ? "Analyzing..." : "Analyze Webpage Colors"}
              </button>
            </div>
            <div className="flex items-center w-full">
              <div className="text-center w-full">
                <div className="text-xs text-gray-500 mb-0.5">new</div>
                <div
                  className="w-full h-10"
                  style={{ backgroundColor: currentColor?.hex || "#000" }}
                />
              </div>
              <div className="text-center w-full">
                <div className="text-xs text-gray-500 mb-0.5">current</div>
                <div
                  className="w-full h-10"
                  style={{ backgroundColor: colorHistory[0]?.hex || "#333" }}
                />
              </div>
            </div>
          </div>
          {/* Color History */}
          <div>
            <div className="text-xs text-gray-700 mb-1">Color history:</div>
            <div className="flex items-end gap-1">
              <div className="grid grid-cols-8 border border-gray-300 bg-white">
                {Array.from({ length: 56 }).map((_, index) => {
                  const color = colorHistory[index]
                  return (
                    <div
                      key={index}
                      onClick={() => {
                        if (color) {
                          const nextHsv = colorToHsv(color)
                          if (nextHsv) setHsv(nextHsv)
                          setCurrentColor(color)
                          copyToClipboard(color.hex, `history-${index}`)
                        }
                      }}
                      className={`size-5 border-r border-b border-gray-300 ${color ? "cursor-pointer" : ""}`}
                      style={{ backgroundColor: color?.hex || "#f5f5f5" }}
                      title={color?.hex || ""}
                    />
                  )
                })}
              </div>
              <button
                onClick={clearHistory}
                className="size-5 bg-white border border-red-300 flex items-center justify-center cursor-pointer hover:bg-red-50"
                title="Clear history">
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path
                    d="M1 1L9 9M1 9L9 1"
                    stroke="#cc4444"
                    strokeWidth="1.5"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
          {analyzedColors.length > 0 && (
            <div className="mt-2 rounded border border-gray-300 bg-white p-2">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-600 mb-1">
            CSS Colors on This Page
          </div>
          <div className="grid grid-cols-12 gap-1 rounded border border-gray-200 bg-gray-50 p-1">
            {analyzedColors.map((color, index) => {
              const isSelected = selectedAnalyzedColor?.hex === color.hex
              return (
                <button
                  key={`${color.hex}-${index}`}
                  type="button"
                  onClick={() => {
                    setSelectedAnalyzedColor(color)
                    void highlightWebpageColor(color)
                    const nextHsv = colorToHsv({
                      hex: color.hex,
                      rgb: color.rgb,
                      hsl: undefined,
                      timestamp: Date.now()
                    })
                    if (nextHsv) setHsv(nextHsv)
                    setCurrentColor({
                      hex: color.hex,
                      rgb: color.rgb,
                      hsl: undefined,
                      timestamp: Date.now()
                    })
                    copyToClipboard(color.hex, `analyzed-${index}`)
                  }}
                  title={`${color.hex} • ${color.count}`}
                  className={`h-6 w-full border ${isSelected ? "border-red-500" : "border-gray-200"}`}
                  style={{ backgroundColor: color.hex }}
                />
              )
            })}
          </div>
          <div className="mt-2 flex gap-2">
            <input
              type="text"
              readOnly
              value={selectedAnalyzedColor?.rgb || ""}
              className="flex-1 px-2 py-1 border border-gray-300 font-mono text-[11px] bg-gray-50"
            />
            <input
              type="text"
              readOnly
              value={selectedAnalyzedColor?.hex || ""}
              className="w-24 px-2 py-1 border border-gray-300 font-mono text-[11px] bg-gray-50"
            />
          </div>
              {selectedAnalyzedColor?.selectors?.length ? (
                <div className="mt-2 max-h-28 overflow-auto rounded border border-gray-200 bg-gray-50 p-1 space-y-1">
                  {selectedAnalyzedColor.selectors.map((selector, idx) => (
                <div
                  key={`${selector}-${idx}`}
                  title={selector}
                  className="rounded border border-gray-200 bg-white px-2 py-1 text-[10px] font-mono text-gray-700 truncate">
                  {selector}
                </div>
              ))}
                </div>
              ) : (
                <div className="mt-2 text-[11px] text-gray-500">
                  No elements recorded for this color.
                </div>
              )}
              <div className="mt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={handleSaveAnalyzed}
                  disabled={isSaving || !analyzedDomain}
                  className="px-3 py-1 text-[11px] rounded border border-gray-400 bg-white hover:bg-gray-50 disabled:opacity-60">
                  {isSaving ? "Saving..." : "Save"}
                </button>
                <button
                  type="button"
                  onClick={handleCancelAnalyzed}
                  className="px-3 py-1 text-[11px] rounded border border-gray-400 bg-white hover:bg-gray-50">
                  Cancel
                </button>
              </div>
            </div>
          )}

          {Object.keys(savedWebpageColors).length > 0 && (
            <div className="mt-2 rounded border border-gray-300 bg-white p-2">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-600 mb-1">
                Saved Webpage Colors
              </div>
              <div className="space-y-2 max-h-32 overflow-auto pr-1">
                {Object.entries(savedWebpageColors).map(
                  ([domain, colors]) => (
                    <div
                      key={domain}
                      className="rounded border border-gray-200 bg-gray-50 p-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-[11px] font-semibold text-gray-700 truncate">
                          {domain}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteSavedDomain(domain)}
                          className="px-2 py-0.5 text-[10px] rounded border border-red-300 text-red-600 bg-white hover:bg-red-50">
                          Delete
                        </button>
                      </div>
                      <div className="mt-2 grid grid-cols-10 gap-1">
                        {colors.slice(0, 20).map((color, idx) => (
                          <button
                            key={`${domain}-${color.hex}-${idx}`}
                            type="button"
                            onClick={() => {
                              const nextHsv = colorToHsv({
                                hex: color.hex,
                                rgb: color.rgb,
                                hsl: undefined,
                                timestamp: Date.now()
                              })
                              if (nextHsv) setHsv(nextHsv)
                              setCurrentColor({
                                hex: color.hex,
                                rgb: color.rgb,
                                hsl: undefined,
                                timestamp: Date.now()
                              })
                              copyToClipboard(color.hex, `saved-${domain}-${idx}`)
                            }}
                            title={`${color.hex} • ${color.count}`}
                            className="h-4 w-full border border-gray-200"
                            style={{ backgroundColor: color.hex }}
                          />
                        ))}
                      </div>
                    </div>
                  )
                )}
              </div>
            </div>
          )}
    </div>
  )
}

export default IndexPopup
