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
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400">
          Typography
        </h2>
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider ${
            largeText
              ? "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200"
              : "bg-slate-50 text-slate-600 ring-1 ring-inset ring-slate-200"
          }`}>
          {largeText ? "Large Text Mode" : "Normal Text Mode"}
        </span>
      </div>

      <div className="flex flex-col gap-6">
        {/* Font Size Slider */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <label className="text-sm font-bold text-slate-600">
              Font Size
            </label>
            <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 ring-1 ring-blue-200/50 px-2 py-1 rounded-md">
              {fontSize}px
            </span>
          </div>
          <input
            type="range"
            min={12}
            max={64}
            value={fontSize}
            onChange={(event) => onFontSizeChange(Number(event.target.value))}
            className="h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-blue-600 hover:accent-blue-700 focus:outline-none"
          />
          <p className="text-[11px] font-medium text-slate-400">
            WCAG Large Text starts at {Math.ceil(threshold)}px ({thresholdPt}pt)
            for {isBold ? "bold" : "regular"} weight
          </p>
        </div>

        {/* Bold Toggle */}
        <div className="flex items-center justify-between rounded-2xl border border-slate-200/60 bg-slate-50/50 p-4 transition-colors hover:bg-slate-50">
          <span className="text-sm font-bold text-slate-600">Bold Weight</span>
          <button
            type="button"
            onClick={onBoldToggle}
            className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 shadow-inner ${
              isBold ? "bg-blue-600" : "bg-slate-300"
            }`}>
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${
                isBold ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>
      </div>
    </div>
  )
}
