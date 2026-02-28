import { Pipette } from "lucide-react"

import { pickOutsideBrowserColor } from "~features/pick-outside-browser-color"
import { isValidPartialHex, parseColorWithAlpha } from "~utils/color-utils"

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
  // ... existing handleInputChange, handlePaste, handlePickColor ...
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
    <div className="flex flex-col gap-3 group">
      <div className="flex items-center justify-between px-1">
        <label className="text-sm font-semibold text-slate-700">{label}</label>
        {hasAlpha && (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold tracking-wider text-slate-500 uppercase ring-1 ring-slate-200/50">
            {Math.round(alpha * 100)}% Opacity
          </span>
        )}
      </div>

      <div className="relative flex items-center gap-3">
        <div className="relative h-12 w-12 shrink-0 rounded-xl shadow-sm ring-1 ring-black/5 overflow-hidden group-hover:shadow transition-shadow">
          {hasAlpha && (
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjgiPgo8cmVjdCB3aWR0aD0iNCIgaGVpZ2h0PSI0IiBmaWxsPSIjZTJlOGYwIj48L3JlY3Q+CjxyZWN0IHg9IjQiIHk9IjQiIHdpZHRoPSI0IiBoZWlnaHQ9IjQiIGZpbGw9IiNlMmU4ZjAiPjwvcmVjdD4KPC9zdmc+')] opacity-50" />
          )}
          <div
            className="absolute inset-0 transition-colors"
            style={{ backgroundColor: color }}
          />
        </div>
        <div className="relative flex-1">
          <input
            type="text"
            value={inputValue}
            onChange={(event) => handleInputChange(event.target.value)}
            onPaste={handlePaste}
            placeholder="#000000"
            spellCheck={false}
            className="w-full h-12 rounded-xl border border-slate-200 bg-white/50 pl-4 pr-11 text-sm font-semibold font-mono text-slate-700 outline-none transition-all hover:border-slate-300 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 placeholder:text-slate-300"
          />
          <button
            type="button"
            onClick={handlePickColor}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors active:scale-95"
            title="Pick color from screen">
            <Pipette className="size-4" strokeWidth={2.5} />
          </button>
        </div>
      </div>

      {!hideSwatches && swatches.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1 px-1">
          {swatches.map((swatch) => (
            <button
              key={`${label.toLowerCase()}-${swatch}`}
              type="button"
              onClick={() => onInputChange(swatch)}
              aria-label={`Set ${label.toLowerCase()} ${swatch}`}
              className={`h-6 w-6 rounded-lg shadow-sm transition-all hover:scale-110 active:scale-95 ${
                color === swatch
                  ? "ring-2 ring-blue-500 ring-offset-1 border-transparent scale-110 z-10"
                  : "border border-black/5 hover:border-black/10"
              }`}
              style={{ backgroundColor: swatch }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
