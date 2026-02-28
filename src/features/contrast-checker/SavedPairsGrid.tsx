import { Trash2 } from "lucide-react"

import type { SavedPair } from "~hooks/use-saved-pairs"
import { getContrastRatio } from "~utils/color-utils"

interface SavedPairsGridProps {
  pairs: SavedPair[]
  onSelect: (foreground: string, background: string) => void
  onRemove: (id: string) => void
}

export function SavedPairsGrid({
  pairs,
  onSelect,
  onRemove
}: SavedPairsGridProps) {
  if (pairs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 py-12 px-4 text-center">
        <div className="rounded-full bg-white p-3 shadow-sm ring-1 ring-slate-100">
          <div className="h-6 w-6 rounded-full bg-slate-100" />
        </div>
        <div className="flex flex-col gap-1">
          <p className="text-sm font-semibold text-slate-700">
            No saved pairs yet
          </p>
          <p className="text-xs text-slate-500 max-w-[200px] mx-auto">
            Save your favorite combinations to access them quickly later.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="grid gap-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
      {pairs.map((pair) => {
        const ratio = getContrastRatio(pair.foreground, pair.background)
        return (
          <div
            key={pair.id}
            role="button"
            tabIndex={0}
            onClick={() => onSelect(pair.foreground, pair.background)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault()
                onSelect(pair.foreground, pair.background)
              }
            }}
            className="group relative flex items-center gap-4 rounded-2xl border border-slate-100 bg-white p-3 transition-all hover:border-blue-200 hover:shadow-md active:scale-[0.98] cursor-pointer">
            <div className="flex h-12 w-12 shrink-0 overflow-hidden rounded-xl shadow-inner ring-1 ring-black/5">
              <div
                className="h-full w-1/2"
                style={{ backgroundColor: pair.foreground }}
              />
              <div
                className="h-full w-1/2"
                style={{ backgroundColor: pair.background }}
              />
            </div>

            <div className="flex flex-col min-w-0 flex-1 gap-0.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold text-slate-700">
                  {pair.foreground}
                </span>
                <span className="text-[10px] font-medium text-slate-400">
                  on
                </span>
                <span className="text-xs font-mono font-bold text-slate-700">
                  {pair.background}
                </span>
              </div>
              <span className="text-[11px] font-medium text-slate-500">
                Ratio: {ratio.toFixed(2)}:1
              </span>
            </div>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onRemove(pair.id)
              }}
              className="opacity-0 group-hover:opacity-100 absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-500 transition-all focus:opacity-100"
              title="Remove pair">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
