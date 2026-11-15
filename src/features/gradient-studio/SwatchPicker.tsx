import { useState } from "react"

import { Dropdown } from "~/components/dropdown"
import { usePaletteColors } from "~/hooks/use-palette-colors"
import type { PaletteSource } from "~/lib/constants"

type SwatchSource = Exclude<PaletteSource, "saved-pairs">

const SOURCES: Array<{ value: SwatchSource; label: string }> = [
  { value: "color-history", label: "Color history" },
  { value: "webpage-colors", label: "Saved palettes" },
  { value: "combined-colors", label: "Both" }
]

interface SwatchPickerProps {
  /** The color the popup had when it opened the studio */
  currentColor: string | null
  onPick: (hex: string) => void
}

/** Your colors, to drop into the selected stop */
export const SwatchPicker = ({ currentColor, onPick }: SwatchPickerProps) => {
  const [source, setSource] = useState<SwatchSource>("color-history")
  const swatches = usePaletteColors(source)
  const swatch = (hex: string, label: string) => (
    <button
      key={hex}
      type="button"
      title={label}
      aria-label={label}
      onClick={() => onPick(hex)}
      className="size-6 rounded-lg border border-black/5 shadow-xs transition-transform hover:scale-110 focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-500 active:scale-95"
      style={{ backgroundColor: hex }}
    />
  )

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-slate-600">
          Use one of your colors
        </span>
        <Dropdown
          value={source}
          onChange={(next) => setSource(next as SwatchSource)}
          options={SOURCES}
          ariaLabel="Colors from"
        />
      </div>
      {currentColor && (
        <div className="flex items-center gap-2 text-xs text-slate-500">
          {swatch(currentColor, `Popup color ${currentColor}`)}
          The color from the popup
        </div>
      )}
      {swatches.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {swatches.map((hex) => swatch(hex, `Use ${hex}`))}
        </div>
      ) : (
        <p className="text-xs text-slate-400">
          {source === "color-history"
            ? "Colors you pick with Color Hub show up here."
            : "Palettes you save from pages show up here."}
        </p>
      )}
    </div>
  )
}
