import { useRef } from "react"

import { cn } from "~/lib/cn"
import { parseColorWithAlpha } from "~/utils/color-utils"
import { gradientToCss, type Gradient } from "~/utils/gradient"

import { CHECKERBOARD } from "./ui"

interface GradientStopBarProps {
  gradient: Gradient
  selected: number
  /** No more stops can be added */
  full: boolean
  onSelect: (index: number) => void
  onMove: (index: number, position: number) => void
  onAdd: (position: number) => void
  onRemove: (index: number) => void
}

const clampPosition = (value: number) =>
  Math.min(100, Math.max(0, Math.round(value * 10) / 10))

/**
 * The stops on a left-to-right strip of the gradient. Drag a stop to move
 * it, click the strip to add one. With a stop focused, arrow keys move it
 * (Shift for 10%) and Delete removes it.
 */
export const GradientStopBar = ({
  gradient,
  selected,
  full,
  onSelect,
  onMove,
  onAdd,
  onRemove
}: GradientStopBarProps) => {
  const trackRef = useRef<HTMLDivElement>(null)
  const draggingRef = useRef<number | null>(null)

  const positionAt = (clientX: number) => {
    const rect = trackRef.current?.getBoundingClientRect()
    if (!rect || rect.width === 0) return 0
    return clampPosition(((clientX - rect.left) / rect.width) * 100)
  }

  // The strip always runs left to right, whatever the type and angle
  const stripCss = gradientToCss({
    ...gradient,
    type: "linear",
    angle: 90,
    repeating: false
  })
  const canRemove = gradient.stops.length > 2

  const handleKeyDown = (event: React.KeyboardEvent, index: number) => {
    const stop = gradient.stops[index]
    const step = event.shiftKey ? 10 : 1
    const moves: Record<string, number> = {
      ArrowLeft: stop.position - step,
      ArrowDown: stop.position - step,
      ArrowRight: stop.position + step,
      ArrowUp: stop.position + step,
      Home: 0,
      End: 100
    }
    if (event.key in moves) {
      event.preventDefault()
      onMove(index, clampPosition(moves[event.key]))
    } else if (
      (event.key === "Delete" || event.key === "Backspace") &&
      canRemove
    ) {
      event.preventDefault()
      onRemove(index)
    }
  }

  return (
    <div className="relative select-none pb-14">
      <div
        ref={trackRef}
        title={full ? undefined : "Click to add a stop"}
        onPointerDown={(event) => {
          if (event.button !== 0 || full) return
          // The new stop goes on the end of the list, and follows the
          // pointer until it's let go
          draggingRef.current = gradient.stops.length
          event.currentTarget.setPointerCapture(event.pointerId)
          onAdd(positionAt(event.clientX))
        }}
        onPointerMove={(event) => {
          if (draggingRef.current !== null)
            onMove(draggingRef.current, positionAt(event.clientX))
        }}
        onPointerUp={() => {
          draggingRef.current = null
        }}
        onPointerCancel={() => {
          draggingRef.current = null
        }}
        className={cn(
          "relative h-10 overflow-hidden rounded-xl ring-1 ring-black/10",
          !full && "cursor-copy"
        )}
        style={CHECKERBOARD}>
        <div
          className="absolute inset-0"
          style={{ backgroundImage: stripCss }}
        />
      </div>
      {gradient.stops.map((stop, index) => {
        const parsed = parseColorWithAlpha(stop.color)
        const isSelected = index === selected
        return (
          <button
            key={index}
            type="button"
            role="slider"
            aria-label={`Stop ${index + 1}, ${stop.color}`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={stop.position}
            aria-valuetext={`${stop.position}%`}
            onPointerDown={(event) => {
              event.stopPropagation()
              onSelect(index)
              draggingRef.current = index
              event.currentTarget.setPointerCapture(event.pointerId)
            }}
            onPointerMove={(event) => {
              if (draggingRef.current === index)
                onMove(index, positionAt(event.clientX))
            }}
            onPointerUp={() => {
              draggingRef.current = null
            }}
            onPointerCancel={() => {
              draggingRef.current = null
            }}
            onFocus={() => onSelect(index)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={cn(
              "absolute top-12 size-6 -translate-x-1/2 cursor-grab rounded-lg border-2 shadow-xs outline-hidden active:cursor-grabbing",
              // A tick from the stop up to the strip
              "before:absolute before:top-[-9px] before:left-1/2 before:h-2 before:w-0.5 before:-translate-x-1/2 before:rounded-full",
              isSelected
                ? "z-10 border-white ring-2 ring-blue-600 before:bg-blue-600"
                : "border-white ring-1 ring-black/25 before:bg-slate-400 focus-visible:ring-2 focus-visible:ring-blue-400"
            )}
            style={{
              left: `${Math.min(100, Math.max(0, stop.position))}%`,
              // The swatch shows the color as opaque so it's easy to see
              backgroundColor: parsed?.hex ?? stop.color
            }}
          />
        )
      })}
      <p className="absolute inset-x-0 bottom-0 text-center text-xs text-slate-400">
        {full
          ? `That's the most stops. Remove one to add another`
          : "Click the bar to add a stop, drag a stop to move it"}
      </p>
    </div>
  )
}
