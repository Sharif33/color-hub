import { BookmarkPlus, Check, Copy } from "lucide-react"
import { useEffect, useState } from "react"

import { ScreenHeader } from "~features/popup/ScreenHeader"
import { TailwindMatchChip } from "~features/tailwind-match/TailwindMatchChip"
import {
  COLOR_FORMATS,
  formatColor,
  type ColorFormat
} from "~utils/color-formats"
import {
  formatHsl,
  formatOklch,
  hexToRgb,
  hslToRgb,
  parseColor,
  rgbToHsv,
  type ColorEntry,
  type HSV
} from "~utils/color-utils"
import type { TailwindVersion } from "~utils/tailwind-match"

// The formats that don't have their own row above the "Copy as" row
const CODE_FORMATS = COLOR_FORMATS.filter(({ value }) =>
  ["tailwind", "swiftui", "uikit", "compose"].includes(value)
)

interface AdjustScreenProps {
  hsv: HSV
  currentColor: ColorEntry | null
  gradientRef: React.RefObject<HTMLCanvasElement>
  hueRef: React.RefObject<HTMLCanvasElement>
  onGradientMouseDown: (e: React.MouseEvent<HTMLCanvasElement>) => void
  onHueMouseDown: (e: React.MouseEvent<HTMLCanvasElement>) => void
  /** Paints the canvases, which only exist while this screen is open */
  redraw: () => void
  onCopy: (text: string, field: string) => void
  onColorChange: (hsv: HSV) => void
  onAddToHistory: () => void
  copiedField: string | null
  tailwindVersion: TailwindVersion
  onBack: () => void
  r: number
  g: number
  b: number
}

const inputClass =
  "h-8 w-full min-w-0 rounded-md border border-slate-200 bg-white px-2 font-mono text-xs focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-slate-700 dark:bg-slate-800"

const CopyButton = ({
  copied,
  label,
  onClick
}: {
  copied: boolean
  label: string
  onClick: () => void
}) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={`Copy ${label}`}
    title={`Copy ${label}`}
    className="flex size-8 shrink-0 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white">
    {copied ? (
      <Check className="size-3.5 text-emerald-600" strokeWidth={3} />
    ) : (
      <Copy className="size-3.5" />
    )}
  </button>
)

export const AdjustScreen = ({
  hsv,
  currentColor,
  gradientRef,
  hueRef,
  onGradientMouseDown,
  onHueMouseDown,
  redraw,
  onCopy,
  onColorChange,
  onAddToHistory,
  copiedField,
  tailwindVersion,
  onBack,
  r,
  g,
  b
}: AdjustScreenProps) => {
  const [rValue, setRValue] = useState(r.toString())
  const [gValue, setGValue] = useState(g.toString())
  const [bValue, setBValue] = useState(b.toString())
  const [hValue, setHValue] = useState("")
  const [sValue, setSValue] = useState("")
  const [lValue, setLValue] = useState("")
  const [hexValue, setHexValue] = useState("")
  const [oklchValue, setOklchValue] = useState("")
  const [codeFormat, setCodeFormat] = useState<ColorFormat>("tailwind")

  useEffect(() => {
    setRValue(r.toString())
    setGValue(g.toString())
    setBValue(b.toString())

    // Parse HSL from string
    const hslString = currentColor?.hsl || formatHsl(r, g, b)
    const hslMatch = hslString.match(
      /hsl\s*\(\s*(\d+)\s*,\s*(\d+)%?\s*,\s*(\d+)%?\s*\)/i
    )
    if (hslMatch) {
      setHValue(hslMatch[1])
      setSValue(hslMatch[2])
      setLValue(hslMatch[3])
    }
  }, [currentColor, r, g, b])

  // Keep the typed text while it still names the current color, so "#abc"
  // isn't expanded to "#aabbcc" before "#abcdef" is finished. This depends on
  // currentColor only: r/g/b change one render earlier, while currentColor is
  // still the previous color, and comparing then would overwrite the text
  useEffect(() => {
    const hex = currentColor?.hex || ""
    setHexValue((prev) => (parseColor(prev) === hex.toLowerCase() ? prev : hex))
    setOklchValue((prev) => {
      if (!hex) return ""
      if (parseColor(prev) === hex.toLowerCase()) return prev
      const { r, g, b } = hexToRgb(hex)
      return formatOklch(r, g, b)
    })
  }, [currentColor])

  useEffect(() => {
    redraw()
    // Only on mount: later changes are drawn by useColorPicker
  }, [])

  const [saved, setSaved] = useState(false)
  const handleSave = () => {
    onAddToHistory()
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  const handleRgbChange = (component: "r" | "g" | "b", value: string) => {
    const numValue = parseInt(value, 10)

    if (component === "r") setRValue(value)
    if (component === "g") setGValue(value)
    if (component === "b") setBValue(value)

    if (!isNaN(numValue) && numValue >= 0 && numValue <= 255) {
      const newR = component === "r" ? numValue : parseInt(rValue, 10)
      const newG = component === "g" ? numValue : parseInt(gValue, 10)
      const newB = component === "b" ? numValue : parseInt(bValue, 10)

      if (!isNaN(newR) && !isNaN(newG) && !isNaN(newB)) {
        const newHsv = rgbToHsv(newR, newG, newB)
        onColorChange(newHsv)
      }
    }
  }

  const handleHslChange = (component: "h" | "s" | "l", value: string) => {
    const numValue = parseInt(value, 10)

    if (component === "h") setHValue(value)
    if (component === "s") setSValue(value)
    if (component === "l") setLValue(value)

    const maxVal = component === "h" ? 360 : 100
    if (!isNaN(numValue) && numValue >= 0 && numValue <= maxVal) {
      const newH = component === "h" ? numValue : parseInt(hValue, 10)
      const newS = component === "s" ? numValue : parseInt(sValue, 10)
      const newL = component === "l" ? numValue : parseInt(lValue, 10)

      if (!isNaN(newH) && !isNaN(newS) && !isNaN(newL)) {
        const { r: rC, g: gC, b: bC } = hslToRgb(newH, newS, newL)
        onColorChange(rgbToHsv(rC, gC, bC))
      }
    }
  }

  const handleHexChange = (value: string) => {
    setHexValue(value)
    const parsed = parseColor(value)
    if (parsed) {
      const { r, g, b } = hexToRgb(parsed)
      onColorChange(rgbToHsv(r, g, b))
    }
  }

  const handleOklchChange = (value: string) => {
    setOklchValue(value)
    if (!/^\s*oklch\(/i.test(value)) return
    const parsed = parseColor(value)
    if (parsed) {
      const { r, g, b } = hexToRgb(parsed)
      onColorChange(rgbToHsv(r, g, b))
    }
  }

  const codeValue = currentColor
    ? formatColor(currentColor.hex, codeFormat)
    : ""

  const hex = currentColor?.hex ?? "#000000"

  const rows: Array<{
    label: string
    copyText: string
    field: string
    inputs: React.ReactNode
  }> = [
    {
      label: "HEX",
      copyText: hexValue,
      field: "hex",
      inputs: (
        <input
          type="text"
          value={hexValue}
          onChange={(e) => handleHexChange(e.target.value)}
          aria-label="HEX"
          className={inputClass}
          placeholder="#000000"
        />
      )
    },
    {
      label: "RGB",
      copyText: `rgb(${r}, ${g}, ${b})`,
      field: "rgb-full",
      inputs: (
        <div className="grid flex-1 grid-cols-3 gap-1">
          {(
            [
              ["r", rValue, "Red"],
              ["g", gValue, "Green"],
              ["b", bValue, "Blue"]
            ] as const
          ).map(([component, value, name]) => (
            <input
              key={component}
              type="number"
              min="0"
              max="255"
              value={value}
              aria-label={name}
              onChange={(e) => handleRgbChange(component, e.target.value)}
              className={inputClass}
            />
          ))}
        </div>
      )
    },
    {
      label: "HSL",
      copyText: formatHsl(r, g, b),
      field: "hsl-full",
      inputs: (
        <div className="grid flex-1 grid-cols-3 gap-1">
          {(
            [
              ["h", hValue, "Hue", 360],
              ["s", sValue, "Saturation", 100],
              ["l", lValue, "Lightness", 100]
            ] as const
          ).map(([component, value, name, max]) => (
            <input
              key={component}
              type="number"
              min="0"
              max={max}
              value={value}
              aria-label={name}
              onChange={(e) => handleHslChange(component, e.target.value)}
              className={inputClass}
            />
          ))}
        </div>
      )
    },
    {
      label: "OKLCH",
      copyText: oklchValue,
      field: "oklch",
      inputs: (
        <input
          type="text"
          value={oklchValue}
          onChange={(e) => handleOklchChange(e.target.value)}
          aria-label="OKLCH"
          className={inputClass}
          placeholder="oklch(62.8% 0.25768 29.23)"
        />
      )
    }
  ]

  return (
    <div>
      <ScreenHeader
        title="Adjust color"
        subtitle={hex.toUpperCase()}
        onBack={onBack}
      />
      <div className="flex flex-col gap-3 p-3">
        <div className="relative">
          <canvas
            ref={gradientRef}
            width={656}
            height={320}
            aria-label="Saturation and brightness"
            className="block h-40 w-full cursor-crosshair rounded-lg"
            onMouseDown={onGradientMouseDown}
          />
          <span
            className="pointer-events-none absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.3)]"
            style={{
              left: `${hsv.s}%`,
              top: `${100 - hsv.v}%`,
              backgroundColor: hex
            }}
          />
        </div>

        <div className="relative">
          <canvas
            ref={hueRef}
            width={656}
            height={24}
            aria-label="Hue"
            className="block h-3 w-full cursor-pointer rounded-full"
            onMouseDown={onHueMouseDown}
          />
          <span
            className="pointer-events-none absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.3)]"
            style={{
              left: `${(hsv.h / 360) * 100}%`,
              backgroundColor: `hsl(${hsv.h}, 100%, 50%)`
            }}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          {rows.map((row) => (
            <div key={row.label} className="flex items-center gap-2">
              <span className="w-11 shrink-0 text-xs font-medium text-slate-500 dark:text-slate-400">
                {row.label}
              </span>
              {row.inputs}
              <CopyButton
                copied={copiedField === row.field}
                label={row.label}
                onClick={() => onCopy(row.copyText, row.field)}
              />
            </div>
          ))}
          <div className="flex items-center gap-2">
            <span className="w-11 shrink-0 text-xs font-medium text-slate-500 dark:text-slate-400">
              Code
            </span>
            <div
              role="radiogroup"
              aria-label="Code format"
              className="grid flex-1 grid-cols-4 gap-0.5 rounded-md bg-slate-100 p-0.5 dark:bg-slate-800">
              {CODE_FORMATS.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={codeFormat === value}
                  title={label}
                  onClick={() => setCodeFormat(value)}
                  className={
                    codeFormat === value
                      ? "rounded px-1 py-1 text-[11px] font-semibold shadow-sm bg-white dark:bg-slate-600"
                      : "rounded px-1 py-1 text-[11px] text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                  }>
                  {label.split(" / ")[0]}
                </button>
              ))}
            </div>
            <span className="size-8 shrink-0" />
          </div>
          <div className="flex items-center gap-2">
            <span className="w-11 shrink-0" />
            <input
              type="text"
              readOnly
              value={codeValue}
              title={codeValue}
              aria-label="Color as code"
              className={`${inputClass} bg-slate-50 dark:bg-slate-800/60`}
            />
            <CopyButton
              copied={copiedField === "code"}
              label="code"
              onClick={() => onCopy(codeValue, "code")}
            />
          </div>
        </div>

        {currentColor && (
          <TailwindMatchChip
            hex={currentColor.hex}
            version={tailwindVersion}
            copied={copiedField === "tailwind-name"}
            onCopy={(name) => onCopy(name, "tailwind-name")}
          />
        )}

        <button
          type="button"
          onClick={handleSave}
          className="flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 dark:border-slate-700 dark:hover:bg-slate-800">
          {saved ? (
            <Check className="size-4 text-emerald-600" strokeWidth={3} />
          ) : (
            <BookmarkPlus className="size-4" />
          )}
          {saved ? "Saved to history" : "Save to history"}
        </button>
      </div>
    </div>
  )
}
