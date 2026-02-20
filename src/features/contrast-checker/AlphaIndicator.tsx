interface AlphaIndicatorProps {
  fgAlpha: number
  bgAlpha: number
  effectiveForeground: string
  effectiveBackground: string
}

export function AlphaIndicator({
  fgAlpha,
  bgAlpha,
  effectiveForeground,
  effectiveBackground
}: AlphaIndicatorProps) {
  const hasAlpha = fgAlpha < 1 || bgAlpha < 1
  if (!hasAlpha) return null

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-blue-100 bg-blue-50/50 p-4">
      <div className="flex items-center gap-2">
        <div className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
        <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">
          Alpha Blending Active
        </p>
      </div>
      
      <div className="flex flex-col gap-2">
        {fgAlpha < 1 && (
          <div className="flex items-center justify-between text-xs text-blue-600/80">
            <span>Foreground ({Math.round(fgAlpha * 100)}%)</span>
            <div className="flex items-center gap-2">
              <span className="font-mono">{effectiveForeground}</span>
              <span
                className="h-3 w-3 rounded-sm ring-1 ring-blue-200"
                style={{ backgroundColor: effectiveForeground }}
              />
            </div>
          </div>
        )}
        {bgAlpha < 1 && (
          <div className="flex items-center justify-between text-xs text-blue-600/80">
            <span>Background ({Math.round(bgAlpha * 100)}%)</span>
            <div className="flex items-center gap-2">
              <span className="font-mono">{effectiveBackground}</span>
              <span
                className="h-3 w-3 rounded-sm ring-1 ring-blue-200"
                style={{ backgroundColor: effectiveBackground }}
              />
            </div>
          </div>
        )}
      </div>
      
      <p className="text-[10px] text-blue-400 mt-1">
        Contrast is calculated using the resulting opaque colors.
      </p>
    </div>
  )
}
