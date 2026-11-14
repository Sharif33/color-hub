import { Check, ChevronDown, Download } from "lucide-react"
import { useEffect, useRef, useState } from "react"

import { cn } from "~lib/cn"

import {
  exportReport,
  type ReportFormat,
  type ReportInfo,
  type ReportPair
} from "./export"

interface ExportMenuProps {
  pairs: ReportPair[]
  info: ReportInfo
}

const ACTIONS: Array<{
  format: ReportFormat
  label: string
  description: string
  /** File extension to download; copied to the clipboard when missing */
  download?: string
}> = [
  {
    format: "github",
    label: "Copy as GitHub issue",
    description: "Failing pairs as a task list, with the nearest fix"
  },
  {
    format: "markdown",
    label: "Copy as Markdown",
    description: "A table of the pairs shown"
  },
  {
    format: "csv",
    label: "Download CSV",
    description: "For spreadsheets",
    download: "csv"
  },
  {
    format: "json",
    label: "Download JSON",
    description: "For scripts and CI",
    download: "json"
  }
]

export const ExportMenu = ({ pairs, info }: ExportMenuProps) => {
  const [isOpen, setIsOpen] = useState(false)
  const [done, setDone] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return
    const handleClickOutside = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setIsOpen(false)
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false)
    }
    document.addEventListener("mousedown", handleClickOutside)
    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [isOpen])

  const run = async (action: (typeof ACTIONS)[number]) => {
    const output = exportReport(action.format, pairs, info)
    if (action.download) {
      const blob = new Blob([output], {
        type: action.download === "csv" ? "text/csv" : "application/json"
      })
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      let host = "page"
      try {
        host = new URL(info.url).hostname || host
      } catch {
        // Keep the generic name
      }
      link.href = url
      link.download = `${host}-contrast.${action.download}`
      link.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } else {
      try {
        await navigator.clipboard.writeText(output)
      } catch (error) {
        console.warn("Clipboard write failed:", error)
        return
      }
    }
    setDone(action.label)
    setIsOpen(false)
    setTimeout(() => setDone(null), 1500)
  }

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={() => setIsOpen(!isOpen)}
        disabled={pairs.length === 0}
        className="flex items-center gap-2 rounded-xl border border-slate-200/80 bg-white/80 px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm transition-all hover:border-slate-300 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50">
        {done ? (
          <Check className="size-3.5 text-emerald-600" strokeWidth={3} />
        ) : (
          <Download className="size-3.5" />
        )}
        {done ? "Done" : `Export ${pairs.length} pairs`}
        <ChevronDown
          className={cn(
            "size-3.5 text-slate-400 transition-transform",
            isOpen && "rotate-180"
          )}
        />
      </button>
      {isOpen && (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-64 rounded-xl border border-slate-100 bg-white p-1.5 shadow-xl shadow-slate-200/50 ring-1 ring-black/5">
          {ACTIONS.map((action) => (
            <button
              key={action.format}
              type="button"
              role="menuitem"
              onClick={() => void run(action)}
              className="flex w-full flex-col items-start rounded-lg px-3 py-2 text-left hover:bg-slate-50">
              <span className="text-sm font-semibold text-slate-700">
                {action.label}
              </span>
              <span className="text-[11px] text-slate-500">
                {action.description}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
