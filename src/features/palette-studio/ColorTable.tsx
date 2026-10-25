import { useMemo } from "react"

import type { AnalyzedColor } from "~features/webpage-color-analyzer"
import { formatColor, type ColorFormat } from "~utils/color-formats"
import { parseColorWithAlpha } from "~utils/color-utils"
import {
  isExactTailwindMatch,
  nearestTailwindColor,
  type TailwindVersion
} from "~utils/tailwind-match"

import { ColorSwatch } from "./ColorSwatch"

interface ColorTableProps {
  colors: AnalyzedColor[]
  tailwindVersion: TailwindVersion
  copyFormat: ColorFormat
  copiedKey: string | null
  onCopy: (text: string, key: string) => void
}

const CopyButton = ({
  text,
  copyKey,
  copiedKey,
  onCopy,
  title,
  children,
  className = ""
}: {
  text: string
  copyKey: string
  copiedKey: string | null
  onCopy: (text: string, key: string) => void
  title: string
  children: React.ReactNode
  className?: string
}) => (
  <button
    type="button"
    title={title}
    onClick={() => onCopy(text, copyKey)}
    className={`whitespace-nowrap rounded-md px-1.5 py-0.5 text-left font-mono text-xs text-slate-700 hover:bg-slate-100 ${className}`}>
    {copiedKey === copyKey ? (
      <span className="font-sans font-semibold text-emerald-600">Copied</span>
    ) : (
      children
    )}
  </button>
)

export const ColorTable = ({
  colors,
  tailwindVersion,
  copyFormat,
  copiedKey,
  onCopy
}: ColorTableProps) => {
  const rows = useMemo(
    () =>
      colors.map((color) => {
        const match = nearestTailwindColor(color.hex, tailwindVersion)
        const opacity = Math.round(
          (parseColorWithAlpha(color.hex)?.alpha ?? 1) * 100
        )
        return {
          color,
          oklch: formatColor(color.hex, "oklch"),
          copyText: formatColor(color.hex, copyFormat),
          tailwindName: opacity < 100 ? `${match.name}/${opacity}` : match.name,
          tailwindHex: match.hex,
          deltaE: match.deltaE,
          exact: isExactTailwindMatch(match)
        }
      }),
    [colors, tailwindVersion, copyFormat]
  )

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[860px] text-left text-sm">
        <thead>
          <tr className="border-b border-slate-100 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            <th className="py-3 pl-2 pr-3">Color</th>
            <th className="px-3 py-3">OKLCH</th>
            <th className="px-3 py-3 text-right">Uses</th>
            <th className="px-3 py-3">Used for</th>
            <th className="px-3 py-3">CSS variables</th>
            <th className="px-3 py-3">Tailwind {tailwindVersion}</th>
            <th className="py-3 pl-3 pr-2">Elements</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(
            ({
              color,
              oklch,
              copyText,
              tailwindName,
              tailwindHex,
              deltaE,
              exact
            }) => (
              <tr
                key={color.rgb}
                className="border-b border-slate-50 align-middle last:border-0 hover:bg-slate-50/60">
                <td className="py-2 pl-2 pr-3">
                  <div className="flex items-center gap-2">
                    <ColorSwatch
                      hex={color.hex}
                      className="h-8 w-8 rounded-lg"
                    />
                    <CopyButton
                      text={copyText}
                      copyKey={`hex-${color.rgb}`}
                      copiedKey={copiedKey}
                      onCopy={onCopy}
                      title={`Copy ${copyText}`}
                      className="font-semibold">
                      {color.hex}
                    </CopyButton>
                  </div>
                </td>
                <td className="px-3 py-2">
                  <CopyButton
                    text={oklch}
                    copyKey={`oklch-${color.rgb}`}
                    copiedKey={copiedKey}
                    onCopy={onCopy}
                    title="Copy OKLCH">
                    {oklch}
                  </CopyButton>
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-slate-600">
                  {color.coverage !== undefined
                    ? `${(color.coverage * 100).toFixed(1)}%`
                    : color.count}
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1">
                    {(color.properties ?? []).map((property) => (
                      <span
                        key={property}
                        className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-600">
                        {property}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1">
                    {(color.variables ?? []).length === 0 && (
                      <span className="text-xs text-slate-300">—</span>
                    )}
                    {(color.variables ?? []).map((name) => (
                      <CopyButton
                        key={name}
                        text={`var(${name})`}
                        copyKey={`var-${color.rgb}-${name}`}
                        copiedKey={copiedKey}
                        onCopy={onCopy}
                        title={`Copy var(${name})`}
                        className="border border-slate-200 bg-white text-[11px]">
                        {name}
                      </CopyButton>
                    ))}
                  </div>
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1.5">
                    <ColorSwatch
                      hex={tailwindHex}
                      className="h-4 w-4 rounded"
                    />
                    <CopyButton
                      text={tailwindName}
                      copyKey={`tw-${color.rgb}`}
                      copiedKey={copiedKey}
                      onCopy={onCopy}
                      title={`Copy ${tailwindName}`}>
                      {exact ? "=" : "≈"} {tailwindName}
                    </CopyButton>
                    <span className="whitespace-nowrap text-[11px] tabular-nums text-slate-400">
                      ΔE {deltaE.toFixed(1)}
                    </span>
                  </div>
                </td>
                <td className="py-2 pl-3 pr-2">
                  <span
                    title={color.selectors.join("\n")}
                    className="block max-w-[220px] truncate font-mono text-[11px] text-slate-500">
                    {color.selectors.slice(0, 3).join(", ") || "—"}
                  </span>
                </td>
              </tr>
            )
          )}
        </tbody>
      </table>
    </div>
  )
}
