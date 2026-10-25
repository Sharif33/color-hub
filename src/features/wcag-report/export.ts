import { formatLc } from "~utils/apca"
import { formatRatio, suggestAccessibleColors } from "~utils/wcag-utils"

/** A contrast pair as the report shows it */
export interface ReportPair {
  foreground: string
  background: string
  ratio: number
  lc: number
  largeText: boolean
  passAA: boolean
  passAAA: boolean
  count: number
  selectors: string[]
}

export interface ReportInfo {
  url: string
  title: string
  timestamp: number
  /** Which pairs are included, e.g. "Failing AA" */
  filterLabel: string
}

export type ReportFormat = "markdown" | "github" | "csv" | "json"

const requiredRatio = (pair: ReportPair) => (pair.largeText ? 3 : 4.5)
const sizeLabel = (pair: ReportPair) => (pair.largeText ? "large" : "normal")
const formatDate = (timestamp: number) => new Date(timestamp).toISOString()

// Backticks would end the code span. In a table, pipes end the cell even
// inside code, so they're escaped there
const markdownCode = (value: string, inTable = false) => {
  const code = value.replace(/`/g, "'")
  return `\`${inTable ? code.replace(/\|/g, "\\|") : code}\``
}

const formatSelectors = (selectors: string[], inTable: boolean, max = 5) => {
  const shown = selectors
    .slice(0, max)
    .map((selector) => markdownCode(selector, inTable))
    .join(", ")
  return selectors.length > max
    ? `${shown} and ${selectors.length - max} more`
    : shown
}

/** The closest change that reaches AA, if any */
const suggestFix = (pair: ReportPair): string | null => {
  const fix = suggestAccessibleColors(
    pair.foreground,
    pair.background,
    pair.largeText
  ).find((suggestion) => suggestion.level === "AA")
  if (!fix) return null
  const what = fix.target === "foreground" ? "text" : "background"
  return `${what} ${fix.hex.toUpperCase()} (${formatRatio(fix.ratio)}:1)`
}

const toMarkdown = (pairs: ReportPair[], info: ReportInfo): string => {
  const rows = pairs.map((pair) =>
    [
      markdownCode(pair.foreground, true),
      markdownCode(pair.background, true),
      `${formatRatio(pair.ratio)}:1`,
      formatLc(pair.lc),
      sizeLabel(pair),
      pair.passAA ? "✅" : "❌",
      pair.passAAA ? "✅" : "❌",
      String(pair.count),
      formatSelectors(pair.selectors, true)
    ].join(" | ")
  )
  return [
    `# WCAG contrast report: ${info.title || info.url}`,
    "",
    `${info.url}  `,
    `Analyzed ${formatDate(info.timestamp)} · ${pairs.length} pairs (${info.filterLabel})`,
    "",
    "| Text | Background | Ratio | APCA Lc | Text size | AA | AAA | Uses | Elements |",
    "|---|---|---|---|---|---|---|---|---|",
    ...rows.map((row) => `| ${row} |`),
    "",
    "Ratios are measured on the colors as rendered: text and backgrounds are blended through every ancestor's background color and opacity. Background images aren't considered. Large text (24px, or 18.66px bold) needs 3:1 for AA; other text needs 4.5:1.",
    ""
  ].join("\n")
}

const toGitHubIssue = (pairs: ReportPair[], info: ReportInfo): string => {
  const failing = pairs.filter((pair) => !pair.passAA)
  const page = info.title || info.url
  if (failing.length === 0) {
    return `All ${pairs.length} text/background pairs on ${page} pass WCAG AA.\n`
  }
  const items = failing.map((pair) => {
    const fix = suggestFix(pair)
    const elements = `${pair.count} ${pair.count === 1 ? "element" : "elements"}`
    return [
      `- [ ] **${pair.foreground} on ${pair.background}**: ${formatRatio(pair.ratio)}:1, needs ${requiredRatio(pair)}:1 (${sizeLabel(pair)} text). ${elements}: ${formatSelectors(pair.selectors, false)}`,
      ...(fix ? [`  - Nearest fix: ${fix}`] : [])
    ].join("\n")
  })
  return [
    `## Color contrast: ${failing.length} text/background ${failing.length === 1 ? "pair fails" : "pairs fail"} WCAG AA`,
    "",
    `Page: ${info.url}`,
    `Checked with Color Hub on ${formatDate(info.timestamp)}. Colors are measured as rendered.`,
    "",
    ...items,
    ""
  ].join("\n")
}

// Quote a field when it holds a comma, quote or line break; quotes are doubled
const csvField = (value: string | number | boolean): string => {
  const text = String(value)
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

const toCsv = (pairs: ReportPair[]): string =>
  [
    [
      "text",
      "background",
      "ratio",
      "apca_lc",
      "large_text",
      "aa",
      "aaa",
      "uses",
      "elements"
    ].join(","),
    ...pairs.map((pair) =>
      [
        pair.foreground,
        pair.background,
        formatRatio(pair.ratio),
        formatLc(pair.lc),
        pair.largeText,
        pair.passAA,
        pair.passAAA,
        pair.count,
        pair.selectors.join("; ")
      ]
        .map(csvField)
        .join(",")
    )
  ].join("\r\n") + "\r\n"

const toJson = (pairs: ReportPair[], info: ReportInfo): string =>
  JSON.stringify(
    {
      url: info.url,
      title: info.title,
      analyzedAt: formatDate(info.timestamp),
      filter: info.filterLabel,
      pairs: pairs.map((pair) => ({
        text: pair.foreground,
        background: pair.background,
        ratio: Number(formatRatio(pair.ratio)),
        apcaLc: Number(formatLc(pair.lc)),
        largeText: pair.largeText,
        requiredRatio: requiredRatio(pair),
        aa: pair.passAA,
        aaa: pair.passAAA,
        uses: pair.count,
        elements: pair.selectors
      }))
    },
    null,
    2
  ) + "\n"

export const exportReport = (
  format: ReportFormat,
  pairs: ReportPair[],
  info: ReportInfo
): string => {
  switch (format) {
    case "markdown":
      return toMarkdown(pairs, info)
    case "github":
      return toGitHubIssue(pairs, info)
    case "csv":
      return toCsv(pairs)
    case "json":
      return toJson(pairs, info)
  }
}
