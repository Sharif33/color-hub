import { Check, X } from "lucide-react"

interface ComplianceBadgeProps {
  label: string
  passed: boolean
  requiredRatio: string
}

export function ComplianceBadge({
  label,
  passed,
  requiredRatio
}: ComplianceBadgeProps) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        className={`inline-flex size-5 items-center justify-center rounded-full ${
          passed
            ? "bg-emerald-100 text-emerald-600"
            : "bg-red-50 text-red-400"
        }`}>
        {passed ? (
          <Check className="size-3.5" strokeWidth={2.5} />
        ) : (
          <X className="size-3.5" strokeWidth={2.5} />
        )}
      </span>
      <div className="flex flex-col">
        <span className="text-sm font-medium leading-none text-slate-900">
          {label}
        </span>
        <span className="mt-0.5 text-[11px] leading-none text-slate-400">
          ≥ {requiredRatio}:1
        </span>
      </div>
    </div>
  )
}
