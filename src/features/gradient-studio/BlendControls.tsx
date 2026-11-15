import { cn } from "~/lib/cn"
import {
  GRADIENT_EASINGS,
  gradientToCss,
  INTERPOLATION_SPACES,
  type Gradient
} from "~/utils/gradient"

import { CHECKERBOARD, Segmented, SliderField } from "./ui"

interface BlendControlsProps {
  gradient: Gradient
  onChange: (patch: Partial<Gradient>) => void
}

/**
 * The gradient blended in each space, side by side, so the gray middle of
 * sRGB is plain to see. Click one to use it.
 */
export const BlendControls = ({ gradient, onChange }: BlendControlsProps) => (
  <div className="flex flex-col gap-4">
    <div
      role="radiogroup"
      aria-label="Blend in"
      className="flex flex-col gap-2">
      {INTERPOLATION_SPACES.map((space) => {
        const selected = gradient.space === space.value
        const css = gradientToCss({
          ...gradient,
          type: "linear",
          angle: 90,
          repeating: false,
          space: space.value
        })
        return (
          <button
            key={space.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange({ space: space.value })}
            className={cn(
              "flex flex-col gap-1.5 rounded-2xl border p-2.5 text-left transition-colors focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-blue-500",
              selected
                ? "border-blue-200 bg-blue-50 ring-1 ring-blue-200"
                : "border-slate-200/80 bg-white/80 hover:border-slate-300"
            )}>
            <span className="flex items-baseline justify-between gap-2 px-0.5">
              <span className="text-xs font-bold text-slate-700">
                {space.label}
              </span>
              <span className="truncate text-[11px] text-slate-500">
                {space.description}
              </span>
            </span>
            <span
              className="relative block h-6 overflow-hidden rounded-lg ring-1 ring-black/5"
              style={CHECKERBOARD}>
              <span
                className="absolute inset-0"
                style={{ backgroundImage: css }}
              />
            </span>
          </button>
        )
      })}
    </div>

    {gradient.space === "oklch" && (
      <div className="flex items-center gap-3">
        <span className="w-16 shrink-0 text-xs font-semibold text-slate-600">
          Hue path
        </span>
        <Segmented
          label="Hue path"
          value={gradient.hue}
          options={[
            {
              value: "shorter",
              label: "Short way",
              title: "Straight from one hue to the next"
            },
            {
              value: "longer",
              label: "Long way",
              title: "The long way round the color wheel, through more hues"
            }
          ]}
          onChange={(hue) => onChange({ hue })}
        />
      </div>
    )}

    <div className="flex items-center gap-3">
      <span className="w-16 shrink-0 text-xs font-semibold text-slate-600">
        Easing
      </span>
      <Segmented
        label="Easing between stops"
        value={gradient.easing}
        options={GRADIENT_EASINGS}
        onChange={(easing) => onChange({ easing })}
      />
    </div>
    {gradient.easing !== "linear" && (
      <p className="-mt-2 text-xs text-slate-500">
        CSS can't ease between stops, so the code gets extra stops that follow
        the curve. Easing smooths the hard edge where an overlay fades out.
      </p>
    )}

    <SliderField
      label="Grain"
      value={gradient.grain}
      min={0}
      max={30}
      unit="%"
      onChange={(grain) => onChange({ grain })}
    />
    <p className="-mt-2 text-xs text-slate-500">
      A little noise hides the banding that large, subtle gradients show.
    </p>
  </div>
)
