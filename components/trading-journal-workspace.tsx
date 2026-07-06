"use client"

import { useEffect, useState } from "react"
import { Plus, Trash2 } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type Direction = "long" | "short"

interface JournalEntry {
  id: string
  symbol: string
  direction: Direction
  entry: number
  exit: number
  size: number
  checklist: {
    trend: boolean
    contradiction: boolean
    invalidation: boolean
    positionSize: boolean
  }
  note: string
  createdAt: number
}

const STORAGE_KEY = "eatfear:journal:v1"

function pnl(entry: JournalEntry): number {
  const raw = (entry.exit - entry.entry) * entry.size
  return entry.direction === "long" ? raw : -raw
}

function readEntries(): JournalEntry[] {
  if (typeof window === "undefined") return []
  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (!raw) return []
  try {
    return JSON.parse(raw) as JournalEntry[]
  } catch {
    return []
  }
}

function checklistScore(entry: JournalEntry): number {
  return Object.values(entry.checklist).filter(Boolean).length
}

export function TradingJournalWorkspace() {
  const [entries, setEntries] = useState<JournalEntry[]>([])
  const [symbol, setSymbol] = useState("BTC")
  const [direction, setDirection] = useState<Direction>("long")
  const [entry, setEntry] = useState(0)
  const [exit, setExit] = useState(0)
  const [size, setSize] = useState(1)
  const [note, setNote] = useState("")
  const [checklist, setChecklist] = useState<JournalEntry["checklist"]>({
    trend: false,
    contradiction: false,
    invalidation: false,
    positionSize: false,
  })

  useEffect(() => {
    setEntries(readEntries())
  }, [])

  useEffect(() => {
    if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
  }, [entries])

  const addEntry = () => {
    const cleanSymbol = symbol.trim().toUpperCase()
    if (!/^[A-Z0-9.=-]{1,12}$/.test(cleanSymbol) || entry <= 0 || exit <= 0 || size <= 0) return
    setEntries((current) => [
      {
        id: crypto.randomUUID(),
        symbol: cleanSymbol,
        direction,
        entry,
        exit,
        size,
        checklist,
        note,
        createdAt: Date.now(),
      },
      ...current,
    ])
    setNote("")
  }

  const totalPnl = entries.reduce((sum, item) => sum + pnl(item), 0)
  const wins = entries.filter((item) => pnl(item) > 0).length

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-5">
      <header>
        <h1 className="text-xl font-bold tracking-tight">Trading Journal</h1>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          Record signal decisions, checklist discipline, and paper-trade outcomes locally.
        </p>
      </header>

      <section className="grid gap-3 lg:grid-cols-[24rem_minmax(0,1fr)]">
        <div className="rounded-md border bg-card/95 p-3 shadow-sm">
          <h2 className="text-sm font-semibold">Add Decision</h2>
          <div className="mt-3 grid gap-2">
            <Input value={symbol} onChange={(event) => setSymbol(event.target.value)} placeholder="Symbol" />
            <select
              value={direction}
              onChange={(event) => setDirection(event.target.value === "short" ? "short" : "long")}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              aria-label="Direction"
            >
              <option value="long">Long</option>
              <option value="short">Short</option>
            </select>
            <div className="grid grid-cols-3 gap-2">
              <Input type="number" value={entry || ""} onChange={(event) => setEntry(Number(event.target.value))} placeholder="Entry" />
              <Input type="number" value={exit || ""} onChange={(event) => setExit(Number(event.target.value))} placeholder="Exit" />
              <Input type="number" value={size || ""} onChange={(event) => setSize(Number(event.target.value))} placeholder="Size" />
            </div>
            <div className="grid gap-1.5 text-sm">
              {([
                ["trend", "Trend/support checked"],
                ["contradiction", "Contradictions reviewed"],
                ["invalidation", "Invalidation price defined"],
                ["positionSize", "Position size fits risk"],
              ] as const).map(([key, label]) => (
                <label key={key} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={checklist[key]}
                    onChange={(event) => setChecklist((current) => ({ ...current, [key]: event.target.checked }))}
                  />
                  {label}
                </label>
              ))}
            </div>
            <Input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Note" />
            <Button onClick={addEntry}>
              <Plus className="mr-2 h-4 w-4" />
              Save
            </Button>
          </div>
        </div>

        <div className="rounded-md border bg-card/95 p-3 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">Decision History</h2>
            <div className="flex gap-2">
              <Badge variant="secondary">Trades {entries.length}</Badge>
              <Badge variant={totalPnl >= 0 ? "default" : "destructive"}>PnL {totalPnl.toFixed(2)}</Badge>
              <Badge variant="secondary">Win rate {entries.length === 0 ? "-" : `${Math.round((wins / entries.length) * 100)}%`}</Badge>
            </div>
          </div>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="border-b text-left text-xs text-muted-foreground">
                <tr>
                  <th className="py-2">Symbol</th>
                  <th>Direction</th>
                  <th>Entry</th>
                  <th>Exit</th>
                  <th>Size</th>
                  <th>Checklist</th>
                  <th>PnL</th>
                  <th>Note</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {entries.map((item) => (
                  <tr key={item.id} className="border-b last:border-b-0">
                    <td className="py-2 font-medium">{item.symbol}</td>
                    <td>{item.direction}</td>
                    <td className="tabular-nums">{item.entry}</td>
                    <td className="tabular-nums">{item.exit}</td>
                    <td className="tabular-nums">{item.size}</td>
                    <td>{checklistScore(item)}/4</td>
                    <td className={pnl(item) >= 0 ? "text-emerald-600" : "text-red-600"}>{pnl(item).toFixed(2)}</td>
                    <td className="max-w-48 truncate text-muted-foreground">{item.note || "-"}</td>
                    <td>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Delete ${item.symbol} journal entry`}
                        onClick={() => setEntries((current) => current.filter((entryItem) => entryItem.id !== item.id))}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </main>
  )
}
