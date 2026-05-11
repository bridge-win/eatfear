import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { generateCrashAlertEmail } from "@/lib/email-templates"

export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get user email
    const { data: profile } = await supabase.from("profiles").select("email").eq("id", user.id).single()

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 })
    }

    // Generate test email
    const email = generateCrashAlertEmail("Bitcoin", "BTCUSDT", "crypto", 45000, 8.5, 5.0)

    // Send email
    const RESEND_API_KEY = process.env.RESEND_API_KEY

    if (!RESEND_API_KEY) {
      return NextResponse.json({ error: "Email service not configured" }, { status: 500 })
    }

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "eatfear <onboarding@resend.dev>",
        to: [profile.email],
        subject: email.subject,
        html: email.html,
        text: email.text,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      console.error("[v0] Resend API error:", error)
      return NextResponse.json({ error: "Failed to send email", details: error }, { status: 500 })
    }

    const result = await response.json()

    return NextResponse.json({
      success: true,
      message: "Test alert sent successfully",
      emailId: result.id,
    })
  } catch (error) {
    console.error("[v0] Error sending test alert:", error)
    return NextResponse.json(
      { error: "Failed to send test alert", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}
