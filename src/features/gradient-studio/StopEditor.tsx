import { Lock, LockOpen, Pipette, Trash2 } from "lucide-react"
import { useEffect, useState } from "react"

import { hexToRgb, parseColorWithAlpha } from "~/utils/color-utils"
import { rgbaToHex, type GradientStop } from "~/utils/gradient"

import { resolveCssColor } from "./css-color"
import { pickScreenColor } from "./eyedropper"
import { CHECKERBOARD, iconButton, SliderField } from "./ui"

interface StopEditorProps {
  stop: GradientStop
  index: number
  canRemove: boolean
  /** Shuffling the generator's ideas keeps this stop's color */
  locked: boolean
  onToggleLock: () => void
  onChange: (patch: Partial<GradientStop>) => void
  onRemove: () => void
}

const withAlpha = (hex: string, alpha: number) =>
  rgbaToHex({ ...hexToRgb(hex), a: alpha })

/** Color, opacity and position of the selected stop */
export const StopEditor = ({
  stop,
  index,
  canRemove,
  locked,
  onToggleLock,
  onChange,
  onRemove
}: StopEditorProps) => {
  const parsed = parseColorWithAlpha(stop.color) ?? { hex: "#000000", alpha: 1 }
  const [draft, setDraft] = useState(stop.color)
  const [invalid, setInvalid] = useState(false)

  // Show the stop's color again when it changes from elsewhere
  useEffect(() => {
    setDraft(stop.color)
    setInvalid(false)
  }, [stop.color])

  const commit = (value: string) => {
    const color = resolveCssColor(value.replace(/;$/, ""))
    if (!color) {
      setInvalid(value.trim() !== "")
      return
    }
    setInvalid(false)
    const next = withAlpha(color.hex, color.alpha)
    setDraft(next)
    onChange({ color: next })
  }

  const pick = async () => {
    const hex = await pickScreenColor()
    // A picked color is opaque, so keep the stop's own opacity
    if (hex) onChange({ color: withAlpha(hex, parsed.alpha) })
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <label
          className="relative size-11 shrink-0 cursor-pointer overflow-hidden rounded-xl shadow-xs ring-1 ring-black/10"
          style={CHECKERBOARD}
          title="Choose a color">
          <span
            className="absolute inset-0"
            style={{ backgroundColor: stop.color }}
          />
          <input
            type="color"
            value={parsed.hex}
            onChange={(event) =>
              onChange({ color: withAlpha(event.target.value, parsed.alpha) })
            }
            aria-label={`Stop ${index + 1} color`}
            className="absolute inset-0 cursor-pointer opacity-0"
          />
        </label>
        <div className="relative min-w-0 flex-1">
          <input
            type="text"
            value={draft}
            spellCheck={false}
            aria-label={`Stop ${index + 1} color value`}
            aria-invalid={invalid}
            onChange={(event) => {
              setDraft(event.target.value)
              setInvalid(false)
            }}
            onBlur={() => {
              commit(draft)
              if (!resolveCssColor(draft)) setDraft(stop.color)
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") commit(draft)
            }}
            className="h-11 w-full rounded-xl border border-slate-200 bg-white/50 pl-3 pr-10 font-mono text-sm font-semibold text-slate-700 outline-hidden transition-all hover:border-slate-300 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 aria-invalid:border-red-400"
          />
          <button
            type="button"
            onClick={() => void pick()}
            title="Pick a color from the screen"
            aria-label="Pick a color from the screen"
            className={`absolute right-1.5 top-1/2 -translate-y-1/2 ${iconButton}`}>
            <Pipette className="size-4" />
          </button>
        </div>
        <button
          type="button"
          onClick={onToggleLock}
          aria-pressed={locked}
          title={
            locked
              ? "Locked: shuffling keeps this color. Click to unlock"
              : "Lock this color, so shuffling keeps it"
          }
          aria-label="Lock this color when shuffling"
          className={`${iconButton} ${locked ? "text-blue-600!" : ""}`}>
          {locked ? (
            <Lock className="size-4" />
          ) : (
            <LockOpen className="size-4" />
          )}
        </button>
        <button
          type="button"
          onClick={onRemove}
          disabled={!canRemove}
          title={canRemove ? "Remove this stop" : "A gradient needs two stops"}
          aria-label="Remove this stop"
          className={iconButton}>
          <Trash2 className="size-4" />
        </button>
      </div>
      {invalid && (
        <p className="-mt-1 text-xs text-red-600">
          That isn't a color. Try a hex code, rgb(), hsl(), oklch() or a name.
        </p>
      )}
      <SliderField
        label="Opacity"
        value={Math.round(parsed.alpha * 100)}
        min={0}
        max={100}
        unit="%"
        onChange={(value) =>
          onChange({ color: withAlpha(parsed.hex, value / 100) })
        }
      />
      <SliderField
        label="Position"
        value={stop.position}
        min={0}
        max={100}
        step={0.5}
        unit="%"
        onChange={(position) => onChange({ position })}
      />
    </div>
  )
}
