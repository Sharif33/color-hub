import type { WCAGCompliance } from "~utils/wcag-utils"

import { ComplianceBadge } from "./ComplianceBadge"

interface WCAGCompliancePanelProps {
  ratio: number
  wcag: WCAGCompliance
  largeText: boolean
}

function getRatioColor(ratio: number): string {
  if (ratio >= 7) return "text-emerald-600"
  if (ratio >= 4.5) return "text-emerald-500"
  if (ratio >= 3) return "text-amber-500"
  return "text-red-500"
}

function getRatioLabel(ratio: number): { text: string; className: string } {
  if (ratio >= 7)
    return { text: "Excellent", className: "bg-emerald-100 text-emerald-700" }
  if (ratio >= 4.5)
    return { text: "Good", className: "bg-emerald-50 text-emerald-600" }
  if (ratio >= 3)
    return { text: "Fair", className: "bg-amber-50 text-amber-600" }
  return { text: "Poor", className: "bg-red-50 text-red-500" }
}

export function WCAGCompliancePanel({
  ratio,
  wcag,
  largeText
}: WCAGCompliancePanelProps) {
  const ratioColor = getRatioColor(ratio)
  const ratioLabel = getRatioLabel(ratio)

  return (
    <div className="flex flex-col gap-5 p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold tracking-widest text-slate-400 uppercase">
          WCAG 2.2 Compliance
        </h2>
        <span
          className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-wider uppercase ring-1 ring-inset ${
            ratio >= 7
              ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
              : ratio >= 4.5
                ? "bg-emerald-50 text-emerald-600 ring-emerald-200"
                : ratio >= 3
                  ? "bg-amber-50 text-amber-700 ring-amber-200"
                  : "bg-red-50 text-red-600 ring-red-200"
          }`}>
          {ratioLabel.text}
        </span>
      </div>

      <div
        title="Color Contrast Ratio"
        className="flex items-baseline gap-2 pb-2">
        <p
          className={`text-6xl font-black tracking-tighter leading-none ${ratioColor} drop-shadow-sm`}>
          {ratio.toFixed(2)}
        </p>
        <span className="text-2xl font-bold text-slate-300 tracking-tight">
          : 1
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div
          className={`flex flex-col gap-4 rounded-2xl border p-4 transition-all duration-300 ${
            !largeText
              ? "border-blue-200 bg-blue-50/30 shadow-sm shadow-blue-100/50 ring-1 ring-blue-500/5"
              : "border-slate-100 bg-white hover:border-slate-200 hover:shadow-sm"
          }`}>
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-700">Normal Text</p>
            {!largeText && (
              <span
                className="flex h-2 w-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]"
                title="Active"
              />
            )}
          </div>
          <div className="flex gap-3">
            <ComplianceBadge
              label="AA"
              passed={wcag.normalAA}
              requiredRatio="4.5"
            />
            <div className="w-px bg-slate-100" />
            <ComplianceBadge
              label="AAA"
              passed={wcag.normalAAA}
              requiredRatio="7"
            />
          </div>
        </div>

        <div
          className={`flex flex-col gap-4 rounded-2xl border p-4 transition-all duration-300 ${
            largeText
              ? "border-blue-200 bg-blue-50/30 shadow-sm shadow-blue-100/50 ring-1 ring-blue-500/5"
              : "border-slate-100 bg-white hover:border-slate-200 hover:shadow-sm"
          }`}>
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-700">Large Text</p>
            {largeText && (
              <span
                className="flex h-2 w-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]"
                title="Active"
              />
            )}
          </div>
          <div className="flex gap-3">
            <ComplianceBadge
              label="AA"
              passed={wcag.largeAA}
              requiredRatio="3"
            />
            <div className="w-px bg-slate-100" />
            <ComplianceBadge
              label="AAA"
              passed={wcag.largeAAA}
              requiredRatio="4.5"
            />
          </div>
        </div>

        <div className="flex flex-col gap-4 rounded-2xl border border-slate-100 bg-white p-4 transition-all duration-300 hover:border-slate-200 hover:shadow-sm">
          <p className="text-sm font-semibold text-slate-700">Graphics & UI</p>
          <div className="flex gap-3">
            <ComplianceBadge
              label="AA"
              passed={wcag.graphicsAA}
              requiredRatio="3"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
