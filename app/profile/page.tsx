"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { SubscriptionCard } from "@/components/subscription-card"
import { AlertHistoryTable } from "@/components/alert-history-table"
import { ArrowLeft, Bell, Mail, Plus, Send } from "lucide-react"
import Link from "next/link"
import type { Subscription } from "@/lib/types"
import { useToast } from "@/hooks/use-toast"
import { BrandLogo } from "@/components/brand-logo"

interface Profile {
  id: string
  email: string
  created_at: string
  notification_enabled: boolean
}

interface AlertHistoryItem {
  id: string
  asset_symbol: string
  asset_type: "crypto" | "stock"
  trigger_price: number
  drop_percentage: number
  alert_condition: string
  sent_at: string
}

export default function ProfilePage() {
  const router = useRouter()
  const { toast } = useToast()
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [alertHistory, setAlertHistory] = useState<AlertHistoryItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSendingTest, setIsSendingTest] = useState(false)
  const [newSymbol, setNewSymbol] = useState("")
  const [newAssetType, setNewAssetType] = useState<"crypto" | "stock">("crypto")
  const [newThreshold, setNewThreshold] = useState(5)
  const [isCreatingSubscription, setIsCreatingSubscription] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    const supabase = createClient()

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      router.push("/auth/login")
      return
    }

    setUser(user)

    const { data: profileData } = await supabase.from("profiles").select("*").eq("id", user.id).single()

    if (profileData) {
      setProfile(profileData)
    }

    const { data: subsData } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })

    if (subsData) {
      setSubscriptions(subsData)
    }

    const ninetyDaysAgo = new Date()
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)

    const { data: alertsData } = await supabase
      .from("alert_history")
      .select("*")
      .eq("user_id", user.id)
      .gte("sent_at", ninetyDaysAgo.toISOString())
      .order("sent_at", { ascending: false })
      .limit(50)

    if (alertsData) {
      setAlertHistory(alertsData)
    }

    setIsLoading(false)
  }

  const handleNotificationToggle = async (enabled: boolean) => {
    if (!user) return

    const supabase = createClient()
    const { error } = await supabase.from("profiles").update({ notification_enabled: enabled }).eq("id", user.id)

    if (!error) {
      setProfile((prev) => (prev ? { ...prev, notification_enabled: enabled } : null))
      toast({
        title: enabled ? "Notifications Enabled" : "Notifications Disabled",
        description: enabled ? "You will receive crash alert emails." : "You will not receive any alerts.",
      })
    }
  }

  const handleSendTestAlert = async () => {
    setIsSendingTest(true)
    try {
      const response = await fetch("/api/send-test-alert", {
        method: "POST",
      })

      if (response.ok) {
        toast({
          title: "Test Alert Sent",
          description: "Check your email inbox for the test crash alert.",
        })
      } else {
        const error = await response.json()
        toast({
          title: "Failed to Send",
          description: error.error || "Failed to send test alert",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An error occurred while sending the test alert",
        variant: "destructive",
      })
    } finally {
      setIsSendingTest(false)
    }
  }

  const handleUpdateSubscription = async (id: string, threshold: number, isActive: boolean) => {
    const supabase = createClient()
    const { error } = await supabase
      .from("subscriptions")
      .update({
        threshold_percentage: threshold,
        is_active: isActive,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)

    if (!error) {
      setSubscriptions((prev) =>
        prev.map((sub) =>
          sub.id === id
            ? { ...sub, threshold_percentage: threshold, is_active: isActive, updated_at: new Date().toISOString() }
            : sub,
        ),
      )
      toast({
        title: "Subscription Updated",
        description: "Your alert settings have been saved.",
      })
    }
  }

  const handleCreateSubscription = async () => {
    if (!user) return
    const symbol = newSymbol.trim().toUpperCase()
    if (!/^[A-Z0-9.=-]{1,12}$/.test(symbol)) {
      toast({
        title: "Invalid Symbol",
        description: "Use symbols like BTC, ETH, SPY, or NVDA.",
        variant: "destructive",
      })
      return
    }
    setIsCreatingSubscription(true)
    const supabase = createClient()
    const { data, error } = await supabase
      .from("subscriptions")
      .insert({
        user_id: user.id,
        asset_symbol: symbol,
        asset_type: newAssetType,
        threshold_percentage: newThreshold,
        is_active: true,
      })
      .select("*")
      .single()

    if (error) {
      toast({
        title: "Subscription Not Created",
        description: error.message,
        variant: "destructive",
      })
    } else if (data) {
      setSubscriptions((prev) => [data, ...prev])
      setNewSymbol("")
      toast({
        title: "Subscription Created",
        description: `${symbol} alerts are now active.`,
      })
    }
    setIsCreatingSubscription(false)
  }

  const handleDeleteSubscription = async (id: string) => {
    const supabase = createClient()
    const { error } = await supabase.from("subscriptions").delete().eq("id", id)

    if (!error) {
      setSubscriptions((prev) => prev.filter((sub) => sub.id !== id))
      toast({
        title: "Subscription Deleted",
        description: "The alert subscription has been removed.",
      })
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <p className="text-muted-foreground">Loading profile...</p>
      </div>
    )
  }

  const activeSubscriptions = subscriptions.filter((s) => s.is_active).length

  return (
    <div className="min-h-svh bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-4">
            <Link href="/dashboard">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <BrandLogo className="text-xl" markClassName="h-7 w-7" />
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold mb-2">Profile & Settings</h1>
            <p className="text-muted-foreground">Manage your account, subscriptions, and notification preferences</p>
          </div>

          {/* Account Info */}
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5" />
                  Account Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="font-semibold">{profile?.email || user?.email}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Member Since</p>
                  <p className="font-semibold">
                    {profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : "N/A"}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5" />
                  Notification Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="notifications">Email Alerts</Label>
                    <p className="text-sm text-muted-foreground">Receive crash alert emails</p>
                  </div>
                  <Switch
                    id="notifications"
                    checked={profile?.notification_enabled ?? true}
                    onCheckedChange={handleNotificationToggle}
                  />
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Active Subscriptions</p>
                  <p className="text-2xl font-bold">{activeSubscriptions}</p>
                </div>
                <Button
                  variant="outline"
                  className="w-full bg-transparent"
                  onClick={handleSendTestAlert}
                  disabled={isSendingTest || !profile?.notification_enabled}
                >
                  <Send className="h-4 w-4 mr-2" />
                  {isSendingTest ? "Sending..." : "Send Test Alert"}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Subscriptions */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold">Your Subscriptions</h2>
              <Link href="/watchlist">
                <Button variant="outline">Open Watchlist</Button>
              </Link>
            </div>
            <Card className="mb-4">
              <CardHeader>
                <CardTitle>Create Alert Subscription</CardTitle>
                <CardDescription>
                  Add email crash-alert coverage for a crypto or stock symbol.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-[1fr_9rem_9rem_auto]">
                <Input
                  value={newSymbol}
                  onChange={(event) => setNewSymbol(event.target.value)}
                  placeholder="BTC, ETH, NVDA"
                  onKeyDown={(event) => {
                    if (event.key === "Enter") handleCreateSubscription()
                  }}
                />
                <select
                  value={newAssetType}
                  onChange={(event) => setNewAssetType(event.target.value === "stock" ? "stock" : "crypto")}
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  aria-label="Asset type"
                >
                  <option value="crypto">Crypto</option>
                  <option value="stock">Stock</option>
                </select>
                <Input
                  type="number"
                  min="0.1"
                  max="100"
                  step="0.1"
                  value={newThreshold}
                  onChange={(event) => setNewThreshold(Number.parseFloat(event.target.value))}
                  aria-label="Threshold percentage"
                />
                <Button onClick={handleCreateSubscription} disabled={isCreatingSubscription}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add
                </Button>
              </CardContent>
            </Card>
            {subscriptions.length === 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle>No Subscriptions Yet</CardTitle>
                  <CardDescription>
                    Head to the dashboard to subscribe to cryptocurrencies or stocks for crash alerts.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Link href="/dashboard">
                    <Button>Go to Dashboard</Button>
                  </Link>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {subscriptions.map((subscription) => (
                  <SubscriptionCard
                    key={subscription.id}
                    subscription={subscription}
                    onUpdate={handleUpdateSubscription}
                    onDelete={handleDeleteSubscription}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Alert History */}
          <AlertHistoryTable alerts={alertHistory} />
        </div>
      </main>
    </div>
  )
}
