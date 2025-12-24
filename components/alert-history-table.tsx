"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { TrendingDown } from "lucide-react"

interface AlertHistoryItem {
  id: string
  asset_symbol: string
  asset_type: "crypto" | "stock"
  trigger_price: number
  drop_percentage: number
  alert_condition: string
  sent_at: string
}

interface AlertHistoryTableProps {
  alerts: AlertHistoryItem[]
}

export function AlertHistoryTable({ alerts }: AlertHistoryTableProps) {
  if (alerts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Alert History</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No alerts sent yet.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Alert History (Last 90 Days)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {alerts.map((alert) => (
            <div key={alert.id} className="flex items-center justify-between p-3 rounded-lg border bg-muted/50">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
                  <TrendingDown className="h-5 w-5 text-destructive" />
                </div>
                <div>
                  <p className="font-semibold">{alert.asset_symbol}</p>
                  <p className="text-sm text-muted-foreground">
                    Dropped {alert.drop_percentage.toFixed(2)}% to ${alert.trigger_price.toFixed(2)}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <Badge variant={alert.asset_type === "crypto" ? "default" : "secondary"}>{alert.asset_type}</Badge>
                <p className="text-xs text-muted-foreground mt-1">{new Date(alert.sent_at).toLocaleString()}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
