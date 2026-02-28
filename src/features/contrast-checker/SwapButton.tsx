import { ArrowLeftRight } from "lucide-react"

interface SwapButtonProps {
  onSwap: () => void
}

export function SwapButton({ onSwap }: SwapButtonProps) {
  return (
    <button
      type="button"
      onClick={onSwap}
      aria-label="Swap foreground and background"
      className="group relative flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 shadow-sm transition-all hover:border-blue-300 hover:text-blue-600 hover:shadow-md hover:scale-105 active:scale-95 z-10">
      <ArrowLeftRight
        className="h-4 w-4 transition-transform group-hover:rotate-180 duration-500"
        strokeWidth={2.5}
      />
    </button>
  )
}
