import { cn } from "~lib/cn"

// Translucent colors are shown over a checkerboard, so their alpha is visible
const CHECKERBOARD = {
  backgroundImage: "repeating-conic-gradient(#e2e8f0 0% 25%, #ffffff 0% 50%)",
  backgroundSize: "10px 10px"
}

export const ColorSwatch = ({
  hex,
  className
}: {
  hex: string
  className?: string
}) => (
  <span
    className={cn(
      "inline-block shrink-0 overflow-hidden border border-black/10",
      className
    )}
    style={CHECKERBOARD}>
    <span className="block h-full w-full" style={{ backgroundColor: hex }} />
  </span>
)
