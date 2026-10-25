import { ArrowRight } from "lucide-react"
import { useMemo, useState } from "react"

import { Dropdown } from "~components/dropdown"
import type { AnalyzedColor } from "~features/webpage-color-analyzer"
import { cn } from "~lib/cn"

import { ColorSwatch } from "./ColorSwatch"
import { comparePalettes, SHIFT_THRESHOLD, type DiffKind } from "./compare"

export interface ComparablePalette {
  id: string
  label: string
  colors: AnalyzedColor[]
}

interface ComparePanelProps {
  palette: ComparablePalette
  /** The other palettes it can be compared with */
  others: ComparablePalette[]
}

const KIND_STYLES: Record<DiffKind, { label: string; className: string }> = {
  shifted: {
    label: "Changed",
    className: "bg-amber-50 text-amber-700 ring-amber-200"
  },
  removed: {
    label: "Only in A",
    className: "bg-red-50 text-red-600 ring-red-200"
  },
  added: {
    label: "Only in B",
    className: "bg-emerald-50 text-emerald-700 ring-emerald-200"
  },
  same: {
    label: "Same",
    className: "bg-slate-50 text-slate-500 ring-slate-200"
  }
}

const ColorCell = ({ color }: { color?: AnalyzedColor }) =>
  color ? (
    <div className="flex items-center gap-2">
      <ColorSwatch hex={color.hex} className="h-6 w-6 rounded-md" />
      <span className="font-mono text-xs font-semibold text-slate-700">
        {color.hex}
      </span>
      <span className="text-[11px] tabular-nums text-slate-400">
        ×{color.count}
      </span>
    </div>
  ) : (
    <span className="text-xs text-slate-300">—</span>
  )

export const ComparePanel = ({ palette, others }: ComparePanelProps) => {
  const [otherId, setOtherId] = useState<string>(others[0]?.id ?? "")
  const [hideSame, setHideSame] = useState(true)
  const other = others.find((entry) => entry.id === otherId) ?? others[0]

  const rows = useMemo(
    () => (other ? comparePalettes(palette.colors, other.colors) : []),
    [palette.colors, other]
  )
  const counts = useMemo(() => {
    const result: Record<DiffKind, number> = {
      shifted: 0,
      removed: 0,
      added: 0,
      same: 0
    }
    rows.forEach((row) => (result[row.kind] += 1))
    return result
  }, [rows])
  const visibleRows = hideSame
    ? rows.filter((row) => row.kind !== "same")
    : rows

  if (!other) {
    return (
      <p className="py-12 text-center text-sm text-slate-500">
        Save another palette to compare it with this one.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <span className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-700">
          A · {palette.label}
        </span>
        <ArrowRight className="size-4 text-slate-400" />
        <span className="text-xs font-semibold text-slate-500">B ·</span>
        <Dropdown
          value={other.id}
          onChange={setOtherId}
          options={others.map((entry) => ({
            value: entry.id,
            label: entry.label
          }))}
          size="md"
          ariaLabel="Palette to compare with"
        />
        <label className="ml-auto flex items-center gap-2 text-xs font-medium text-slate-600">
          <input
            type="checkbox"
            checked={hideSame}
            onChange={(e) => setHideSame(e.target.checked)}
            className="accent-blue-600"
          />
          Hide unchanged
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        {(Object.keys(KIND_STYLES) as DiffKind[]).map((kind) => (
          <span
            key={kind}
            className={cn(
              "rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1",
              KIND_STYLES[kind].className
            )}>
            {KIND_STYLES[kind].label}: {counts[kind]}
          </span>
        ))}
      </div>

      {visibleRows.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-500">
          The palettes have the same colors.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                <th className="py-3 pl-2 pr-3">Change</th>
                <th className="px-3 py-3">A · {palette.label}</th>
                <th className="px-3 py-3">B · {other.label}</th>
                <th className="py-3 pl-3 pr-2 text-right">ΔE</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row) => (
                <tr
                  key={`${row.kind}-${row.a?.rgb ?? ""}-${row.b?.rgb ?? ""}`}
                  className="border-b border-slate-50 last:border-0">
                  <td className="py-2 pl-2 pr-3">
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1",
                        KIND_STYLES[row.kind].className
                      )}>
                      {KIND_STYLES[row.kind].label}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <ColorCell color={row.a} />
                  </td>
                  <td className="px-3 py-2">
                    <ColorCell color={row.b} />
                  </td>
                  <td className="py-2 pl-3 pr-2 text-right text-xs tabular-nums text-slate-500">
                    {row.kind === "shifted" && row.deltaE !== undefined
                      ? row.deltaE.toFixed(1)
                      : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-slate-400">
        Colors that differ by up to ΔE {SHIFT_THRESHOLD} are shown as changed;
        bigger differences count as removed and added.
      </p>
    </div>
  )
}
