"use client"

import { useEffect, useState } from "react"

export function scheduleIdleTask(callback: () => void, timeout = 500): () => void {
  if (typeof window === "undefined") return () => {}
  if ("requestIdleCallback" in window) {
    const handle = window.requestIdleCallback(callback, { timeout })
    return () => window.cancelIdleCallback(handle)
  }
  const handle = globalThis.setTimeout(callback, 0)
  return () => globalThis.clearTimeout(handle)
}

export function useDeferredRender(renderKey: string, timeout = 180): boolean {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    setReady(false)
    return scheduleIdleTask(() => setReady(true), timeout)
  }, [renderKey, timeout])

  return ready
}

export function useDebouncedValue<T>(value: T, delayMs = 500): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const handle = globalThis.setTimeout(() => setDebounced(value), delayMs)
    return () => globalThis.clearTimeout(handle)
  }, [delayMs, value])

  return debounced
}

export function useDelayedIdleRender(renderKey: string, delay = 1_000, idleTimeout = 500): boolean {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelIdle = () => {}
    setReady(false)
    const handle = globalThis.setTimeout(() => {
      cancelIdle = scheduleIdleTask(() => setReady(true), idleTimeout)
    }, delay)

    return () => {
      globalThis.clearTimeout(handle)
      cancelIdle()
    }
  }, [delay, idleTimeout, renderKey])

  return ready
}
