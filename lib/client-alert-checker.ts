import { createBrowserClient } from "@/lib/supabase/client"
import { TOP_CRYPTOS } from "./crypto-service"

export interface ClientAlert {
  assetSymbol: string
  assetName: string
  assetType: "crypto" | "stock"
  currentPrice: number
  dropPercentage: number
  threshold: number
  timestamp: Date
}

export class ClientAlertChecker {
  private supabase = createBrowserClient()
  private alertCallbacks: ((alert: ClientAlert) => void)[] = []
  private lastAlertTime: Map<string, number> = new Map()
  private COOLDOWN_MS = 5 * 60 * 1000 // 5 minutes between same alert

  onAlert(callback: (alert: ClientAlert) => void) {
    this.alertCallbacks.push(callback)
  }

  async checkCryptoPrice(symbol: string, currentPrice: number, changePercent: number) {
    if (changePercent >= 0) return // Only check drops

    const userId = (await this.supabase.auth.getUser()).data.user?.id
    if (!userId) return

    // Get user's subscription for this asset
    const { data: sub } = await this.supabase
      .from("subscriptions")
      .select("*, profiles(notification_enabled)")
      .eq("user_id", userId)
      .eq("asset_symbol", symbol)
      .eq("asset_type", "crypto")
      .eq("is_active", true)
      .single()

    if (!sub || !sub.profiles?.notification_enabled) return

    const dropPercent = Math.abs(changePercent)

    if (dropPercent >= sub.threshold_percentage) {
      // Check cooldown
      const lastAlert = this.lastAlertTime.get(symbol) || 0
      if (Date.now() - lastAlert < this.COOLDOWN_MS) return

      this.lastAlertTime.set(symbol, Date.now())

      const cryptoInfo = TOP_CRYPTOS.find((c) => c.symbol === symbol)
      const alert: ClientAlert = {
        assetSymbol: symbol,
        assetName: cryptoInfo?.name || symbol,
        assetType: "crypto",
        currentPrice,
        dropPercentage: dropPercent,
        threshold: sub.threshold_percentage,
        timestamp: new Date(),
      }

      // Trigger callbacks
      this.alertCallbacks.forEach((cb) => cb(alert))

      // Record in database
      await this.supabase.from("alert_history").insert({
        user_id: userId,
        asset_symbol: symbol,
        asset_type: "crypto",
        trigger_price: currentPrice,
        drop_percentage: dropPercent,
        alert_condition: `24h drop: ${dropPercent.toFixed(2)}%`,
      })

      // Trigger server-side email (optional - will be rate limited)
      await this.triggerEmailAlert(userId, symbol, "crypto")
    }
  }

  async checkStockPrice(symbol: string, name: string, currentPrice: number, changePercent: number) {
    if (changePercent >= 0) return // Only check drops

    const userId = (await this.supabase.auth.getUser()).data.user?.id
    if (!userId) return

    // Get user's subscription for this asset
    const { data: sub } = await this.supabase
      .from("subscriptions")
      .select("*, profiles(notification_enabled)")
      .eq("user_id", userId)
      .eq("asset_symbol", symbol)
      .eq("asset_type", "stock")
      .eq("is_active", true)
      .single()

    if (!sub || !sub.profiles?.notification_enabled) return

    const dropPercent = Math.abs(changePercent)

    if (dropPercent >= sub.threshold_percentage) {
      // Check cooldown
      const lastAlert = this.lastAlertTime.get(symbol) || 0
      if (Date.now() - lastAlert < this.COOLDOWN_MS) return

      this.lastAlertTime.set(symbol, Date.now())

      const alert: ClientAlert = {
        assetSymbol: symbol,
        assetName: name,
        assetType: "stock",
        currentPrice,
        dropPercentage: dropPercent,
        threshold: sub.threshold_percentage,
        timestamp: new Date(),
      }

      // Trigger callbacks
      this.alertCallbacks.forEach((cb) => cb(alert))

      // Record in database
      await this.supabase.from("alert_history").insert({
        user_id: userId,
        asset_symbol: symbol,
        asset_type: "stock",
        trigger_price: currentPrice,
        drop_percentage: dropPercent,
        alert_condition: `Daily drop: ${dropPercent.toFixed(2)}%`,
      })

      // Trigger server-side email (optional)
      await this.triggerEmailAlert(userId, symbol, "stock")
    }
  }

  private async triggerEmailAlert(userId: string, assetSymbol: string, assetType: string) {
    try {
      await fetch("/api/send-immediate-alert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, assetSymbol, assetType }),
      })
    } catch (error) {
      console.error("[v0] Failed to trigger email alert:", error)
    }
  }
}
