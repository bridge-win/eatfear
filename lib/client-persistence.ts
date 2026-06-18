"use client"

import {
  createElement,
  startTransition,
  useEffect,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react"
import useSWR, { SWRConfig, type KeyedMutator, type SWRConfiguration } from "swr"

import { scheduleIdleTask } from "@/lib/client-performance"

const STORAGE_PREFIX = "eatfear:v1:"
const DEFAULT_DEDUPING_INTERVAL_MS = 15_000
const DEFAULT_FOCUS_THROTTLE_MS = 60_000
const DEFAULT_STORAGE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

const GLOBAL_SWR_CONFIG: SWRConfiguration = {
  keepPreviousData: false,
  revalidateOnFocus: false,
  revalidateOnReconnect: true,
  revalidateIfStale: true,
  dedupingInterval: DEFAULT_DEDUPING_INTERVAL_MS,
  focusThrottleInterval: DEFAULT_FOCUS_THROTTLE_MS,
  errorRetryCount: 2,
}

interface StoredEnvelope<T> {
  savedAt: number
  value: T
}

interface StoredCacheEntry {
  savedAt: number
  value: unknown
}

export interface PersistentSWRResult<T> {
  data: T | undefined
  error: Error | undefined
  isLoading: boolean
  isValidating: boolean
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

interface PersistentStorageOptions {
  maxAgeMs?: number
}

const memoryCache = new Map<string, StoredCacheEntry>()
const pendingWriteValues = new Map<string, StoredEnvelope<unknown>>()
const scheduledWriteKeys = new Set<string>()

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined"
}

export function ClientDataCacheProvider({ children }: { children: ReactNode }) {
  return createElement(SWRConfig, { value: GLOBAL_SWR_CONFIG }, children)
}

function toStorageKey(key: string): string {
  return `${STORAGE_PREFIX}${key}`
}

function isStoredEnvelope(value: unknown): value is StoredEnvelope<unknown> {
  if (typeof value !== "object" || value === null) return false
  const candidate = value as { savedAt?: unknown; value?: unknown }
  return typeof candidate.savedAt === "number" && Number.isFinite(candidate.savedAt) && "value" in candidate
}

function isFresh(savedAt: number, maxAgeMs = DEFAULT_STORAGE_MAX_AGE_MS): boolean {
  return Date.now() - savedAt <= maxAgeMs
}

function readMemoryJson<T>(key: string, options: PersistentStorageOptions = {}): T | undefined {
  const entry = memoryCache.get(toStorageKey(key))
  if (!entry || !isFresh(entry.savedAt, options.maxAgeMs)) return undefined
  return entry.value as T
}

function readStoredJsonNow<T>(key: string, options: PersistentStorageOptions = {}): T | undefined {
  if (!canUseStorage()) return undefined
  const storageKey = toStorageKey(key)
  const memoryValue = readMemoryJson<T>(key, options)
  if (memoryValue !== undefined) return memoryValue

  try {
    const raw = window.localStorage.getItem(storageKey)
    if (!raw) return undefined
    const parsed = JSON.parse(raw) as unknown
    if (!isStoredEnvelope(parsed) || !isFresh(parsed.savedAt, options.maxAgeMs)) {
      window.localStorage.removeItem(storageKey)
      memoryCache.delete(storageKey)
      return undefined
    }
    memoryCache.set(storageKey, { savedAt: parsed.savedAt, value: parsed.value })
    return parsed.value as T
  } catch {
    window.localStorage.removeItem(storageKey)
    return undefined
  }
}

function pruneStoredJson(removeCount = 8): void {
  if (!canUseStorage()) return
  const entries: Array<{ key: string; savedAt: number }> = []
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index)
    if (!key?.startsWith(STORAGE_PREFIX)) continue
    try {
      const raw = window.localStorage.getItem(key)
      const parsed = raw ? (JSON.parse(raw) as unknown) : null
      entries.push({ key, savedAt: isStoredEnvelope(parsed) ? parsed.savedAt : 0 })
    } catch {
      entries.push({ key, savedAt: 0 })
    }
  }
  for (const entry of entries.sort((a, b) => a.savedAt - b.savedAt).slice(0, removeCount)) {
    window.localStorage.removeItem(entry.key)
    memoryCache.delete(entry.key)
  }
}

function flushStoredJson(storageKey: string): void {
  const envelope = pendingWriteValues.get(storageKey)
  pendingWriteValues.delete(storageKey)
  scheduledWriteKeys.delete(storageKey)
  if (!envelope || !canUseStorage()) return

  const serialized = JSON.stringify(envelope)
  try {
    window.localStorage.setItem(storageKey, serialized)
  } catch {
    pruneStoredJson()
    try {
      window.localStorage.setItem(storageKey, serialized)
    } catch {
      memoryCache.delete(storageKey)
    }
  }
}

export function readStoredJson<T>(key: string): T | undefined {
  return readStoredJsonNow<T>(key)
}

export function writeStoredJson<T>(key: string, value: T): void {
  const storageKey = toStorageKey(key)
  const envelope: StoredEnvelope<T> = { savedAt: Date.now(), value }
  memoryCache.set(storageKey, envelope)
  pendingWriteValues.set(storageKey, envelope)
  if (scheduledWriteKeys.has(storageKey)) return
  scheduledWriteKeys.add(storageKey)
  scheduleIdleTask(() => flushStoredJson(storageKey), 1_500)
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
  storageOptions: PersistentStorageOptions = {},
): PersistentSWRResult<T> {
  const [storedState, setStoredState] = useState<StoredState<T>>(() => {
    const data = readMemoryJson<T>(storageKey, storageOptions)
    return {
      key: storageKey,
      data,
      ready: data !== undefined,
    }
  })
  const storedData = storedState.key === storageKey ? storedState.data : undefined
  const storageReady = storedState.key === storageKey && storedState.ready
  const shouldStartNetwork = swrKey !== null && (storageReady || config.fallbackData !== undefined)
  const response = useSWR<T, Error>(shouldStartNetwork ? swrKey : null, fetcher, {
    ...GLOBAL_SWR_CONFIG,
    ...config,
  })

  useEffect(() => {
    const memoryValue = readMemoryJson<T>(storageKey, storageOptions)
    if (memoryValue !== undefined) {
      setStoredState({ key: storageKey, data: memoryValue, ready: true })
      return () => {}
    }

    setStoredState({ key: storageKey, data: undefined, ready: false })
    return scheduleIdleTask(() => {
      const data = readStoredJsonNow<T>(storageKey, storageOptions)
      startTransition(() => {
        setStoredState({ key: storageKey, data, ready: true })
      })
    }, 300)
  }, [storageKey, storageOptions.maxAgeMs])

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
    isValidating: response.isValidating,
    isRefreshing: response.isValidating && data !== undefined,
    mutate: response.mutate,
  }
}
