"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Menu, TrendingDown } from "lucide-react"

import { CommandPalette } from "@/components/command-palette"
import { LanguageToggle } from "@/components/language-toggle"
import { ThemeToggle } from "@/components/theme-toggle"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { useT } from "@/lib/i18n"
import { scheduleIdleTask } from "@/lib/client-performance"
import { cn } from "@/lib/utils"

const navItems = [
  { href: "/home", key: "nav.home" },
  { href: "/crypto", key: "nav.crypto" },
  { href: "/stock", key: "nav.stock" },
  { href: "/macro", key: "nav.macro" },
  { href: "/methodology", key: "nav.methodology" },
  { href: "/news", key: "nav.news" },
] as const

type NavHref = (typeof navItems)[number]["href"]

function isItemActive(pathname: string, href: string) {
  return href === "/home" ? pathname === "/home" : pathname === href || pathname.startsWith(`${href}/`)
}

export function SiteHeader() {
  const pathname = usePathname()
  const router = useRouter()
  const t = useT()
  const [mobileOpen, setMobileOpen] = React.useState(false)
  // Optimistic active item — updated immediately on click so the UI responds
  // without waiting for pathname to reflect the completed navigation.
  const [pendingHref, setPendingHref] = React.useState<NavHref | null>(null)
  const [isPending, startTransition] = React.useTransition()

  // Clear optimistic state once the real pathname catches up.
  React.useEffect(() => {
    if (pendingHref && isItemActive(pathname, pendingHref)) {
      setPendingHref(null)
    }
  }, [pathname, pendingHref])

  React.useEffect(() => {
    return scheduleIdleTask(() => {
      for (const item of navItems) router.prefetch(item.href)
    }, 1_000)
  }, [router])

  const prefetchRoute = React.useCallback((href: string) => {
    router.prefetch(href)
  }, [router])

  const navigate = React.useCallback((href: NavHref) => {
    setPendingHref(href)
    startTransition(() => {
      router.push(href)
    })
  }, [router])

  const activeHref = pendingHref ?? null

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="container mx-auto flex min-h-12 items-center justify-between gap-2 px-4 py-2">
        <div className="flex items-center gap-2">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <button
                type="button"
                aria-label={t("nav.menu")}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:hidden"
              >
                <Menu className="h-4.5 w-4.5" />
              </button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64">
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <TrendingDown className="h-5 w-5 text-primary" />
                  eatfear
                </SheetTitle>
              </SheetHeader>
              <nav className="flex flex-col gap-1 px-2">
                {navItems.map((item) => {
                  const isActive = activeHref ? activeHref === item.href : isItemActive(pathname, item.href)
                  return (
                    <button
                      key={item.href}
                      type="button"
                      onPointerEnter={() => prefetchRoute(item.href)}
                      onFocus={() => prefetchRoute(item.href)}
                      onClick={() => { setMobileOpen(false); navigate(item.href) }}
                      className={cn(
                        "rounded-md px-3 py-2 text-left text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                        isActive && "bg-foreground text-background hover:bg-foreground hover:text-background",
                      )}
                    >
                      {t(item.key)}
                    </button>
                  )
                })}
              </nav>
            </SheetContent>
          </Sheet>
          <Link href="/home" className="flex items-center gap-2">
            <TrendingDown className="h-5 w-5 text-primary" />
            <span className="text-lg font-bold">eatfear</span>
          </Link>
        </div>

        <nav className="hidden flex-wrap items-center gap-2 md:flex">
          {navItems.map((item) => {
            const isActive = activeHref ? activeHref === item.href : isItemActive(pathname, item.href)
            return (
              <button
                key={item.href}
                type="button"
                onPointerEnter={() => prefetchRoute(item.href)}
                onFocus={() => prefetchRoute(item.href)}
                onClick={() => navigate(item.href)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                  isActive && "bg-foreground text-background hover:bg-foreground hover:text-background",
                  isPending && pendingHref === item.href && "opacity-80",
                )}
              >
                {t(item.key)}
              </button>
            )
          })}
        </nav>

        <div className="flex items-center justify-end gap-2">
          <CommandPalette />
          <ThemeToggle />
          <LanguageToggle />
        </div>
      </div>
    </header>
  )
}
