"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { TrendingDown } from "lucide-react"

import { LanguageToggle } from "@/components/language-toggle"
import { useT } from "@/lib/i18n"
import { cn } from "@/lib/utils"

const navItems = [
  { href: "/home", key: "nav.home" },
  { href: "/crypto", key: "nav.crypto" },
  { href: "/stock", key: "nav.stock" },
  { href: "/macro", key: "nav.macro" },
  { href: "/methodology", key: "nav.methodology" },
  { href: "/news", key: "nav.news" },
] as const

export function SiteHeader() {
  const pathname = usePathname()
  const t = useT()

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="container mx-auto flex min-h-12 flex-col gap-2 px-4 py-2 md:flex-row md:items-center md:justify-between">
        <Link href="/crypto" className="flex items-center gap-2">
          <TrendingDown className="h-5 w-5 text-primary" />
          <span className="text-lg font-bold">eatfear</span>
        </Link>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <nav className="flex flex-wrap items-center gap-2">
            {navItems.map((item) => {
              const isActive =
                item.href === "/home"
                  ? pathname === "/home"
                  : pathname === item.href || pathname.startsWith(`${item.href}/`)

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  prefetch
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
          <LanguageToggle />
        </div>
      </div>
    </header>
  )
}
