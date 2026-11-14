import { PanelsTopLeft, Trash2 } from "lucide-react"

import { ColorSwatchButton } from "~features/popup/ColorSwatchButton"
import { ScreenHeader } from "~features/popup/ScreenHeader"

import type { AnalyzedColor } from "./index"

interface SavedPalettesScreenProps {
  palettes: Record<string, AnalyzedColor[]>
  copiedField: string | null
  onPickColor: (color: AnalyzedColor, field: string) => void
  onOpenInStudio: (domain?: string) => void
  onDelete: (domain: string) => void
  onBack: () => void
}

const SWATCHES_SHOWN = 20

export const SavedPalettesScreen = ({
  palettes,
  copiedField,
  onPickColor,
  onOpenInStudio,
  onDelete,
  onBack
}: SavedPalettesScreenProps) => {
  const entries = Object.entries(palettes)

  return (
    <div>
      <ScreenHeader
        title="Saved palettes"
        subtitle="Click a color to copy it"
        onBack={onBack}
        action={
          <button
            type="button"
            onClick={() => onOpenInStudio()}
            className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white">
            <PanelsTopLeft className="size-3.5" />
            Studio
          </button>
        }
      />

      {entries.length === 0 ? (
        <p className="px-6 py-16 text-center text-sm text-slate-500 dark:text-slate-400">
          No saved palettes yet. Run Page colors on a website and save the
          result.
        </p>
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {entries.map(([domain, colors]) => (
            <li key={domain} className="flex flex-col gap-2 px-3 py-3">
              <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium leading-tight">
                    {domain}
                  </span>
                  <span className="block text-xs text-slate-500 dark:text-slate-400">
                    {colors.length} {colors.length === 1 ? "color" : "colors"}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => onOpenInStudio(domain)}
                  title="Open in Palette Studio"
                  className="rounded-lg px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white">
                  Open
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(domain)}
                  aria-label={`Delete ${domain}`}
                  title="Delete"
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/60 dark:hover:text-red-400">
                  <Trash2 className="size-3.5" />
                </button>
              </div>
              <div className="flex flex-wrap gap-1">
                {colors.slice(0, SWATCHES_SHOWN).map((color, index) => {
                  const field = `saved-${domain}-${index}`
                  return (
                    <ColorSwatchButton
                      key={`${color.rgb}-${index}`}
                      hex={color.hex}
                      copied={copiedField === field}
                      onClick={() => onPickColor(color, field)}
                      className="size-6 rounded-md"
                    />
                  )
                })}
                {colors.length > SWATCHES_SHOWN && (
                  <button
                    type="button"
                    onClick={() => onOpenInStudio(domain)}
                    className="flex h-6 items-center rounded-md px-1.5 text-[11px] text-slate-500 ring-1 ring-inset ring-slate-200 hover:text-slate-900 dark:text-slate-400 dark:ring-slate-700 dark:hover:text-white">
                    +{colors.length - SWATCHES_SHOWN}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
