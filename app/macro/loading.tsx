import { DashboardFrame } from "@/components/page-frame"

export default function Loading() {
  return (
    <DashboardFrame contentClassName="animate-pulse">
      <div className="h-6 w-40 rounded bg-muted" />
      <div className="h-3 w-72 rounded bg-muted/70" />
      <div className="grid gap-2 md:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="h-16 rounded-md border bg-muted/30" />
        ))}
      </div>
      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="h-32 rounded-md border bg-muted/20" />
        ))}
      </div>
    </DashboardFrame>
  )
}
