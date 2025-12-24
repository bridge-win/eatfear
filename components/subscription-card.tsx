"use client"

import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Trash2, Edit2, Save, X } from "lucide-react"
import type { Subscription } from "@/lib/types"
import { useState } from "react"

interface SubscriptionCardProps {
  subscription: Subscription
  onUpdate: (id: string, threshold: number, isActive: boolean) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

export function SubscriptionCard({ subscription, onUpdate, onDelete }: SubscriptionCardProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [threshold, setThreshold] = useState(subscription.threshold_percentage)
  const [isActive, setIsActive] = useState(subscription.is_active)
  const [isLoading, setIsLoading] = useState(false)

  const handleSave = async () => {
    setIsLoading(true)
    await onUpdate(subscription.id, threshold, isActive)
    setIsEditing(false)
    setIsLoading(false)
  }

  const handleCancel = () => {
    setThreshold(subscription.threshold_percentage)
    setIsActive(subscription.is_active)
    setIsEditing(false)
  }

  const handleDelete = async () => {
    if (confirm(`Are you sure you want to delete the subscription for ${subscription.asset_symbol}?`)) {
      setIsLoading(true)
      await onDelete(subscription.id)
      setIsLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <div className="space-y-1">
          <h3 className="font-semibold text-lg">{subscription.asset_symbol}</h3>
          <Badge variant={subscription.asset_type === "crypto" ? "default" : "secondary"}>
            {subscription.asset_type === "crypto" ? "Cryptocurrency" : "Stock"}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          {!isEditing && (
            <>
              <Button variant="ghost" size="icon" onClick={() => setIsEditing(true)} disabled={isLoading}>
                <Edit2 className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={handleDelete} disabled={isLoading}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isEditing ? (
          <>
            <div className="space-y-2">
              <Label htmlFor={`threshold-${subscription.id}`}>Alert Threshold (%)</Label>
              <Input
                id={`threshold-${subscription.id}`}
                type="number"
                min="0.1"
                max="100"
                step="0.1"
                value={threshold}
                onChange={(e) => setThreshold(Number.parseFloat(e.target.value))}
              />
              <p className="text-xs text-muted-foreground">Alert when price drops more than this percentage</p>
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor={`active-${subscription.id}`}>Active</Label>
              <Switch id={`active-${subscription.id}`} checked={isActive} onCheckedChange={setIsActive} />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={isLoading} className="flex-1">
                <Save className="h-4 w-4 mr-2" />
                Save
              </Button>
              <Button variant="outline" onClick={handleCancel} disabled={isLoading}>
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Alert Threshold</p>
              <p className="text-lg font-semibold">{subscription.threshold_percentage.toFixed(2)}%</p>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Status</p>
              <Badge variant={subscription.is_active ? "default" : "secondary"}>
                {subscription.is_active ? "Active" : "Paused"}
              </Badge>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Subscribed</p>
              <p className="text-sm">{new Date(subscription.created_at).toLocaleDateString()}</p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
