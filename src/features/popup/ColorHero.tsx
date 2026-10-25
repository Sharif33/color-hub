import { Check, Copy } from "lucide-react"
import { useMemo } from "react"

import { cn } from "~lib/cn"
import {
  formatColor,
  getColorFormatLabel,
  type ColorFormat
} from "~utils/color-formats"
import { getReadableTextColor } from "~utils/color-utils"
import {
  isExactTailwindMatch,
  nearestTailwindColor,
  type TailwindVersion
} from "~utils/tailwind-match"

interface ColorHeroProps {
  /** The current color, or null before any color was picked or chosen */
  hex: string | null
  copyFormat: ColorFormat
  tailwindVersion: TailwindVersion
  copiedField: string | null
  onCopy: (text: string, field: string) => void
}

// Hairlines at both edges keep the band visible when its color is the same
// as the popup's background (white in light mode, slate-900 in dark)
const EDGES =
  "shadow-[inset_0_1px_0_rgb(15_23_42/0.1),inset_0_-1px_0_rgb(15_23_42/0.1)] dark:shadow-[inset_0_1px_0_rgb(255_255_255/0.12),inset_0_-1px_0_rgb(255_255_255/0.12)]"

/**
 * The current color as a full-width band: the popup's one bold element.
 * Each value on it copies itself; the button copies the default format.
 */
export const ColorHero = ({
  hex,
  copyFormat,
  tailwindVersion,
  copiedField,
  onCopy
}: ColorHeroProps) => {
  const match = useMemo(
    () => (hex ? nearestTailwindColor(hex, tailwindVersion) : null),
    [hex, tailwindVersion]
  )

  // Nothing to show until a color is picked, chosen or adjusted
  if (!hex || !match) return null

  const textColor = getReadableTextColor(hex)
  const onDark = textColor !== "#0f172a"
  // The hex is already the headline, so OKLCH goes under it in that case
  const secondFormat: ColorFormat = copyFormat === "hex" ? "oklch" : copyFormat
  const secondValue = formatColor(hex.toUpperCase(), secondFormat)

  const valueButton = cn(
    "block max-w-full truncate rounded px-1 -mx-1 text-left focus-visible:outline focus-visible:outline-2",
    onDark
      ? "hover:bg-white/15 focus-visible:outline-white"
      : "hover:bg-black/10 focus-visible:outline-slate-900"
  )
  const copied = (field: string) => copiedField === field

  return (
    <section
      aria-label="Current color"
      className={cn("px-4 pb-4 pt-3.5", EDGES)}
      style={{ backgroundColor: hex, color: textColor }}>
      <div className="flex items-start justify-between gap-3">
        <button
          type="button"
          title="Copy HEX"
          onClick={() => onCopy(hex.toUpperCase(), "hero-hex")}
          className={cn(
            valueButton,
            "font-mono text-[28px] font-semibold leading-tight tracking-tight"
          )}>
          {copied("hero-hex") ? "Copied" : hex.toUpperCase()}
        </button>
        <button
          type="button"
          onClick={() =>
            onCopy(formatColor(hex.toUpperCase(), copyFormat), "hero-default")
          }
          className={cn(
            "mt-1 flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold focus-visible:outline focus-visible:outline-2",
            onDark
              ? "bg-white/15 hover:bg-white/25 focus-visible:outline-white"
              : "bg-black/10 hover:bg-black/15 focus-visible:outline-slate-900"
          )}>
          {copied("hero-default") ? (
            <Check className="size-3.5" strokeWidth={3} />
          ) : (
            <Copy className="size-3.5" />
          )}
          {copied("hero-default")
            ? "Copied"
            : `Copy ${getColorFormatLabel(copyFormat)}`}
        </button>
      </div>
      <button
        type="button"
        title={`Copy ${getColorFormatLabel(secondFormat)}`}
        onClick={() => onCopy(secondValue, "hero-second")}
        className={cn(valueButton, "mt-1 font-mono text-xs opacity-80")}>
        {copied("hero-second") ? "Copied" : secondValue}
      </button>
      <button
        type="button"
        title={`Copy the Tailwind ${tailwindVersion} name`}
        onClick={() => onCopy(match.name, "hero-tailwind")}
        className={cn(valueButton, "mt-0.5 text-xs opacity-80")}>
        {copied("hero-tailwind")
          ? "Copied"
          : `${isExactTailwindMatch(match) ? "=" : "≈"} ${match.name} in Tailwind ${tailwindVersion} (ΔE ${match.deltaE.toFixed(1)})`}
      </button>
    </section>
  )
}
