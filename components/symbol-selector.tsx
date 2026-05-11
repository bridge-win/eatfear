"use client"

import * as React from "react"
import { Check, ChevronsUpDown, Search } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

export interface SymbolOption {
  id: string
  label: string
  hint?: string
}

interface SymbolSelectorProps {
  value: string
  options: SymbolOption[]
  onChange: (id: string) => void
  placeholder?: string
  emptyMessage?: string
  className?: string
}

export function SymbolSelector({
  value,
  options,
  onChange,
  placeholder = "Search symbol",
  emptyMessage = "No instrument found.",
  className,
}: SymbolSelectorProps) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")

  const current = options.find((option) => option.id === value)

  const filtered = React.useMemo(() => {
    const trimmed = query.trim().toLowerCase()
    if (!trimmed) return options.slice(0, 60)
    return options
      .filter((option) => {
        return (
          option.id.toLowerCase().includes(trimmed) ||
          option.label.toLowerCase().includes(trimmed) ||
          option.hint?.toLowerCase().includes(trimmed)
        )
      })
      .slice(0, 60)
  }, [options, query])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          role="combobox"
          aria-expanded={open}
          className={cn("h-8 min-w-[180px] justify-between gap-2 text-xs font-medium", className)}
        >
          <span className="truncate">
            {current ? current.label : value}
          </span>
          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[260px] space-y-2 p-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={placeholder}
            className="h-8 pl-7 text-xs"
            autoFocus
          />
        </div>
        <div className="max-h-72 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="p-3 text-center text-xs text-muted-foreground">{emptyMessage}</p>
          ) : (
            <ul className="space-y-0.5">
              {filtered.map((option) => {
                const isSelected = option.id === value
                return (
                  <li key={option.id}>
                    <button
                      type="button"
                      onClick={() => {
                        onChange(option.id)
                        setOpen(false)
                        setQuery("")
                      }}
                      className={cn(
                        "flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-muted",
                        isSelected && "bg-muted",
                      )}
                    >
                      <span className="flex flex-col overflow-hidden">
                        <span className="truncate font-medium">{option.label}</span>
                        {option.hint && (
                          <span className="truncate text-[10px] text-muted-foreground">{option.hint}</span>
                        )}
                      </span>
                      {isSelected && <Check className="h-3.5 w-3.5 text-foreground" />}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
