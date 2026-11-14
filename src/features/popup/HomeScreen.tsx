import {
  ArrowUpRight,
  Camera,
  ChevronRight,
  Crosshair,
  Eye,
  Loader2,
  Palette,
  PanelsTopLeft,
  Pipette,
  ScanEye,
  Settings,
  SlidersHorizontal,
  SwatchBook,
  TestTubes,
  type LucideIcon
} from "lucide-react"

import ColorHubLogo from "~components/color hub/logo"
import { cn } from "~lib/cn"
import type { ColorEntry } from "~utils/color-utils"

import { ColorSwatchButton } from "./ColorSwatchButton"

/** What a tool row does when clicked, shown by its trailing icon */
type ToolKind = "screen" | "tab" | "page"

interface Tool {
  label: string
  hint: string
  icon: LucideIcon
  kind: ToolKind
  onClick: () => void
  busy?: boolean
  /** Short state shown before the chevron, e.g. the vision mode */
  status?: string
}

const RECENT_COUNT = 10

const ToolRow = ({ tool, disabled }: { tool: Tool; disabled: boolean }) => {
  const { label, hint, icon: Icon, kind, onClick, busy, status } = tool
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || busy}
      className="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent dark:hover:bg-slate-800">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
        <Icon className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium leading-tight">{label}</span>
        <span className="block truncate text-xs leading-tight text-slate-500 dark:text-slate-400">
          {hint}
        </span>
      </span>
      {status && (
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {status}
        </span>
      )}
      {busy ? (
        <Loader2 className="size-4 animate-spin text-slate-400" />
      ) : kind === "screen" ? (
        <ChevronRight className="size-4 text-slate-400" />
      ) : kind === "tab" ? (
        <ArrowUpRight className="size-4 text-slate-400" />
      ) : null}
    </button>
  )
}

interface HomeScreenProps {
  hero: React.ReactNode
  history: ColorEntry[]
  savedPaletteCount: number
  pageRestricted: boolean
  isAnalyzing: boolean
  isAnalyzingContrast: boolean
  visionLabel: string
  copiedField: string | null
  onPick: () => void
  onAdjust: () => void
  onPickRecent: (color: ColorEntry, index: number) => void
  onOpenHistory: () => void
  onPageColors: () => void
  onScreenshotColors: () => void
  onContrastReport: () => void
  onInspect: () => void
  onVision: () => void
  onOpenSaved: () => void
  onOpenStudio: () => void
  onOpenChecker: () => void
  onOpenSettings: () => void
}

export const HomeScreen = (props: HomeScreenProps) => {
  const tools: Tool[] = [
    {
      label: "Page colors",
      hint: "Every color in this page's CSS",
      icon: Palette,
      kind: "screen",
      onClick: props.onPageColors,
      busy: props.isAnalyzing
    },
    {
      label: "Screenshot colors",
      hint: "Main colors on screen, images included",
      icon: Camera,
      kind: "screen",
      onClick: props.onScreenshotColors
    },
    {
      label: "Contrast report",
      hint: "Every text color checked against WCAG",
      icon: ScanEye,
      kind: "tab",
      onClick: props.onContrastReport,
      busy: props.isAnalyzingContrast
    },
    {
      label: "Inspect elements",
      hint: "Hover anything on the page to see its colors",
      icon: Crosshair,
      kind: "page",
      onClick: props.onInspect
    },
    {
      label: "Simulate vision",
      hint: "Preview color blindness on this page",
      icon: Eye,
      kind: "screen",
      onClick: props.onVision,
      status: props.visionLabel
    }
  ]
  const recent = props.history.slice(0, RECENT_COUNT)

  return (
    <div>
      <header className="flex h-12 items-center justify-between px-3">
        <ColorHubLogo size={20} className="text-base" />
        <button
          type="button"
          title="Settings"
          aria-label="Settings"
          onClick={props.onOpenSettings}
          className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100">
          <Settings className="size-4" />
        </button>
      </header>

      {props.hero}

      <div className="flex gap-2 px-3 pt-3">
        <button
          type="button"
          onClick={props.onPick}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white">
          <Pipette className="size-4" />
          Pick from screen
        </button>
        <button
          type="button"
          onClick={props.onAdjust}
          className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 dark:border-slate-700 dark:hover:bg-slate-800">
          <SlidersHorizontal className="size-4" />
          Adjust
        </button>
      </div>

      <section aria-label="Recent colors" className="px-3 pt-3">
        <div className="flex items-center gap-2">
          {recent.length === 0 ? (
            <p className="flex-1 text-xs text-slate-500 dark:text-slate-400">
              Colors you pick show up here.
            </p>
          ) : (
            <div className="flex flex-1 gap-1">
              {recent.map((color, index) => (
                <ColorSwatchButton
                  key={`${color.hex}-${index}`}
                  hex={color.hex}
                  copied={props.copiedField === `recent-${index}`}
                  onClick={() => props.onPickRecent(color, index)}
                  className="size-6 rounded-md"
                />
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={props.onOpenHistory}
            className="flex shrink-0 items-center rounded-md px-1 py-0.5 text-xs font-medium text-slate-500 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 dark:text-slate-400 dark:hover:text-slate-100">
            History
            <ChevronRight className="size-3.5" />
          </button>
        </div>
      </section>

      <section aria-labelledby="page-tools" className="px-1 pt-3">
        <h2
          id="page-tools"
          className="px-3 pb-1 text-xs font-medium text-slate-500 dark:text-slate-400">
          On this page
        </h2>
        {props.pageRestricted && (
          <p className="mx-2 mb-1 rounded-lg bg-amber-50 px-2.5 py-2 text-xs text-amber-800 dark:bg-amber-950/60 dark:text-amber-200">
            Browsers don't let extensions read this kind of page. Open a website
            to use these tools.
          </p>
        )}
        {tools.map((tool) => (
          <ToolRow
            key={tool.label}
            tool={tool}
            disabled={props.pageRestricted}
          />
        ))}
      </section>

      <nav
        aria-label="More"
        className="mt-2 flex items-center gap-1 border-t border-slate-200 px-2 pt-2 dark:border-slate-800">
        {[
          {
            label: "Saved palettes",
            title: "Palettes you saved from pages",
            icon: SwatchBook,
            onClick: props.onOpenSaved,
            badge: props.savedPaletteCount
          },
          {
            label: "Studio",
            title: "Open Palette Studio in a new tab",
            icon: PanelsTopLeft,
            onClick: props.onOpenStudio,
            external: true
          },
          {
            label: "Checker",
            title: "Open the Contrast Checker in a new tab",
            icon: TestTubes,
            onClick: props.onOpenChecker,
            external: true
          }
        ].map(({ label, title, icon: Icon, onClick, badge, external }) => (
          <button
            key={label}
            type="button"
            title={title}
            onClick={onClick}
            className={cn(
              "flex items-center gap-1.5 whitespace-nowrap rounded-lg px-2 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100",
              label === "Saved palettes" && "mr-auto"
            )}>
            <Icon className="size-3.5" />
            {label}
            {badge ? (
              <span className="rounded-full bg-slate-100 px-1.5 text-[11px] tabular-nums dark:bg-slate-800">
                {badge}
              </span>
            ) : null}
            {external && <ArrowUpRight className="size-3 text-slate-400" />}
          </button>
        ))}
      </nav>
      <p className="px-4 pb-2.5 text-[11px] text-slate-400 dark:text-slate-500">
        Made by{" "}
        <a
          href="https://github.com/Sharif33"
          target="_blank"
          rel="noopener noreferrer"
          className="underline decoration-slate-300 underline-offset-2 hover:text-slate-700 dark:decoration-slate-600 dark:hover:text-slate-300">
          Sharif Rashed
        </a>
      </p>
    </div>
  )
}
