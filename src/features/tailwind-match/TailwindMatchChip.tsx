import { useMemo } from "react"

import { parseColorWithAlpha } from "~utils/color-utils"
import {
  isExactTailwindMatch,
  nearestTailwindColor,
  type TailwindVersion
} from "~utils/tailwind-match"

interface TailwindMatchChipProps {
  hex: string
  version: TailwindVersion
  copied: boolean
  /** Copies the class color name, e.g. `blue-500` */
  onCopy: (name: string) => void
}

export const TailwindMatchChip = ({
  hex,
  version,
  copied,
  onCopy
}: TailwindMatchChipProps) => {
  const match = useMemo(
    () => nearestTailwindColor(hex, version),
    [hex, version]
  )
  const exact = isExactTailwindMatch(match)
  // A translucent color is the palette color with an opacity modifier
  const opacity = Math.round((parseColorWithAlpha(hex)?.alpha ?? 1) * 100)
  const name = opacity < 100 ? `${match.name}/${opacity}` : match.name

  return (
    <button
      type="button"
      onClick={() => onCopy(name)}
      title={`Nearest Tailwind ${version} color: ${name} (${match.hex}). Click to copy the name`}
      className="flex w-full items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800">
      <span
        className="h-3.5 w-3.5 shrink-0 rounded-sm ring-1 ring-inset ring-black/10 dark:ring-white/10"
        style={{ backgroundColor: match.hex }}
      />
      <span className="text-slate-500 dark:text-slate-400">
        Tailwind {version}
      </span>
      <span className="font-mono font-semibold">
        {exact ? "=" : "≈"} {name}
      </span>
      <span className="ml-auto tabular-nums text-slate-500 dark:text-slate-400">
        {copied ? "Copied" : `ΔE ${match.deltaE.toFixed(1)}`}
      </span>
    </button>
  )
}
