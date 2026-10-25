import { ChevronLeft } from "lucide-react"

interface ScreenHeaderProps {
  title: string
  subtitle?: string
  onBack: () => void
  /** Optional control on the right, e.g. a Clear button */
  action?: React.ReactNode
}

/** The top bar of every popup screen except home */
export const ScreenHeader = ({
  title,
  subtitle,
  onBack,
  action
}: ScreenHeaderProps) => (
  <header className="sticky top-0 z-10 flex h-12 items-center gap-1 border-b border-slate-200 bg-white/95 px-2 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
    <button
      type="button"
      onClick={onBack}
      aria-label="Back"
      className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100">
      <ChevronLeft className="size-5" />
    </button>
    <div className="min-w-0 flex-1">
      <h1 className="truncate text-sm font-semibold leading-tight">{title}</h1>
      {subtitle && (
        <p className="truncate text-xs leading-tight text-slate-500 dark:text-slate-400">
          {subtitle}
        </p>
      )}
    </div>
    {action}
  </header>
)
