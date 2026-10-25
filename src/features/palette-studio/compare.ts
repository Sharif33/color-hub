import type { AnalyzedColor } from "~features/webpage-color-analyzer"
import { deltaE2000, hexToLab, parseColorWithAlpha } from "~utils/color-utils"

/** Up to this ΔE, a color missing from one palette counts as changed */
export const SHIFT_THRESHOLD = 5

const MAX_ALPHA_DIFFERENCE = 0.05

export type DiffKind = "same" | "shifted" | "removed" | "added"

export interface DiffRow {
  kind: DiffKind
  /** The color in palette A; missing for `added` */
  a?: AnalyzedColor
  /** The color in palette B; missing for `removed` */
  b?: AnalyzedColor
  deltaE?: number
}

const KIND_ORDER: Record<DiffKind, number> = {
  shifted: 0,
  removed: 1,
  added: 2,
  same: 3
}

/**
 * Pairs the colors of two palettes: identical colors are `same`, then the
 * closest remaining pairs within ΔE 5 are `shifted`, and the rest exist in
 * only one palette. Changes come first, most used first.
 */
export const comparePalettes = (
  paletteA: AnalyzedColor[],
  paletteB: AnalyzedColor[]
): DiffRow[] => {
  const rows: DiffRow[] = []
  const bByKey = new Map(paletteB.map((color) => [color.rgb, color]))
  const matchedB = new Set<string>()
  const restA: AnalyzedColor[] = []

  for (const a of paletteA) {
    const b = bByKey.get(a.rgb)
    if (b) {
      rows.push({ kind: "same", a, b, deltaE: 0 })
      matchedB.add(b.rgb)
    } else {
      restA.push(a)
    }
  }
  const restB = paletteB.filter((color) => !matchedB.has(color.rgb))

  // Closest pairs first, so each color is paired with its best match
  const info = (color: AnalyzedColor) => ({
    lab: hexToLab(color.hex),
    alpha: parseColorWithAlpha(color.hex)?.alpha ?? 1
  })
  const infoA = restA.map(info)
  const infoB = restB.map(info)
  const candidates: Array<{ i: number; j: number; deltaE: number }> = []
  restA.forEach((_, i) => {
    restB.forEach((_, j) => {
      if (Math.abs(infoA[i].alpha - infoB[j].alpha) > MAX_ALPHA_DIFFERENCE)
        return
      const deltaE = deltaE2000(infoA[i].lab, infoB[j].lab)
      if (deltaE <= SHIFT_THRESHOLD) candidates.push({ i, j, deltaE })
    })
  })
  candidates.sort((x, y) => x.deltaE - y.deltaE)

  const pairedA = new Set<number>()
  const pairedB = new Set<number>()
  for (const { i, j, deltaE } of candidates) {
    if (pairedA.has(i) || pairedB.has(j)) continue
    pairedA.add(i)
    pairedB.add(j)
    rows.push({ kind: "shifted", a: restA[i], b: restB[j], deltaE })
  }
  restA.forEach((a, i) => {
    if (!pairedA.has(i)) rows.push({ kind: "removed", a })
  })
  restB.forEach((b, j) => {
    if (!pairedB.has(j)) rows.push({ kind: "added", b })
  })

  const uses = (row: DiffRow) => (row.a?.count ?? 0) + (row.b?.count ?? 0)
  return rows.sort(
    (x, y) => KIND_ORDER[x.kind] - KIND_ORDER[y.kind] || uses(y) - uses(x)
  )
}
