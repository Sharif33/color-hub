import { useCallback, useEffect, useState } from "react"

import {
  cleanGradientName,
  parseSavedGradients,
  SAVED_GRADIENTS_KEY,
  SAVED_GRADIENTS_LIMIT,
  type SavedGradient
} from "~/lib/saved-gradients"
import type { Gradient } from "~/utils/gradient"

const read = async (): Promise<SavedGradient[]> => {
  const result = await chrome.storage.local.get([SAVED_GRADIENTS_KEY])
  return parseSavedGradients(result[SAVED_GRADIENTS_KEY])
}

const write = (gradients: SavedGradient[]) =>
  chrome.storage.local.set({ [SAVED_GRADIENTS_KEY]: gradients })

/** Gradients saved in Gradient Studio, newest first, kept in sync across tabs */
export const useSavedGradients = () => {
  const [saved, setSaved] = useState<SavedGradient[]>([])

  useEffect(() => {
    void read().then(setSaved)
    const listener = (
      changes: { [key: string]: chrome.storage.StorageChange },
      area: string
    ) => {
      if (area === "local" && changes[SAVED_GRADIENTS_KEY])
        setSaved(parseSavedGradients(changes[SAVED_GRADIENTS_KEY].newValue))
    }
    chrome.storage.onChanged.addListener(listener)
    return () => chrome.storage.onChanged.removeListener(listener)
  }, [])

  /**
   * Saves `gradient` as a new entry, or over the entry `id` when it still
   * exists. Resolves the entry's id
   */
  const save = useCallback(
    async (gradient: Gradient, id: string | null): Promise<string> => {
      const current = await read()
      const now = Date.now()
      const existing = id ? current.find((entry) => entry.id === id) : null
      if (existing) {
        await write(
          current.map((entry) =>
            entry.id === existing.id
              ? { ...entry, gradient, updatedAt: now }
              : entry
          )
        )
        return existing.id
      }
      const entry: SavedGradient = {
        id: crypto.randomUUID(),
        name: `Gradient ${current.length + 1}`,
        gradient,
        createdAt: now,
        updatedAt: now
      }
      await write([entry, ...current].slice(0, SAVED_GRADIENTS_LIMIT))
      return entry.id
    },
    []
  )

  const rename = useCallback(async (id: string, name: string) => {
    const clean = cleanGradientName(name)
    if (!clean) return
    const current = await read()
    await write(
      current.map((entry) =>
        entry.id === id ? { ...entry, name: clean } : entry
      )
    )
  }, [])

  /** Removes the entry; resolves it (and its place) so it can be put back */
  const remove = useCallback(async (id: string) => {
    const current = await read()
    const index = current.findIndex((entry) => entry.id === id)
    if (index === -1) return null
    await write(current.filter((entry) => entry.id !== id))
    return { entry: current[index], index }
  }, [])

  const restore = useCallback(
    async ({ entry, index }: { entry: SavedGradient; index: number }) => {
      const current = await read()
      if (current.some((other) => other.id === entry.id)) return
      const next = [...current]
      next.splice(Math.min(index, next.length), 0, entry)
      await write(next)
    },
    []
  )

  return { saved, save, rename, remove, restore }
}
