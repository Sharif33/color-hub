import { ArrowRight, Check, CheckCircle2, Copy } from "lucide-react"
import { useMemo, useState } from "react"

import type { AnalyzedColor } from "~features/webpage-color-analyzer"

import { ColorSwatch } from "./ColorSwatch"
import {
  DEFAULT_DUPLICATE_THRESHOLD,
  findNearDuplicates,
  formatReplacements
} from "./lint"

interface LintPanelProps {
  colors: AnalyzedColor[]
}

const formatUses = (count: number) => `${count} ${count === 1 ? "use" : "uses"}`

export const LintPanel = ({ colors }: LintPanelProps) => {
  const [threshold, setThreshold] = useState(DEFAULT_DUPLICATE_THRESHOLD)
  const [copied, setCopied] = useState(false)

  const groups = useMemo(
    () => findNearDuplicates(colors, threshold),
    [colors, threshold]
  )
  const duplicateCount = groups.reduce(
    (sum, group) => sum + group.duplicates.length,
    0
  )

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(formatReplacements(groups))
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch (error) {
      console.warn("Clipboard write failed:", error)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <label
            htmlFor="lint-threshold"
            className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Treat colors as duplicates within ΔE{" "}
            <span className="tabular-nums text-slate-700">
              {threshold.toFixed(1)}
            </span>
          </label>
          <input
            id="lint-threshold"
            type="range"
            min={0.5}
            max={5}
            step={0.5}
            value={threshold}
            onChange={(e) => setThreshold(Number(e.target.value))}
            className="w-64 accent-blue-600"
          />
          <p className="max-w-md text-xs text-slate-500">
            ΔE 1 is about the smallest difference people notice side by side.
            Colors closer than 2 are usually the same color written twice.
          </p>
        </div>
        {groups.length > 0 && (
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:border-slate-300">
            {copied ? (
              <Check className="size-3.5 text-emerald-600" strokeWidth={3} />
            ) : (
              <Copy className="size-3.5" />
            )}
            {copied ? "Copied" : "Copy replacement list"}
          </button>
        )}
      </div>

      {groups.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-12 text-center text-slate-500">
          <CheckCircle2 className="size-9 text-emerald-400" strokeWidth={1.5} />
          <p className="text-sm">
            No near-duplicates within ΔE {threshold.toFixed(1)}.
          </p>
        </div>
      ) : (
        <>
          <p className="text-sm text-slate-600">
            {duplicateCount} {duplicateCount === 1 ? "color" : "colors"} could
            be merged into {groups.length} existing{" "}
            {groups.length === 1 ? "color" : "colors"}. The most used color in
            each group is suggested.
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            {groups.map(({ canonical, duplicates }) => (
              <div
                key={canonical.rgb}
                className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-center gap-3">
                  <ColorSwatch
                    hex={canonical.hex}
                    className="h-9 w-9 rounded-lg"
                  />
                  <div className="flex flex-col">
                    <span className="font-mono text-sm font-semibold text-slate-800">
                      {canonical.hex}
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Keep · {formatUses(canonical.count)}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col gap-1.5 border-t border-slate-100 pt-3">
                  {duplicates.map(({ color, deltaE }) => (
                    <div
                      key={color.rgb}
                      className="flex items-center gap-2 text-xs text-slate-600">
                      <ColorSwatch
                        hex={color.hex}
                        className="h-5 w-5 rounded"
                      />
                      <span className="font-mono">{color.hex}</span>
                      <ArrowRight className="size-3 text-slate-400" />
                      <span className="font-mono">{canonical.hex}</span>
                      <span className="ml-auto tabular-nums text-slate-400">
                        ΔE {deltaE.toFixed(1)} · {formatUses(color.count)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
