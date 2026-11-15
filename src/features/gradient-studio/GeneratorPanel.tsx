import { Check, Copy, Moon, Shuffle, Sun } from "lucide-react"
import { useEffect, useMemo, useState } from "react"

import { Dropdown } from "~/components/dropdown"
import { cn } from "~/lib/cn"
import { parseColorWithAlpha } from "~/utils/color-utils"
import { backgroundImageCss, sortStops, type Gradient } from "~/utils/gradient"

import {
  generateMesh,
  HARMONIES,
  harmonyColors,
  meshDeclarations,
  meshToCss,
  paletteColors,
  randomAngle,
  withColors,
  type Harmony,
  type MeshGradient
} from "./generate"
import { PRESETS } from "./presets"
import { CHECKERBOARD, Segmented } from "./ui"
import type { ColorSource } from "./useColorSources"

type Tab = "ideas" | "presets" | "mesh"
type Source = Harmony | "palette"

const IDEA_COUNT = 8

interface GeneratorPanelProps {
  gradient: Gradient
  /**
   * The color harmonies are built on: the selected stop's, as you last set
   * it. Applying an idea doesn't change it, so the ideas stay put
   */
  baseColor: string
  /** Stops kept when shuffling, by order of position */
  locked: Set<number>
  sources: ColorSource[]
  /** Bumped by the page when Space is pressed */
  shuffleSignal: number
  onApply: (gradient: Gradient) => void
}

const Thumbnail = ({
  gradient,
  label,
  onClick
}: {
  gradient: Gradient
  label: string
  onClick: () => void
}) => (
  <button
    type="button"
    title={label}
    aria-label={label}
    onClick={onClick}
    className="relative h-16 overflow-hidden rounded-xl ring-1 ring-black/10 transition-transform hover:scale-[1.03] focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 active:scale-100"
    style={CHECKERBOARD}>
    <span
      className="absolute inset-0"
      style={{ backgroundImage: backgroundImageCss(gradient) }}
    />
  </button>
)

/**
 * New gradients to start from: ideas built on a color or a palette, presets,
 * and a mesh background made of the gradient's colors.
 */
export const GeneratorPanel = ({
  gradient,
  baseColor,
  locked,
  sources,
  shuffleSignal,
  onApply
}: GeneratorPanelProps) => {
  const [tab, setTab] = useState<Tab>("ideas")
  const [source, setSource] = useState<Source>("analogous")
  const [paletteId, setPaletteId] = useState("history")
  const [stopCount, setStopCount] = useState(3)
  const [randomizeAngle, setRandomizeAngle] = useState(false)
  const [ideas, setIdeas] = useState<Gradient[]>([])
  const [meshDark, setMeshDark] = useState(true)
  const [mesh, setMesh] = useState<MeshGradient | null>(null)
  const [meshCopied, setMeshCopied] = useState(false)

  const palette = sources.find((entry) => entry.id === paletteId) ?? sources[0]
  const opaqueBase = parseColorWithAlpha(baseColor)?.hex ?? "#2563eb"

  const makeIdeas = (): Gradient[] =>
    Array.from({ length: IDEA_COUNT }, () => {
      const colors =
        source === "palette"
          ? paletteColors(palette?.colors ?? [], stopCount)
          : harmonyColors(opaqueBase, source, stopCount)
      const idea = withColors(gradient, colors, locked)
      return randomizeAngle && gradient.type !== "conic"
        ? { ...idea, angle: randomAngle() }
        : idea
    }).filter((idea) => idea.stops.length >= 2)

  // New ideas when what they're built from changes. The gradient's own shape
  // settings are read when shuffling, not watched, so editing doesn't
  // replace the ideas under the pointer
  useEffect(() => {
    setIdeas(makeIdeas())
  }, [
    source,
    paletteId,
    stopCount,
    randomizeAngle,
    opaqueBase,
    palette?.colors
  ])

  // Shuffle: new ideas, and the first one goes straight into the editor
  const shuffle = () => {
    const next = makeIdeas()
    if (next.length === 0) return
    setIdeas(next)
    onApply(next[0])
  }

  useEffect(() => {
    if (shuffleSignal > 0 && tab === "ideas") shuffle()
    if (shuffleSignal > 0 && tab === "mesh") shuffleMesh()
  }, [shuffleSignal])

  // The mesh uses the gradient's colors, opaque, without repeats
  const meshColors = useMemo(
    () =>
      Array.from(
        new Set(
          sortStops(gradient.stops).map(
            (stop) => parseColorWithAlpha(stop.color)?.hex ?? stop.color
          )
        )
      ),
    [gradient.stops]
  )
  const shuffleMesh = () => setMesh(generateMesh(meshColors, meshDark))
  useEffect(() => {
    shuffleMesh()
  }, [meshColors.join(), meshDark])

  const copyMesh = async () => {
    if (!mesh) return
    try {
      await navigator.clipboard.writeText(meshDeclarations(mesh))
      setMeshCopied(true)
      setTimeout(() => setMeshCopied(false), 1500)
    } catch (error) {
      console.warn("Clipboard write failed:", error)
    }
  }

  const paletteEmpty = source === "palette" && (palette?.colors.length ?? 0) < 2

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented<Tab>
          label="Generate"
          value={tab}
          options={[
            { value: "ideas", label: "Ideas" },
            { value: "presets", label: "Presets" },
            { value: "mesh", label: "Mesh" }
          ]}
          onChange={setTab}
        />
        {tab !== "presets" && (
          <button
            type="button"
            onClick={tab === "ideas" ? shuffle : shuffleMesh}
            disabled={tab === "ideas" && paletteEmpty}
            title="Shuffle (Space)"
            className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-700 focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:cursor-not-allowed disabled:opacity-50">
            <Shuffle className="size-3.5" />
            Shuffle
            <kbd className="rounded-sm bg-white/20 px-1.5 font-sans text-[10px] font-semibold">
              Space
            </kbd>
          </button>
        )}
      </div>

      {tab === "ideas" && (
        <>
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <span className="w-16 shrink-0 text-xs font-semibold text-slate-600">
                Colors
              </span>
              <Segmented<Source>
                label="Build ideas from"
                value={source}
                options={[
                  ...HARMONIES,
                  {
                    value: "palette" as const,
                    label: "Palette",
                    title: "Colors from your history or a saved palette"
                  }
                ]}
                onChange={setSource}
              />
            </div>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
              {source === "palette" ? (
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  From
                  <Dropdown
                    value={palette?.id ?? "history"}
                    onChange={setPaletteId}
                    options={sources.map((entry) => ({
                      value: entry.id,
                      label: entry.label
                    }))}
                    ariaLabel="Palette"
                  />
                </div>
              ) : (
                source !== "random" && (
                  <span
                    title="Select a stop or change its color to build on another color"
                    className="flex items-center gap-2 text-xs text-slate-500">
                    <span
                      className="size-5 rounded-full ring-1 ring-black/10"
                      style={{ backgroundColor: opaqueBase }}
                    />
                    Based on this color
                  </span>
                )
              )}
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-600">
                  Stops
                </span>
                <Segmented
                  label="Number of stops"
                  value={String(stopCount)}
                  options={["2", "3", "4", "5"].map((n) => ({
                    value: n,
                    label: n
                  }))}
                  onChange={(value) => setStopCount(Number(value))}
                />
              </div>
              {gradient.type !== "conic" && (
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                  <input
                    type="checkbox"
                    checked={randomizeAngle}
                    onChange={(event) =>
                      setRandomizeAngle(event.target.checked)
                    }
                    className="size-4 rounded-sm accent-blue-600"
                  />
                  Random direction
                </label>
              )}
            </div>
          </div>

          {paletteEmpty ? (
            <p className="rounded-2xl bg-slate-50 px-4 py-6 text-center text-xs text-slate-500">
              {palette?.id === "history"
                ? "Pick a few colors with Color Hub first, or choose a saved palette."
                : "This palette needs at least two colors."}
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {ideas.map((idea, index) => (
                <Thumbnail
                  key={index}
                  gradient={idea}
                  label={`Use idea ${index + 1}`}
                  onClick={() => onApply(idea)}
                />
              ))}
            </div>
          )}
          {locked.size > 0 && (
            <p className="-mt-1 text-xs text-slate-500">
              Locked stops keep their color in every idea.
            </p>
          )}
        </>
      )}

      {tab === "presets" && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {PRESETS.map((preset) => (
            <div key={preset.name} className="flex flex-col gap-1.5">
              <Thumbnail
                gradient={preset.gradient}
                label={`Use ${preset.name}`}
                onClick={() => onApply(preset.gradient)}
              />
              <span className="px-0.5 text-xs font-medium text-slate-600">
                {preset.name}
              </span>
            </div>
          ))}
        </div>
      )}

      {tab === "mesh" && mesh && (
        <div className="flex flex-col gap-3">
          <div
            className="h-48 rounded-2xl ring-1 ring-black/10"
            style={meshToCss(mesh)}
          />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-slate-500">
              Soft blobs of this gradient's {meshColors.length} colors. CSS has
              no mesh gradient, so it's layered radial gradients.
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setMeshDark(!meshDark)}
                title={
                  meshDark
                    ? "Use the lightest color as the base"
                    : "Use the darkest color as the base"
                }
                className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-xs hover:border-slate-300">
                {meshDark ? (
                  <Moon className="size-3.5" />
                ) : (
                  <Sun className="size-3.5" />
                )}
                {meshDark ? "Dark base" : "Light base"}
              </button>
              <button
                type="button"
                onClick={() => void copyMesh()}
                className={cn(
                  "flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold shadow-xs",
                  meshCopied
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                )}>
                {meshCopied ? (
                  <Check className="size-3.5" strokeWidth={3} />
                ) : (
                  <Copy className="size-3.5" />
                )}
                {meshCopied ? "Copied" : "Copy mesh CSS"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
