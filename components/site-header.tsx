"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Menu } from "lucide-react"

import { BrandLogo } from "@/components/brand-logo"
import { CommandPalette } from "@/components/command-palette"
import { FontSizeToggle } from "@/components/font-size-toggle"
import { LanguageToggle } from "@/components/language-toggle"
import { ThemeToggle } from "@/components/theme-toggle"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { useT } from "@/lib/i18n"
import { cn } from "@/lib/utils"

export const navItems = [
  { href: "/home", key: "nav.home" },
  { href: "/crypto", key: "nav.crypto" },
  { href: "/smart-money", key: "nav.smartMoney" },
  { href: "/stock", key: "nav.stock" },
  { href: "/discover", key: "nav.discover" },
  { href: "/watchlist", key: "nav.watchlist" },
  { href: "/journal", key: "nav.journal" },
  { href: "/macro", key: "nav.macro" },
  { href: "/methodology", key: "nav.methodology" },
  { href: "/news", key: "nav.news" },
] as const

type NavHref = (typeof navItems)[number]["href"]

function isItemActive(pathname: string, href: string) {
  return href === "/home" ? pathname === "/home" : pathname === href || pathname.startsWith(`${href}/`)
}

// Nested routes match multiple items — the most
// specific (longest) matching href wins so only one tab highlights.
function resolveActiveHref(pathname: string): string | null {
  let best: string | null = null
  for (const item of navItems) {
    if (isItemActive(pathname, item.href) && (best === null || item.href.length > best.length)) {
      best = item.href
    }
  }
  return best
}

export function isMainNavPath(pathname: string) {
  return navItems.some((item) => isItemActive(pathname, item.href))
}

function applyPendingNavHighlight(href: NavHref) {
  if (typeof document === "undefined") return

  const isDark = document.documentElement.classList.contains("dark")
  const activeBackground = isDark ? "rgb(250, 250, 250)" : "rgb(33, 33, 33)"
  const activeColor = isDark ? "rgb(33, 33, 33)" : "rgb(250, 250, 250)"

  for (const item of document.querySelectorAll<HTMLElement>("[data-main-nav-href]")) {
    const isPending = item.dataset.mainNavHref === href
    item.dataset.pendingActive = isPending ? "true" : "false"
    if (isPending) {
      item.style.setProperty("transition", "none", "important")
      item.style.setProperty("background-color", activeBackground, "important")
      item.style.setProperty("color", activeColor, "important")
    } else {
      item.style.removeProperty("transition")
      item.style.removeProperty("background-color")
      item.style.removeProperty("color")
    }
  }
}

function clearPendingNavHighlight() {
  if (typeof document === "undefined") return

  for (const item of document.querySelectorAll<HTMLElement>("[data-main-nav-href]")) {
    delete item.dataset.pendingActive
    item.style.removeProperty("transition")
    item.style.removeProperty("background-color")
    item.style.removeProperty("color")
  }
}

export function SiteHeader() {
  const pathname = usePathname()
  const router = useRouter()
  const t = useT()
  const [mobileOpen, setMobileOpen] = React.useState(false)
  const [optimisticHref, setOptimisticHref] = React.useState<NavHref | null>(null)
  const pendingPushRef = React.useRef<NavHref | null>(null)
  const activePathname = optimisticHref ?? pathname
  const activeHref = resolveActiveHref(activePathname)

  React.useEffect(() => {
    pendingPushRef.current = null
    clearPendingNavHighlight()
    if (optimisticHref && isItemActive(pathname, optimisticHref)) setOptimisticHref(null)
  }, [optimisticHref, pathname])

  const markRoutePending = React.useCallback((href: NavHref) => {
    if (isItemActive(pathname, href)) return
    applyPendingNavHighlight(href)
    React.startTransition(() => {
      setOptimisticHref(href)
    })
  }, [pathname])

  const pushRoute = React.useCallback((href: NavHref) => {
    if (isItemActive(pathname, href)) return
    markRoutePending(href)
    if (pendingPushRef.current === href) return
    pendingPushRef.current = href
    window.setTimeout(() => router.push(href), 0)
  }, [markRoutePending, pathname, router])

  const canHandleNavigationEvent = React.useCallback((
    event: React.MouseEvent<HTMLAnchorElement> | React.PointerEvent<HTMLAnchorElement>,
  ) => {
    return !(
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.altKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.currentTarget.target
    )
  }, [])

  const handlePointerDown = React.useCallback((event: React.PointerEvent<HTMLAnchorElement>, href: NavHref) => {
    if (!canHandleNavigationEvent(event)) return
    pushRoute(href)
  }, [canHandleNavigationEvent, pushRoute])

  const navigate = React.useCallback((event: React.MouseEvent<HTMLAnchorElement>, href: NavHref) => {
    if (
      !canHandleNavigationEvent(event)
    ) {
      return
    }

    event.preventDefault()
    pushRoute(href)
  }, [canHandleNavigationEvent, pushRoute])

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
                <SheetTitle>
                  <BrandLogo className="text-base" markClassName="h-6 w-6" />
                </SheetTitle>
              </SheetHeader>
              <nav className="flex flex-col gap-1 px-2">
                {navItems.map((item) => {
                  const isActive = activeHref === item.href
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      prefetch={false}
                      data-main-nav-href={item.href}
                      onPointerDown={(event) => handlePointerDown(event, item.href)}
                      onClick={(event) => {
                        navigate(event, item.href)
                        setMobileOpen(false)
                      }}
                      className={cn(
                        "rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                        isActive && "bg-foreground text-background hover:bg-foreground hover:text-background",
                      )}
                    >
                      {t(item.key)}
                    </Link>
                  )
                })}
              </nav>
            </SheetContent>
          </Sheet>
          <Link
            href="/home"
            prefetch={false}
            data-main-nav-href="/home"
            onPointerDown={(event) => handlePointerDown(event, "/home")}
            onClick={(event) => navigate(event, "/home")}
            className="flex items-center"
          >
            <BrandLogo className="text-lg" markClassName="h-6 w-6" />
          </Link>
        </div>

        <nav className="hidden flex-wrap items-center gap-2 md:flex">
          {navItems.map((item) => {
            const isActive = activeHref === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch={false}
                data-main-nav-href={item.href}
                onPointerDown={(event) => handlePointerDown(event, item.href)}
                onClick={(event) => navigate(event, item.href)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                  isActive && "bg-foreground text-background hover:bg-foreground hover:text-background",
                )}
              >
                {t(item.key)}
              </Link>
            )
          })}
        </nav>

        <div className="flex items-center justify-end gap-2">
          <CommandPalette />
          <FontSizeToggle />
          <ThemeToggle />
          <LanguageToggle />
        </div>
      </div>
    </header>
  )
}
