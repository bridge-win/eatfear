"use client"

import { useEffect, useState, type Dispatch, type SetStateAction } from "react"
import useSWR, { type KeyedMutator, type SWRConfiguration } from "swr"

const STORAGE_PREFIX = "eatfear:v1:"

interface StoredEnvelope<T> {
  savedAt: number
  value: T
}

export interface PersistentSWRResult<T> {
  data: T | undefined
  error: Error | undefined
  isLoading: boolean
  isRefreshing: boolean
  mutate: KeyedMutator<T>
}

export type DashboardTabValue = "realtime" | "history"

export function isDashboardTabValue(value: string): value is DashboardTabValue {
  return value === "realtime" || value === "history"
}

interface StoredState<T> {
  key: string
  data: T | undefined
  ready: boolean
}

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined"
}

export function readStoredJson<T>(key: string): T | undefined {
  if (!canUseStorage()) return undefined
  try {
    const raw = window.localStorage.getItem(`${STORAGE_PREFIX}${key}`)
    if (!raw) return undefined
    const parsed = JSON.parse(raw) as StoredEnvelope<T>
    return parsed.value
  } catch {
    return undefined
  }
}

export function writeStoredJson<T>(key: string, value: T): void {
  if (!canUseStorage()) return
  try {
    window.localStorage.setItem(`${STORAGE_PREFIX}${key}`, JSON.stringify({ savedAt: Date.now(), value }))
  } catch {
    // Storage is a best-effort UX cache; quota/private-mode failures should not affect live data.
  }
}

export function usePersistentState<T extends string>(
  key: string,
  defaultValue: T,
  isValid: (value: string) => value is T,
): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(defaultValue)
  const [isRestored, setIsRestored] = useState(false)

  useEffect(() => {
    const stored = readStoredJson<string>(key)
    if (stored !== undefined && isValid(stored)) setValue(stored)
    setIsRestored(true)
  }, [isValid, key])

  useEffect(() => {
    if (isRestored) writeStoredJson(key, value)
  }, [isRestored, key, value])

  return [value, setValue]
}

export async function jsonFetcher<T>(url: string): Promise<T> {
  const response = await fetch(url)
  const json = (await response.json()) as T & { error?: string }
  if (!response.ok) throw new Error(json.error ?? `Request failed with ${response.status}`)
  return json
}

export function usePersistentSWR<T>(
  storageKey: string,
  swrKey: string | null,
  fetcher: (key: string) => Promise<T>,
  config: SWRConfiguration<T, Error> = {},
): PersistentSWRResult<T> {
  const [storedState, setStoredState] = useState<StoredState<T>>({
    key: storageKey,
    data: undefined,
    ready: false,
  })
  const response = useSWR<T, Error>(swrKey, fetcher, {
    keepPreviousData: false,
    revalidateOnFocus: false,
    revalidateOnReconnect: true,
    dedupingInterval: 15_000,
    ...config,
  })
  const storedData = storedState.key === storageKey ? storedState.data : undefined
  const storageReady = storedState.key === storageKey && storedState.ready

  useEffect(() => {
    setStoredState({
      key: storageKey,
      data: readStoredJson<T>(storageKey),
      ready: true,
    })
  }, [storageKey])

  useEffect(() => {
    if (storedData !== undefined && response.data === undefined) {
      void response.mutate(storedData, { revalidate: false })
    }
  }, [response.data, response.mutate, storedData])

  useEffect(() => {
    if (response.data !== undefined) writeStoredJson(storageKey, response.data)
  }, [response.data, storageKey])

  const data = response.data ?? storedData

  return {
    data,
    error: response.error,
    isLoading: data === undefined && (response.isLoading || !storageReady),
    isRefreshing: response.isValidating && data !== undefined,
    mutate: response.mutate,
  }
}
