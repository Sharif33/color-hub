interface TypographyControlsProps {
  fontSize: number
  isBold: boolean
  onFontSizeChange: (size: number) => void
  onBoldToggle: () => void
  largeText: boolean
}

const LARGE_TEXT_THRESHOLD = 24
const LARGE_TEXT_BOLD_THRESHOLD = 18.66

export function TypographyControls({
  fontSize,
  isBold,
  onFontSizeChange,
  onBoldToggle,
  largeText
}: TypographyControlsProps) {
  const threshold = isBold ? LARGE_TEXT_BOLD_THRESHOLD : LARGE_TEXT_THRESHOLD
  const thresholdPt = isBold ? 14 : 18

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold text-slate-900">
        Typography Controls
      </h2>
      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-2 text-sm text-slate-700">
          <span className="flex items-center justify-between gap-2 mb-1">
            Font size ({fontSize}px)
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                largeText
                  ? "bg-blue-50 text-blue-700"
                  : "bg-slate-100 text-slate-600"
              }`}>
              {largeText ? "Large text" : "Normal text"}
            </span>
          </span>
          <input
            type="range"
            min={8}
            max={64}
            value={fontSize}
            onChange={(event) => onFontSizeChange(Number(event.target.value))}
            className="h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-300"
          />
          <span className="text-[11px] text-slate-400">
            WCAG large text: {isBold ? "bold" : "regular"} ≥{" "}
            {Math.ceil(threshold)}px ({thresholdPt}pt)
          </span>
        </label>
        <label className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          Bold text
          <button
            type="button"
            onClick={onBoldToggle}
            className={`rounded-full px-4 py-1 text-xs font-semibold transition ${
              isBold ? "bg-slate-900 text-white" : "bg-slate-200 text-slate-700"
            }`}>
            {isBold ? "On" : "Off"}
          </button>
        </label>
      </div>
    </div>
  )
}
