import { ColorSwatchButton } from "~features/popup/ColorSwatchButton"
import { ScreenHeader } from "~features/popup/ScreenHeader"
import type { ColorEntry } from "~utils/color-utils"

interface HistoryScreenProps {
  history: ColorEntry[]
  lastPicked: ColorEntry | null
  copiedField: string | null
  onPick: (color: ColorEntry, index: number) => void
  onClearHistory: () => void
  onClearLastPicked: () => void
  onBack: () => void
}

export const HistoryScreen = ({
  history,
  lastPicked,
  copiedField,
  onPick,
  onClearHistory,
  onClearLastPicked,
  onBack
}: HistoryScreenProps) => (
  <div>
    <ScreenHeader
      title="History"
      subtitle="Click a color to copy it"
      onBack={onBack}
      action={
        history.length > 0 && (
          <button
            type="button"
            onClick={onClearHistory}
            className="rounded-lg px-2 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/60">
            Clear history
          </button>
        )
      }
    />

    {lastPicked && (
      <div className="flex items-center gap-2.5 border-b border-slate-100 px-3 py-2.5 dark:border-slate-800">
        <span
          className="size-5 shrink-0 rounded-md ring-1 ring-inset ring-black/10 dark:ring-white/10"
          style={{ backgroundColor: lastPicked.hex }}
        />
        <span className="min-w-0 flex-1 text-xs text-slate-500 dark:text-slate-400">
          <span className="font-mono font-medium text-slate-900 dark:text-slate-100">
            {lastPicked.hex}
          </span>{" "}
          is shown on the toolbar icon
        </span>
        <button
          type="button"
          onClick={onClearLastPicked}
          className="rounded-lg px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white">
          Remove
        </button>
      </div>
    )}

    {history.length === 0 ? (
      <p className="px-6 py-16 text-center text-sm text-slate-500 dark:text-slate-400">
        Colors you pick from the screen, or save while adjusting, show up here.
      </p>
    ) : (
      <div className="grid grid-cols-5 gap-1.5 p-3">
        {history.map((color, index) => (
          <ColorSwatchButton
            key={`${color.hex}-${index}`}
            hex={color.hex}
            label={color.hex.toUpperCase()}
            copied={copiedField === `history-${index}`}
            onClick={() => onPick(color, index)}
            className="h-14 w-full rounded-lg"
          />
        ))}
      </div>
    )}
  </div>
)
