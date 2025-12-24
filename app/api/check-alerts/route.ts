import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"
import { generateCrashAlertEmail } from "@/lib/email-templates"
import { fetchStockData } from "@/lib/stock-service"
import { TOP_CRYPTOS } from "@/lib/crypto-service"

export const runtime = "edge"

// This endpoint should be called by a cron job every 5 minutes
export async function GET(request: Request) {
  try {
    // Verify cron secret for security
    const authHeader = request.headers.get("authorization")
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

    // Get all active subscriptions
    const { data: subscriptions, error: subsError } = await supabase
      .from("subscriptions")
      .select("*, profiles(email, notification_enabled)")
      .eq("is_active", true)

    if (subsError || !subscriptions) {
      throw new Error("Failed to fetch subscriptions")
    }

    const alertsSent: string[] = []
    const now = new Date()
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)

    // Process crypto subscriptions
    const cryptoSubs = subscriptions.filter((s) => s.asset_type === "crypto")
    for (const sub of cryptoSubs) {
      if (!sub.profiles?.notification_enabled) continue

      // Check if alert was sent in last 24 hours
      const { data: recentAlerts } = await supabase
        .from("alert_history")
        .select("id")
        .eq("user_id", sub.user_id)
        .eq("asset_symbol", sub.asset_symbol)
        .gte("sent_at", twentyFourHoursAgo.toISOString())
        .limit(1)

      if (recentAlerts && recentAlerts.length > 0) continue

      // Fetch current price from Binance
      try {
        const response = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${sub.asset_symbol}`)
        const data = await response.json()

        if (data.priceChangePercent) {
          const dropPercent = Math.abs(Number.parseFloat(data.priceChangePercent))
          const currentPrice = Number.parseFloat(data.lastPrice)

          if (dropPercent >= sub.threshold_percentage && Number.parseFloat(data.priceChangePercent) < 0) {
            // Send alert
            const cryptoInfo = TOP_CRYPTOS.find((c) => c.symbol === sub.asset_symbol)
            const email = generateCrashAlertEmail(
              cryptoInfo?.name || sub.asset_symbol,
              sub.asset_symbol,
              "crypto",
              currentPrice,
              dropPercent,
              sub.threshold_percentage,
            )

            await sendEmail(sub.profiles.email, email.subject, email.html, email.text)

            // Record alert
            await supabase.from("alert_history").insert({
              user_id: sub.user_id,
              asset_symbol: sub.asset_symbol,
              asset_type: "crypto",
              trigger_price: currentPrice,
              drop_percentage: dropPercent,
              alert_condition: `24h drop: ${dropPercent.toFixed(2)}%`,
            })

            alertsSent.push(`${sub.asset_symbol} to ${sub.profiles.email}`)
          }
        }
      } catch (error) {
        console.error(`[v0] Error checking crypto ${sub.asset_symbol}:`, error)
      }
    }

    // Process stock subscriptions
    const stockSubs = subscriptions.filter((s) => s.asset_type === "stock")
    if (stockSubs.length > 0) {
      const uniqueSymbols = [...new Set(stockSubs.map((s) => s.asset_symbol))]
      const stockData = await fetchStockData(uniqueSymbols)

      for (const sub of stockSubs) {
        if (!sub.profiles?.notification_enabled) continue

        // Check if alert was sent in last 24 hours
        const { data: recentAlerts } = await supabase
          .from("alert_history")
          .select("id")
          .eq("user_id", sub.user_id)
          .eq("asset_symbol", sub.asset_symbol)
          .gte("sent_at", twentyFourHoursAgo.toISOString())
          .limit(1)

        if (recentAlerts && recentAlerts.length > 0) continue

        const stock = stockData.get(sub.asset_symbol)
        if (!stock) continue

        const dropPercent = Math.abs(stock.changePercentToday)

        if (dropPercent >= sub.threshold_percentage && stock.changePercentToday < 0) {
          // Send alert
          const email = generateCrashAlertEmail(
            stock.name,
            sub.asset_symbol,
            "stock",
            stock.price,
            dropPercent,
            sub.threshold_percentage,
          )

          await sendEmail(sub.profiles.email, email.subject, email.html, email.text)

          // Record alert
          await supabase.from("alert_history").insert({
            user_id: sub.user_id,
            asset_symbol: sub.asset_symbol,
            asset_type: "stock",
            trigger_price: stock.price,
            drop_percentage: dropPercent,
            alert_condition: `Daily drop: ${dropPercent.toFixed(2)}%`,
          })

          alertsSent.push(`${sub.asset_symbol} to ${sub.profiles.email}`)
        }
      }
    }

    return NextResponse.json({
      success: true,
      alertsSent: alertsSent.length,
      alerts: alertsSent,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("[v0] Error in check-alerts:", error)
    return NextResponse.json(
      { error: "Failed to check alerts", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}

async function sendEmail(to: string, subject: string, html: string, text: string) {
  // Using Resend API for sending emails
  const RESEND_API_KEY = process.env.RESEND_API_KEY

  if (!RESEND_API_KEY) {
    console.error("[v0] RESEND_API_KEY not configured")
    return
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "CrashWatch <alerts@crashwatch.app>",
        to: [to],
        subject,
        html,
        text,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      console.error("[v0] Failed to send email:", error)
    }
  } catch (error) {
    console.error("[v0] Error sending email:", error)
  }
}
