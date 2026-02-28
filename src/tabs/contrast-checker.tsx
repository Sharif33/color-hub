import { AlertCircle, Check, Save } from "lucide-react"
import { useCallback, useRef, useState } from "react"

import "~style.css"

import ColorHubLogo from "~components/color hub/logo"
import { AlphaIndicator } from "~features/contrast-checker/AlphaIndicator"
import { ColorCard } from "~features/contrast-checker/ColorCard"
import { ColorPreview } from "~features/contrast-checker/ColorPreview"
import { ColorSuggestions } from "~features/contrast-checker/ColorSuggestions"
import { PaletteSelector } from "~features/contrast-checker/PaletteSelector"
import { SavedPairsGrid } from "~features/contrast-checker/SavedPairsGrid"
import { SwapButton } from "~features/contrast-checker/SwapButton"
import { TypographyControls } from "~features/contrast-checker/TypographyControls"
import { WCAGCompliancePanel } from "~features/contrast-checker/WCAGCompliancePanel"
import { useContrastInfo } from "~hooks/use-contrast-info"
import { usePaletteColors } from "~hooks/use-palette-colors"
import { useSavedPairs } from "~hooks/use-saved-pairs"
import { PALETTE_OPTIONS, type PaletteSource } from "~lib/constants"
import { DEFAULT_BACKGROUND, DEFAULT_FOREGROUND } from "~utils/color-utils"

function ContrastCheckerPage() {
  const [foregroundInput, setForegroundInput] = useState(DEFAULT_FOREGROUND)
  const [backgroundInput, setBackgroundInput] = useState(DEFAULT_BACKGROUND)
  const [fontSize, setFontSize] = useState(16)
  const [isBold, setIsBold] = useState(false)
  const [paletteSource, setPaletteSource] =
    useState<PaletteSource>("color-history")

  const swatches = usePaletteColors(paletteSource)
  const { pairs, savePair, removePair, isDuplicate } = useSavedPairs()
  const {
    foreground,
    background,
    fgAlpha,
    bgAlpha,
    effectiveForeground,
    effectiveBackground,
    ratio,
    foregroundTextColor,
    backgroundTextColor,
    previewMetaColor,
    wcag,
    largeText,
    suggestions
  } = useContrastInfo(foregroundInput, backgroundInput, fontSize, isBold)

  const handleSwapColors = () => {
    setForegroundInput(backgroundInput)
    setBackgroundInput(foregroundInput)
  }

  const handleApplySuggestion = (
    hex: string,
    target: "foreground" | "background"
  ) => {
    if (target === "foreground") {
      setForegroundInput(hex)
    } else {
      setBackgroundInput(hex)
    }
  }

  const [saveStatus, setSaveStatus] = useState<"idle" | "saved" | "duplicate">(
    "idle"
  )
  const statusTimer = useRef<ReturnType<typeof setTimeout>>()

  const handleSavePair = useCallback(() => {
    clearTimeout(statusTimer.current)
    if (isDuplicate(foreground, background)) {
      setSaveStatus("duplicate")
      statusTimer.current = setTimeout(() => setSaveStatus("idle"), 2000)
      return
    }
    savePair(foreground, background)
    setSaveStatus("saved")
    statusTimer.current = setTimeout(() => setSaveStatus("idle"), 1500)
  }, [foreground, background, savePair, isDuplicate])

  const handleSelectPair = (fg: string, bg: string) => {
    setForegroundInput(fg)
    setBackgroundInput(bg)
  }

  const isSavedPairsSource = paletteSource === "saved-pairs"

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-blue-100 selection:text-blue-900">
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-50/50 via-slate-50/50 to-slate-50 pointer-events-none -z-10" />
      <nav className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/80 backdrop-blur-xl shadow-sm">
        <div className="container mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <ColorHubLogo size={28} className="text-blue-600" />
            <h1 className="text-lg font-extrabold tracking-tight text-slate-800">
              Contrast Checker
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={handleSavePair}
              className={`flex items-center gap-2 rounded-xl border px-5 py-2 text-sm font-bold shadow-sm transition-all hover:-translate-y-0.5 active:translate-y-0 ${
                saveStatus === "saved"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700 shadow-emerald-100/50"
                  : saveStatus === "duplicate"
                    ? "border-amber-200 bg-amber-50 text-amber-700 shadow-amber-100/50"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:shadow-md"
              }`}>
              {saveStatus === "saved" ? (
                <Check className="size-4" strokeWidth={3} />
              ) : saveStatus === "duplicate" ? (
                <AlertCircle className="size-4" strokeWidth={2.5} />
              ) : (
                <Save className="size-4" strokeWidth={2.5} />
              )}
              {saveStatus === "saved"
                ? "Saved"
                : saveStatus === "duplicate"
                  ? "Exists"
                  : "Save Pair"}
            </button>
          </div>
        </div>
      </nav>

      <main className="container mx-auto max-w-[1400px] px-6 py-10">
        <div className="grid gap-8 lg:grid-cols-12 items-start">
          {/* Left Column: Controls */}
          <div className="flex flex-col gap-6 lg:col-span-5 xl:col-span-4">
            <div className="flex flex-col gap-6 rounded-3xl border border-slate-200/80 bg-white/60 backdrop-blur-sm p-6 shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100/80 pb-4">
                <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400">
                  Colors
                </h2>
                <PaletteSelector
                  value={paletteSource}
                  onChange={setPaletteSource}
                  options={PALETTE_OPTIONS}
                />
              </div>

              <div className="flex flex-col gap-2 items-center">
                <div className="w-full">
                  <ColorCard
                    label="Foreground"
                    color={foreground}
                    alpha={fgAlpha}
                    textColor={foregroundTextColor}
                    inputValue={foregroundInput}
                    onColorChange={setForegroundInput}
                    onInputChange={setForegroundInput}
                    swatches={swatches}
                    hideSwatches={isSavedPairsSource}
                  />
                </div>

                <div className="relative flex items-center justify-center w-full py-1">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-100"></div>
                  </div>
                  <div className="relative bg-transparent px-4">
                    <SwapButton onSwap={handleSwapColors} />
                  </div>
                </div>

                <div className="w-full">
                  <ColorCard
                    label="Background"
                    color={background}
                    alpha={bgAlpha}
                    textColor={backgroundTextColor}
                    inputValue={backgroundInput}
                    onColorChange={setBackgroundInput}
                    onInputChange={setBackgroundInput}
                    swatches={swatches}
                    hideSwatches={isSavedPairsSource}
                  />
                </div>
              </div>

              {(fgAlpha < 1 || bgAlpha < 1) && (
                <div className="pt-2">
                  <AlphaIndicator
                    fgAlpha={fgAlpha}
                    bgAlpha={bgAlpha}
                    effectiveForeground={effectiveForeground}
                    effectiveBackground={effectiveBackground}
                  />
                </div>
              )}
            </div>

            {isSavedPairsSource && (
              <div className="rounded-3xl border border-slate-200/80 bg-white/60 backdrop-blur-sm p-6 shadow-sm">
                <h2 className="mb-4 text-sm font-bold uppercase tracking-widest text-slate-400 border-b border-slate-100/80 pb-4">
                  Saved Pairs
                </h2>
                <SavedPairsGrid
                  pairs={pairs}
                  onSelect={handleSelectPair}
                  onRemove={removePair}
                />
              </div>
            )}

            <div className="rounded-3xl border border-slate-200/80 bg-white/60 backdrop-blur-sm p-6 shadow-sm">
              <TypographyControls
                fontSize={fontSize}
                isBold={isBold}
                largeText={largeText}
                onFontSizeChange={setFontSize}
                onBoldToggle={() => setIsBold((prev) => !prev)}
              />
            </div>
          </div>

          {/* Right Column: Preview & Analysis */}
          <div className="flex flex-col gap-8 lg:col-span-7 xl:col-span-8">
            <div className="rounded-3xl border border-slate-200/80 bg-white/80 backdrop-blur-sm shadow-sm overflow-hidden flex flex-col">
              <WCAGCompliancePanel
                ratio={ratio}
                wcag={wcag}
                largeText={largeText}
              />
              <div className="h-px bg-slate-100/80 w-full" />
              <ColorSuggestions
                suggestions={suggestions}
                foreground={effectiveForeground}
                background={effectiveBackground}
                ratio={ratio}
                onApply={handleApplySuggestion}
              />
            </div>

            <div className="shadow-2xl shadow-slate-200/40 rounded-3xl border border-slate-200/50">
              <ColorPreview
                background={effectiveBackground}
                foreground={effectiveForeground}
                previewMetaColor={previewMetaColor}
                fontSize={fontSize}
                isBold={isBold}
                ratio={ratio}
                largeText={largeText}
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

export default ContrastCheckerPage
