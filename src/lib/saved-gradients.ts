import { normalizeGradient, type Gradient } from "~/utils/gradient"

export const SAVED_GRADIENTS_KEY = "savedGradients"

/** Saved gradients are capped so the list stays quick to scan */
export const SAVED_GRADIENTS_LIMIT = 200

export interface SavedGradient {
  id: string
  name: string
  gradient: Gradient
  createdAt: number
  updatedAt: number
}

const MAX_NAME_LENGTH = 80

const time = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) ? value : 0

/**
 * Saved gradients read from storage or a backup file. Entries that aren't a
 * saved gradient are dropped, and gradients are checked stop by stop.
 */
export const parseSavedGradients = (value: unknown): SavedGradient[] => {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  return value.slice(0, SAVED_GRADIENTS_LIMIT).flatMap((entry) => {
    if (!entry || typeof entry !== "object") return []
    const raw = entry as Record<string, unknown>
    const gradient = normalizeGradient(raw.gradient)
    if (typeof raw.id !== "string" || !raw.id || !gradient) return []
    if (seen.has(raw.id)) return []
    seen.add(raw.id)
    const name =
      typeof raw.name === "string" && raw.name.trim()
        ? raw.name.trim().slice(0, MAX_NAME_LENGTH)
        : "Gradient"
    return [
      {
        id: raw.id,
        name,
        gradient,
        createdAt: time(raw.createdAt),
        updatedAt: time(raw.updatedAt)
      }
    ]
  })
}

export const cleanGradientName = (name: string) =>
  name.trim().slice(0, MAX_NAME_LENGTH)
