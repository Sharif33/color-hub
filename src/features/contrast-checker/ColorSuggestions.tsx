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
    <div className="flex flex-col gap-5 p-6 bg-slate-50/50">
      {onlyAAA ? (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2.5">
            <h2 className="text-sm font-bold tracking-widest text-slate-400 uppercase">
              Reach Excellent (AAA)
            </h2>
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold tracking-wider text-emerald-700 uppercase shadow-sm shadow-emerald-100/50">
              AA passed
            </span>
          </div>
          <p className="text-xs font-medium text-slate-500">
            Your pair meets AA ({ratio.toFixed(2)}:1). These tweaks would reach
            AAA (7:1).
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          <h2 className="text-sm font-bold tracking-widest text-slate-400 uppercase">
            Suggested Fixes
          </h2>
          <p className="text-xs font-medium text-slate-500">
            Nearest colors to reach AA or AAA compliance, sorted by smallest
            change.
          </p>
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1">
        {suggestions.map((s) => {
          const style = LEVEL_STYLES[s.level]
          const previewFg = s.target === "foreground" ? s.hex : foreground
          const previewBg = s.target === "background" ? s.hex : background
          return (
            <button
              key={`${s.hex}-${s.level}-${s.target}`}
              type="button"
              onClick={() => onApply(s.hex, s.target)}
              className="group flex flex-col items-center gap-3 rounded-2xl border border-slate-200/80 bg-white p-3 text-left shadow-sm transition-all hover:border-blue-400 hover:shadow-md hover:ring-1 hover:ring-blue-400 active:scale-[0.98]">
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-3">
                  <div
                    className="flex items-center justify-center rounded-xl size-10 text-base font-bold shadow-sm ring-1 ring-black/5 transition-transform group-hover:scale-105"
                    style={{
                      backgroundColor: previewBg,
                      color: previewFg
                    }}>
                    Aa
                  </div>
                  <div className="flex flex-col items-start gap-0.5">
                    <span className="text-xs font-mono font-bold text-slate-700">
                      {s.hex.toUpperCase()}
                    </span>
                    <span className="text-[11px] font-mono font-medium text-slate-500">
                      Ratio: {s.ratio.toFixed(2)}:1
                    </span>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-1.5">
                  <span
                    className={`rounded-md py-0.5 px-2 text-[10px] font-bold tracking-wider uppercase whitespace-nowrap ${style.badge}`}>
                    {s.level} · {style.label}
                  </span>
                  <span
                    className={`rounded-md py-0.5 px-2 text-[10px] font-bold tracking-wider uppercase whitespace-nowrap ${TARGET_STYLES[s.target]}`}>
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
