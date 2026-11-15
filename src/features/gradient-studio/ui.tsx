import { cn } from "~/lib/cn"

/** Shows through translucent stops */
export const CHECKERBOARD: React.CSSProperties = {
  backgroundImage: "repeating-conic-gradient(#e2e8f0 0% 25%, #ffffff 0% 50%)",
  backgroundSize: "12px 12px"
}

export const Panel = ({
  title,
  actions,
  children,
  className
}: {
  title: string
  actions?: React.ReactNode
  children: React.ReactNode
  className?: string
}) => (
  <section
    aria-label={title}
    className={cn(
      "flex flex-col gap-4 rounded-3xl border border-slate-200/80 bg-white/60 p-6 shadow-xs backdrop-blur-xs",
      className
    )}>
    <div className="flex min-h-7 items-center justify-between gap-3 border-b border-slate-100/80 pb-3">
      <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400">
        {title}
      </h2>
      {actions && <div className="flex items-center gap-1">{actions}</div>}
    </div>
    {children}
  </section>
)

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label
}: {
  value: T
  options: Array<{ value: T; label: string; title?: string }>
  onChange: (value: T) => void
  label: string
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="flex w-fit flex-wrap rounded-xl border border-slate-200/80 bg-white/80 p-1 shadow-xs">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          title={option.title}
          onClick={() => onChange(option.value)}
          className={cn(
            "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-blue-500",
            value === option.value
              ? "bg-blue-600 text-white shadow-xs"
              : "text-slate-600 hover:text-slate-900"
          )}>
          {option.label}
        </button>
      ))}
    </div>
  )
}

/** A labelled range slider with a number field next to it */
export const SliderField = ({
  label,
  value,
  min,
  max,
  step = 1,
  unit,
  onChange
}: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  unit: string
  onChange: (value: number) => void
}) => (
  <label className="flex items-center gap-3 text-xs font-semibold text-slate-600">
    <span className="w-16 shrink-0">{label}</span>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(event) => onChange(Number(event.target.value))}
      className="min-w-0 flex-1 accent-blue-600"
    />
    <span className="flex items-center gap-1">
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={+value.toFixed(1)}
        onChange={(event) => {
          const next = Number(event.target.value)
          if (event.target.value !== "" && Number.isFinite(next))
            onChange(Math.min(max, Math.max(min, next)))
        }}
        aria-label={`${label} (${unit})`}
        className="w-16 rounded-lg border border-slate-200 bg-white/50 px-2 py-1 text-right font-mono text-xs text-slate-700 outline-hidden focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
      />
      <span className="w-3 text-slate-400">{unit}</span>
    </span>
  </label>
)

export const iconButton =
  "rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-blue-500 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
