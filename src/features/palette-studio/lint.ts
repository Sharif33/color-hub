import type { AnalyzedColor } from "~features/webpage-color-analyzer"
import { deltaE2000, hexToLab, parseColorWithAlpha } from "~utils/color-utils"

/** Under ΔE 2 two colors are hard to tell apart, so one is likely a mistake */
export const DEFAULT_DUPLICATE_THRESHOLD = 2

// Colors whose alpha differs more than this are different tokens (a 10% and a
// 50% black), however close their RGB is
const MAX_ALPHA_DIFFERENCE = 0.05

export interface DuplicateGroup {
  /** The most used color, suggested as the one to keep */
  canonical: AnalyzedColor
  /** The rest, closest first, with their distance to the canonical color */
  duplicates: Array<{ color: AnalyzedColor; deltaE: number }>
}

/**
 * Groups colors that are within `threshold` (CIEDE2000) of another color in
 * the group. Groups are linked transitively, so the colors at either end of a
 * group can be further apart than the threshold.
 */
export const findNearDuplicates = (
  colors: AnalyzedColor[],
  threshold = DEFAULT_DUPLICATE_THRESHOLD
): DuplicateGroup[] => {
  const labs = colors.map((color) => hexToLab(color.hex))
  const alphas = colors.map(
    (color) => parseColorWithAlpha(color.hex)?.alpha ?? 1
  )

  // Union-find over every close pair
  const parent = colors.map((_, index) => index)
  const find = (i: number): number => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]]
      i = parent[i]
    }
    return i
  }
  for (let i = 0; i < colors.length; i += 1) {
    for (let j = i + 1; j < colors.length; j += 1) {
      if (Math.abs(alphas[i] - alphas[j]) > MAX_ALPHA_DIFFERENCE) continue
      if (deltaE2000(labs[i], labs[j]) <= threshold) {
        parent[find(j)] = find(i)
      }
    }
  }

  const members = new Map<number, number[]>()
  colors.forEach((_, index) => {
    const root = find(index)
    members.set(root, [...(members.get(root) ?? []), index])
  })

  return Array.from(members.values())
    .filter((indexes) => indexes.length > 1)
    .map((indexes) => {
      const canonicalIndex = indexes.reduce((best, index) =>
        colors[index].count > colors[best].count ? index : best
      )
      return {
        canonical: colors[canonicalIndex],
        duplicates: indexes
          .filter((index) => index !== canonicalIndex)
          .map((index) => ({
            color: colors[index],
            deltaE: deltaE2000(labs[canonicalIndex], labs[index])
          }))
          .sort((a, b) => a.deltaE - b.deltaE)
      }
    })
    .sort(
      (a, b) =>
        b.duplicates.reduce((sum, d) => sum + d.color.count, 0) -
        a.duplicates.reduce((sum, d) => sum + d.color.count, 0)
    )
}

/** A find-and-replace list, one line per duplicate */
export const formatReplacements = (groups: DuplicateGroup[]): string =>
  groups
    .flatMap(({ canonical, duplicates }) =>
      duplicates.map(
        ({ color, deltaE }) =>
          `${color.hex} → ${canonical.hex}  (ΔE ${deltaE.toFixed(1)}, ${color.count} ${
            color.count === 1 ? "use" : "uses"
          })`
      )
    )
    .join("\n")
