import { cn } from "~/lib/cn"
import { GRADIENT_TYPES, type Gradient } from "~/utils/gradient"

import { Segmented, SliderField } from "./ui"

interface ShapeControlsProps {
  gradient: Gradient
  onChange: (patch: Partial<Gradient>) => void
}

// The eight directions, as arrows in a 3×3 grid around the center
const DIRECTIONS: Array<{ angle: number; arrow: string; label: string }> = [
  { angle: 315, arrow: "↖", label: "To top left" },
  { angle: 0, arrow: "↑", label: "To top" },
  { angle: 45, arrow: "↗", label: "To top right" },
  { angle: 270, arrow: "←", label: "To left" },
  { angle: 90, arrow: "→", label: "To right" },
  { angle: 225, arrow: "↙", label: "To bottom left" },
  { angle: 180, arrow: "↓", label: "To bottom" },
  { angle: 135, arrow: "↘", label: "To bottom right" }
]

/** Type, direction, shape, center and repeat */
export const ShapeControls = ({ gradient, onChange }: ShapeControlsProps) => {
  const { type } = gradient
  return (
    <div className="flex flex-col gap-4">
      <Segmented
        label="Gradient type"
        value={type}
        options={GRADIENT_TYPES}
        onChange={(next) => onChange({ type: next })}
      />

      {type === "linear" && (
        <div className="flex items-center gap-4">
          <div
            role="group"
            aria-label="Direction"
            className="grid shrink-0 grid-cols-3 gap-1">
            {DIRECTIONS.map(({ angle, arrow, label }, index) => (
              <button
                key={angle}
                type="button"
                title={label}
                aria-label={label}
                aria-pressed={gradient.angle === angle}
                onClick={() => onChange({ angle })}
                className={cn(
                  "flex size-7 items-center justify-center rounded-lg text-sm font-semibold transition-colors focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-blue-500",
                  // Leave the middle cell empty
                  index === 4 && "col-start-3",
                  gradient.angle === angle
                    ? "bg-blue-600 text-white"
                    : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
                )}>
                {arrow}
              </button>
            ))}
          </div>
          <div className="min-w-0 flex-1">
            <SliderField
              label="Angle"
              value={gradient.angle}
              min={0}
              max={360}
              unit="°"
              onChange={(angle) => onChange({ angle: angle % 360 })}
            />
          </div>
        </div>
      )}

      {type === "radial" && (
        <Segmented
          label="Shape"
          value={gradient.shape}
          options={[
            {
              value: "ellipse",
              label: "Ellipse",
              title: "Stretches to the box"
            },
            { value: "circle", label: "Circle", title: "Round in any box" }
          ]}
          onChange={(shape) => onChange({ shape })}
        />
      )}

      {type === "conic" && (
        <SliderField
          label="Start"
          value={gradient.angle}
          min={0}
          max={360}
          unit="°"
          onChange={(angle) => onChange({ angle: angle % 360 })}
        />
      )}

      {type !== "linear" && (
        <div className="flex flex-col gap-2">
          <SliderField
            label="Center X"
            value={gradient.center.x}
            min={0}
            max={100}
            unit="%"
            onChange={(x) => onChange({ center: { ...gradient.center, x } })}
          />
          <SliderField
            label="Center Y"
            value={gradient.center.y}
            min={0}
            max={100}
            unit="%"
            onChange={(y) => onChange({ center: { ...gradient.center, y } })}
          />
          <p className="text-xs text-slate-400">
            Or click the preview to move the center.
          </p>
        </div>
      )}

      <label className="flex w-fit items-center gap-2 text-xs font-semibold text-slate-600">
        <input
          type="checkbox"
          checked={gradient.repeating}
          onChange={(event) => onChange({ repeating: event.target.checked })}
          className="size-4 rounded-sm accent-blue-600"
        />
        Repeat the stops
        <span className="font-normal text-slate-400">
          (move the last stop in to see stripes)
        </span>
      </label>
    </div>
  )
}
