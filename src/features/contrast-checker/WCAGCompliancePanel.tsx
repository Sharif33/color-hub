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
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-bold tracking-widest text-slate-400 uppercase">
            WCAG 2.2 Compliance
          </h2>
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${ratioLabel.className}`}>
            {ratioLabel.text}
          </span>
        </div>
      </div>

      <div title="Color Contrast Ratio" className="flex items-baseline gap-2">
        <p className={`text-6xl font-black tracking-tight leading-none ${ratioColor}`}>
          {ratio.toFixed(2)}
        </p>
        <span className="text-2xl font-bold text-slate-300">: 1</span>
      </div>

      <div className="grid gap-4 sm:grid-cols-3 mt-2">
        <div
          className={`flex flex-col gap-4 rounded-2xl border p-4 transition ${
            !largeText
              ? "border-blue-200 bg-blue-50/50 shadow-sm shadow-blue-100/50"
              : "border-slate-200/60 bg-slate-50/50 hover:bg-slate-50"
          }`}>
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-600">Normal Text</p>
            {!largeText && (
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold tracking-wider text-blue-700 uppercase">
                Active
              </span>
            )}
          </div>
          <div className="flex gap-4">
            <ComplianceBadge
              label="AA"
              passed={wcag.normalAA}
              requiredRatio="4.5"
            />
            <ComplianceBadge
              label="AAA"
              passed={wcag.normalAAA}
              requiredRatio="7"
            />
          </div>
        </div>

        <div
          className={`flex flex-col gap-4 rounded-2xl border p-4 transition ${
            largeText
              ? "border-blue-200 bg-blue-50/50 shadow-sm shadow-blue-100/50"
              : "border-slate-200/60 bg-slate-50/50 hover:bg-slate-50"
          }`}>
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-600">Large Text</p>
            {largeText && (
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold tracking-wider text-blue-700 uppercase">
                Active
              </span>
            )}
          </div>
          <div className="flex gap-4">
            <ComplianceBadge
              label="AA"
              passed={wcag.largeAA}
              requiredRatio="3"
            />
            <ComplianceBadge
              label="AAA"
              passed={wcag.largeAAA}
              requiredRatio="4.5"
            />
          </div>
        </div>

        <div className="flex flex-col gap-4 rounded-2xl border border-slate-200/60 bg-slate-50/50 p-4 hover:bg-slate-50 transition">
          <p className="text-sm font-semibold text-slate-600">Graphics & UI</p>
          <div className="flex gap-4">
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
