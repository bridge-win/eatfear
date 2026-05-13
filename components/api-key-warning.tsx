"use client"

import { AlertCircle, Key, RefreshCw, X } from "lucide-react"
import { useState } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

export interface ApiKeyStatus {
  missing?: boolean
  invalid?: boolean
  rateLimited?: boolean
  envVar?: string
  source?: string
}

interface ApiKeyWarningProps {
  status: ApiKeyStatus | null
  source: string
  className?: string
  onDismiss?: () => void
  onRetry?: () => void
}

export function ApiKeyWarning({ status, source, className, onDismiss, onRetry }: ApiKeyWarningProps) {
  const [dismissed, setDismissed] = useState(false)

  if (!status || dismissed) return null

  const { missing, invalid, rateLimited, envVar } = status

  // No issues
  if (!missing && !invalid && !rateLimited) return null

  const handleDismiss = () => {
    setDismissed(true)
    onDismiss?.()
  }

  // Determine warning type and message
  let variant: "warning" | "error" | "info" = "warning"
  let title = ""
  let message = ""
  let showEnvVar = false

  if (invalid) {
    variant = "error"
    title = `${source} API Key 无效`
    message = "API Key 已过期或无效，请检查并更新。"
    showEnvVar = true
  } else if (rateLimited) {
    variant = "warning"
    title = `${source} 请求频率受限`
    message = missing
      ? "已达到免费 API 速率限制。添加 API Key 可获得更高的请求配额。"
      : "已达到 API 速率限制，请稍后重试。"
    showEnvVar = Boolean(missing)
  } else if (missing) {
    // For CoinGecko, this is just informational since it works without key
    if (source === "CoinGecko") {
      variant = "info"
      title = `${source} 使用免费 API`
      message = "当前使用免费 API（10-30 次/分钟）。如需更高频率，可添加 API Key。"
      showEnvVar = true
    } else {
      variant = "info"
      title = `${source} API Key 未设置`
      message = "某些功能可能受限。添加 API Key 可解锁完整功能。"
      showEnvVar = true
    }
  }

  const bgColor = {
    warning: "bg-amber-500/10 border-amber-500/20",
    error: "bg-destructive/10 border-destructive/20",
    info: "bg-blue-500/10 border-blue-500/20",
  }[variant]

  const textColor = {
    warning: "text-amber-600 dark:text-amber-400",
    error: "text-destructive",
    info: "text-blue-600 dark:text-blue-400",
  }[variant]

  const iconColor = {
    warning: "text-amber-500",
    error: "text-destructive",
    info: "text-blue-500",
  }[variant]

  return (
    <div className={cn("relative rounded-lg border p-3", bgColor, className)}>
      <div className="flex items-start gap-3">
        <div className={cn("mt-0.5 shrink-0", iconColor)}>
          {variant === "info" ? <Key className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
        </div>
        <div className="flex-1 space-y-1">
          <p className={cn("text-sm font-medium", textColor)}>{title}</p>
          <p className="text-xs text-muted-foreground">{message}</p>
          {showEnvVar && envVar && (
            <div className="mt-2 flex items-center gap-2">
              <code className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-mono">{envVar}</code>
              <span className="text-[10px] text-muted-foreground">environment variable</span>
            </div>
          )}
          {rateLimited && onRetry && (
            <Button variant="ghost" size="sm" className="mt-2 h-7 text-xs" onClick={onRetry}>
              <RefreshCw className="mr-1.5 h-3 w-3" />
              Retry
            </Button>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0"
          onClick={handleDismiss}
          aria-label="Dismiss"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}

interface ApiKeyStatusListProps {
  statuses: Array<{ source: string; status: ApiKeyStatus | null }>
  className?: string
}

export function ApiKeyStatusList({ statuses, className }: ApiKeyStatusListProps) {
  const warnings = statuses.filter(
    (s) => s.status && (s.status.missing || s.status.invalid || s.status.rateLimited),
  )

  if (warnings.length === 0) return null

  return (
    <div className={cn("space-y-2", className)}>
      {warnings.map(({ source, status }) => (
        <ApiKeyWarning key={source} source={source} status={status} />
      ))}
    </div>
  )
}
