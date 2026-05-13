"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { TrendingDown } from "lucide-react"
import { cn } from "@/lib/utils"

const navItems = [
  { href: "/", label: "home" },
  { href: "/crypto", label: "crypto" },
  { href: "/stock", label: "stock" },
  { href: "/macro", label: "macro" },
  { href: "/news", label: "news" },
]

export function SiteHeader() {
  const pathname = usePathname()

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="container mx-auto flex min-h-12 flex-col gap-2 px-4 py-2 md:flex-row md:items-center md:justify-between">
        <Link href="/" className="flex items-center gap-2">
          <TrendingDown className="h-5 w-5 text-primary" />
          <span className="text-lg font-bold">eatfear</span>
        </Link>
        <nav className="flex flex-wrap items-center gap-2">
          {navItems.map((item) => {
            const isActive =
              item.href === "/"
                ? pathname === "/" || pathname === "/home"
                : pathname === item.href || pathname.startsWith(`${item.href}/`)

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "rounded-full px-3 py-1.5 text-sm font-medium capitalize text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                  isActive && "bg-foreground text-background hover:bg-foreground hover:text-background",
                )}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>
      </div>
    </header>
  )
}
