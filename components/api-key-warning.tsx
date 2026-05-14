"use client"

import { AlertCircle, Key, RefreshCw, X } from "lucide-react"
import { useState } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { useT } from "@/lib/i18n"

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
  const t = useT()

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
    title = t("apiKey.invalid.title", { source })
    message = t("apiKey.invalid.msg")
    showEnvVar = true
  } else if (rateLimited) {
    variant = "warning"
    title = t("apiKey.rateLimited.title", { source })
    message = missing ? t("apiKey.rateLimited.msg.missing") : t("apiKey.rateLimited.msg.has")
    showEnvVar = Boolean(missing)
  } else if (missing) {
    // For CoinGecko, this is just informational since it works without key
    if (source === "CoinGecko") {
      variant = "info"
      title = t("apiKey.freeTier.title", { source })
      message = t("apiKey.freeTier.msg")
      showEnvVar = true
    } else {
      variant = "info"
      title = t("apiKey.missing.title", { source })
      message = t("apiKey.missing.msg")
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
              <span className="text-[10px] text-muted-foreground">{t("apiKey.envVar")}</span>
            </div>
          )}
          {rateLimited && onRetry && (
            <Button variant="ghost" size="sm" className="mt-2 h-7 text-xs" onClick={onRetry}>
              <RefreshCw className="mr-1.5 h-3 w-3" />
              {t("apiKey.retry")}
            </Button>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0"
          onClick={handleDismiss}
          aria-label={t("apiKey.dismiss")}
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
