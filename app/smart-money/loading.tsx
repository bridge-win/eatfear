import { DashboardFrame } from "@/components/page-frame"

export default function Loading() {
  return (
    <DashboardFrame contentClassName="animate-pulse">
      <div className="h-6 w-48 rounded bg-muted" />
      <div className="h-3 w-80 rounded bg-muted/70" />
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-16 rounded-md border bg-muted/30" />
        ))}
      </div>
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className="h-64 rounded-md border bg-muted/20" />
      ))}
    </DashboardFrame>
  )
}
