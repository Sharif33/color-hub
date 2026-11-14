import { Check, ClipboardPaste, Copy } from "lucide-react"
import { useState } from "react"

import { cn } from "~lib/cn"
import type { Gradient } from "~utils/gradient"

import { parsePastedGradient } from "./css-color"
import {
  exportGradient,
  GRADIENT_EXPORT_FORMATS,
  type GradientExportFormat
} from "./export"
import { Segmented } from "./ui"

const FORMAT_KEY = "gradient-studio-format"

// The last format used, kept in this browser only
const readFormat = (): GradientExportFormat => {
  try {
    const saved = localStorage.getItem(FORMAT_KEY)
    if (GRADIENT_EXPORT_FORMATS.some((format) => format.value === saved))
      return saved as GradientExportFormat
  } catch {
    // Storage can be blocked
  }
  return "css"
}

/** `background-image` declarations, with the sRGB fallback when needed */
export const gradientDeclarations = (gradient: Gradient): string =>
  exportGradient(gradient, "css").code

interface CssPanelProps {
  gradient: Gradient
  /** The preview's size in px, which pasted lengths are worked out in */
  getPreviewBox: () => { width: number; height: number } | undefined
  onImport: (gradient: Gradient) => void
}

/** The gradient as code for the web and native platforms, and an import */
export const CssPanel = ({
  gradient,
  getPreviewBox,
  onImport
}: CssPanelProps) => {
  const [format, setFormat] = useState<GradientExportFormat>(readFormat)
  const [copied, setCopied] = useState(false)
  const [pasted, setPasted] = useState("")
  const [error, setError] = useState(false)
  const { code, notes } = exportGradient(gradient, format)

  const chooseFormat = (next: GradientExportFormat) => {
    setFormat(next)
    setCopied(false)
    try {
      localStorage.setItem(FORMAT_KEY, next)
    } catch {
      // Storage can be blocked
    }
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch (copyError) {
      console.warn("Clipboard write failed:", copyError)
    }
  }

  const importPasted = () => {
    const next = parsePastedGradient(pasted, getPreviewBox())
    setError(!next)
    if (next) {
      onImport(next)
      setPasted("")
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Segmented<GradientExportFormat>
        label="Code for"
        value={format}
        options={GRADIENT_EXPORT_FORMATS}
        onChange={chooseFormat}
      />
      <div className="relative">
        <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-2xl bg-slate-900 p-4 pr-24 font-mono text-xs leading-relaxed text-slate-100">
          {code}
        </pre>
        <button
          type="button"
          onClick={() => void copy()}
          className={cn(
            "absolute right-3 top-3 flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400",
            copied
              ? "bg-emerald-500/20 text-emerald-200"
              : "bg-white/10 text-slate-100 hover:bg-white/20"
          )}>
          {copied ? (
            <Check className="size-3.5" strokeWidth={3} />
          ) : (
            <Copy className="size-3.5" />
          )}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      {notes.length > 0 && (
        <ul className="-mt-1 flex list-disc flex-col gap-1 pl-4 text-xs text-slate-500">
          {notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      )}

      <form
        className="flex flex-col gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          importPasted()
        }}>
        <label
          htmlFor="import-css"
          className="text-xs font-semibold text-slate-600">
          Edit a gradient from your code
        </label>
        <div className="flex gap-2">
          <input
            id="import-css"
            type="text"
            value={pasted}
            spellCheck={false}
            placeholder="background: linear-gradient(…);"
            aria-invalid={error}
            onChange={(event) => {
              setPasted(event.target.value)
              setError(false)
            }}
            className="h-10 min-w-0 flex-1 rounded-xl border border-slate-200 bg-white/50 px-3 font-mono text-xs text-slate-700 outline-none transition-all placeholder:text-slate-300 hover:border-slate-300 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 aria-[invalid=true]:border-red-400"
          />
          <button
            type="submit"
            disabled={!pasted.trim()}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 shadow-sm hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-50">
            <ClipboardPaste className="size-3.5" />
            Open
          </button>
        </div>
        {error && (
          <p className="text-xs text-red-600">
            No gradient found. Paste a linear-, radial- or conic-gradient().
          </p>
        )}
      </form>
    </div>
  )
}
