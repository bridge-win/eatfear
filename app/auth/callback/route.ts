import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  const next = searchParams.get("next") ?? "/"
  const error = searchParams.get("error")
  const error_description = searchParams.get("error_description")

  if (error) {
    console.log("[v0] OAuth error received:", error, error_description)
    return NextResponse.redirect(
      `${origin}/auth/auth-error?error=${encodeURIComponent(error)}&message=${encodeURIComponent(error_description || "Authentication failed")}`,
    )
  }

  if (code) {
    const supabase = await createClient()

    if (!supabase) {
      return NextResponse.redirect(
        `${origin}/auth/auth-error?error=service_unavailable&message=${encodeURIComponent("Authentication service not configured")}`,
      )
    }

    const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

    if (!exchangeError && data.session) {
      console.log("[v0] Successfully exchanged code for session, user:", data.user?.email)

      const forwardedHost = request.headers.get("x-forwarded-host")
      const isLocalEnv = process.env.NODE_ENV === "development"

      if (isLocalEnv) {
        return NextResponse.redirect(`${origin}${next}`)
      } else if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${next}`)
      } else {
        return NextResponse.redirect(`${origin}${next}`)
      }
    } else {
      console.log("[v0] Failed to exchange code:", exchangeError?.message)
      return NextResponse.redirect(
        `${origin}/auth/auth-error?error=exchange_failed&message=${encodeURIComponent(exchangeError?.message || "Failed to authenticate")}`,
      )
    }
  }

  console.log("[v0] No code provided in callback")
  return NextResponse.redirect(`${origin}/auth/auth-error?error=no_code&message=No authentication code provided`)
}
