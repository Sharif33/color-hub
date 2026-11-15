import { ArrowUpRight, Check, Copy } from "lucide-react"

import { cn } from "~/lib/cn"

import { toEditableGradient, type PageGradient } from "./index"

interface PageGradientsSectionProps {
  gradients: PageGradient[]
  selected: PageGradient | null
  copiedField: string | null
  onSelect: (gradient: PageGradient) => void
  onCopy: (text: string, field: string) => void
  onEdit: (gradient: PageGradient) => void
}

const iconButton =
  "flex size-7 shrink-0 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-blue-500 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"

/**
 * The page's gradients, most used first. Click one to outline its elements
 * on the page; copy its CSS or edit it in Gradient Studio.
 */
export const PageGradientsSection = ({
  gradients,
  selected,
  copiedField,
  onSelect,
  onCopy,
  onEdit
}: PageGradientsSectionProps) => (
  <section aria-labelledby="page-gradients" className="flex flex-col gap-1.5">
    <h3
      id="page-gradients"
      className="text-xs font-medium text-slate-500 dark:text-slate-400">
      Gradients ({gradients.length})
    </h3>
    {gradients.map((gradient, index) => {
      const field = `gradient-${index}`
      const uses = `${gradient.count} ${gradient.count === 1 ? "use" : "uses"}`
      const editable = toEditableGradient(gradient) !== null
      return (
        <div key={gradient.css} className="flex items-center gap-1">
          <button
            type="button"
            title={`${uses}. Click to show them on the page`}
            aria-label={`Gradient ${index + 1}, ${uses}. Show on the page`}
            aria-pressed={selected?.css === gradient.css}
            onClick={() => onSelect(gradient)}
            className={cn(
              "h-7 min-w-0 flex-1 rounded-md ring-1 ring-inset ring-black/10 focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-500 dark:ring-white/15",
              selected?.css === gradient.css &&
                "outline-solid outline-2 outline-offset-1 outline-slate-900 dark:outline-slate-100"
            )}
            style={{ backgroundImage: gradient.css }}
          />
          <span className="w-12 shrink-0 text-right text-[11px] tabular-nums text-slate-500 dark:text-slate-400">
            {uses}
          </span>
          <button
            type="button"
            title="Copy CSS"
            aria-label={`Copy gradient ${index + 1} CSS`}
            onClick={() => onCopy(gradient.css, field)}
            className={iconButton}>
            {copiedField === field ? (
              <Check className="size-3.5" strokeWidth={3} />
            ) : (
              <Copy className="size-3.5" />
            )}
          </button>
          <button
            type="button"
            title={
              editable
                ? "Edit in Gradient Studio"
                : "This gradient uses CSS Gradient Studio can't read"
            }
            aria-label={`Edit gradient ${index + 1} in Gradient Studio`}
            disabled={!editable}
            onClick={() => onEdit(gradient)}
            className={iconButton}>
            <ArrowUpRight className="size-3.5" />
          </button>
        </div>
      )
    })}
  </section>
)
