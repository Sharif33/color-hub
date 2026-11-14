import { rgbToHex, rgbToOklab, type Oklab } from "~utils/color-utils"

export interface QuantizedColor {
  hex: string
  r: number
  g: number
  b: number
  /** Share of the sampled pixels, from 0 to 1 */
  coverage: number
  pixels: number
}

export interface QuantizeOptions {
  maxColors?: number
  /** Colors covering less than this share are dropped (e.g. text antialiasing) */
  minCoverage?: number
  /** OKLab distance within which colors are grouped. 0.04 is about ΔE 3–4 */
  groupDistance?: number
}

const okDistance = (a: Oklab, b: Oklab) =>
  Math.hypot(a.L - b.L, a.a - b.a, a.b - b.b)

/**
 * The main colors of an RGBA pixel buffer. Each color is the most common exact
 * color of its group, not an average, so flat UI colors come back exactly as
 * the page paints them.
 */
export const quantizePixels = (
  data: Uint8ClampedArray,
  {
    maxColors = 12,
    minCoverage = 0.005,
    groupDistance = 0.04
  }: QuantizeOptions = {}
): QuantizedColor[] => {
  const exact = new Map<number, number>()
  let total = 0
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue
    const key = (data[i] << 16) | (data[i + 1] << 8) | data[i + 2]
    exact.set(key, (exact.get(key) ?? 0) + 1)
    total += 1
  }
  if (total === 0) return []

  // Bins of 5 bits per channel gather the many slightly different colors of
  // photos and gradients. A bin is represented by its most common color
  const bins = new Map<
    number,
    { pixels: number; best: number; bestPixels: number }
  >()
  exact.forEach((pixels, key) => {
    const bin =
      (((key >> 19) & 31) << 10) | (((key >> 11) & 31) << 5) | ((key >> 3) & 31)
    const entry = bins.get(bin)
    if (!entry) {
      bins.set(bin, { pixels, best: key, bestPixels: pixels })
      return
    }
    entry.pixels += pixels
    if (pixels > entry.bestPixels) {
      entry.best = key
      entry.bestPixels = pixels
    }
  })

  // Biggest bins first: each starts a group unless it's close to one, and
  // past a working limit everything joins the nearest group
  const groups: Array<{ key: number; lab: Oklab; pixels: number }> = []
  const groupLimit = maxColors * 3
  const sortedBins = Array.from(bins.values()).sort(
    (a, b) => b.pixels - a.pixels
  )
  for (const bin of sortedBins) {
    const lab = rgbToOklab(
      bin.best >> 16,
      (bin.best >> 8) & 255,
      bin.best & 255
    )
    let nearest = -1
    let nearestDistance = Infinity
    groups.forEach((group, index) => {
      const distance = okDistance(lab, group.lab)
      if (distance < nearestDistance) {
        nearest = index
        nearestDistance = distance
      }
    })
    if (
      nearest >= 0 &&
      (nearestDistance <= groupDistance || groups.length >= groupLimit)
    ) {
      groups[nearest].pixels += bin.pixels
    } else {
      groups.push({ key: bin.best, lab, pixels: bin.pixels })
    }
  }

  // Antialiased edges are blends of the two colors either side of them. A
  // small group that lies between two bigger ones is folded into the closer
  const rgbOf = (key: number) => [key >> 16, (key >> 8) & 255, key & 255]
  const blendOf = (key: number, a: number, b: number): number | null => {
    const [p, pa, pb] = [rgbOf(key), rgbOf(a), rgbOf(b)]
    const ab = pb.map((v, i) => v - pa[i])
    const lengthSquared = ab.reduce((sum, v) => sum + v * v, 0)
    if (lengthSquared === 0) return null
    const t =
      ab.reduce((sum, v, i) => sum + v * (p[i] - pa[i]), 0) / lengthSquared
    if (t <= 0.05 || t >= 0.95) return null
    const distance = Math.hypot(...p.map((v, i) => v - (pa[i] + t * ab[i])))
    return distance <= 8 ? t : null
  }
  groups.sort((a, b) => b.pixels - a.pixels)
  for (let i = groups.length - 1; i >= 2; i -= 1) {
    if (groups[i].pixels / total >= 0.02) continue
    search: for (let a = 0; a < i; a += 1) {
      for (let b = a + 1; b < i; b += 1) {
        const t = blendOf(groups[i].key, groups[a].key, groups[b].key)
        if (t === null) continue
        groups[t < 0.5 ? a : b].pixels += groups[i].pixels
        groups.splice(i, 1)
        break search
      }
    }
  }

  return groups
    .filter((group) => group.pixels / total >= minCoverage)
    .sort((a, b) => b.pixels - a.pixels)
    .slice(0, maxColors)
    .map(({ key, pixels }) => {
      const r = key >> 16
      const g = (key >> 8) & 255
      const b = key & 255
      return {
        hex: rgbToHex(r, g, b).toUpperCase(),
        r,
        g,
        b,
        coverage: pixels / total,
        pixels
      }
    })
}
