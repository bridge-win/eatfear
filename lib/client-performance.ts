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
