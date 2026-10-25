import { useEffect, useState } from "react"

import {
  getVisionSimulation,
  setVisionSimulation,
  VISION_MODES,
  type VisionMode
} from "./index"

interface VisionSimulationPanelProps {
  tabId: number | null
}

export const VisionSimulationPanel = ({
  tabId
}: VisionSimulationPanelProps) => {
  const [mode, setMode] = useState<VisionMode | null>(null)

  // The page keeps the simulation after the popup closes, so show what's on
  useEffect(() => {
    if (tabId === null) return
    void getVisionSimulation(tabId).then(setMode)
  }, [tabId])

  const choose = async (next: VisionMode | null) => {
    if (tabId === null) return
    setMode(next)
    setMode(await setVisionSimulation(tabId, next))
  }

  const options: Array<{
    value: VisionMode | null
    label: string
    description: string
  }> = [
    { value: null, label: "Off", description: "Normal vision" },
    ...VISION_MODES
  ]

  return (
    <div className="rounded border border-gray-300 bg-white p-2">
      <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-600">
        Simulate on this page
      </div>
      <div role="radiogroup" className="flex flex-col">
        {options.map((option) => (
          <label
            key={option.label}
            className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-xs hover:bg-gray-50">
            <input
              type="radio"
              name="vision-mode"
              checked={mode === option.value}
              onChange={() => void choose(option.value)}
            />
            <span className="font-medium text-gray-800">{option.label}</span>
            <span className="ml-auto text-[10px] text-gray-500">
              {option.description}
            </span>
          </label>
        ))}
      </div>
      <p className="mt-1 text-[10px] text-gray-500">
        Stays on until you turn it off or reload the page.
      </p>
    </div>
  )
}
