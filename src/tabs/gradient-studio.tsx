import {
  ArrowLeftRight,
  Check,
  Copy,
  Pipette,
  Save,
  StretchHorizontal
} from "lucide-react"
import { useEffect, useRef, useState } from "react"

import "~style.css"

import ColorHubLogo from "~components/color hub/logo"
import { BlendControls } from "~features/gradient-studio/BlendControls"
import type { LintIssue } from "~features/gradient-studio/checks"
import { ChecksPanel } from "~features/gradient-studio/ChecksPanel"
import {
  CssPanel,
  gradientDeclarations
} from "~features/gradient-studio/CssPanel"
import { pickScreenColor } from "~features/gradient-studio/eyedropper"
import {
  starterGradient,
  vividMiddle
} from "~features/gradient-studio/generate"
import { GeneratorPanel } from "~features/gradient-studio/GeneratorPanel"
import { GradientStopBar } from "~features/gradient-studio/GradientStopBar"
import { decodeGradient, encodeGradient } from "~features/gradient-studio/open"
import { SavedGradientsPanel } from "~features/gradient-studio/SavedGradientsPanel"
import { ShapeControls } from "~features/gradient-studio/ShapeControls"
import { StopEditor } from "~features/gradient-studio/StopEditor"
import { SwatchPicker } from "~features/gradient-studio/SwatchPicker"
import { CHECKERBOARD, iconButton, Panel } from "~features/gradient-studio/ui"
import { useColorSources } from "~features/gradient-studio/useColorSources"
import { useSavedGradients } from "~features/gradient-studio/useSavedGradients"
import { cn } from "~lib/cn"
import { hexToRgb, parseColor, parseColorWithAlpha } from "~utils/color-utils"
import {
  backgroundImageCss,
  DEFAULT_GRADIENT,
  normalizeGradient,
  rgbaToHex,
  sampleGradient,
  sortStops,
  type Gradient,
  type GradientStop
} from "~utils/gradient"

/** Stops the editor lets you add up to */
const MAX_STOPS = 10

const params = new URLSearchParams(window.location.search)
const popupColor = parseColor(`#${params.get("color") ?? ""}`)

const getInitialGradient = (): Gradient => {
  const encoded = params.get("g")
  const fromUrl = encoded ? normalizeGradient(decodeGradient(encoded)) : null
  if (fromUrl) return fromUrl
  return popupColor ? starterGradient(popupColor) : DEFAULT_GRADIENT
}

function GradientStudioPage() {
  const [gradient, setGradient] = useState<Gradient>(getInitialGradient)
  const [selected, setSelected] = useState(0)
  const [copied, setCopied] = useState(false)
  // Picking a start and an end color is two eyedropper sessions, each
  // started by its own click
  const [pickingEnd, setPickingEnd] = useState(false)
  // Indexes into `gradient.stops` whose color a shuffle keeps
  const [locked, setLocked] = useState<Set<number>>(new Set())
  const [shuffleSignal, setShuffleSignal] = useState(0)
  // Null picks white or dark, whichever reads better on the gradient
  const [textColor, setTextColor] = useState<string | null>(null)
  const copiedTimer = useRef<ReturnType<typeof setTimeout>>()
  const previewRef = useRef<HTMLDivElement>(null)
  const sources = useColorSources()
  const savedGradients = useSavedGradients()
  // The saved gradient being edited; saving again updates it
  const [savedId, setSavedId] = useState<string | null>(() => params.get("id"))
  const savedEntry = savedGradients.saved.find((entry) => entry.id === savedId)
  const isSaved =
    !!savedEntry &&
    JSON.stringify(normalizeGradient(savedEntry.gradient)) ===
      JSON.stringify(normalizeGradient(gradient))

  const stop = gradient.stops[Math.min(selected, gradient.stops.length - 1)]
  const stopIndex = gradient.stops.indexOf(stop)
  const sortedStops = sortStops(gradient.stops)
  // The generator counts stops by position, as the ideas it makes are sorted
  const lockedByPosition = new Set(
    Array.from(locked).map((index) =>
      sortedStops.indexOf(gradient.stops[index])
    )
  )

  // The color generated ideas are built on: the selected stop's. Applying an
  // idea recolors that stop, but this stays, so the other ideas stay up and
  // the next shuffle doesn't drift. Selecting or recoloring a stop moves it
  const [ideaBase, setIdeaBase] = useState(() => stop.color)
  // The selected stop as the last applied idea left it
  const appliedRef = useRef<{ index: number; color: string } | null>(null)
  useEffect(() => {
    const applied = appliedRef.current
    if (applied?.index === stopIndex && applied.color === stop.color) return
    appliedRef.current = null
    setIdeaBase(stop.color)
  }, [stopIndex, stop.color])

  // Space shuffles, unless it's typing or pressing a focused control
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== " " || event.repeat) return
      if (event.ctrlKey || event.metaKey || event.altKey) return
      const target = event.target as HTMLElement
      if (target.closest("input, textarea, select, button, [role=slider]"))
        return
      event.preventDefault()
      setShuffleSignal((n) => n + 1)
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [])

  // Keep the address in sync, so reloading or sharing the link keeps the
  // gradient. Dragging changes it many times a second, so wait for a pause
  useEffect(() => {
    const timer = setTimeout(() => {
      const id = savedId ? `&id=${encodeURIComponent(savedId)}` : ""
      window.history.replaceState(
        null,
        "",
        `?g=${encodeGradient(gradient)}${id}`
      )
    }, 300)
    return () => clearTimeout(timer)
  }, [gradient, savedId])

  const update = (patch: Partial<Gradient>) =>
    setGradient((current) => ({ ...current, ...patch }))

  const updateStop = (index: number, patch: Partial<GradientStop>) =>
    setGradient((current) => ({
      ...current,
      stops: current.stops.map((entry, i) =>
        i === index ? { ...entry, ...patch } : entry
      )
    }))

  const addStop = (position: number) => {
    if (gradient.stops.length >= MAX_STOPS) return
    // The new stop takes the color already there, so nothing changes until
    // it's edited
    const color = rgbaToHex(sampleGradient(gradient, position))
    setGradient({
      ...gradient,
      stops: [...gradient.stops, { color, position }]
    })
    setSelected(gradient.stops.length)
  }

  const removeStop = (index: number) => {
    if (gradient.stops.length <= 2) return
    setGradient({
      ...gradient,
      stops: gradient.stops.filter((_, i) => i !== index)
    })
    setSelected(Math.max(0, Math.min(index, gradient.stops.length - 2)))
    // Locks after the removed stop move down one
    setLocked(
      new Set(
        Array.from(locked)
          .filter((i) => i !== index)
          .map((i) => (i > index ? i - 1 : i))
      )
    )
  }

  const toggleLock = (index: number) => {
    const next = new Set(locked)
    if (next.has(index)) next.delete(index)
    else next.add(index)
    setLocked(next)
  }

  // An idea's stops are in order of position, so locks by position become
  // locks by index
  const applyIdea = (next: Gradient) => {
    const index = Math.min(stopIndex, next.stops.length - 1)
    appliedRef.current = { index, color: next.stops[index].color }
    setGradient(next)
    setLocked(
      new Set(Array.from(lockedByPosition).filter((i) => i < next.stops.length))
    )
    setSelected(index)
  }

  // Mirrors the stops. Their order is reversed too: where two stops share a
  // position (a hard edge), the one listed first is drawn first
  const reverseStops = () => {
    const last = gradient.stops.length - 1
    update({
      stops: gradient.stops.map((_, index) => {
        const entry = gradient.stops[last - index]
        return { ...entry, position: 100 - entry.position }
      })
    })
    setSelected(last - stopIndex)
    setLocked(new Set(Array.from(locked).map((index) => last - index)))
    // The selected stop moves with the reversal; it's the same stop
    if (appliedRef.current)
      appliedRef.current = { ...appliedRef.current, index: last - stopIndex }
  }

  const spreadStops = () => {
    const sorted = sortStops(gradient.stops)
    const last = sorted.length - 1
    update({
      stops: gradient.stops.map((entry) => ({
        ...entry,
        position: Math.round((sorted.indexOf(entry) / last) * 1000) / 10
      }))
    })
  }

  // The first and last stops by position
  const pickEnds = async () => {
    const sorted = sortStops(gradient.stops)
    const target = sorted[pickingEnd ? sorted.length - 1 : 0]
    const index = gradient.stops.indexOf(target)
    const hex = await pickScreenColor()
    if (!hex) {
      setPickingEnd(false)
      return
    }
    const alpha = parseColorWithAlpha(target.color)?.alpha ?? 1
    updateStop(index, {
      color: rgbaToHex({ ...hexToRgb(hex), a: alpha })
    })
    setSelected(index)
    setPickingEnd(!pickingEnd)
  }

  const saveGradient = async () => {
    try {
      setSavedId(
        await savedGradients.save(gradient, savedEntry ? savedId : null)
      )
    } catch (error) {
      console.warn("Saving the gradient failed:", error)
    }
  }

  const openSaved = (next: Gradient, id: string) => {
    setGradient(next)
    setSavedId(id)
    setSelected(0)
    setLocked(new Set())
  }

  const applyFix = (issue: LintIssue) => {
    if (!issue.fix) return
    if (issue.fix.kind === "use-oklch") update({ space: "oklch" })
    if (issue.fix.kind === "add-grain") update({ grain: 6 })
    if (
      issue.fix.kind === "add-middle-stop" &&
      issue.fix.afterStop !== undefined
    ) {
      const from = sortedStops[issue.fix.afterStop]
      const to = sortedStops[issue.fix.afterStop + 1]
      if (!from || !to || gradient.stops.length >= MAX_STOPS) return
      setGradient({
        ...gradient,
        stops: [
          ...gradient.stops,
          {
            color: vividMiddle(from.color.slice(0, 7), to.color.slice(0, 7)),
            position: Math.round(((from.position + to.position) / 2) * 10) / 10
          }
        ]
      })
      setSelected(gradient.stops.length)
    }
  }

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      clearTimeout(copiedTimer.current)
      copiedTimer.current = setTimeout(() => setCopied(false), 1500)
    } catch (error) {
      console.warn("Clipboard write failed:", error)
    }
  }

  // Radial and conic gradients move their center to where the preview is
  // clicked
  const handlePreviewClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (gradient.type === "linear") return
    const rect = event.currentTarget.getBoundingClientRect()
    const round = (n: number) =>
      Math.round(Math.min(100, Math.max(0, n)) * 10) / 10
    update({
      center: {
        x: round(((event.clientX - rect.left) / rect.width) * 100),
        y: round(((event.clientY - rect.top) / rect.height) * 100)
      }
    })
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 selection:bg-blue-100 selection:text-blue-900">
      <nav className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/80 shadow-sm backdrop-blur-xl">
        <div className="container mx-auto flex h-16 max-w-[1400px] items-center justify-between gap-4 px-6">
          <div className="flex items-center gap-3">
            <ColorHubLogo size={28} className="text-blue-600" />
            <h1 className="text-lg font-extrabold tracking-tight text-slate-800">
              Gradient Studio
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void saveGradient()}
              disabled={isSaved}
              title={
                isSaved
                  ? "Saved. Changes you make can be saved again"
                  : savedEntry
                    ? `Save the changes to ${savedEntry.name}`
                    : "Save this gradient in this browser"
              }
              className={cn(
                "flex items-center gap-2 rounded-xl border px-5 py-2 text-sm font-bold shadow-sm transition-all",
                isSaved
                  ? "cursor-default border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-slate-200 bg-white text-slate-700 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md active:translate-y-0"
              )}>
              {isSaved ? (
                <Check className="size-4" strokeWidth={3} />
              ) : (
                <Save className="size-4" strokeWidth={2.5} />
              )}
              {isSaved ? "Saved" : savedEntry ? "Save changes" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => void copy(gradientDeclarations(gradient))}
              className={cn(
                "flex items-center gap-2 rounded-xl border px-5 py-2 text-sm font-bold shadow-sm transition-all hover:-translate-y-0.5 active:translate-y-0",
                copied
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:shadow-md"
              )}>
              {copied ? (
                <Check className="size-4" strokeWidth={3} />
              ) : (
                <Copy className="size-4" strokeWidth={2.5} />
              )}
              {copied ? "Copied" : "Copy CSS"}
            </button>
          </div>
        </div>
      </nav>

      <main className="container mx-auto max-w-[1400px] px-6 py-10">
        <div className="grid items-start gap-8 lg:grid-cols-12">
          <div className="flex flex-col gap-6 lg:col-span-5 xl:col-span-4">
            <Panel
              title="Color stops"
              actions={
                <>
                  <button
                    type="button"
                    onClick={() => void pickEnds()}
                    title={
                      pickingEnd
                        ? "Now pick the end color from your screen"
                        : "Pick the start color, then the end color, from anywhere on your screen"
                    }
                    className={cn(
                      "flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold transition-colors",
                      pickingEnd
                        ? "bg-blue-600 text-white hover:bg-blue-700"
                        : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                    )}>
                    <Pipette className="size-3.5" />
                    {pickingEnd ? "Now pick end" : "Pick start & end"}
                  </button>
                  <button
                    type="button"
                    onClick={reverseStops}
                    title="Reverse the stops"
                    aria-label="Reverse the stops"
                    className={iconButton}>
                    <ArrowLeftRight className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={spreadStops}
                    title="Space the stops evenly"
                    aria-label="Space the stops evenly"
                    className={iconButton}>
                    <StretchHorizontal className="size-4" />
                  </button>
                </>
              }>
              <GradientStopBar
                gradient={gradient}
                selected={selected}
                full={gradient.stops.length >= MAX_STOPS}
                onSelect={setSelected}
                onMove={(index, position) => updateStop(index, { position })}
                onAdd={addStop}
                onRemove={removeStop}
              />
              <StopEditor
                stop={stop}
                index={stopIndex}
                canRemove={gradient.stops.length > 2}
                locked={locked.has(stopIndex)}
                onToggleLock={() => toggleLock(stopIndex)}
                onChange={(patch) => updateStop(stopIndex, patch)}
                onRemove={() => removeStop(stopIndex)}
              />
              <SwatchPicker
                currentColor={popupColor}
                onPick={(hex) => {
                  const alpha = parseColorWithAlpha(stop.color)?.alpha ?? 1
                  updateStop(stopIndex, {
                    color: rgbaToHex({ ...hexToRgb(hex), a: alpha })
                  })
                }}
              />
            </Panel>

            <Panel title="Shape">
              <ShapeControls gradient={gradient} onChange={update} />
            </Panel>

            <Panel title="Blending">
              <BlendControls gradient={gradient} onChange={update} />
            </Panel>
          </div>

          <div className="order-first flex flex-col gap-8 lg:order-none lg:col-span-7 xl:col-span-8">
            <div
              ref={previewRef}
              className={cn(
                "relative h-[360px] overflow-hidden rounded-3xl border border-slate-200/50 shadow-2xl shadow-slate-200/40 lg:h-[440px]",
                gradient.type !== "linear" && "cursor-crosshair"
              )}
              style={CHECKERBOARD}
              onClick={handlePreviewClick}>
              <div
                className="absolute inset-0"
                style={{ backgroundImage: backgroundImageCss(gradient) }}
              />
              {gradient.type !== "linear" && (
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgb(0_0_0/0.3)]"
                  style={{
                    left: `${gradient.center.x}%`,
                    top: `${gradient.center.y}%`
                  }}
                />
              )}
            </div>

            <Panel title="Checks" className="bg-white/80">
              <ChecksPanel
                gradient={gradient}
                textColor={textColor}
                onTextColorChange={setTextColor}
                onFix={applyFix}
              />
            </Panel>

            <Panel title="Generate" className="bg-white/80">
              <GeneratorPanel
                gradient={gradient}
                baseColor={ideaBase}
                locked={lockedByPosition}
                sources={sources}
                shuffleSignal={shuffleSignal}
                onApply={applyIdea}
              />
            </Panel>

            <Panel title="Code" className="bg-white/80">
              <CssPanel
                gradient={gradient}
                getPreviewBox={() => {
                  const rect = previewRef.current?.getBoundingClientRect()
                  return rect && rect.width > 0 && rect.height > 0
                    ? { width: rect.width, height: rect.height }
                    : undefined
                }}
                onImport={(next) => {
                  setGradient(next)
                  setSelected(0)
                  setLocked(new Set())
                  // A pasted gradient is a new one, not changes to the
                  // saved gradient that was open
                  setSavedId(null)
                }}
              />
            </Panel>

            <Panel title="Saved gradients" className="bg-white/80">
              <SavedGradientsPanel
                saved={savedGradients.saved}
                currentId={savedEntry ? savedId : null}
                onOpen={(entry) => openSaved(entry.gradient, entry.id)}
                onRename={(id, name) => void savedGradients.rename(id, name)}
                onDelete={savedGradients.remove}
                onRestore={(removed) => void savedGradients.restore(removed)}
              />
            </Panel>
          </div>
        </div>
      </main>
    </div>
  )
}

export default GradientStudioPage
