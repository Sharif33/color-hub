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
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider transition-colors duration-300 ${
            largeText
              ? "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200/50"
              : "bg-slate-50 text-slate-500 ring-1 ring-inset ring-slate-200"
          }`}>
          {largeText ? "Large Text" : "Normal Text"}
        </span>
      </div>

      <div className="flex flex-col gap-7">
        {/* Font Size Slider */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-semibold text-slate-700">
              Font Size
            </label>
            <div className="flex items-center gap-1.5 rounded-lg border border-slate-200/80 bg-slate-50 px-2 py-1 shadow-inner">
              <input
                type="number"
                min={12}
                max={64}
                value={fontSize}
                onChange={(e) => onFontSizeChange(Number(e.target.value))}
                className="w-10 bg-transparent text-right font-mono text-sm font-bold text-slate-700 outline-none"
              />
              <span className="text-xs font-medium text-slate-400">px</span>
            </div>
          </div>
          <div className="relative flex items-center h-4">
            <input
              type="range"
              min={12}
              max={64}
              value={fontSize}
              onChange={(event) => onFontSizeChange(Number(event.target.value))}
              className="absolute w-full h-1.5 cursor-pointer appearance-none rounded-full bg-slate-200 outline-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:ring-1 [&::-webkit-slider-thumb]:ring-slate-200 [&::-webkit-slider-thumb]:transition-transform hover:[&::-webkit-slider-thumb]:scale-110 active:[&::-webkit-slider-thumb]:scale-95 [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:shadow-md [&::-moz-range-thumb]:ring-1 [&::-moz-range-thumb]:ring-slate-200 [&::-moz-range-thumb]:transition-transform hover:[&::-moz-range-thumb]:scale-110 active:[&::-moz-range-thumb]:scale-95"
              style={{
                background: `linear-gradient(to right, #3b82f6 ${((fontSize - 12) / (64 - 12)) * 100}%, #e2e8f0 ${((fontSize - 12) / (64 - 12)) * 100}%)`
              }}
            />
          </div>
          <p className="text-[11px] font-medium text-slate-400">
            WCAG Large Text starts at {Math.ceil(threshold)}px ({thresholdPt}pt)
            for {isBold ? "bold" : "regular"} weight
          </p>
        </div>

        {/* Bold Toggle */}
        <div className="flex items-center justify-between rounded-xl border border-slate-200/60 bg-white p-3 shadow-sm transition-colors hover:border-slate-300">
          <span className="text-sm font-semibold text-slate-700">
            Bold Weight
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={isBold}
            onClick={onBoldToggle}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-4 focus:ring-blue-500/20 ${
              isBold ? "bg-blue-500" : "bg-slate-200"
            }`}>
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                isBold ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>
      </div>
    </div>
  )
}
