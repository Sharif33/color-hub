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
    <div className="flex items-center gap-2">
      <span
        className={`inline-flex size-5 shrink-0 items-center justify-center rounded-full shadow-inner ring-1 ring-inset ${
          passed
            ? "bg-emerald-500 text-white ring-emerald-600"
            : "bg-red-50 text-red-500 ring-red-200"
        }`}>
        {passed ? (
          <Check className="size-3.5" strokeWidth={3} />
        ) : (
          <X className="size-3.5" strokeWidth={2.5} />
        )}
      </span>
      <div className="flex flex-col">
        <span className="text-[13px] font-bold leading-none text-slate-700">
          {label}
        </span>
        <span className="mt-0.5 text-[10px] font-medium leading-none text-slate-400">
          ≥ {requiredRatio}:1
        </span>
      </div>
    </div>
  )
}
