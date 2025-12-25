import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"

export default function PrivacyPolicyPage() {
  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="border-b">
        <div className="container mx-auto flex h-16 items-center px-4">
          <Link href="/">
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Home
            </Button>
          </Link>
        </div>
      </header>

      <main className="flex-1">
        <div className="container mx-auto max-w-4xl px-4 py-12">
          <h1 className="mb-8 text-4xl font-bold">Privacy Policy</h1>
          <div className="space-y-6 text-muted-foreground">
            <section>
              <p className="text-sm mb-6">Last Updated: January 2025</p>
              <p>
                CrashWatch is committed to protecting your privacy. This Privacy Policy explains how we collect, use,
                and safeguard your information when you use our market monitoring platform.
              </p>
            </section>

            <section>
              <h2 className="mb-3 text-2xl font-semibold text-foreground">Information We Collect</h2>
              <div className="space-y-3">
                <div>
                  <h3 className="mb-2 text-lg font-medium text-foreground">Account Information</h3>
                  <p>
                    When you register for an account, we collect your email address and authentication credentials
                    (password or OAuth provider information such as Google).
                  </p>
                </div>
                <div>
                  <h3 className="mb-2 text-lg font-medium text-foreground">Usage Data</h3>
                  <p>
                    We collect information about your subscriptions to cryptocurrencies and stocks, alert preferences,
                    and notification history to provide our monitoring services.
                  </p>
                </div>
              </div>
            </section>

            <section>
              <h2 className="mb-3 text-2xl font-semibold text-foreground">How We Use Your Information</h2>
              <ul className="list-inside list-disc space-y-2">
                <li>To provide real-time market crash monitoring and alert services</li>
                <li>To send email notifications when your subscribed assets experience significant price drops</li>
                <li>To maintain and improve our platform functionality</li>
                <li>To communicate important service updates and changes</li>
                <li>To ensure platform security and prevent fraudulent activities</li>
              </ul>
            </section>

            <section>
              <h2 className="mb-3 text-2xl font-semibold text-foreground">Data Storage and Security</h2>
              <p>
                Your data is stored securely using industry-standard encryption practices. We use Supabase for
                authentication and database services, which implements Row Level Security (RLS) to ensure your data is
                protected. Passwords are encrypted and never stored in plain text.
              </p>
            </section>

            <section>
              <h2 className="mb-3 text-2xl font-semibold text-foreground">Third-Party Services</h2>
              <p className="mb-3">We use the following third-party services to operate our platform:</p>
              <ul className="list-inside list-disc space-y-2">
                <li>
                  <strong>Google OAuth:</strong> For authentication (when you choose to sign in with Google)
                </li>
                <li>
                  <strong>Supabase:</strong> For database and authentication services
                </li>
                <li>
                  <strong>Resend:</strong> For sending email notifications
                </li>
                <li>
                  <strong>Binance, CoinGecko, Yahoo Finance:</strong> For market data (no personal data shared)
                </li>
              </ul>
            </section>

            <section>
              <h2 className="mb-3 text-2xl font-semibold text-foreground">Email Communications</h2>
              <p>
                We send email notifications only when your subscribed assets trigger crash alerts. You can manage your
                notification preferences in your profile settings. We do not send marketing emails without your explicit
                consent.
              </p>
            </section>

            <section>
              <h2 className="mb-3 text-2xl font-semibold text-foreground">Your Rights</h2>
              <p className="mb-3">You have the right to:</p>
              <ul className="list-inside list-disc space-y-2">
                <li>Access and export your personal data</li>
                <li>Update or correct your account information</li>
                <li>Delete your account and associated data</li>
                <li>Opt out of email notifications</li>
                <li>Revoke OAuth permissions at any time</li>
              </ul>
            </section>

            <section>
              <h2 className="mb-3 text-2xl font-semibold text-foreground">Data Retention</h2>
              <p>
                We retain your account information and alert history for as long as your account is active. Alert
                history is automatically deleted after 90 days. When you delete your account, all personal data is
                permanently removed from our systems.
              </p>
            </section>

            <section>
              <h2 className="mb-3 text-2xl font-semibold text-foreground">Cookies and Tracking</h2>
              <p>
                We use essential cookies for authentication and session management. We do not use advertising cookies or
                third-party tracking scripts.
              </p>
            </section>

            <section>
              <h2 className="mb-3 text-2xl font-semibold text-foreground">Children's Privacy</h2>
              <p>
                Our service is not intended for users under the age of 18. We do not knowingly collect personal
                information from children.
              </p>
            </section>

            <section>
              <h2 className="mb-3 text-2xl font-semibold text-foreground">Changes to This Policy</h2>
              <p>
                We may update this Privacy Policy from time to time. We will notify you of any material changes by
                posting the new policy on this page and updating the "Last Updated" date.
              </p>
            </section>

            <section>
              <h2 className="mb-3 text-2xl font-semibold text-foreground">Contact Us</h2>
              <p>
                If you have any questions about this Privacy Policy or our data practices, please contact us through
                your account dashboard or by accessing your profile settings.
              </p>
            </section>
          </div>
        </div>
      </main>

      <footer className="border-t py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>&copy; 2025 CrashWatch. Real-time market crash monitoring.</p>
        </div>
      </footer>
    </div>
  )
}
