import { Archive, ClipboardCopy, Wind } from "lucide-react"

import "~style.css"

import ColorHubLogo from "~components/color hub/logo"
import { BackupPanel } from "~features/backup/BackupPanel"
import { useSettings } from "~hooks/use-settings"
import { cn } from "~lib/cn"
import { updateSettings } from "~lib/settings"
import {
  TAILWIND_V3_VERSION,
  TAILWIND_V4_VERSION
} from "~lib/tailwind-palettes"
import { COLOR_FORMATS, formatColor } from "~utils/color-formats"
import { TAILWIND_VERSIONS } from "~utils/tailwind-match"

const SAMPLE_COLOR = "#2563eb"

const TAILWIND_RELEASES = {
  v4: TAILWIND_V4_VERSION,
  v3: TAILWIND_V3_VERSION
}

const SectionCard = ({
  icon: Icon,
  title,
  description,
  children
}: {
  icon: typeof ClipboardCopy
  title: string
  description: string
  children: React.ReactNode
}) => (
  <section className="rounded-3xl border border-slate-200/80 bg-white/80 p-6 shadow-sm">
    <div className="mb-5 flex items-start gap-3">
      <div className="rounded-xl bg-blue-50 p-2 text-blue-600 ring-1 ring-blue-100">
        <Icon className="size-4" />
      </div>
      <div>
        <h2 className="text-base font-bold text-slate-800">{title}</h2>
        <p className="mt-0.5 text-sm text-slate-500">{description}</p>
      </div>
    </div>
    {children}
  </section>
)

function OptionsPage() {
  const settings = useSettings()

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-blue-100 selection:text-blue-900">
      <nav className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/80 backdrop-blur-xl shadow-sm">
        <div className="container mx-auto flex h-16 max-w-3xl items-center gap-3 px-6">
          <ColorHubLogo size={28} className="text-blue-600" />
          <h1 className="text-lg font-extrabold tracking-tight text-slate-800">
            Settings
          </h1>
        </div>
      </nav>

      <main className="container mx-auto flex max-w-3xl flex-col gap-6 px-6 py-10">
        <SectionCard
          icon={ClipboardCopy}
          title="Copy format"
          description="Clicking a color in the history or a saved palette, and picking a color, copies it in this format.">
          <div
            role="radiogroup"
            aria-label="Copy format"
            className="grid gap-2 sm:grid-cols-2">
            {COLOR_FORMATS.map(({ value, label }) => {
              const selected = settings.copyFormat === value
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => void updateSettings({ copyFormat: value })}
                  className={cn(
                    "flex flex-col items-start gap-1 rounded-2xl border px-4 py-3 text-left transition-colors",
                    selected
                      ? "border-blue-300 bg-blue-50/60 ring-1 ring-blue-200"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  )}>
                  <span className="flex w-full items-center justify-between text-sm font-semibold text-slate-700">
                    {label}
                    {selected && (
                      <span className="h-2 w-2 rounded-full bg-blue-600" />
                    )}
                  </span>
                  <code className="break-words font-mono text-[11px] text-slate-500">
                    {formatColor(SAMPLE_COLOR, value)}
                  </code>
                </button>
              )
            })}
          </div>
        </SectionCard>

        <SectionCard
          icon={Wind}
          title="Tailwind palette"
          description="Colors are matched to the closest color in this palette (by CIEDE2000), and exported with its name when a color has no CSS variable.">
          <div
            role="radiogroup"
            aria-label="Tailwind palette"
            className="grid gap-2 sm:grid-cols-2">
            {TAILWIND_VERSIONS.map((version) => {
              const selected = settings.tailwindVersion === version
              return (
                <button
                  key={version}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() =>
                    void updateSettings({ tailwindVersion: version })
                  }
                  className={cn(
                    "flex items-center justify-between rounded-2xl border px-4 py-3 text-left transition-colors",
                    selected
                      ? "border-blue-300 bg-blue-50/60 ring-1 ring-blue-200"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  )}>
                  <span className="text-sm font-semibold text-slate-700">
                    Tailwind {version}{" "}
                    <span className="font-normal text-slate-500">
                      ({TAILWIND_RELEASES[version]} palette)
                    </span>
                  </span>
                  {selected && (
                    <span className="h-2 w-2 rounded-full bg-blue-600" />
                  )}
                </button>
              )
            })}
          </div>
        </SectionCard>

        <SectionCard
          icon={Archive}
          title="Backup"
          description="Save your color history, saved palettes, contrast pairs and settings to a file, or restore them on another browser.">
          <BackupPanel />
        </SectionCard>
      </main>
    </div>
  )
}

export default OptionsPage
