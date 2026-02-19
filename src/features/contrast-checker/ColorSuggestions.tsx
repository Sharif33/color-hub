import type { ColorSuggestion, SuggestionTarget } from "~utils/wcag-utils"

interface ColorSuggestionsProps {
  suggestions: ColorSuggestion[]
  foreground: string
  background: string
  ratio: number
  onApply: (hex: string, target: SuggestionTarget) => void
}

const LEVEL_STYLES = {
  AA: {
    badge: "bg-emerald-50 text-emerald-600",
    label: "Good"
  },
  AAA: {
    badge: "bg-emerald-100 text-emerald-700",
    label: "Excellent"
  }
} as const

const TARGET_STYLES = {
  foreground: "bg-violet-50 text-violet-600",
  background: "bg-sky-50 text-sky-600"
} as const

export function ColorSuggestions({
  suggestions,
  foreground,
  background,
  ratio,
  onApply
}: ColorSuggestionsProps) {
  const onlyAAA =
    suggestions.length > 0 && suggestions.every((s) => s.level === "AAA")

  if (suggestions.length === 0) return null

  return (
    <div className="flex flex-col gap-3 bg-white p-6">
      {onlyAAA ? (
        <>
          <div className="flex items-center gap-2.5">
            <h2 className="text-xs tracking-[0.2em] text-slate-500 uppercase">
              Reach Excellent (AAA)
            </h2>
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-600">
              AA passed
            </span>
          </div>
          <p className="text-[11px] text-slate-400 -mt-1">
            Your pair meets AA ({ratio.toFixed(2)}:1). These tweaks would reach
            AAA (7:1).
          </p>
        </>
      ) : (
        <>
          <h2 className="text-xs tracking-[0.2em] text-slate-500 uppercase">
            Suggested Fixes
          </h2>
          <p className="text-[11px] text-slate-400 -mt-1">
            Nearest colors to reach AA or AAA compliance, sorted by smallest
            change.
          </p>
        </>
      )}
      <div className="grid grid-cols-2 gap-3">
        {suggestions.map((s) => {
          const style = LEVEL_STYLES[s.level]
          const previewFg = s.target === "foreground" ? s.hex : foreground
          const previewBg = s.target === "background" ? s.hex : background
          return (
            <button
              key={`${s.hex}-${s.level}-${s.target}`}
              type="button"
              onClick={() => onApply(s.hex, s.target)}
              className="group flex flex-col items-center gap-2 rounded-lg border border-slate-200 p-3 text-left transition hover:border-slate-400 hover:bg-slate-50">
              <div className="flex items-center justify-between gap-2 w-full">
                <div className="flex shrink-0 overflow-hidden rounded">
                  <span
                    className="h-10 w-6"
                    style={{ backgroundColor: previewFg }}
                  />
                  <span
                    className="h-10 w-6"
                    style={{ backgroundColor: previewBg }}
                  />
                </div>
                <span className="text-slate-400 text-base">=</span>
                <div
                  className="flex items-center justify-center rounded-md size-10 text-base font-semibold"
                  style={{
                    backgroundColor: previewBg,
                    color: previewFg
                  }}>
                  Aa
                </div>
                <div className="flex flex-col items-start gap-1.5">
                  <span className="text-[11px] font-mono text-slate-400">
                    {s.hex}
                  </span>
                  <span className="text-[11px] font-mono text-slate-400">
                    {s.ratio.toFixed(2)}:1
                  </span>
                </div>

                <div className="flex flex-col items-end gap-1.5">
                  <span
                    className={`rounded-full py-0.5 px-2 text-[10px] font-semibold whitespace-nowrap ${style.badge}`}>
                    {s.level} · {style.label}
                  </span>
                  <span
                    className={`rounded-full py-0.5 px-2 text-[10px] font-semibold whitespace-nowrap ${TARGET_STYLES[s.target]}`}>
                    {s.target}
                  </span>
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
