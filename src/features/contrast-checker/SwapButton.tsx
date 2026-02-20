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
      className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 shadow-sm transition-all hover:border-blue-200 hover:text-blue-600 hover:shadow-md active:scale-95"
    >
      <ArrowLeftRight className="h-4 w-4" />
    </button>
  )
}
