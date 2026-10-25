import { Check } from "lucide-react"

import { cn } from "~lib/cn"
import { getReadableTextColor } from "~utils/color-utils"

// Translucent colors are shown over a checkerboard, so their alpha is visible
const CHECKERBOARD = {
  backgroundImage: "repeating-conic-gradient(#cbd5e1 0% 25%, #ffffff 0% 50%)",
  backgroundSize: "8px 8px"
}

interface ColorSwatchButtonProps {
  hex: string
  onClick: () => void
  copied?: boolean
  selected?: boolean
  /** Shown on the swatch, e.g. its hex */
  label?: string
  className?: string
}

export const ColorSwatchButton = ({
  hex,
  onClick,
  copied = false,
  selected = false,
  label,
  className
}: ColorSwatchButtonProps) => (
  <button
    type="button"
    title={hex}
    aria-label={label ? undefined : hex}
    aria-pressed={selected || undefined}
    onClick={onClick}
    className={cn(
      "relative shrink-0 overflow-hidden focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-500",
      selected &&
        "outline outline-2 outline-offset-1 outline-slate-900 dark:outline-white",
      className
    )}
    style={CHECKERBOARD}>
    <span
      // The ring is drawn on this layer: on the button it would sit under it
      className="absolute inset-0 flex items-end justify-center rounded-[inherit] ring-1 ring-inset ring-black/10 dark:ring-white/25"
      style={{ backgroundColor: hex, color: getReadableTextColor(hex) }}>
      {copied ? (
        <Check className="m-auto size-3.5" strokeWidth={3} />
      ) : label ? (
        <span className="pb-1 font-mono text-[10px] font-medium">{label}</span>
      ) : null}
    </span>
  </button>
)
