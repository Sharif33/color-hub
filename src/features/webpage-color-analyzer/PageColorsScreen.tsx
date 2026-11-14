import { Loader2, PanelsTopLeft, Save } from "lucide-react"
import { useMemo } from "react"

import { findNearDuplicates } from "~features/palette-studio/lint"
import { ColorSwatchButton } from "~features/popup/ColorSwatchButton"
import { ScreenHeader } from "~features/popup/ScreenHeader"
import { TailwindMatchChip } from "~features/tailwind-match/TailwindMatchChip"
import { formatColor, type ColorFormat } from "~utils/color-formats"
import type { TailwindVersion } from "~utils/tailwind-match"

import type { AnalyzedColor } from "./index"

interface PageColorsScreenProps {
  source: "css" | "screenshot"
  /** Where the palette would be saved, e.g. `example.com` */
  domain: string | null
  colors: AnalyzedColor[]
  selected: AnalyzedColor | null
  isAnalyzing: boolean
  truncatedScan: { scanned: number; total: number } | null
  isSaving: boolean
  saveError: string | null
  copyFormat: ColorFormat
  tailwindVersion: TailwindVersion
  copiedField: string | null
  onCopy: (text: string, field: string) => void
  onSelect: (color: AnalyzedColor) => void
  onSave: () => void
  onOpenInStudio: (view?: string) => void
  onBack: () => void
}

const chip =
  "rounded-md bg-white px-1.5 py-0.5 text-[11px] text-slate-700 ring-1 ring-inset ring-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-700"

export const PageColorsScreen = ({
  source,
  domain,
  colors,
  selected,
  isAnalyzing,
  truncatedScan,
  isSaving,
  saveError,
  copyFormat,
  tailwindVersion,
  copiedField,
  onCopy,
  onSelect,
  onSave,
  onOpenInStudio,
  onBack
}: PageColorsScreenProps) => {
  const duplicateGroups = useMemo(() => findNearDuplicates(colors), [colors])
  const title = source === "screenshot" ? "Screenshot colors" : "Page colors"
  const copied = (field: string) => copiedField === field

  return (
    <div className="flex min-h-[480px] flex-col">
      <ScreenHeader
        title={title}
        subtitle={domain ?? "This page"}
        onBack={onBack}
      />

      {isAnalyzing ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-sm text-slate-500 dark:text-slate-400">
          <Loader2 className="size-5 animate-spin" />
          {source === "screenshot"
            ? "Capturing the screen…"
            : "Reading the page's colors…"}
        </div>
      ) : colors.length === 0 ? (
        <p className="flex flex-1 items-center justify-center px-6 text-center text-sm text-slate-500 dark:text-slate-400">
          No colors found. The page may still be loading; go back and try again.
        </p>
      ) : (
        <div className="flex flex-1 flex-col gap-3 p-3">
          {truncatedScan && (
            <p className="rounded-lg bg-amber-50 px-2.5 py-2 text-xs text-amber-800 dark:bg-amber-950/60 dark:text-amber-200">
              This page is very large, so only the first{" "}
              {truncatedScan.scanned.toLocaleString()} of{" "}
              {truncatedScan.total.toLocaleString()} elements were checked.
            </p>
          )}

          <div className="grid grid-cols-8 gap-1.5">
            {colors.map((color) => (
              <ColorSwatchButton
                key={color.rgb}
                hex={color.hex}
                selected={selected?.rgb === color.rgb}
                onClick={() => onSelect(color)}
                className="aspect-square w-full rounded-md"
              />
            ))}
          </div>

          {duplicateGroups.length > 0 && (
            <button
              type="button"
              onClick={() => onOpenInStudio("lint")}
              className="text-left text-xs text-slate-600 underline decoration-slate-300 underline-offset-2 hover:text-slate-900 dark:text-slate-300 dark:decoration-slate-600 dark:hover:text-white">
              {duplicateGroups.length} near-duplicate{" "}
              {duplicateGroups.length === 1 ? "group" : "groups"} could be one
              color each. Review them in Studio.
            </button>
          )}

          {selected && (
            <div className="flex flex-col gap-2.5 rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
              <div className="flex items-center gap-3">
                <ColorSwatchButton
                  hex={selected.hex}
                  copied={copied("selected-default")}
                  onClick={() =>
                    onCopy(
                      formatColor(selected.hex, copyFormat),
                      "selected-default"
                    )
                  }
                  className="size-11 rounded-lg"
                />
                <div className="min-w-0">
                  <button
                    type="button"
                    title="Copy HEX"
                    onClick={() => onCopy(selected.hex, "selected-hex")}
                    className="block font-mono text-base font-semibold leading-tight hover:underline">
                    {copied("selected-hex") ? "Copied" : selected.hex}
                  </button>
                  <button
                    type="button"
                    title="Copy RGB"
                    onClick={() => onCopy(selected.rgb, "selected-rgb")}
                    className="block font-mono text-xs text-slate-500 hover:underline dark:text-slate-400">
                    {copied("selected-rgb") ? "Copied" : selected.rgb}
                  </button>
                </div>
                <span className="ml-auto shrink-0 text-xs text-slate-500 dark:text-slate-400">
                  {selected.coverage !== undefined
                    ? `${(selected.coverage * 100).toFixed(1)}% of screen`
                    : `${selected.count} ${selected.count === 1 ? "use" : "uses"}`}
                </span>
              </div>

              <TailwindMatchChip
                hex={selected.hex}
                version={tailwindVersion}
                copied={copied("selected-tailwind")}
                onCopy={(name) => onCopy(name, "selected-tailwind")}
              />

              {selected.properties?.length ? (
                <div className="flex flex-wrap items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                  <span className="mr-0.5">Used for</span>
                  {selected.properties.map((property) => (
                    <span key={property} className={chip}>
                      {property}
                    </span>
                  ))}
                </div>
              ) : null}

              {selected.variables?.length ? (
                <div className="flex flex-wrap items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                  <span className="mr-0.5">Variables</span>
                  {selected.variables.map((name) => (
                    <button
                      key={name}
                      type="button"
                      title={`Copy var(${name})`}
                      onClick={() => onCopy(`var(${name})`, `variable-${name}`)}
                      className={`${chip} font-mono hover:ring-slate-400`}>
                      {copied(`variable-${name}`) ? "Copied" : name}
                    </button>
                  ))}
                </div>
              ) : null}

              {selected.selectors.length > 0 && (
                <details className="group text-xs text-slate-500 dark:text-slate-400">
                  <summary className="cursor-pointer select-none hover:text-slate-900 dark:hover:text-white">
                    Elements ({selected.selectors.length})
                  </summary>
                  <div className="mt-1.5 flex max-h-24 flex-wrap gap-1 overflow-auto">
                    {selected.selectors.map((selector) => (
                      <span
                        key={selector}
                        title={selector}
                        className={`${chip} max-w-full truncate font-mono`}>
                        {selector}
                      </span>
                    ))}
                  </div>
                </details>
              )}
            </div>
          )}
        </div>
      )}

      {!isAnalyzing && colors.length > 0 && (
        <footer className="sticky bottom-0 flex flex-col gap-1.5 border-t border-slate-200 bg-white/95 p-3 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
          {saveError && (
            <p className="text-xs text-red-600 dark:text-red-400">
              {saveError}
            </p>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onOpenInStudio()}
              title="Export as code, find near-duplicates and compare"
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 dark:border-slate-700 dark:hover:bg-slate-800">
              <PanelsTopLeft className="size-4" />
              Open in Studio
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={isSaving || !domain}
              title={
                domain
                  ? `Save as ${domain}`
                  : "Pages without a hostname can't be saved"
              }
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white">
              <Save className="size-4" />
              {isSaving ? "Saving…" : "Save palette"}
            </button>
          </div>
        </footer>
      )}
    </div>
  )
}
