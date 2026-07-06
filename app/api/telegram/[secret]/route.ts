import { NextResponse } from "next/server"

import { createAdminClient } from "@/lib/supabase/admin"
import { parseStartCommand, sendTelegramMessage, type TelegramUpdate } from "@/lib/telegram"

export const dynamic = "force-dynamic"

/**
 * Telegram webhook. Set it once with:
 *   curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://<domain>/api/telegram/<TELEGRAM_WEBHOOK_SECRET>"
 *
 * The secret is a path segment so Telegram (and only Telegram, who knows the
 * URL) can post here. Handles `/start <link_token>` to bind a chat to a user.
 */
export async function POST(request: Request, ctx: { params: Promise<{ secret: string }> }) {
  const { secret } = await ctx.params
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET
  if (!expected || secret !== expected) {
    return NextResponse.json({ ok: false }, { status: 404 })
  }

  let update: TelegramUpdate
  try {
    update = (await request.json()) as TelegramUpdate
  } catch {
    return NextResponse.json({ ok: true }) // ack malformed to stop Telegram retrying
  }

  const start = parseStartCommand(update)
  if (!start) return NextResponse.json({ ok: true })

  const admin = createAdminClient()
  if (!admin) {
    await sendTelegramMessage(start.chatId, "⚠️ eatfear alerts are not configured yet. Try again later.")
    return NextResponse.json({ ok: true })
  }

  if (!start.token) {
    await sendTelegramMessage(
      start.chatId,
      "👋 Welcome to <b>eatfear</b> alerts.\n\nOpen your <b>Profile → Connect Telegram</b> on the site and tap the button to link this chat.",
    )
    return NextResponse.json({ ok: true })
  }

  // Match the one-time deep-link token to a pending link row, then bind the chat.
  const { data: pending } = await admin
    .from("telegram_links")
    .select("user_id")
    .eq("link_token", start.token)
    .is("verified_at", null)
    .maybeSingle()

  if (!pending) {
    await sendTelegramMessage(start.chatId, "❌ This link is invalid or already used. Generate a new one from your Profile.")
    return NextResponse.json({ ok: true })
  }

  const { error } = await admin
    .from("telegram_links")
    .update({
      chat_id: start.chatId,
      username: start.username ?? null,
      link_token: null,
      verified_at: new Date().toISOString(),
    })
    .eq("user_id", pending.user_id)

  if (error) {
    await sendTelegramMessage(start.chatId, "❌ Could not link this chat. Please try again.")
    return NextResponse.json({ ok: true })
  }

  await sendTelegramMessage(
    start.chatId,
    "✅ <b>Linked.</b> You'll get eatfear signal alerts here — oversold dips and overbought distribution, with the evidence and historical stats. Manage rules in your Profile.",
  )
  return NextResponse.json({ ok: true })
}
