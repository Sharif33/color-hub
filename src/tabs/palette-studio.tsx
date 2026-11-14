import {
  Code2,
  CopyCheck,
  ExternalLink,
  GitCompareArrows,
  Palette,
  Save,
  Table2,
  type LucideIcon
} from "lucide-react"
import { useEffect, useMemo, useState } from "react"

import "~style.css"

import ColorHubLogo from "~components/color hub/logo"
import { ColorSwatch } from "~features/palette-studio/ColorSwatch"
import { ColorTable } from "~features/palette-studio/ColorTable"
import { ComparePanel } from "~features/palette-studio/ComparePanel"
import { ExportPanel } from "~features/palette-studio/ExportPanel"
import { LintPanel } from "~features/palette-studio/LintPanel"
import { usePalettes } from "~features/palette-studio/usePalettes"
import type { AnalyzedColor } from "~features/webpage-color-analyzer"
import { useSettings } from "~hooks/use-settings"
import { cn } from "~lib/cn"

const PENDING_ID = "pending"

type View = "colors" | "export" | "lint" | "compare"

const VIEWS: Array<{ value: View; label: string; icon: LucideIcon }> = [
  { value: "colors", label: "Colors", icon: Table2 },
  { value: "export", label: "Export", icon: Code2 },
  { value: "lint", label: "Near-duplicates", icon: CopyCheck },
  { value: "compare", label: "Compare", icon: GitCompareArrows }
]

const getInitialView = (): View => {
  const view = new URLSearchParams(window.location.search).get("view")
  return VIEWS.some((entry) => entry.value === view) ? (view as View) : "colors"
}

interface PaletteEntry {
  id: string
  label: string
  colors: AnalyzedColor[]
  pending: boolean
}

const getInitialSelection = (): string | null => {
  const params = new URLSearchParams(window.location.search)
  if (params.get("pending") === "1") return PENDING_ID
  const domain = params.get("domain")
  return domain ? `saved:${domain}` : null
}

const formatTimestamp = (ts: number): string =>
  new Date(ts).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  })

function PaletteStudioPage() {
  const { saved, pending, loaded, savePending } = usePalettes()
  const { tailwindVersion, copyFormat } = useSettings()
  const [selectedId, setSelectedId] = useState<string | null>(
    getInitialSelection
  )
  const [view, setView] = useState<View>(getInitialView)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  const palettes = useMemo<PaletteEntry[]>(() => {
    const entries: PaletteEntry[] = Object.entries(saved).map(
      ([domain, colors]) => ({
        id: `saved:${domain}`,
        label: domain,
        colors,
        pending: false
      })
    )
    if (pending) {
      entries.unshift({
        id: PENDING_ID,
        label: pending.domain || pending.title || "Current analysis",
        colors: pending.colors,
        pending: true
      })
    }
    return entries
  }, [saved, pending])

  // Fall back to the first palette when the selection doesn't exist (yet)
  const selected =
    palettes.find((entry) => entry.id === selectedId) ?? palettes[0] ?? null

  // Keep the address in sync, so reloading shows the same palette
  useEffect(() => {
    if (!selected) return
    const query = selected.pending
      ? "?pending=1"
      : `?domain=${encodeURIComponent(selected.label)}`
    window.history.replaceState(null, "", query)
  }, [selected])

  const copy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedKey(key)
      setTimeout(() => setCopiedKey(null), 1500)
    } catch (error) {
      console.warn("Clipboard write failed:", error)
    }
  }

  const handleSave = async () => {
    setSaveError(null)
    try {
      const domain = await savePending()
      if (domain) setSelectedId(`saved:${domain}`)
    } catch (error) {
      console.warn("Saving palette failed:", error)
      setSaveError("Couldn't save this palette. Please try again.")
    }
  }

  if (!loaded) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center font-sans">
        <div className="h-8 w-8 rounded-full border-2 border-slate-300 border-t-blue-500 animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-blue-100 selection:text-blue-900">
      <nav className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/80 backdrop-blur-xl shadow-sm">
        <div className="container mx-auto flex h-16 max-w-7xl items-center gap-3 px-6">
          <ColorHubLogo size={28} className="text-blue-600" />
          <h1 className="text-lg font-extrabold tracking-tight text-slate-800">
            Palette Studio
          </h1>
        </div>
      </nav>

      <main className="container mx-auto max-w-7xl px-6 py-8">
        {!selected ? (
          <div className="flex flex-col items-center gap-3 py-24 text-center text-slate-500">
            <Palette className="size-10 text-slate-300" strokeWidth={1.5} />
            <p className="text-base font-semibold text-slate-700">
              No palettes yet
            </p>
            <p className="max-w-sm text-sm">
              Open the Color Hub popup on a page, click{" "}
              <span className="font-semibold text-slate-700">
                Analyze Webpage Colors
              </span>
              , then open the results here.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            <div
              role="tablist"
              aria-label="Palettes"
              className="flex flex-wrap gap-2">
              {palettes.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  role="tab"
                  aria-selected={entry.id === selected.id}
                  onClick={() => setSelectedId(entry.id)}
                  className={cn(
                    "flex w-56 flex-col gap-2 rounded-2xl border px-3 py-2.5 text-left shadow-sm transition-colors",
                    entry.id === selected.id
                      ? "border-blue-200 bg-blue-50 ring-1 ring-blue-200"
                      : "border-slate-200/80 bg-white/80 hover:border-slate-300"
                  )}>
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-semibold text-slate-700">
                      {entry.label}
                    </span>
                    {entry.pending && (
                      <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-700 ring-1 ring-amber-200">
                        Unsaved
                      </span>
                    )}
                  </span>
                  <span className="flex h-3 overflow-hidden rounded-full">
                    {entry.colors.slice(0, 16).map((color) => (
                      <span
                        key={color.rgb}
                        className="h-full flex-1"
                        style={{ backgroundColor: color.hex }}
                      />
                    ))}
                  </span>
                </button>
              ))}
            </div>

            <section className="flex min-w-0 flex-col gap-6">
              <div className="flex flex-wrap items-start justify-between gap-4 rounded-3xl border border-slate-200/80 bg-white/80 p-6 shadow-sm">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                    {selected.pending ? "Unsaved analysis" : "Saved palette"}
                  </p>
                  <h2 className="mt-1 truncate text-2xl font-black tracking-tight text-slate-800">
                    {selected.label}
                  </h2>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span>
                      {selected.colors.length}{" "}
                      {selected.colors.length === 1 ? "color" : "colors"}
                    </span>
                    {selected.pending && pending && (
                      <>
                        <span>·</span>
                        <span>
                          Analyzed {formatTimestamp(pending.timestamp)}
                        </span>
                        {pending.url && (
                          <a
                            href={pending.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] hover:bg-blue-50 hover:text-blue-600">
                            <ExternalLink className="size-3" />
                            Open page
                          </a>
                        )}
                      </>
                    )}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1">
                    {selected.colors.map((color) => (
                      <ColorSwatch
                        key={color.rgb}
                        hex={color.hex}
                        className="h-6 w-6 rounded-md"
                      />
                    ))}
                  </div>
                </div>
                {selected.pending && (
                  <div className="flex flex-col items-end gap-1.5">
                    <button
                      type="button"
                      onClick={handleSave}
                      disabled={!pending?.domain}
                      title={
                        pending?.domain
                          ? `Save as ${pending.domain}`
                          : "Pages without a hostname can't be saved"
                      }
                      className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">
                      <Save className="size-4" />
                      Save palette
                    </button>
                    {pending?.domain && saved[pending.domain] && (
                      <span className="text-[11px] text-slate-400">
                        Replaces the saved {pending.domain} palette
                      </span>
                    )}
                    {saveError && (
                      <span className="text-[11px] text-red-600">
                        {saveError}
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div className="flex w-fit rounded-2xl border border-slate-200/80 bg-white/80 p-1 shadow-sm">
                {VIEWS.map(({ value, label, icon: Icon }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setView(value)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold transition-colors",
                      view === value
                        ? "bg-blue-600 text-white shadow-sm"
                        : "text-slate-600 hover:text-slate-900"
                    )}>
                    <Icon className="size-3.5" />
                    {label}
                  </button>
                ))}
              </div>

              <div className="rounded-3xl border border-slate-200/80 bg-white/80 p-6 shadow-sm">
                {view === "colors" && (
                  <ColorTable
                    colors={selected.colors}
                    tailwindVersion={tailwindVersion}
                    copyFormat={copyFormat}
                    copiedKey={copiedKey}
                    onCopy={copy}
                  />
                )}
                {view === "lint" && <LintPanel colors={selected.colors} />}
                {view === "compare" && (
                  <ComparePanel
                    key={selected.id}
                    palette={selected}
                    others={palettes.filter(
                      (entry) => entry.id !== selected.id
                    )}
                  />
                )}
                {view === "export" && (
                  <ExportPanel
                    colors={selected.colors}
                    source={selected.label}
                    tailwindVersion={tailwindVersion}
                  />
                )}
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  )
}

export default PaletteStudioPage
