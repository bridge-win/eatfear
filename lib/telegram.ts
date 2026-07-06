/**
 * Telegram Bot API helpers (@EatfearBot). Fetch-based, no SDK dependency, so it
 * runs on the edge and stays tiny.
 *
 * Flow: a signed-in user gets a deep-link (t.me/EatfearBot?start=<token>); when
 * they open it and press Start, Telegram POSTs a `/start <token>` update to the
 * webhook route, which binds their chat_id to the user via the one-time token.
 * Thereafter alert fan-out calls sendTelegramMessage(chat_id, ...).
 *
 * Network note: api.telegram.org is blocked by this dev container's egress
 * policy, so sends can only be verified in a deployed (Vercel) environment.
 */

const API_BASE = "https://api.telegram.org"

export const TELEGRAM_BOT_USERNAME = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ?? "EatfearBot"

export interface TelegramSendResult {
  ok: boolean
  error?: string
}

function botToken(): string | null {
  return process.env.TELEGRAM_BOT_TOKEN ?? null
}

/** Deep-link a user opens to bind their Telegram chat to their account. */
export function buildTelegramDeepLink(linkToken: string): string {
  return `https://t.me/${TELEGRAM_BOT_USERNAME}?start=${encodeURIComponent(linkToken)}`
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
