import { ChevronDown } from "lucide-react"
import { useEffect, useRef, useState } from "react"

import { cn } from "~lib/cn"

export interface DropdownOption<T extends string> {
  value: T
  label: string
}

interface DropdownProps<T extends string> {
  value: T
  onChange: (value: T) => void
  options: Array<DropdownOption<T>>
  size?: "sm" | "md"
  ariaLabel?: string
}

const TRIGGER_SIZES = {
  sm: "rounded-lg px-3 py-1.5",
  md: "rounded-xl px-3 py-2"
}

export function Dropdown<T extends string>({
  value,
  onChange,
  options,
  size = "sm",
  ariaLabel
}: DropdownProps<T>) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const selectedOption = options.find((option) => option.value === value)

  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false)
    }

    document.addEventListener("mousedown", handleClickOutside)
    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [isOpen])

  const handleSelect = (option: T) => {
    onChange(option)
    setIsOpen(false)
  }

  return (
    <div ref={dropdownRef} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={ariaLabel}
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center gap-2 border border-slate-200/80 bg-white/80 backdrop-blur-sm text-xs font-semibold text-slate-600 shadow-sm transition-all hover:border-slate-300 hover:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/10 active:scale-95",
          TRIGGER_SIZES[size]
        )}>
        <span>{selectedOption?.label}</span>
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 text-slate-400 transition-transform duration-300",
            isOpen && "rotate-180"
          )}
          strokeWidth={2.5}
        />
      </button>

      {isOpen && (
        <div
          role="listbox"
          className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-48 origin-top-right rounded-xl border border-slate-100 bg-white p-1.5 shadow-xl shadow-slate-200/50 ring-1 ring-black/5">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={option.value === value}
              onClick={() => handleSelect(option.value)}
              className={cn(
                "flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors",
                option.value === value
                  ? "bg-blue-50/80 text-blue-700 font-semibold"
                  : "text-slate-600 font-medium hover:bg-slate-50 hover:text-slate-900"
              )}>
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
