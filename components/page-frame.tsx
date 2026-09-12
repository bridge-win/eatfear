"use client"

import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

interface AppFrameProps {
  children: ReactNode
  className?: string
}

export function AppFrame({ children, className }: AppFrameProps) {
  return (
    <div className={cn("min-h-svh bg-background", className)}>
      {children}
    </div>
  )
}

interface DashboardFrameProps {
  children: ReactNode
  mainClassName?: string
  contentClassName?: string
}

export function DashboardFrame({
  children,
  mainClassName,
  contentClassName,
}: DashboardFrameProps) {
  return (
    <AppFrame>
      <main className={cn("container mx-auto min-w-0 px-4 py-3", mainClassName)}>
        <div className={cn("min-w-0 space-y-3", contentClassName)}>{children}</div>
      </main>
    </AppFrame>
  )
}
