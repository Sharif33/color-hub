import { useEffect, useMemo, useState } from "react"

import "~style.css"

import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  ListFilter,
  SlidersHorizontal,
  TestTubes,
  XCircle
} from "lucide-react"

import ColorHubLogo from "~components/color hub/logo"
import { Dropdown, type DropdownOption } from "~components/dropdown"
import type { WCAGAnalysisData } from "~features/webpage-color-analyzer"
import { getContrastRatio } from "~utils/color-utils"
import { calculateWCAGCompliance, formatRatio } from "~utils/wcag-utils"

type FilterKey = "all" | "fail-aa" | "pass-aa" | "pass-aaa"
type SortKey = "ratio-desc" | "ratio-asc" | "count"

const SORT_OPTIONS: Array<DropdownOption<SortKey>> = [
  { value: "ratio-desc", label: "Ratio (high → low)" },
  { value: "ratio-asc", label: "Ratio (low → high)" },
  { value: "count", label: "Frequency" }
]

interface AnalyzedPair {
  foreground: string
  background: string
  count: number
  selectors: string[]
  ratio: number
  normalAA: boolean
  normalAAA: boolean
  largeAA: boolean
  largeAAA: boolean
  largeText: boolean
  /** AA / AAA at the thresholds that apply to this pair's text size */
  passAA: boolean
  passAAA: boolean
}

const Badge = ({ pass, label }: { pass: boolean; label: string }) => (
  <span
    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
      pass
        ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/80"
        : "bg-red-50 text-red-600 ring-1 ring-red-200/80"
    }`}>
    {pass ? (
      <CheckCircle2 className="size-3" strokeWidth={2.5} />
    ) : (
      <XCircle className="size-3" strokeWidth={2.5} />
    )}
    {label}
  </span>
)

const RatioPill = ({
  ratio,
  passAA,
  passAAA
}: {
  ratio: number
  passAA: boolean
  passAAA: boolean
}) => {
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full px-3 py-1 text-sm font-extrabold tabular-nums shadow-sm ${
        passAAA
          ? "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200/80"
          : passAA
            ? "bg-sky-100 text-sky-800 ring-1 ring-sky-200/80"
            : "bg-red-100 text-red-700 ring-1 ring-red-200/80"
      }`}>
      {formatRatio(ratio)}:1
    </span>
  )
}

const ColorSwatch = ({ hex, label }: { hex: string; label: string }) => (
  <div className="flex flex-col items-center gap-1.5">
    <div
      className="h-10 w-16 rounded-xl border border-black/10 shadow-sm"
      style={{ backgroundColor: hex }}
    />
    <span className="font-mono text-[10px] font-semibold text-slate-600 uppercase tracking-wide">
      {hex}
    </span>
    <span className="text-[10px] text-slate-400">{label}</span>
  </div>
)

const PreviewChip = ({
  foreground,
  background
}: {
  foreground: string
  background: string
}) => (
  <div
    className="flex items-center justify-center rounded-xl px-3 py-2 text-sm font-semibold border border-black/10 min-w-[108px] shadow-sm"
    style={{ backgroundColor: background, color: foreground }}>
    WCAG
  </div>
)

const StatCard = ({
  label,
  value,
  tone
}: {
  label: string
  value: number
  tone: "neutral" | "danger" | "success" | "premium"
}) => {
  const toneClass =
    tone === "danger"
      ? "bg-red-50/80 ring-red-200/80 text-red-700"
      : tone === "success"
        ? "bg-emerald-50/80 ring-emerald-200/80 text-emerald-700"
        : tone === "premium"
          ? "bg-violet-50/80 ring-violet-200/80 text-violet-700"
          : "bg-slate-50/80 ring-slate-200/90 text-slate-700"

  return (
    <div
      className={`rounded-2xl px-4 py-3 ring-1 shadow-sm ${toneClass}`}>
      <p className="text-[11px] font-semibold uppercase tracking-wide opacity-80">
        {label}
      </p>
      <p className="mt-1 text-2xl font-black tabular-nums">{value}</p>
    </div>
  )
}

const openInContrastChecker = (fg: string, bg: string, largeText: boolean) => {
  const fgParam = fg.replace("#", "")
  const bgParam = bg.replace("#", "")
  // Without the flag the checker judges a large-text pair as normal text
  const url =
    chrome.runtime.getURL("tabs/contrast-checker.html") +
    `?fg=${fgParam}&bg=${bgParam}${largeText ? "&large=1" : ""}`
  chrome.tabs.create({ url })
}

const formatTimestamp = (ts: number): string => {
  const diff = Math.floor((Date.now() - ts) / 1000)
  if (diff < 60) return "just now"
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return new Date(ts).toLocaleDateString()
}

export default function WCAGContrastAnalyzerPage() {
  const [data, setData] = useState<WCAGAnalysisData | null>(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FilterKey>("all")
  const [sortBy, setSortBy] = useState<SortKey>("ratio-desc")

  useEffect(() => {
    chrome.storage.local.get(["WCAG_ANALYSIS_PENDING"], (result) => {
      const stored = result.WCAG_ANALYSIS_PENDING as
        | WCAGAnalysisData
        | undefined
      if (stored) setData(stored)
      setLoading(false)
    })
  }, [])

  const analyzedPairs = useMemo<AnalyzedPair[]>(() => {
    if (!data) return []
    return data.pairs.map((pair) => {
      const ratio = getContrastRatio(pair.foreground, pair.background)
      const wcag = calculateWCAGCompliance(ratio)
      // Reports saved before large text was detected have no flag
      const largeText = pair.largeText === true
      return {
        ...pair,
        ratio,
        normalAA: wcag.normalAA,
        normalAAA: wcag.normalAAA,
        largeAA: wcag.largeAA,
        largeAAA: wcag.largeAAA,
        largeText,
        passAA: largeText ? wcag.largeAA : wcag.normalAA,
        passAAA: largeText ? wcag.largeAAA : wcag.normalAAA
      }
    })
  }, [data])

  const filtered = useMemo(() => {
    let result = analyzedPairs
    if (filter === "fail-aa") result = result.filter((p) => !p.passAA)
    else if (filter === "pass-aa") result = result.filter((p) => p.passAA)
    else if (filter === "pass-aaa") result = result.filter((p) => p.passAAA)

    return [...result].sort((a, b) => {
      if (sortBy === "ratio-asc") return a.ratio - b.ratio
      if (sortBy === "ratio-desc") return b.ratio - a.ratio
      return b.count - a.count
    })
  }, [analyzedPairs, filter, sortBy])

  const stats = useMemo(() => {
    const total = analyzedPairs.length
    const failAA = analyzedPairs.filter((p) => !p.passAA).length
    const passAA = analyzedPairs.filter((p) => p.passAA).length
    const passAAA = analyzedPairs.filter((p) => p.passAAA).length
    return { total, failAA, passAA, passAAA }
  }, [analyzedPairs])

  const FILTERS: { key: FilterKey; label: string; count: number }[] = [
    { key: "all", label: "All Pairs", count: stats.total },
    { key: "fail-aa", label: "Failing AA", count: stats.failAA },
    { key: "pass-aa", label: "Passing AA", count: stats.passAA },
    { key: "pass-aaa", label: "Passing AAA", count: stats.passAAA }
  ]

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center font-sans">
        <div className="flex flex-col items-center gap-3 text-slate-500">
          <div className="h-8 w-8 rounded-full border-2 border-slate-300 border-t-blue-500 animate-spin" />
          <span className="text-sm">Loading analysis…</span>
        </div>
      </div>
    )
  }

  if (!data || data.pairs.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center font-sans">
        <div className="flex flex-col items-center gap-4 text-slate-500 text-center max-w-sm px-6">
          <AlertTriangle className="size-10 text-amber-400" strokeWidth={1.5} />
          <p className="text-base font-semibold text-slate-700">
            No data found
          </p>
          <p className="text-sm text-slate-500">
            Close this tab and click{" "}
            <span className="font-semibold text-slate-700">
              Analyze WCAG Contrast
            </span>{" "}
            from the Color Hub popup on the page you want to analyze.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-blue-100 selection:text-blue-900">
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-50/40 via-slate-50/30 to-slate-50 pointer-events-none -z-10" />

      {/* Nav */}
      <nav className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/80 backdrop-blur-xl shadow-sm">
        <div className="container mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <ColorHubLogo size={28} />
        </div>
      </nav>

      <main className="container mx-auto max-w-7xl px-6 py-8">
        {/* Header */}
        <div className="mb-8 rounded-3xl border border-slate-200/80 bg-white/80 p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                Report
              </p>
              <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-800 leading-tight">
                WCAG Contrast Analysis
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Review detected text/background color pairs with compliance
                status and quick actions.
              </p>
              <div className="mt-3 flex items-center gap-2">
                {data.url && (
                  <a
                    href={data.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] text-slate-500 hover:bg-blue-50 hover:text-blue-600 transition-colors max-w-[420px] truncate">
                    <ExternalLink className="size-3 shrink-0" />
                    <span className="truncate">{data.title || data.url}</span>
                  </a>
                )}
                {data.timestamp && (
                  <span className="shrink-0 text-[11px] text-slate-400">
                    Updated {formatTimestamp(data.timestamp)}
                  </span>
                )}
              </div>
            </div>

            <div className="grid min-w-[260px] grid-cols-2 gap-2">
              <StatCard
                label="Total Pairs"
                value={stats.total}
                tone="neutral"
              />
              <StatCard label="Failing AA" value={stats.failAA} tone="danger" />
              <StatCard
                label="Passing AA"
                value={stats.passAA}
                tone="success"
              />
              <StatCard
                label="Passing AAA"
                value={stats.passAAA}
                tone="premium"
              />
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="relative z-30 mb-6 rounded-2xl border border-slate-200/80 bg-white/80 p-3 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-slate-500">
              <ListFilter className="size-4" />
              <span className="text-xs font-semibold uppercase tracking-wide">
                Filters
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {FILTERS.map(({ key, label, count }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFilter(key)}
                  className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-semibold transition-all ${
                    filter === key
                      ? "border-blue-200 bg-blue-600 text-white shadow-sm shadow-blue-200/70"
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-800"
                  }`}>
                  {label}
                  <span
                    className={`rounded-full size-5 flex items-center justify-center text-[10px] font-bold shrink-0 ${
                      filter === key
                        ? "bg-white/20 text-white"
                        : "bg-slate-100 text-slate-500"
                    }`}>
                    {count}
                  </span>
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 text-slate-500 ml-auto">
              <SlidersHorizontal className="size-4" />
              <Dropdown
                value={sortBy}
                onChange={(next) => setSortBy(next)}
                options={SORT_OPTIONS}
                size="md"
                ariaLabel="Sort pairs"
              />
            </div>
          </div>
        </div>

        {/* Pairs grid */}
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-20 text-slate-400">
            <CheckCircle2
              className="size-10 text-emerald-400"
              strokeWidth={1.5}
            />
            <p className="text-sm">No pairs match this filter.</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((pair, i) => (
              <div
                key={`${pair.foreground}-${pair.background}-${i}`}
                className="relative z-0 rounded-3xl border border-slate-200/80 bg-white shadow-sm hover:z-20 hover:shadow-lg hover:-translate-y-0.5 transition overflow-visible flex flex-col">
                <div className="flex items-center justify-between rounded-t-[calc(1.5rem-1px)] border-b border-slate-100 bg-gradient-to-r from-slate-50/80 to-white px-5 py-3">
                  <div className="flex items-center gap-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-slate-500">
                      Pair {i + 1}
                    </p>
                    {pair.largeText && (
                      <span
                        title="WCAG large text: judged at 3:1 (AA) and 4.5:1 (AAA)"
                        className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-700 ring-1 ring-blue-200/80">
                        Large text
                      </span>
                    )}
                  </div>
                  <div className="relative group/uses">
                    <span className="inline-flex cursor-help items-center rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-600 transition-colors group-hover/uses:bg-slate-200">
                      {pair.count} {pair.count === 1 ? "use" : "uses"}
                    </span>
                    {pair.selectors.length > 0 && (
                      <div className="invisible absolute right-0 top-full z-[9999] w-[320px] max-w-[78vw] rounded-2xl border border-slate-200/90 bg-white p-3.5 text-left shadow-[0_12px_30px_rgba(15,23,42,0.14)] ring-1 ring-black/5 opacity-0 translate-y-1 scale-[0.98] transition-all duration-150 ease-out pointer-events-auto group-hover/uses:visible group-hover/uses:opacity-100 group-hover/uses:translate-y-0 group-hover/uses:scale-100 hover:visible hover:opacity-100 hover:translate-y-0 hover:scale-100">
                        <div className="absolute -top-1 right-4 size-2 rotate-45 border-l border-t border-slate-200 bg-white" />
                        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                          Found elements ({pair.selectors.length})
                        </p>
                        <div className="max-h-52 space-y-1.5 overflow-auto pr-1">
                          {pair.selectors.map((sel, si) => (
                            <code
                              key={si}
                              className="block rounded-lg border border-slate-100 bg-slate-50 px-2 py-1.5 text-[10px] font-mono text-slate-600 break-all">
                              {sel}
                            </code>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="p-5 flex flex-col gap-4">
                  {/* Top row: swatches + preview + ratio */}
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <ColorSwatch hex={pair.foreground} label="Text" />
                      <span className="text-slate-300 text-lg">↔</span>
                      <ColorSwatch hex={pair.background} label="BG" />
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <PreviewChip
                        foreground={pair.foreground}
                        background={pair.background}
                      />
                      <RatioPill
                        ratio={pair.ratio}
                        passAA={pair.passAA}
                        passAAA={pair.passAAA}
                      />
                    </div>
                  </div>

                  {/* Badges */}
                  <div className="flex flex-wrap gap-1.5">
                    <Badge pass={pair.normalAA} label="AA Normal" />
                    <Badge pass={pair.normalAAA} label="AAA Normal" />
                    <Badge pass={pair.largeAA} label="AA Large" />
                    <Badge pass={pair.largeAAA} label="AAA Large" />
                  </div>

                  {/* Open in Contrast Checker */}
                  <button
                    type="button"
                    onClick={() =>
                      openInContrastChecker(
                        pair.foreground,
                        pair.background,
                        pair.largeText
                      )
                    }
                    className="mt-auto w-full flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-semibold text-slate-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 transition-colors">
                    <TestTubes className="size-3.5" />
                    Open in Contrast Checker
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
