import { Check, X } from "lucide-react"

import { APCA_LEVELS, formatLc } from "~utils/apca"

interface ApcaPanelProps {
  lc: number
}

const getLcColor = (lc: number): string => {
  const magnitude = Math.abs(lc)
  if (magnitude >= 75) return "text-emerald-600"
  if (magnitude >= 60) return "text-emerald-500"
  if (magnitude >= 45) return "text-amber-500"
  return "text-red-500"
}

const getPolarity = (lc: number): string => {
  if (lc > 0) return "Dark text on a light background"
  if (lc < 0) return "Light text on a dark background"
  return "Too little contrast to read"
}

export function ApcaPanel({ lc }: ApcaPanelProps) {
  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-bold tracking-widest text-slate-400 uppercase">
          APCA Contrast
        </h2>
        <span
          title="APCA is the contrast method in the WCAG 3 draft. It isn't a conformance requirement yet, so use it alongside WCAG 2.2."
          className="cursor-help rounded-full bg-slate-50 px-2.5 py-0.5 text-[10px] font-bold tracking-wider text-slate-500 uppercase ring-1 ring-inset ring-slate-200">
          WCAG 3 draft · advisory
        </span>
      </div>

      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <p
          title="Lightness contrast. Positive for dark text on light, negative for light text on dark"
          className={`text-4xl font-black tracking-tighter leading-none ${getLcColor(lc)}`}>
          Lc {formatLc(lc)}
        </p>
        <span className="text-xs font-medium text-slate-400">
          {getPolarity(lc)}
        </span>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {APCA_LEVELS.map((level) => {
          const passed = Math.abs(lc) >= level.minimum
          return (
            <div
              key={level.minimum}
              title={level.description}
              className="flex items-start gap-2 rounded-xl border border-slate-100 bg-white p-3">
              <span
                className={`mt-0.5 inline-flex size-4 shrink-0 items-center justify-center rounded-full ring-1 ring-inset ${
                  passed
                    ? "bg-emerald-500 text-white ring-emerald-600"
                    : "bg-red-50 text-red-500 ring-red-200"
                }`}>
                {passed ? (
                  <Check className="size-3" strokeWidth={3} />
                ) : (
                  <X className="size-3" strokeWidth={2.5} />
                )}
              </span>
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="text-[13px] font-bold leading-tight text-slate-700">
                  {level.label}
                </span>
                <span className="text-[10px] font-medium leading-tight text-slate-400">
                  Lc ≥ {level.minimum} · {level.description}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
