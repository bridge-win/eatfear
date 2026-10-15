"use client"

import { usePathname } from "next/navigation"
import { isMainNavPath, SiteHeader } from "@/components/site-header"

export function MainSiteHeader() {
  const pathname = usePathname()
  // /cn owns its responsive workspace navigation; avoid two fixed headers.
  if (pathname === "/cn" || pathname.startsWith("/cn/") || !isMainNavPath(pathname)) return null
  return <SiteHeader />
}
