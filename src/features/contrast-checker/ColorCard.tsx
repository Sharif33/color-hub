import { Pipette } from "lucide-react"

import { pickOutsideBrowserColor } from "~features/pick-outside-browser-color"
import { isValidPartialHex, parseColor } from "~utils/color-utils"

interface ColorCardProps {
  label: "Foreground" | "Background"
  color: string
  textColor: string
  inputValue: string
  onColorChange: (color: string) => void
  onInputChange: (value: string) => void
  swatches: string[]
}

export function ColorCard({
  label,
  color,
  textColor,
  inputValue,
  onColorChange,
  onInputChange,
  swatches
}: ColorCardProps) {
  const handleInputChange = (value: string) => {
    if (!value) {
      onInputChange("#")
      return
    }

    const parsed = parseColor(value)
    if (parsed) {
      onInputChange(parsed)
      return
    }

    const next = value.startsWith("#") ? value : `#${value}`
    if (isValidPartialHex(next)) {
      onInputChange(next.toLowerCase())
    }
  }

  const handlePaste = (event: React.ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault()
    const pasted = event.clipboardData.getData("text").trim()

    const parsed = parseColor(pasted)
    if (parsed) {
      onInputChange(parsed)
    }
  }

  const handlePickColor = async () => {
    const pickedColor = await pickOutsideBrowserColor()
    if (pickedColor) {
      onInputChange(pickedColor.hex.toLowerCase())
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div
        className="rounded-xl border p-4"
        style={{
          background: color,
          color: textColor
        }}>
        <div className="mb-16 flex justify-end">
          <button
            type="button"
            onClick={handlePickColor}
            aria-label={`Pick ${label.toLowerCase()} color`}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-transparent transition hover:scale-110 hover:border-current/50 active:scale-95">
            <Pipette className="size-5" />
          </button>
        </div>
        <p className="text-base font-medium">{label}</p>
        <p className="mt-2 text-lg font-semibold leading-none tracking-tight">
          {color}
        </p>
      </div>
      <input
        type="text"
        value={inputValue}
        onChange={(event) => handleInputChange(event.target.value)}
        onPaste={handlePaste}
        placeholder="#000000 / rgb(0,0,0) / hsl(0,0%,0%)"
        className="w-full rounded-xl border bg-white px-3 py-1.5 text-sm text-slate-900 outline-none ring-2 ring-transparent transition focus:border-slate-400 focus:ring-slate-300"
      />
      <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
        {swatches.map((swatch) => (
          <button
            key={`${label.toLowerCase()}-${swatch}`}
            type="button"
            onClick={() => onInputChange(swatch)}
            aria-label={`Set ${label.toLowerCase()} ${swatch}`}
            className={`flex-none rounded border size-6 ${
              color === swatch ? "border-blue-600" : "border-slate-400"
            }`}
            style={{ backgroundColor: swatch }}
          />
        ))}
      </div>
      {swatches.length === 0 && (
        <p className="text-xs text-slate-500">
          No colors available for this source.
        </p>
      )}
    </div>
  )
}
