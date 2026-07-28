import { NextResponse } from "next/server"

import { createAdminClient } from "@/lib/supabase/admin"
import { parseStartCommand, sendTelegramMessage, verifyLinkToken, type TelegramUpdate } from "@/lib/telegram"

// Node runtime, not edge: lib/telegram.ts signs deep-link tokens with
// node:crypto (createHmac/timingSafeEqual), which the edge runtime lacks.
export const runtime = "nodejs"

/**
 * Telegram webhook. Set it once with:
 *   curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://<domain>/api/telegram/<TELEGRAM_WEBHOOK_SECRET>"
 *
 * The secret is a path segment so only Telegram (who is given the URL) can post
 * here. Handles `/start <token>` — a signed, expiring token (see lib/telegram.ts)
 * — binding this chat to the user in `telegram_links(user_id, chat_id)`.
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

  const verified = verifyLinkToken(start.token)
  if (!verified) {
    await sendTelegramMessage(start.chatId, "❌ This link expired or is invalid. Generate a new one from your Profile.")
    return NextResponse.json({ ok: true })
  }

  // A chat can only be bound to one account; a user can only bind one chat
  // (both columns are UNIQUE). Upsert on user_id so re-linking replaces the chat.
  const { error } = await admin
    .from("telegram_links")
    .upsert({ user_id: verified.userId, chat_id: String(start.chatId), verified_at: new Date().toISOString() }, { onConflict: "user_id" })

  if (error) {
    const isChatConflict = error.message?.toLowerCase().includes("chat_id")
    await sendTelegramMessage(
      start.chatId,
      isChatConflict
        ? "❌ This Telegram chat is already linked to a different eatfear account."
        : "❌ Could not link this chat. Please try again.",
    )
    return NextResponse.json({ ok: true })
  }

  await sendTelegramMessage(
    start.chatId,
    "✅ <b>Linked.</b> You'll get eatfear signal alerts here — oversold dips and overbought distribution, with the evidence and historical stats. Manage rules in your Profile.",
  )
  return NextResponse.json({ ok: true })
}
