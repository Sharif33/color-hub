import { Star } from "lucide-react"

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
  isBold
}: ColorPreviewProps) {
  return (
    <div
      className="flex gap-4 flex-col p-6 flex-1 justify-between border"
      style={{ background }}>
      {/* Top: realistic content block */}
      <div className="flex flex-col gap-3 h-full">
        <p
          className="leading-tight h-full flex items-center justify-center"
          style={{
            color: foreground,
            fontSize: `${fontSize}px`,
            fontWeight: isBold ? 700 : 400
          }}>
          The quick brown fox jumps over the lazy dog.
        </p>
      </div>

      {/* Bottom: UI elements */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <span
            className="rounded-full border px-3 h-6 text-xs font-medium inline-flex items-center justify-center"
            style={{ borderColor: foreground, color: foreground }}>
            Label
          </span>
          <span
            className="rounded-full px-3 h-6 text-xs font-medium inline-flex items-center justify-center"
            style={{ background: foreground, color: background }}>
            Label
          </span>
          <div className="flex items-center gap-2">
            <Star className="size-6" stroke={foreground} strokeWidth={1.5} />
            <Star
              className="size-6"
              fill={foreground}
              stroke={foreground}
              strokeWidth={1.5}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
