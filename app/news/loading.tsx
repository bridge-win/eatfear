export default function Loading() {
  return (
    <main className="container mx-auto px-4 py-3">
      <div className="space-y-3 animate-pulse">
        <div className="h-6 w-40 rounded bg-muted" />
        <div className="h-3 w-full max-w-4xl rounded bg-muted/70" />
        <div className="grid gap-3 lg:grid-cols-[1fr_280px]">
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, index) => (
              <div key={index} className="h-20 rounded-md border bg-muted/20" />
            ))}
          </div>
          <div className="space-y-2">
            {Array.from({ length: 2 }).map((_, index) => (
              <div key={index} className="h-32 rounded-md border bg-muted/20" />
            ))}
          </div>
        </div>
      </div>
    </main>
  )
}
