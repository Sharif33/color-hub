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
    <div className="flex flex-col gap-3 rounded-2xl border border-blue-200/60 bg-blue-50/50 p-4 shadow-sm">
      <div className="flex items-center gap-2.5">
        <div className="relative flex h-2.5 w-2.5 items-center justify-center">
          <div className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75" />
          <div className="relative inline-flex h-1.5 w-1.5 rounded-full bg-blue-500" />
        </div>
        <p className="text-xs font-bold text-blue-800 uppercase tracking-widest">
          Alpha Blending Active
        </p>
      </div>

      <div className="flex flex-col gap-2.5">
        {fgAlpha < 1 && (
          <div className="flex items-center justify-between text-[13px] font-medium text-blue-700/80">
            <span>
              Foreground{" "}
              <span className="opacity-75">({Math.round(fgAlpha * 100)}%)</span>
            </span>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs">{effectiveForeground}</span>
              <span
                className="h-4 w-4 rounded-md shadow-sm ring-1 ring-blue-200"
                style={{ backgroundColor: effectiveForeground }}
              />
            </div>
          </div>
        )}
        {bgAlpha < 1 && (
          <div className="flex items-center justify-between text-[13px] font-medium text-blue-700/80">
            <span>
              Background{" "}
              <span className="opacity-75">({Math.round(bgAlpha * 100)}%)</span>
            </span>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs">{effectiveBackground}</span>
              <span
                className="h-4 w-4 rounded-md shadow-sm ring-1 ring-blue-200"
                style={{ backgroundColor: effectiveBackground }}
              />
            </div>
          </div>
        )}
      </div>

      <p className="text-[11px] font-medium text-blue-600/60 mt-1 leading-snug">
        Contrast is calculated using the resulting opaque colors on a white
        background.
      </p>
    </div>
  )
}
