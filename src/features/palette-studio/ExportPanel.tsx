import { Check, Copy, Download } from "lucide-react"
import { useMemo, useState } from "react"

import type { AnalyzedColor } from "~features/webpage-color-analyzer"
import { cn } from "~lib/cn"
import type { TailwindVersion } from "~utils/tailwind-match"

import {
  EXPORT_FORMATS,
  EXPORT_VALUE_FORMATS,
  exportPalette,
  nameColors,
  type ExportFormat,
  type ExportValueFormat
} from "./export"

interface ExportPanelProps {
  colors: AnalyzedColor[]
  /** Where the palette came from, e.g. its domain */
  source: string
  tailwindVersion: TailwindVersion
}

export const ExportPanel = ({
  colors,
  source,
  tailwindVersion
}: ExportPanelProps) => {
  const [format, setFormat] = useState<ExportFormat>("css")
  const [valueFormat, setValueFormat] = useState<ExportValueFormat>("hex")
  const [copied, setCopied] = useState(false)

  const named = useMemo(
    () => nameColors(colors, tailwindVersion),
    [colors, tailwindVersion]
  )
  const output = useMemo(
    () => exportPalette(named, { format, valueFormat, source }),
    [named, format, valueFormat, source]
  )
  const nameSources = useMemo(
    () => ({
      variable: named.filter((n) => n.source === "variable").length,
      tailwind: named.filter((n) => n.source === "tailwind").length,
      index: named.filter((n) => n.source === "index").length
    }),
    [named]
  )
  const extension =
    EXPORT_FORMATS.find((entry) => entry.value === format)?.extension ?? "txt"

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(output)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch (error) {
      console.warn("Clipboard write failed:", error)
    }
  }

  const handleDownload = () => {
    const blob = new Blob([output], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `${source.replace(/[^a-z0-9.-]+/gi, "-")}-palette.${extension}`
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return (
    <div className="grid gap-6 lg:grid-cols-12">
      <div className="flex flex-col gap-5 lg:col-span-4">
        <div className="flex flex-col gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Format
          </p>
          {EXPORT_FORMATS.map((entry) => (
            <button
              key={entry.value}
              type="button"
              onClick={() => setFormat(entry.value)}
              className={cn(
                "flex flex-col items-start rounded-2xl border px-4 py-2.5 text-left transition-colors",
                format === entry.value
                  ? "border-blue-300 bg-blue-50/60 ring-1 ring-blue-200"
                  : "border-slate-200 bg-white hover:border-slate-300"
              )}>
              <span className="text-sm font-semibold text-slate-700">
                {entry.label}
              </span>
              <span className="text-xs text-slate-500">
                {entry.description}
              </span>
            </button>
          ))}
        </div>

        {format !== "dtcg" && (
          <div className="flex flex-col gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Values as
            </p>
            <div className="flex rounded-xl border border-slate-200 bg-white p-1">
              {EXPORT_VALUE_FORMATS.map((entry) => (
                <button
                  key={entry.value}
                  type="button"
                  onClick={() => setValueFormat(entry.value)}
                  className={cn(
                    "flex-1 rounded-lg px-2 py-1.5 text-xs font-semibold transition-colors",
                    valueFormat === entry.value
                      ? "bg-slate-800 text-white"
                      : "text-slate-500 hover:text-slate-800"
                  )}>
                  {entry.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <p className="text-xs leading-relaxed text-slate-500">
          Names come from the page's CSS variables ({nameSources.variable}), the
          Tailwind {tailwindVersion} color within ΔE 2 ({nameSources.tailwind}),
          or <code>palette-N</code> ({nameSources.index}).
        </p>
      </div>

      <div className="flex min-w-0 flex-col gap-3 lg:col-span-8">
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:border-slate-300">
            {copied ? (
              <Check className="size-3.5 text-emerald-600" strokeWidth={3} />
            ) : (
              <Copy className="size-3.5" />
            )}
            {copied ? "Copied" : "Copy"}
          </button>
          <button
            type="button"
            onClick={handleDownload}
            className="flex items-center gap-1.5 rounded-xl bg-slate-800 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-slate-700">
            <Download className="size-3.5" />
            Download .{extension}
          </button>
        </div>
        <pre className="max-h-[560px] overflow-auto rounded-2xl bg-slate-900 p-5 font-mono text-xs leading-relaxed text-slate-100">
          {output}
        </pre>
      </div>
    </div>
  )
}
