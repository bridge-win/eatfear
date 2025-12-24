import { Button } from "@/components/ui/button"
import { ArrowRight, Bell, LineChart, TrendingDown } from "lucide-react"
import Link from "next/link"

export default function HomePage() {
  return (
    <div className="flex min-h-svh flex-col bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <TrendingDown className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold">CrashWatch</span>
          </div>
          <nav className="flex items-center gap-4">
            <Link href="/auth/login">
              <Button variant="ghost">Login</Button>
            </Link>
            <Link href="/auth/sign-up">
              <Button>Get Started</Button>
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1">
        <section className="container mx-auto px-4 py-24 md:py-32">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="text-balance text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
              Never Miss a Market Crash Again
            </h1>
            <p className="mt-6 text-pretty text-lg text-muted-foreground sm:text-xl">
              Real-time monitoring platform for cryptocurrency and stock market crashes. Get instant email alerts when
              your subscribed assets drop significantly.
            </p>
            <div className="mt-10 flex items-center justify-center gap-4">
              <Link href="/auth/sign-up">
                <Button size="lg" className="gap-2">
                  Start Monitoring Free
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="border-t bg-muted/50 py-24">
          <div className="container mx-auto px-4">
            <h2 className="text-center text-3xl font-bold mb-12">Everything You Need to Monitor Markets</h2>
            <div className="grid gap-8 md:grid-cols-3">
              <div className="flex flex-col items-center text-center">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <LineChart className="h-6 w-6 text-primary" />
                </div>
                <h3 className="mb-2 text-xl font-semibold">Real-time Tracking</h3>
                <p className="text-muted-foreground">
                  Monitor top 100 cryptocurrencies and major stocks with live WebSocket updates
                </p>
              </div>
              <div className="flex flex-col items-center text-center">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <TrendingDown className="h-6 w-6 text-primary" />
                </div>
                <h3 className="mb-2 text-xl font-semibold">Crash Detection</h3>
                <p className="text-muted-foreground">
                  Automatically detect significant drops with customizable thresholds
                </p>
              </div>
              <div className="flex flex-col items-center text-center">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <Bell className="h-6 w-6 text-primary" />
                </div>
                <h3 className="mb-2 text-xl font-semibold">Instant Alerts</h3>
                <p className="text-muted-foreground">
                  Receive email notifications within 1 minute when subscribed assets crash
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>&copy; 2025 CrashWatch. Real-time market crash monitoring.</p>
        </div>
      </footer>
    </div>
  )
}
