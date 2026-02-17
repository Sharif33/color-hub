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
    <div className="flex flex-col gap-3 bg-white p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xs tracking-[0.2em] text-slate-500 uppercase">
          WCAG 2.2 Compliance
        </h2>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${ratioLabel.className}`}>
          {ratioLabel.text}
        </span>
      </div>

      <div title="Color Contrast Ratio" className="flex items-baseline gap-1.5">
        <p className={`text-3xl font-bold leading-none ${ratioColor}`}>
          {ratio.toFixed(2)}
        </p>
        <span className="text-base font-medium text-slate-400">: 1</span>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div
          className={`flex flex-col gap-3 border p-3 transition ${
            !largeText
              ? "border-slate-900/10 bg-slate-50"
              : "border-slate-100 bg-white"
          }`}>
          <div className="flex items-center gap-2">
            <p className="text-xs font-mono text-slate-500">Normal Text</p>
            {!largeText && (
              <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-semibold text-white">
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
          className={`flex flex-col gap-3 border p-3 transition ${
            largeText
              ? "border-slate-900/10 bg-slate-50"
              : "border-slate-100 bg-white"
          }`}>
          <div className="flex items-center gap-2">
            <p className="text-xs font-mono text-slate-500">Large Text</p>
            {largeText && (
              <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-semibold text-white">
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

        <div className="flex flex-col gap-3 border border-slate-100 bg-white p-3">
          <p className="text-xs font-mono text-slate-500">Graphics & UI</p>
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
