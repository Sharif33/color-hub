import { Pipette } from "lucide-react"

import { pickOutsideBrowserColor } from "~features/pick-outside-browser-color"
import {
  isValidPartialHex,
  parseColorWithAlpha
} from "~utils/color-utils"

interface ColorCardProps {
  label: "Foreground" | "Background"
  color: string
  alpha: number
  textColor: string
  inputValue: string
  onColorChange: (color: string) => void
  onInputChange: (value: string) => void
  swatches: string[]
  hideSwatches?: boolean
}

export function ColorCard({
  label,
  color,
  alpha,
  textColor,
  inputValue,
  onColorChange,
  onInputChange,
  swatches,
  hideSwatches = false
}: ColorCardProps) {
  const handleInputChange = (value: string) => {
    if (!value) {
      onInputChange("#")
      return
    }

    const parsed = parseColorWithAlpha(value)
    if (parsed) {
      if (parsed.alpha < 1) {
        onInputChange(value.trim())
      } else {
        onInputChange(parsed.hex)
      }
      return
    }

    const next = value.startsWith("#") ? value : `#${value}`
    if (isValidPartialHex(next)) {
      onInputChange(next.toLowerCase())
    }

    // Allow typing rgba/hsla functions in progress (before they fully parse)
    if (/^(rgba?|hsla?)\(/i.test(value)) {
      onInputChange(value)
    }
  }

  const handlePaste = (event: React.ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault()
    const pasted = event.clipboardData.getData("text").trim()

    const parsed = parseColorWithAlpha(pasted)
    if (parsed) {
      if (parsed.alpha < 1) {
        onInputChange(pasted)
      } else {
        onInputChange(parsed.hex)
      }
    }
  }

  const handlePickColor = async () => {
    const pickedColor = await pickOutsideBrowserColor()
    if (pickedColor) {
      onInputChange(pickedColor.hex.toLowerCase())
    }
  }

  const hasAlpha = alpha < 1

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-bold text-slate-600">
          {label}
        </label>
        {hasAlpha && (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold tracking-wider text-slate-500 uppercase">
            {Math.round(alpha * 100)}% Opacity
          </span>
        )}
      </div>

      <div className="relative flex items-center gap-4">
        <div
          className="h-14 w-14 shrink-0 rounded-2xl shadow-sm ring-1 ring-slate-200/80 transition-transform hover:scale-105"
          style={{
            background: hasAlpha
              ? `linear-gradient(${color}, ${color}), repeating-conic-gradient(#e2e8f0 0% 25%, transparent 0% 50%) 0 0 / 10px 10px`
              : color
          }}
        />
        <div className="relative flex-1">
          <input
            type="text"
            value={inputValue}
            onChange={(event) => handleInputChange(event.target.value)}
            onPaste={handlePaste}
            placeholder="#000000"
            className="w-full h-14 rounded-2xl border border-slate-200 bg-slate-50 pl-4 pr-10 text-base font-medium font-mono text-slate-700 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100 placeholder:text-slate-400"
          />
          <button
            type="button"
            onClick={handlePickColor}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-colors"
            title="Pick color from screen"
          >
            <Pipette className="size-5" />
          </button>
        </div>
      </div>

      {!hideSwatches && swatches.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-2">
          {swatches.map((swatch) => (
            <button
              key={`${label.toLowerCase()}-${swatch}`}
              type="button"
              onClick={() => onInputChange(swatch)}
              aria-label={`Set ${label.toLowerCase()} ${swatch}`}
              className={`h-6 w-6 rounded-md border transition-transform hover:scale-110 active:scale-95 ${
                color === swatch
                  ? "border-blue-500 ring-2 ring-blue-200"
                  : "border-slate-200 hover:border-slate-300"
              }`}
              style={{ backgroundColor: swatch }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
