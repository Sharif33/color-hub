import { COLOR_HISTORY_LIMIT } from "./constants"
import { parseSettings } from "./settings"

const BACKUP_APP = "color-hub"
const BACKUP_SCHEMA = 1

/** Storage keys a backup holds. Handoff keys (`*_PENDING`) are left out */
const BACKUP_KEYS = [
  "colorHistory",
  "lastPickedColor",
  "WEBPAGES_COLORS",
  "savedContrastPairs",
  "settings"
] as const

type BackupKey = (typeof BACKUP_KEYS)[number]

export interface Backup {
  app: typeof BACKUP_APP
  schema: number
  exportedAt: string
  data: Partial<Record<BackupKey, unknown>>
}

export interface BackupSummary {
  historyColors: number
  palettes: number
  savedPairs: number
  settings: boolean
}

type Entry = Record<string, unknown>

const isObject = (value: unknown): value is Entry =>
  typeof value === "object" && value !== null && !Array.isArray(value)
const isHex = (value: unknown) =>
  typeof value === "string" && /^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(value)
const isColorEntry = (value: unknown) =>
  isObject(value) && isHex(value.hex) && typeof value.rgb === "string"
const isAnalyzedColor = (value: unknown) =>
  isColorEntry(value) &&
  typeof (value as Entry).count === "number" &&
  Array.isArray((value as Entry).selectors)
const isSavedPair = (value: unknown) =>
  isObject(value) &&
  typeof value.id === "string" &&
  typeof value.foreground === "string" &&
  typeof value.background === "string"

export const createBackup = async (): Promise<Backup> => ({
  app: BACKUP_APP,
  schema: BACKUP_SCHEMA,
  exportedAt: new Date().toISOString(),
  data: await chrome.storage.local.get([...BACKUP_KEYS])
})

/**
 * Checks a backup file without touching storage. Entries that don't have the
 * expected shape are dropped; a file that isn't a Color Hub backup at all is
 * rejected.
 */
export const parseBackup = (
  text: string
): { backup: Backup; summary: BackupSummary } | { error: string } => {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return { error: "This file isn't valid JSON." }
  }
  if (!isObject(raw) || raw.app !== BACKUP_APP || !isObject(raw.data)) {
    return { error: "This isn't a Color Hub backup." }
  }
  if (typeof raw.schema !== "number" || raw.schema > BACKUP_SCHEMA) {
    return {
      error: "This backup is from a newer version of Color Hub. Update first."
    }
  }

  const source = raw.data
  const data: Backup["data"] = {}
  if (Array.isArray(source.colorHistory)) {
    data.colorHistory = source.colorHistory.filter(isColorEntry)
  }
  if (isColorEntry(source.lastPickedColor)) {
    data.lastPickedColor = source.lastPickedColor
  }
  if (isObject(source.WEBPAGES_COLORS)) {
    data.WEBPAGES_COLORS = Object.fromEntries(
      Object.entries(source.WEBPAGES_COLORS)
        .filter(([, colors]) => Array.isArray(colors))
        .map(([domain, colors]) => [
          domain,
          (colors as unknown[]).filter(isAnalyzedColor)
        ])
    )
  }
  if (Array.isArray(source.savedContrastPairs)) {
    data.savedContrastPairs = source.savedContrastPairs.filter(isSavedPair)
  }
  if (isObject(source.settings)) {
    data.settings = parseSettings(source.settings)
  }

  return {
    backup: {
      app: BACKUP_APP,
      schema: raw.schema,
      exportedAt: typeof raw.exportedAt === "string" ? raw.exportedAt : "",
      data
    },
    summary: {
      historyColors: (data.colorHistory as unknown[] | undefined)?.length ?? 0,
      palettes: Object.keys((data.WEBPAGES_COLORS as Entry | undefined) ?? {})
        .length,
      savedPairs:
        (data.savedContrastPairs as unknown[] | undefined)?.length ?? 0,
      settings: data.settings !== undefined
    }
  }
}

/**
 * Writes a parsed backup to storage. `merge` adds the backup's history,
 * palettes and pairs to what's here (a backup palette replaces the saved one
 * for the same site) and keeps the current settings. `replace` makes storage
 * match the backup.
 */
export const applyBackup = async (
  backup: Backup,
  mode: "merge" | "replace"
) => {
  const { data } = backup
  if (mode === "replace") {
    await chrome.storage.local.remove([...BACKUP_KEYS])
    await chrome.storage.local.set(data)
    return
  }

  const current = await chrome.storage.local.get([...BACKUP_KEYS])
  const next: Partial<Record<BackupKey, unknown>> = {}

  if (data.colorHistory) {
    const seen = new Set<string>()
    next.colorHistory = [
      ...((current.colorHistory as Entry[] | undefined) ?? []),
      ...(data.colorHistory as Entry[])
    ]
      .filter((entry) => {
        const hex = String(entry.hex).toLowerCase()
        if (seen.has(hex)) return false
        seen.add(hex)
        return true
      })
      .slice(0, COLOR_HISTORY_LIMIT)
  }
  if (data.lastPickedColor && !current.lastPickedColor) {
    next.lastPickedColor = data.lastPickedColor
  }
  if (data.WEBPAGES_COLORS) {
    next.WEBPAGES_COLORS = {
      ...((current.WEBPAGES_COLORS as Entry | undefined) ?? {}),
      ...(data.WEBPAGES_COLORS as Entry)
    }
  }
  if (data.savedContrastPairs) {
    const existing = (current.savedContrastPairs as Entry[] | undefined) ?? []
    const isNew = (pair: Entry) =>
      !existing.some(
        (p) =>
          p.foreground === pair.foreground && p.background === pair.background
      )
    next.savedContrastPairs = [
      ...existing,
      ...(data.savedContrastPairs as Entry[]).filter(isNew)
    ]
  }
  if (data.settings && !current.settings) {
    next.settings = data.settings
  }
  await chrome.storage.local.set(next)
}
