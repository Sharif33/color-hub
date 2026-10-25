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
      className="flex w-full items-center gap-1.5 rounded border border-gray-300 bg-white px-2 py-1 text-[11px] hover:bg-gray-50">
      <span
        className="h-3.5 w-3.5 shrink-0 rounded-sm border border-gray-300"
        style={{ backgroundColor: match.hex }}
      />
      <span className="text-gray-500">Tailwind {version}</span>
      <span className="font-mono font-semibold text-gray-800">
        {exact ? "=" : "≈"} {name}
      </span>
      <span className="ml-auto tabular-nums text-gray-500">
        {copied ? "Copied" : `ΔE ${match.deltaE.toFixed(1)}`}
      </span>
    </button>
  )
}
