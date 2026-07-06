/**
 * Telegram Bot API helpers (@EatfearBot) — the delivery channel ROADMAP.md
 * lists as "Integration-ready" under Next Integration Work item 5.
 *
 * Binding uses a stateless, signed deep-link token instead of a pending-row
 * table: `/start <token>` where token = base64url(userId.expiry.hmac). This
 * needs no schema change beyond the existing `telegram_links(user_id, chat_id,
 * verified_at, created_at)` (UNIQUE user_id, UNIQUE chat_id) — the webhook
 * verifies the signature + expiry, then upserts the binding.
 *
 * Fetch-based, no SDK dependency, edge-friendly.
 *
 * Network note: api.telegram.org is blocked by this dev container's egress
 * policy, so sends can only be verified in a deployed (Vercel) environment.
 */

import { createHmac, timingSafeEqual } from "node:crypto"

const API_BASE = "https://api.telegram.org"
const LINK_TTL_MS = 15 * 60 * 1000 // 15 minutes to open the deep link

export const TELEGRAM_BOT_USERNAME = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ?? "EatfearBot"

function botToken(): string | null {
  return process.env.TELEGRAM_BOT_TOKEN ?? null
}

/** Reuses CRON_SECRET as the HMAC key so no additional env var is required. */
function linkSecret(): string | null {
  return process.env.TELEGRAM_LINK_SECRET ?? process.env.CRON_SECRET ?? null
}

function base64url(input: Buffer): string {
  return input.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

function base64urlToBuffer(input: string): Buffer {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/").padEnd(input.length + ((4 - (input.length % 4)) % 4), "=")
  return Buffer.from(padded, "base64")
}

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex")
}

/** Deep-link a signed-in user opens to bind their Telegram chat to their account. */
export function buildTelegramDeepLink(userId: string): { url: string; expiresAt: number } | null {
  const secret = linkSecret()
  if (!secret) return null
  const expiresAt = Date.now() + LINK_TTL_MS
  const payload = `${userId}.${expiresAt}`
  const sig = sign(payload, secret)
  const token = base64url(Buffer.from(`${payload}.${sig}`))
  return { url: `https://t.me/${TELEGRAM_BOT_USERNAME}?start=${encodeURIComponent(token)}`, expiresAt }
}

export interface VerifiedLink {
  userId: string
}

/** Verify a `/start` token: signature valid and not expired. Returns null otherwise. */
export function verifyLinkToken(token: string): VerifiedLink | null {
  const secret = linkSecret()
  if (!secret) return null
  let decoded: string
  try {
    decoded = base64urlToBuffer(token).toString("utf8")
  } catch {
    return null
  }
  const parts = decoded.split(".")
  if (parts.length !== 3) return null
  const [userId, expiryStr, sig] = parts
  const expiry = Number(expiryStr)
  if (!userId || !Number.isFinite(expiry) || expiry < Date.now()) return null

  const expectedSig = sign(`${userId}.${expiryStr}`, secret)
  const a = new Uint8Array(Buffer.from(sig, "hex"))
  const b = new Uint8Array(Buffer.from(expectedSig, "hex"))
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  return { userId }
}

export interface TelegramSendResult {
  ok: boolean
  error?: string
}

export async function sendTelegramMessage(
  chatId: number | string,
  text: string,
  options: { disablePreview?: boolean } = {},
): Promise<TelegramSendResult> {
  const token = botToken()
  if (!token) return { ok: false, error: "TELEGRAM_BOT_TOKEN not configured" }
  try {
    const res = await fetch(`${API_BASE}/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: options.disablePreview ?? true,
      }),
    })
    const json = (await res.json()) as { ok: boolean; description?: string }
    return json.ok ? { ok: true } : { ok: false, error: json.description ?? `HTTP ${res.status}` }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "send failed" }
  }
}

// ─── minimal webhook Update shape (only the fields we use) ──────────────────

export interface TelegramUpdate {
  update_id: number
  message?: {
    message_id: number
    from?: { id: number; username?: string; first_name?: string }
    chat: { id: number; type: string; username?: string }
    text?: string
  }
}

/** Extract a `/start <token>` payload, or null for other messages. */
export function parseStartCommand(update: TelegramUpdate): { chatId: number; username?: string; token: string | null } | null {
  const msg = update.message
  if (!msg?.text || !msg.text.startsWith("/start")) return null
  const parts = msg.text.trim().split(/\s+/)
  return {
    chatId: msg.chat.id,
    username: msg.from?.username ?? msg.chat.username,
    token: parts.length > 1 ? parts[1] : null,
  }
}
