import { Check } from "lucide-react"

import { ScreenHeader } from "~features/popup/ScreenHeader"
import { cn } from "~lib/cn"

import { VISION_MODES, type VisionMode } from "./index"

interface VisionScreenProps {
  mode: VisionMode | null
  onChange: (mode: VisionMode | null) => void
  onBack: () => void
}

const OPTIONS: Array<{
  value: VisionMode | null
  label: string
  description: string
}> = [
  { value: null, label: "Off", description: "Normal vision" },
  ...VISION_MODES
]

export const VisionScreen = ({ mode, onChange, onBack }: VisionScreenProps) => (
  <div>
    <ScreenHeader
      title="Simulate vision"
      subtitle="Applied to this page"
      onBack={onBack}
    />
    <div role="radiogroup" aria-label="Vision" className="p-2">
      {OPTIONS.map((option) => {
        const selected = mode === option.value
        return (
          <button
            key={option.label}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500",
              selected
                ? "bg-blue-50 dark:bg-blue-950/50"
                : "hover:bg-slate-100 dark:hover:bg-slate-800"
            )}>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium leading-tight">
                {option.label}
              </span>
              <span className="block text-xs text-slate-500 dark:text-slate-400">
                {option.description}
              </span>
            </span>
            {selected && (
              <Check
                className="size-4 text-blue-600 dark:text-blue-400"
                strokeWidth={3}
              />
            )}
          </button>
        )
      })}
    </div>
    <p className="px-5 pb-4 text-xs text-slate-500 dark:text-slate-400">
      The simulation stays on after the popup closes, until you turn it off or
      reload the page.
    </p>
  </div>
)
