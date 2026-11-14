import { AlertTriangle, CheckCircle2, Wand2 } from "lucide-react"
import { useMemo, useState } from "react"

import { cn } from "~lib/cn"
import { formatLc } from "~utils/apca"
import { parseColor } from "~utils/color-utils"
import { gradientToCss, type Gradient } from "~utils/gradient"
import { formatRatio } from "~utils/wcag-utils"

import {
  bestTextColor,
  checkTextContrast,
  lintGradient,
  type LintIssue
} from "./checks"
import { CHECKERBOARD, Segmented } from "./ui"

interface ChecksPanelProps {
  gradient: Gradient
  textColor: string | null
  onTextColorChange: (color: string | null) => void
  onFix: (issue: LintIssue) => void
}

const TEXT_OPTIONS = [
  { value: "#ffffff", label: "White" },
  { value: "#0f172a", label: "Dark" }
]

/**
 * Whether text stays readable across the whole gradient, and what's worth
 * fixing in the gradient itself.
 */
export const ChecksPanel = ({
  gradient,
  textColor,
  onTextColorChange,
  onFix
}: ChecksPanelProps) => {
  const [large, setLarge] = useState(false)
  const threshold = large ? 3 : 4.5
  const suggested = useMemo(() => bestTextColor(gradient), [gradient])
  const color = textColor ?? suggested
  const contrast = useMemo(
    () => checkTextContrast(gradient, color, threshold),
    [gradient, color, threshold]
  )
  const issues = useMemo(() => lintGradient(gradient), [gradient])
  const passes = contrast.worst.ratio >= threshold
  // Where the text is hardest to read, on the strip (stops can sit outside it)
  const marker = Math.min(100, Math.max(0, contrast.worst.position))
  const strip = gradientToCss({
    ...gradient,
    type: "linear",
    angle: 90,
    repeating: false
  })
  const [draft, setDraft] = useState("")

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-xs font-semibold text-slate-600">
            Text on this gradient
          </h3>
          <Segmented
            label="Text size"
            value={large ? "large" : "normal"}
            options={[
              { value: "normal", label: "Normal text", title: "Needs 4.5:1" },
              {
                value: "large",
                label: "Large text",
                title: "24px, or 18.66px bold: needs 3:1"
              }
            ]}
            onChange={(value) => setLarge(value === "large")}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {TEXT_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={color === option.value}
              onClick={() => onTextColorChange(option.value)}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold ring-1 transition-colors",
                color === option.value
                  ? "bg-blue-50 text-blue-700 ring-blue-200"
                  : "bg-white text-slate-600 ring-slate-200 hover:bg-slate-50"
              )}>
              <span
                className="size-3.5 rounded ring-1 ring-black/15"
                style={{ backgroundColor: option.value }}
              />
              {option.label}
              {option.value === suggested && (
                <span className="font-normal text-slate-400">best</span>
              )}
            </button>
          ))}
          <form
            onSubmit={(event) => {
              event.preventDefault()
              const hex = parseColor(draft)
              if (hex) onTextColorChange(hex)
            }}>
            <input
              type="text"
              value={draft}
              placeholder="Your text color"
              spellCheck={false}
              aria-label="Text color"
              onChange={(event) => setDraft(event.target.value)}
              onBlur={() => {
                const hex = parseColor(draft)
                if (hex) onTextColorChange(hex)
              }}
              className="h-8 w-36 rounded-lg border border-slate-200 bg-white/50 px-2.5 font-mono text-xs text-slate-700 outline-none placeholder:font-sans placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
            />
          </form>
        </div>

        <div className="relative">
          <div
            className="relative h-9 overflow-hidden rounded-xl ring-1 ring-black/10"
            style={CHECKERBOARD}>
            <div
              className="absolute inset-0"
              style={{ backgroundImage: strip }}
            />
            {/* Where the text fails, hatched */}
            {contrast.failing.map(([from, to]) => (
              <div
                key={from}
                className="absolute inset-y-0"
                style={{
                  left: `${from}%`,
                  width: `${Math.max(0.5, to - from)}%`,
                  backgroundImage:
                    "repeating-linear-gradient(135deg, rgb(220 38 38 / 0.85) 0 2px, transparent 2px 7px)"
                }}
              />
            ))}
            <span
              className="absolute inset-0 flex items-center px-3 text-sm font-semibold"
              style={{ color }}>
              Aa Sample text
            </span>
          </div>
          {/* A line through the strip at the lowest contrast, labelled. It
              stays clear of the rounded ends, so it reads as on the strip */}
          <span
            aria-hidden="true"
            className="absolute top-0 h-10 w-0.5 -translate-x-1/2 rounded-full bg-slate-900 ring-1 ring-white"
            style={{ left: `clamp(8px, ${marker}%, calc(100% - 8px))` }}
          />
          <div className="relative mt-1.5 h-4">
            <span
              className={cn(
                "absolute top-0 whitespace-nowrap text-[11px] font-semibold",
                passes ? "text-slate-600" : "text-red-700"
              )}
              // Slides from left-aligned at the start to right-aligned at
              // the end, so the label stays under the strip
              style={{
                left: `${marker}%`,
                transform: `translateX(-${marker}%)`
              }}>
              Lowest contrast {formatRatio(contrast.worst.ratio)}:1
            </span>
          </div>
        </div>

        <p
          className={cn(
            "flex items-start gap-2 rounded-xl px-3 py-2 text-xs",
            passes ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"
          )}>
          {passes ? (
            <CheckCircle2 className="mt-px size-3.5 shrink-0" />
          ) : (
            <AlertTriangle className="mt-px size-3.5 shrink-0" />
          )}
          <span>
            {passes
              ? `Readable everywhere. Even at the marked spot, the contrast is ${formatRatio(contrast.worst.ratio)}:1.`
              : `Too low in the hatched part, down to ${formatRatio(contrast.worst.ratio)}:1 at the marked spot. ${large ? "Large" : "Normal"} text needs ${threshold}:1.`}{" "}
            Weakest APCA Lc {formatLc(contrast.weakestLc)}.
          </span>
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="text-xs font-semibold text-slate-600">Gradient check</h3>
        {issues.length === 0 ? (
          <p className="flex items-center gap-2 text-xs text-slate-500">
            <CheckCircle2 className="size-3.5 text-emerald-500" />
            No gray middle, look-alike stops, color-blind clashes or banding
            risk.
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {issues.map((issue) => (
              <li
                key={issue.id}
                className="flex items-center justify-between gap-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900">
                <span className="flex items-start gap-2">
                  <AlertTriangle className="mt-px size-3.5 shrink-0 text-amber-600" />
                  {issue.message}
                </span>
                {issue.fix && (
                  <button
                    type="button"
                    onClick={() => onFix(issue)}
                    className="flex shrink-0 items-center gap-1 rounded-lg bg-white px-2 py-1 font-semibold text-amber-900 ring-1 ring-amber-200 hover:bg-amber-100">
                    <Wand2 className="size-3" />
                    {issue.fix.label}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
