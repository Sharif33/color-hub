import { Heart, MoreHorizontal, Share2, Star } from "lucide-react"

interface ColorPreviewProps {
  background: string
  foreground: string
  previewMetaColor: string
  fontSize: number
  isBold: boolean
  ratio: number
  largeText: boolean
}

export function ColorPreview({
  background,
  foreground,
  previewMetaColor,
  fontSize,
  isBold,
  ratio,
  largeText
}: ColorPreviewProps) {
  return (
    <div className="flex flex-col overflow-hidden rounded-3xl border border-slate-200/60 bg-white shadow-sm transition-all duration-200 hover:shadow-md">
      <div className="border-b border-slate-100 bg-slate-50/80 px-6 py-4 flex items-center justify-between">
        <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400">
          Live Preview
        </h3>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-slate-200/50 px-3 py-1 text-xs font-mono font-medium text-slate-600">
            {ratio.toFixed(2)}:1
          </span>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500">
            {largeText ? "Large Text" : "Normal Text"}
          </span>
        </div>
      </div>

      <div
        className="flex flex-col gap-8 p-8 transition-colors duration-200 min-h-[400px]"
        style={{ backgroundColor: background }}>
        {/* Typography Sample */}
        <div className="flex flex-col justify-center flex-1">
          <p
            className="leading-tight tracking-wide transition-all duration-200"
            style={{
              color: foreground,
              fontSize: `${fontSize}px`,
              fontWeight: isBold ? 700 : 400
            }}>
            The quick brown fox jumps over the lazy dog.
          </p>
        </div>

        {/* UI Component Samples */}
        <div className="flex flex-wrap gap-6 mt-auto">
          {/* Card Component */}
          <div
            className="rounded-2xl border p-5 shadow-sm min-w-[240px] flex-1 transition-transform hover:-translate-y-1"
            style={{
              borderColor: foreground,
              backgroundColor: background,
              opacity: 0.95
            }}>
            <div className="flex items-start justify-between mb-4">
              <div className="flex gap-3 items-center">
                <div
                  className="h-10 w-10 rounded-full flex items-center justify-center shadow-sm"
                  style={{ backgroundColor: foreground, color: background }}>
                  <Star className="h-5 w-5" fill="currentColor" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <div
                    className="h-2.5 w-20 rounded-full opacity-60"
                    style={{ backgroundColor: foreground }}
                  />
                  <div
                    className="h-2 w-12 rounded-full opacity-40"
                    style={{ backgroundColor: foreground }}
                  />
                </div>
              </div>
              <MoreHorizontal
                className="h-5 w-5 opacity-40 cursor-pointer hover:opacity-80 transition-opacity"
                style={{ color: foreground }}
              />
            </div>
            <div className="space-y-2.5">
              <div
                className="h-2 w-full rounded-full opacity-30"
                style={{ backgroundColor: foreground }}
              />
              <div
                className="h-2 w-5/6 rounded-full opacity-30"
                style={{ backgroundColor: foreground }}
              />
              <div
                className="h-2 w-4/6 rounded-full opacity-30"
                style={{ backgroundColor: foreground }}
              />
            </div>
          </div>

          {/* Button Components */}
          <div className="flex flex-col justify-center gap-3 min-w-[200px] flex-1">
            <button
              type="button"
              className="flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3.5 text-sm font-bold shadow-sm transition-all hover:opacity-90 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0"
              style={{ backgroundColor: foreground, color: background }}>
              <Heart className="h-4 w-4" fill="currentColor" />
              Primary Action
            </button>

            <button
              type="button"
              className="flex w-full items-center justify-center gap-2 rounded-xl border-2 px-5 py-3.5 text-sm font-bold shadow-sm transition-all hover:bg-black/5 hover:-translate-y-0.5 active:translate-y-0"
              style={{ borderColor: foreground, color: foreground }}>
              <Share2 className="h-4 w-4" />
              Secondary Action
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
