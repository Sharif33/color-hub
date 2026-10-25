import { Download, Upload } from "lucide-react"
import { useRef, useState } from "react"

import {
  applyBackup,
  createBackup,
  parseBackup,
  type Backup,
  type BackupSummary
} from "~lib/backup"
import { cn } from "~lib/cn"

type ImportMode = "merge" | "replace"

const describe = (summary: BackupSummary) =>
  [
    `${summary.historyColors} history ${summary.historyColors === 1 ? "color" : "colors"}`,
    `${summary.palettes} ${summary.palettes === 1 ? "palette" : "palettes"}`,
    `${summary.savedPairs} saved ${summary.savedPairs === 1 ? "pair" : "pairs"}`,
    ...(summary.settings ? ["settings"] : [])
  ].join(" · ")

const MODES: Array<{ value: ImportMode; label: string; description: string }> =
  [
    {
      value: "merge",
      label: "Merge",
      description:
        "Add to your current data. A palette for a site you already saved replaces yours. Your settings stay."
    },
    {
      value: "replace",
      label: "Replace",
      description:
        "Delete your current history, palettes, saved pairs and settings, then restore the backup."
    }
  ]

export const BackupPanel = () => {
  const [pending, setPending] = useState<{
    backup: Backup
    summary: BackupSummary
    fileName: string
  } | null>(null)
  const [mode, setMode] = useState<ImportMode>("merge")
  const [message, setMessage] = useState<{
    tone: "error" | "success"
    text: string
  } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleExport = async () => {
    const backup = await createBackup()
    const blob = new Blob([JSON.stringify(backup, null, 2)], {
      type: "application/json"
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `color-hub-backup-${backup.exportedAt.slice(0, 10)}.json`
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    setMessage({ tone: "success", text: "Backup downloaded." })
  }

  const handleFile = async (file: File | undefined) => {
    setMessage(null)
    setPending(null)
    if (!file) return
    const result = parseBackup(await file.text())
    if ("error" in result) {
      setMessage({ tone: "error", text: result.error })
    } else {
      setMode("merge")
      setPending({ ...result, fileName: file.name })
    }
  }

  const handleImport = async () => {
    if (!pending) return
    try {
      await applyBackup(pending.backup, mode)
      setMessage({
        tone: "success",
        text: `${mode === "merge" ? "Merged" : "Restored"} ${describe(pending.summary)}.`
      })
    } catch (error) {
      console.warn("Restoring the backup failed:", error)
      setMessage({ tone: "error", text: "Couldn't restore the backup." })
    }
    setPending(null)
    if (inputRef.current) inputRef.current.value = ""
  }

  const cancel = () => {
    setPending(null)
    if (inputRef.current) inputRef.current.value = ""
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void handleExport()}
          className="flex items-center gap-2 rounded-xl bg-slate-800 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-700">
          <Download className="size-4" />
          Export backup
        </button>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:border-slate-300">
          <Upload className="size-4" />
          Import backup…
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="application/json,.json"
          aria-label="Backup file"
          className="hidden"
          onChange={(e) => void handleFile(e.target.files?.[0])}
        />
      </div>

      {pending && (
        <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
          <div>
            <p className="text-sm font-semibold text-slate-700">
              {pending.fileName}
            </p>
            <p className="text-xs text-slate-500">
              {describe(pending.summary)}
              {pending.backup.exportedAt &&
                ` · exported ${new Date(pending.backup.exportedAt).toLocaleString()}`}
            </p>
          </div>
          <div role="radiogroup" className="grid gap-2 sm:grid-cols-2">
            {MODES.map((option) => (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={mode === option.value}
                onClick={() => setMode(option.value)}
                className={cn(
                  "flex flex-col items-start gap-1 rounded-xl border px-3 py-2 text-left",
                  mode === option.value
                    ? option.value === "replace"
                      ? "border-red-300 bg-red-50/60 ring-1 ring-red-200"
                      : "border-blue-300 bg-blue-50/60 ring-1 ring-blue-200"
                    : "border-slate-200 bg-white hover:border-slate-300"
                )}>
                <span className="text-sm font-semibold text-slate-700">
                  {option.label}
                </span>
                <span className="text-xs text-slate-500">
                  {option.description}
                </span>
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void handleImport()}
              className={cn(
                "rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-sm",
                mode === "replace"
                  ? "bg-red-600 hover:bg-red-700"
                  : "bg-blue-600 hover:bg-blue-700"
              )}>
              {mode === "replace" ? "Replace my data" : "Merge backup"}
            </button>
            <button
              type="button"
              onClick={cancel}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 hover:border-slate-300">
              Cancel
            </button>
          </div>
        </div>
      )}

      {message && (
        <p
          role="status"
          className={cn(
            "text-sm",
            message.tone === "error" ? "text-red-600" : "text-emerald-700"
          )}>
          {message.text}
        </p>
      )}
    </div>
  )
}
