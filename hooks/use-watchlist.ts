"use client"

import { useCallback, useEffect, useState } from "react"

import { createClient } from "@/lib/supabase/client"

export type AssetClass = "crypto" | "stock"

export interface WatchlistItem {
  id: string
  symbol: string
  asset_class: AssetClass
  created_at: string
}

interface UseWatchlist {
  items: WatchlistItem[]
  loading: boolean
  /** null until auth resolves; false = signed out. */
  signedIn: boolean | null
  isWatched: (symbol: string, assetClass: AssetClass) => boolean
  add: (symbol: string, assetClass: AssetClass) => Promise<void>
  remove: (symbol: string, assetClass: AssetClass) => Promise<void>
  toggle: (symbol: string, assetClass: AssetClass) => Promise<void>
  refresh: () => Promise<void>
}

const norm = (s: string) => s.trim().toUpperCase()

export function useWatchlist(): UseWatchlist {
  const [items, setItems] = useState<WatchlistItem[]>([])
  const [loading, setLoading] = useState(true)
  const [signedIn, setSignedIn] = useState<boolean | null>(null)

  const refresh = useCallback(async () => {
    let supabase: ReturnType<typeof createClient>
    try {
      supabase = createClient()
    } catch {
      setSignedIn(false)
      setLoading(false)
      return
    }
    try {
      const { data: auth } = await supabase.auth.getUser()
      if (!auth.user) {
        setSignedIn(false)
        setItems([])
        setLoading(false)
        return
      }
      setSignedIn(true)
      const { data } = await supabase
        .from("watchlist")
        .select("id, symbol, asset_class, created_at")
        .order("created_at", { ascending: false })
      setItems((data as WatchlistItem[]) ?? [])
    } catch {
      // Auth/network failure (e.g. Supabase unreachable) → treat as signed out.
      setSignedIn(false)
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const isWatched = useCallback(
    (symbol: string, assetClass: AssetClass) =>
      items.some((i) => i.symbol === norm(symbol) && i.asset_class === assetClass),
    [items],
  )

  const add = useCallback(
    async (symbol: string, assetClass: AssetClass) => {
      const sym = norm(symbol)
      if (isWatched(sym, assetClass)) return
      const supabase = createClient()
      const { data: auth } = await supabase.auth.getUser()
      if (!auth.user) return
      // Optimistic insert; reconcile on refresh.
      const optimistic: WatchlistItem = {
        id: `tmp-${sym}-${assetClass}`,
        symbol: sym,
        asset_class: assetClass,
        created_at: new Date().toISOString(),
      }
      setItems((prev) => [optimistic, ...prev])
      const { error } = await supabase
        .from("watchlist")
        .insert({ user_id: auth.user.id, symbol: sym, asset_class: assetClass })
      if (error) setItems((prev) => prev.filter((i) => i.id !== optimistic.id))
      else void refresh()
    },
    [isWatched, refresh],
  )

  const remove = useCallback(
    async (symbol: string, assetClass: AssetClass) => {
      const sym = norm(symbol)
      const supabase = createClient()
      const { data: auth } = await supabase.auth.getUser()
      if (!auth.user) return
      setItems((prev) => prev.filter((i) => !(i.symbol === sym && i.asset_class === assetClass)))
      await supabase
        .from("watchlist")
        .delete()
        .eq("user_id", auth.user.id)
        .eq("symbol", sym)
        .eq("asset_class", assetClass)
    },
    [],
  )

  const toggle = useCallback(
    async (symbol: string, assetClass: AssetClass) => {
      if (isWatched(symbol, assetClass)) await remove(symbol, assetClass)
      else await add(symbol, assetClass)
    },
    [isWatched, add, remove],
  )

  return { items, loading, signedIn, isWatched, add, remove, toggle, refresh }
}
