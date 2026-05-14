import { SiteHeader } from "@/components/site-header"

export default function Loading() {
  return (
    <div className="min-h-svh bg-background">
      <SiteHeader />
      <main className="container mx-auto px-4 py-3">
        <div className="space-y-3 animate-pulse">
          <div className="h-6 w-40 rounded bg-muted" />
          <div className="h-3 w-72 rounded bg-muted/70" />
          <div className="grid gap-2 md:grid-cols-3 lg:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-16 rounded-md border bg-muted/30" />
            ))}
          </div>
          <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-32 rounded-md border bg-muted/20" />
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
