export default function Loading() {
  return (
    <main className="container mx-auto px-4 py-4">
      <div className="space-y-4 animate-pulse">
        <div className="h-6 w-56 rounded bg-muted" />
        <div className="h-3 w-full max-w-3xl rounded bg-muted/70" />
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 9 }).map((_, index) => (
            <div key={index} className="h-28 rounded-md border bg-muted/20" />
          ))}
        </div>
      </div>
    </main>
  )
}
