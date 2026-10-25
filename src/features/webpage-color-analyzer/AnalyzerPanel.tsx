import { useMemo } from "react"

import { findNearDuplicates } from "~features/palette-studio/lint"
import { TailwindMatchChip } from "~features/tailwind-match/TailwindMatchChip"
import { getReadableTextColor } from "~utils/color-utils"
import type { TailwindVersion } from "~utils/tailwind-match"

import type { AnalyzedColor } from "./index"

interface AnalyzerPanelProps {
  showSavedWebpageColors: boolean
  analyzedColors: AnalyzedColor[]
  selectedAnalyzedColor: AnalyzedColor | null
  isAnalyzing: boolean
  truncatedScan: { scanned: number; total: number } | null
  analysisSource: "css" | "screenshot"
  isSaving: boolean
  saveError: string | null
  savedWebpageColors: Record<string, AnalyzedColor[]>
  showAnalyzeButton?: boolean
  onAnalyze: () => void
  onSelectColor: (color: AnalyzedColor) => void
  onSave: () => void
  onCancel: () => void
  onOpenInStudio: (view?: string) => void
  onOpenSavedInStudio: (domain: string) => void
  onDeleteDomain: (domain: string) => void
  onPickSaved: (color: AnalyzedColor, key: string) => void
  onCopy: (text: string, field: string) => void
  copiedField: string | null
  tailwindVersion: TailwindVersion
}

export const AnalyzerPanel = ({
  showSavedWebpageColors,
  analyzedColors,
  selectedAnalyzedColor,
  isAnalyzing,
  truncatedScan,
  analysisSource,
  isSaving,
  saveError,
  savedWebpageColors,
  showAnalyzeButton = true,
  onAnalyze,
  onSelectColor,
  onSave,
  onCancel,
  onOpenInStudio,
  onOpenSavedInStudio,
  onDeleteDomain,
  onPickSaved,
  onCopy,
  copiedField,
  tailwindVersion
}: AnalyzerPanelProps) => {
  const duplicateGroups = useMemo(
    () => findNearDuplicates(analyzedColors),
    [analyzedColors]
  )

  return (
    <div className="px-3 flex flex-col gap-3">
      {showAnalyzeButton && (
        <button
          onClick={onAnalyze}
          className="w-full px-3 py-1 bg-white border border-gray-400 rounded text-xs cursor-pointer hover:bg-gray-50"
          disabled={isAnalyzing}>
          {isAnalyzing ? "Analyzing..." : "Analyze Webpage Colors"}
        </button>
      )}

      {analyzedColors.length > 0 && (
        <div className="rounded border border-gray-300 bg-white p-2">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-600 mb-1">
            {analysisSource === "screenshot"
              ? "Colors on Screen"
              : "CSS Colors on This Page"}
          </div>
          {duplicateGroups.length > 0 && (
            <button
              type="button"
              onClick={() => onOpenInStudio("lint")}
              className="mb-1 block text-left text-[10px] text-amber-700 underline-offset-2 hover:underline">
              {duplicateGroups.length} near-duplicate color{" "}
              {duplicateGroups.length === 1 ? "group" : "groups"} (ΔE ≤ 2).
              Review in Studio
            </button>
          )}
          {truncatedScan && (
            <div className="mb-1 text-[10px] text-amber-700">
              Large page: checked the first{" "}
              {truncatedScan.scanned.toLocaleString()} of{" "}
              {truncatedScan.total.toLocaleString()} elements.
            </div>
          )}
          <div className="grid grid-cols-10 rounded border border-gray-200 bg-gray-50 p-1">
            {analyzedColors.map((color, index) => {
              const isSelected = selectedAnalyzedColor?.hex === color.hex
              return (
                <button
                  key={`${color.hex}-${index}`}
                  type="button"
                  onClick={() => onSelectColor(color)}
                  title={color.hex}
                  className={`h-6 w-full border ${
                    isSelected ? "border-red-500" : "border-gray-200"
                  }`}
                  style={{ backgroundColor: color.hex }}
                />
              )
            })}
          </div>
          <div className="mt-2 flex gap-2">
            <input
              type="text"
              readOnly
              value={selectedAnalyzedColor?.rgb || ""}
              onClick={() =>
                selectedAnalyzedColor?.rgb &&
                onCopy(selectedAnalyzedColor.rgb, "analyzed-rgb")
              }
              className="flex-1 px-2 py-1 border border-gray-300 font-mono text-[11px] bg-gray-50 cursor-pointer hover:bg-gray-100"
              title="Click to copy RGB value"
            />
            <input
              type="text"
              readOnly
              value={selectedAnalyzedColor?.hex || ""}
              onClick={() =>
                selectedAnalyzedColor?.hex &&
                onCopy(selectedAnalyzedColor.hex, "analyzed-hex")
              }
              className="w-24 px-2 py-1 border border-gray-300 font-mono text-[11px] bg-gray-50 cursor-pointer hover:bg-gray-100"
              title="Click to copy HEX value"
            />
          </div>
          {selectedAnalyzedColor?.properties?.length ? (
            <div className="mt-2 flex flex-wrap items-center gap-1 text-[10px] text-gray-500">
              Used for
              {selectedAnalyzedColor.properties.map((property) => (
                <span
                  key={property}
                  className="rounded bg-gray-100 px-1 py-0.5 font-medium text-gray-700">
                  {property}
                </span>
              ))}
            </div>
          ) : null}
          {selectedAnalyzedColor?.variables?.length ? (
            <div className="mt-2 flex flex-wrap items-center gap-1 text-[10px] text-gray-500">
              Variables
              {selectedAnalyzedColor.variables.map((name) => (
                <button
                  key={name}
                  type="button"
                  title={`Copy var(${name})`}
                  onClick={() => onCopy(`var(${name})`, `variable-${name}`)}
                  className="rounded border border-gray-300 bg-white px-1 py-0.5 font-mono text-gray-700 hover:bg-gray-50">
                  {copiedField === `variable-${name}` ? "Copied" : name}
                </button>
              ))}
            </div>
          ) : null}
          {selectedAnalyzedColor && (
            <div className="mt-2">
              <TailwindMatchChip
                hex={selectedAnalyzedColor.hex}
                version={tailwindVersion}
                copied={copiedField === "analyzed-tailwind"}
                onCopy={(name) => onCopy(name, "analyzed-tailwind")}
              />
            </div>
          )}
          {selectedAnalyzedColor?.coverage !== undefined ? (
            <div className="mt-2 text-[11px] text-gray-500">
              Covers {(selectedAnalyzedColor.coverage * 100).toFixed(1)}% of the
              visible page.
            </div>
          ) : selectedAnalyzedColor?.selectors?.length ? (
            <div className="mt-2 max-h-28 overflow-auto rounded border border-gray-200 bg-gray-50 p-1 flex flex-wrap gap-0.5">
              {selectedAnalyzedColor.selectors.map((selector, idx) => (
                <div
                  key={`${selector}-${idx}`}
                  title={selector}
                  className="rounded border bg-white p-0.5 text-[9px] font-mono text-gray-700 w-fit flex items-center justify-center leading-none">
                  {selector}
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-2 text-[11px] text-gray-500">
              No elements recorded for this color.
            </div>
          )}
          {saveError && (
            <div className="mt-2 text-[11px] text-red-600">{saveError}</div>
          )}
          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => onOpenInStudio()}
              title="Export as code, find near-duplicates and compare in Palette Studio"
              className="mr-auto px-3 py-1 text-[11px] rounded border border-blue-300 text-blue-700 bg-white hover:bg-blue-50">
              Open in Studio
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={isSaving}
              className="px-3 py-1 text-[11px] rounded border border-gray-400 bg-white hover:bg-gray-50 disabled:opacity-60">
              {isSaving ? "Saving..." : "Save"}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="px-3 py-1 text-[11px] rounded border border-gray-400 bg-white hover:bg-gray-50">
              Cancel
            </button>
          </div>
        </div>
      )}

      {showSavedWebpageColors && Object.keys(savedWebpageColors).length > 0 && (
        <div className="rounded border border-gray-300 bg-white p-2">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-600 mb-1">
            Saved Webpage Colors
          </div>
          <div className="space-y-2 max-h-40 overflow-auto">
            {Object.entries(savedWebpageColors).map(([domain, colors]) => (
              <div
                key={domain}
                className="rounded border border-gray-200 bg-gray-50 p-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[11px] font-semibold text-gray-700 truncate">
                    {domain}
                  </div>
                  <button
                    type="button"
                    onClick={() => onOpenSavedInStudio(domain)}
                    className="ml-auto px-2 py-0.5 text-[10px] rounded border border-blue-300 text-blue-700 bg-white hover:bg-blue-50">
                    Studio
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteDomain(domain)}
                    className="px-2 py-0.5 text-[10px] rounded border border-red-300 text-red-600 bg-white hover:bg-red-50">
                    Delete
                  </button>
                </div>
                <div className="mt-2 grid grid-cols-4">
                  {colors.map((color, idx) => (
                    <button
                      key={`${domain}-${color.hex}-${idx}`}
                      type="button"
                      onClick={() => onPickSaved(color, `${domain}-${idx}`)}
                      title={color.hex}
                      className="h-10 border-gray-300 border-[0.5px] flex items-end justify-center"
                      style={{
                        backgroundColor: color.hex,
                        color: getReadableTextColor(color.hex) || "#000"
                      }}>
                      <span className="text-[9px] font-mono font-medium w-full text-center">
                        {color.hex}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
