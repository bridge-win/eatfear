export default function DiscoverLoading() {
  return (
    <main className="min-h-screen bg-background">
      <div className="container mx-auto space-y-4 px-4 py-5">
        <div className="h-28 animate-pulse rounded-lg border bg-muted/30" />
        <div className="grid gap-3 lg:grid-cols-3">
          <div className="h-48 animate-pulse rounded-lg border bg-muted/30" />
          <div className="h-48 animate-pulse rounded-lg border bg-muted/30" />
          <div className="h-48 animate-pulse rounded-lg border bg-muted/30" />
        </div>
      </div>
    </main>
  )
}
