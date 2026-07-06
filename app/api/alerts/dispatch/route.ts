import { NextResponse } from "next/server"

import {
  channelsForEvent,
  formatAlertMessage,
  type AlertChannel,
  type AlertRule,
  type SignalEventRecord,
} from "@/lib/alert-fanout"
import { createAdminClient } from "@/lib/supabase/admin"
import { sendTelegramMessage } from "@/lib/telegram"

// Node runtime, not edge: imports lib/telegram.ts, which signs deep-link
// tokens with node:crypto (createHmac/timingSafeEqual).
export const runtime = "nodejs"

/**
 * Alert dispatch worker — ROADMAP.md "Next Integration Work" items 2-4: a
 * cron-driven worker that reads recent `signal_events`, matches them against
 * each user's `alert_rules`, and delivers through email / in-app / Telegram,
 * logging to `alerts_log` so a run never double-sends.
 *
 * Call every ~5 minutes from whatever fires `signal_events` inserts (e.g. the
 * same job that scores black-swan/euphoria for watchlist symbols), or on a
 * standalone schedule if events are written elsewhere. Guarded by CRON_SECRET,
 * matching the existing /api/check-alerts convention.
 *
 * `web_push` channel is schema-reserved but has no subscription infra yet, so
 * it is skipped (not fabricated) until that lands.
 */

const LOOKBACK_MS = 15 * 60 * 1000 // events triggered in the last 15 minutes

async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return false
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ from: "eatfear <onboarding@resend.dev>", to: [to], subject, html }),
    })
    return res.ok
  } catch {
    return false
  }
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = createAdminClient()
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 })
  }

  const since = new Date(Date.now() - LOOKBACK_MS).toISOString()
  const { data: events, error: eventsError } = await supabase
    .from("signal_events")
    .select("*")
    .eq("state", "triggered")
    .gte("triggered_at", since)

  if (eventsError) {
    return NextResponse.json({ error: eventsError.message }, { status: 500 })
  }
  if (!events || events.length === 0) {
    return NextResponse.json({ dispatched: 0, events: 0 })
  }

  const { data: rules, error: rulesError } = await supabase.from("alert_rules").select("*").eq("enabled", true)
  if (rulesError) {
    return NextResponse.json({ error: rulesError.message }, { status: 500 })
  }
  const rulesByUser = new Map<string, AlertRule[]>()
  for (const r of (rules ?? []) as AlertRule[]) {
    const list = rulesByUser.get(r.user_id) ?? []
    list.push(r)
    rulesByUser.set(r.user_id, list)
  }

  let dispatched = 0

  for (const rawEvent of events as (SignalEventRecord & { id: string; user_id: string | null })[]) {
    // A per-user event only concerns that user; a global event (user_id null)
    // is evaluated against every user's rules.
    const candidateUserIds = rawEvent.user_id ? [rawEvent.user_id] : [...rulesByUser.keys()]

    for (const userId of candidateUserIds) {
      const userRules = rulesByUser.get(userId)
      if (!userRules?.length) continue
      const channels = channelsForEvent(userRules, rawEvent)
      if (channels.length === 0) continue

      // Dedup: skip channels already logged for this (user, event).
      const { data: already } = await supabase
        .from("alerts_log")
        .select("channel")
        .eq("user_id", userId)
        .eq("event_id", rawEvent.id)
      const sentChannels = new Set((already ?? []).map((r: { channel: string }) => r.channel))
      const toSend = channels.filter((c) => !sentChannels.has(c))
      if (toSend.length === 0) continue

      const locale = "en" as const
      const { title, body } = formatAlertMessage(rawEvent, locale)

      for (const channel of toSend as AlertChannel[]) {
        let delivered = false
        if (channel === "in_app") {
          delivered = true // the alerts_log row itself is the in-app delivery
        } else if (channel === "telegram") {
          const { data: link } = await supabase
            .from("telegram_links")
            .select("chat_id")
            .eq("user_id", userId)
            .maybeSingle()
          if (link?.chat_id) {
            const res = await sendTelegramMessage(link.chat_id, body)
            delivered = res.ok
          }
        } else if (channel === "email") {
          const { data: profile } = await supabase
            .from("profiles")
            .select("email, notification_enabled")
            .eq("id", userId)
            .maybeSingle()
          if (profile?.email && profile.notification_enabled !== false) {
            delivered = await sendEmail(profile.email, title, body.replace(/\n/g, "<br/>"))
          }
        } else {
          continue // web_push: schema-reserved, no subscription infra yet
        }

        if (delivered) {
          await supabase.from("alerts_log").insert({
            user_id: userId,
            event_id: rawEvent.id,
            channel,
            title,
            body,
          })
          dispatched += 1
        }
      }
    }
  }

  return NextResponse.json({ dispatched, events: events.length })
}
