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
                This Privacy Policy describes how we collect, use, and protect your information when you use our
                service.
              </p>
            </section>

            <section>
              <h2 className="mb-3 text-2xl font-semibold text-foreground">Information We Collect</h2>
              <p>
                We collect your email address and account credentials when you register. We also store your preferences
                for asset monitoring and notification settings.
              </p>
            </section>

            <section>
              <h2 className="mb-3 text-2xl font-semibold text-foreground">How We Use Your Information</h2>
              <p>We use your information to:</p>
              <ul className="list-inside list-disc space-y-2 mt-2">
                <li>Provide market monitoring services</li>
                <li>Send email notifications based on your preferences</li>
                <li>Maintain and improve our platform</li>
              </ul>
            </section>

            <section>
              <h2 className="mb-3 text-2xl font-semibold text-foreground">Data Security</h2>
              <p>
                We implement security measures to protect your data. Your password is encrypted and we use secure
                authentication methods.
              </p>
            </section>

            <section>
              <h2 className="mb-3 text-2xl font-semibold text-foreground">Your Rights</h2>
              <p>
                You can access, update, or delete your account information at any time through your profile settings.
              </p>
            </section>

            <section>
              <h2 className="mb-3 text-2xl font-semibold text-foreground">Contact</h2>
              <p>If you have questions about this Privacy Policy, please contact us through your account settings.</p>
            </section>
          </div>
        </div>
      </main>

      <footer className="border-t py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>&copy; 2025 eatfear. Real-time market crash monitoring.</p>
        </div>
      </footer>
    </div>
  )
}
