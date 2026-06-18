"use client"

import { usePathname } from "next/navigation"

import { isMainNavPath, SiteHeader } from "@/components/site-header"

export function MainSiteHeader() {
  const pathname = usePathname()

  if (!isMainNavPath(pathname)) return null

  return <SiteHeader />
}
