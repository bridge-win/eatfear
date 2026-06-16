"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useTheme } from "next-themes"
import { BookOpen, Coins, Home, LineChart, Moon, Newspaper, Search, Sun } from "lucide-react"

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import { useT } from "@/lib/i18n"

const PAGE_ITEMS = [
  { href: "/home", key: "nav.home", icon: Home },
  { href: "/crypto", key: "nav.crypto", icon: Coins },
  { href: "/stock", key: "nav.stock", icon: LineChart },
  { href: "/macro", key: "nav.macro", icon: LineChart },
  { href: "/methodology", key: "nav.methodology", icon: BookOpen },
  { href: "/news", key: "nav.news", icon: Newspaper },
] as const

export function CommandPalette() {
  const [open, setOpen] = React.useState(false)
  const router = useRouter()
  const { setTheme } = useTheme()
  const t = useT()

  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        setOpen((value) => !value)
      }
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [])

  const runCommand = React.useCallback((callback: () => void) => {
    setOpen(false)
    callback()
  }, [])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t("nav.search")}
        className="inline-flex h-7 items-center gap-1.5 rounded-full border bg-background/60 px-2.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        <Search className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">{t("nav.search")}</span>
        <kbd className="hidden items-center gap-0.5 rounded border bg-muted px-1 font-mono text-[9px] text-muted-foreground sm:inline-flex">
          <span>⌘</span>K
        </kbd>
      </button>
      <CommandDialog open={open} onOpenChange={setOpen} title={t("nav.search")} description={t("command.placeholder")}>
        <CommandInput placeholder={t("command.placeholder")} />
        <CommandList>
          <CommandEmpty>{t("command.empty")}</CommandEmpty>
          <CommandGroup heading={t("command.group.pages")}>
            {PAGE_ITEMS.map((item) => (
              <CommandItem key={item.href} value={t(item.key)} onSelect={() => runCommand(() => router.push(item.href))}>
                <item.icon className="h-4 w-4" />
                {t(item.key)}
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading={t("command.group.theme")}>
            <CommandItem value={t("command.theme.light")} onSelect={() => runCommand(() => setTheme("light"))}>
              <Sun className="h-4 w-4" />
              {t("command.theme.light")}
            </CommandItem>
            <CommandItem value={t("command.theme.dark")} onSelect={() => runCommand(() => setTheme("dark"))}>
              <Moon className="h-4 w-4" />
              {t("command.theme.dark")}
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  )
}
