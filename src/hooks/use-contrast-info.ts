import { useMemo } from "react"

import {
  blendColorPair,
  getContrastRatio,
  getReadableTextColor,
  normalizeWithAlpha,
  withAlpha,
  DEFAULT_FOREGROUND,
  DEFAULT_BACKGROUND
} from "../utils/color-utils"
import {
  calculateWCAGCompliance,
  isLargeText,
  suggestAccessibleColors
} from "../utils/wcag-utils"

export const useContrastInfo = (
  foregroundInput: string,
  backgroundInput: string,
  fontSize: number,
  isBold: boolean
) => {
  const fgParsed = useMemo(
    () => normalizeWithAlpha(foregroundInput, DEFAULT_FOREGROUND),
    [foregroundInput]
  )

  const bgParsed = useMemo(
    () => normalizeWithAlpha(backgroundInput, DEFAULT_BACKGROUND),
    [backgroundInput]
  )

  const foreground = fgParsed.hex
  const background = bgParsed.hex
  const fgAlpha = fgParsed.alpha
  const bgAlpha = bgParsed.alpha

  const effective = useMemo(
    () => blendColorPair(fgParsed, bgParsed),
    [fgParsed, bgParsed]
  )
  const effectiveForeground = effective.foreground
  const effectiveBackground = effective.background

  const ratio = useMemo(
    () => getContrastRatio(effectiveForeground, effectiveBackground),
    [effectiveForeground, effectiveBackground]
  )

  const foregroundTextColor = useMemo(
    () => getReadableTextColor(foreground),
    [foreground]
  )

  const backgroundTextColor = useMemo(
    () => getReadableTextColor(background),
    [background]
  )

  const previewUiColor = useMemo(
    () => getReadableTextColor(effectiveBackground),
    [effectiveBackground]
  )

  const previewMetaColor = useMemo(
    () => withAlpha(previewUiColor, 0.68),
    [previewUiColor]
  )

  const wcag = useMemo(() => calculateWCAGCompliance(ratio), [ratio])

  const largeText = useMemo(
    () => isLargeText(fontSize, isBold),
    [fontSize, isBold]
  )

  const suggestions = useMemo(
    () =>
      suggestAccessibleColors(
        effectiveForeground,
        effectiveBackground,
        largeText
      ),
    [effectiveForeground, effectiveBackground, largeText]
  )

  return {
    foreground,
    background,
    fgAlpha,
    bgAlpha,
    effectiveForeground,
    effectiveBackground,
    ratio,
    foregroundTextColor,
    backgroundTextColor,
    previewUiColor,
    previewMetaColor,
    wcag,
    largeText,
    suggestions
  }
}
