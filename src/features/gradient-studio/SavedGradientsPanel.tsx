import { Trash2 } from "lucide-react"
import { useEffect, useRef, useState } from "react"

import { cn } from "~lib/cn"
import type { SavedGradient } from "~lib/saved-gradients"
import { backgroundImageCss } from "~utils/gradient"

import { CHECKERBOARD, iconButton } from "./ui"

interface SavedGradientsPanelProps {
  saved: SavedGradient[]
  /** The saved gradient open in the editor, if any */
  currentId: string | null
  onOpen: (entry: SavedGradient) => void
  onRename: (id: string, name: string) => void
  /** Resolves what was removed, so it can be put back */
  onDelete: (
    id: string
  ) => Promise<{ entry: SavedGradient; index: number } | null>
  onRestore: (removed: { entry: SavedGradient; index: number }) => void
}

// How long Undo stays up after a delete
const UNDO_MS = 6000

const NameField = ({
  name,
  onRename
}: {
  name: string
  onRename: (name: string) => void
}) => {
  const [draft, setDraft] = useState(name)
  useEffect(() => setDraft(name), [name])
  const commit = () => {
    if (draft.trim() && draft.trim() !== name) onRename(draft)
    else setDraft(name)
  }
  return (
    <input
      type="text"
      value={draft}
      aria-label="Name"
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur()
        if (event.key === "Escape") {
          setDraft(name)
          event.currentTarget.blur()
        }
      }}
      className="min-w-0 flex-1 truncate rounded-md bg-transparent px-1 py-0.5 text-xs font-medium text-slate-700 outline-none hover:bg-slate-100 focus:bg-white focus:ring-2 focus:ring-blue-500/30"
    />
  )
}

/** Gradients saved in this browser. Deleting can be undone for a moment */
export const SavedGradientsPanel = ({
  saved,
  currentId,
  onOpen,
  onRename,
  onDelete,
  onRestore
}: SavedGradientsPanelProps) => {
  const [removed, setRemoved] = useState<{
    entry: SavedGradient
    index: number
  } | null>(null)
  const undoTimer = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => () => clearTimeout(undoTimer.current), [])

  const remove = async (id: string) => {
    const result = await onDelete(id)
    if (!result) return
    setRemoved(result)
    clearTimeout(undoTimer.current)
    undoTimer.current = setTimeout(() => setRemoved(null), UNDO_MS)
  }

  return (
    <div className="flex flex-col gap-3">
      {removed && (
        <div
          role="status"
          className="flex items-center justify-between gap-3 rounded-xl bg-slate-900 px-3 py-2 text-xs text-white">
          <span className="truncate">Deleted “{removed.entry.name}”</span>
          <button
            type="button"
            onClick={() => {
              onRestore(removed)
              setRemoved(null)
            }}
            className="shrink-0 rounded-md px-2 py-1 font-semibold text-blue-200 hover:bg-white/10">
            Undo
          </button>
        </div>
      )}
      {saved.length === 0 ? (
        <p className="text-xs text-slate-500">
          Gradients you save show up here, in this browser. They're included in
          backups from Settings.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
          {saved.map((entry) => (
            <div
              key={entry.id}
              className={cn(
                "flex flex-col gap-1.5 rounded-2xl p-1.5",
                entry.id === currentId && "bg-blue-50 ring-1 ring-blue-200"
              )}>
              <button
                type="button"
                title={`Open ${entry.name}`}
                aria-label={`Open ${entry.name}`}
                onClick={() => onOpen(entry)}
                className="relative h-16 overflow-hidden rounded-xl ring-1 ring-black/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
                style={CHECKERBOARD}>
                <span
                  className="absolute inset-0"
                  style={{
                    backgroundImage: backgroundImageCss(entry.gradient)
                  }}
                />
              </button>
              <div className="flex items-center gap-1">
                <NameField
                  name={entry.name}
                  onRename={(name) => onRename(entry.id, name)}
                />
                <button
                  type="button"
                  onClick={() => void remove(entry.id)}
                  title="Delete"
                  aria-label={`Delete ${entry.name}`}
                  className={iconButton}>
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
