import { ChevronDown } from "lucide-react"
import { useEffect, useRef, useState } from "react"

import type { PaletteSource } from "~lib/constants"

interface PaletteSelectorProps {
  value: PaletteSource
  onChange: (value: PaletteSource) => void
  options: Array<{ value: PaletteSource; label: string }>
}

export function PaletteSelector({
  value,
  onChange,
  options
}: PaletteSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const selectedOption = options.find((option) => option.value === value)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const handleSelect = (option: PaletteSource) => {
    onChange(option)
    setIsOpen(false)
  }

  return (
    <div ref={dropdownRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 rounded-lg border border-slate-200/80 bg-white/80 backdrop-blur-sm px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm transition-all hover:border-slate-300 hover:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/10 active:scale-95">
        <span>{selectedOption?.label}</span>
        <ChevronDown
          className={`h-3.5 w-3.5 text-slate-400 transition-transform duration-300 ${
            isOpen ? "rotate-180" : ""
          }`}
          strokeWidth={2.5}
        />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-48 origin-top-right rounded-xl border border-slate-100 bg-white/95 backdrop-blur-md p-1.5 shadow-xl shadow-slate-200/50 ring-1 ring-black/5 focus:outline-none animate-in fade-in zoom-in-95 duration-150">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => handleSelect(option.value)}
              className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                option.value === value
                  ? "bg-blue-50/80 text-blue-700 font-semibold"
                  : "text-slate-600 font-medium hover:bg-slate-50 hover:text-slate-900"
              }`}>
              {option.label}
              {option.value === value && (
                <span className="h-1.5 w-1.5 rounded-full bg-blue-600 shadow-sm" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
