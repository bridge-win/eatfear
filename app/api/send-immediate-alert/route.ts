import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"
import { generateCrashAlertEmail } from "@/lib/email-templates"
import { TOP_CRYPTOS } from "@/lib/crypto-service"

export const runtime = "edge"

// This endpoint is called by client when it detects a crash in real-time
export async function POST(request: Request) {
  try {
    const { userId, assetSymbol, assetType } = await request.json()

    if (!userId || !assetSymbol || !assetType) {
      return NextResponse.json({ error: "Missing parameters" }, { status: 400 })
    }

    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

    // Get subscription and user info
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("*, profiles(email, notification_enabled)")
      .eq("user_id", userId)
      .eq("asset_symbol", assetSymbol)
      .eq("asset_type", assetType)
      .eq("is_active", true)
      .single()

    if (!sub || !sub.profiles?.notification_enabled) {
      return NextResponse.json({ success: false, reason: "No active subscription" })
    }

    // Check if alert was sent recently (anti-spam)
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const { data: recentAlerts } = await supabase
      .from("alert_history")
      .select("id")
      .eq("user_id", userId)
      .eq("asset_symbol", assetSymbol)
      .gte("sent_at", twentyFourHoursAgo.toISOString())
      .limit(1)

    if (recentAlerts && recentAlerts.length > 0) {
      return NextResponse.json({ success: false, reason: "Alert sent recently" })
    }

    // Get latest price and drop info from alert history
    const { data: latestAlert } = await supabase
      .from("alert_history")
      .select("trigger_price, drop_percentage")
      .eq("user_id", userId)
      .eq("asset_symbol", assetSymbol)
      .order("created_at", { ascending: false })
      .limit(1)
      .single()

    if (!latestAlert) {
      return NextResponse.json({ success: false, reason: "No recent alert data" })
    }

    // Send email
    const assetName =
      assetType === "crypto" ? TOP_CRYPTOS.find((c) => c.symbol === assetSymbol)?.name || assetSymbol : assetSymbol

    const email = generateCrashAlertEmail(
      assetName,
      assetSymbol,
      assetType,
      latestAlert.trigger_price,
      latestAlert.drop_percentage,
      sub.threshold_percentage,
    )

    await sendEmail(sub.profiles.email, email.subject, email.html, email.text)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Error in send-immediate-alert:", error)
    return NextResponse.json(
      { error: "Failed to send alert", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}

async function sendEmail(to: string, subject: string, html: string, text: string) {
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
        from: "eatfear <onboarding@resend.dev>",
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
