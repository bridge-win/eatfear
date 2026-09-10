"use client"

import { useMemo, useState } from "react"
import { ChevronDown, ExternalLink } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { CHINA_MANUAL_SNAPSHOT_AS_OF, CHINA_SNAPSHOT_AS_OF } from "@/lib/data/china-snapshot-meta"
import { useI18n } from "@/lib/i18n"
import { getConfiguredMacroIndicatorMetas } from "@/lib/macro-indicator-config"
import { SKIPPED_INDICATORS } from "@/lib/macro-metadata"
import type { MacroDataSource } from "@/lib/types"

interface SourceRow {
  source: MacroDataSource
  label: { zh: string; en: string }
  cadence: { zh: string; en: string }
  access: { zh: string; en: string }
  homepage: string
}

const SOURCE_ROWS: readonly SourceRow[] = [
  {
    source: "Yahoo Finance",
    label: { zh: "Yahoo Finance", en: "Yahoo Finance" },
    cadence: { zh: "实时 / 日线", en: "Realtime / daily" },
    access: { zh: "免费，无 key", en: "Free, no key" },
    homepage: "https://finance.yahoo.com",
  },
  {
    source: "FRED",
    label: { zh: "FRED（含 BIS / IMF / OECD / World Bank 转载）", en: "FRED (incl. BIS / IMF / OECD / World Bank mirrors)" },
    cadence: { zh: "日 / 月 / 季，海外口径滞后 1-2 月", en: "Daily / monthly / quarterly; foreign series lag 1-2 months" },
    access: { zh: "免费 API key（FRED_API_KEY）", en: "Free API key (FRED_API_KEY)" },
    homepage: "https://fred.stlouisfed.org",
  },
  {
    source: "Eastmoney",
    label: { zh: "东方财富数据中心（PBoC / 国家统计局 / 海关总署 / 中债估值）", en: "Eastmoney datacenter (PBoC / NBS / Customs / CDC yields)" },
    cadence: { zh: "官方发布当日同步；月度为主", en: "Same day as the official release; mostly monthly" },
    access: { zh: "免费，无 key（非官方 JSON，akshare 同源）", en: "Free, no key (unofficial JSON, same feed akshare uses)" },
    homepage: "https://data.eastmoney.com/cjsj/",
  },
  {
    source: "MOFCOM",
    label: { zh: "商务部数据中心（央行社融表镜像）", en: "MOFCOM data center (mirror of the PBoC TSF table)" },
    cadence: { zh: "月度，央行发布后同步；社融增量及 7 个分项", en: "Monthly, follows the PBoC release; TSF flow and 7 components" },
    access: { zh: "免费，无 key（POST 接口，非官方 JSON）", en: "Free, no key (POST endpoint, unofficial JSON)" },
    homepage: "https://data.mofcom.gov.cn/gnmy/shrzgm.shtml",
  },
  {
    source: "NBS/PBoC/BIS Snapshot",
    label: { zh: "国家统计局年度公报 / 央行货币政策报告 / BIS 房价库 + 外汇局结售汇 / CFETS 指数 / 政策利率（版本化快照）", en: "NBS annual bulletins / PBoC policy reports / BIS property DB + SAFE FX settlement / CFETS index / policy rates (versioned snapshot)" },
    cadence: { zh: "年度 / 季度 / 月度 / 周度，手工或脚本刷新，每条观测带来源链接", en: "Annual / quarterly / monthly / weekly, hand- or script-refreshed, per-observation source links" },
    access: { zh: "仓库内 JSON，永不失败", en: "In-repo JSON, never fails at runtime" },
    homepage: "https://github.com/bridge-win/house",
  },
]

export function MacroDataSourceCatalog() {
  const { locale, t } = useI18n()
  const [open, setOpen] = useState(false)
  const lang = locale === "en" ? "en" : "zh"

  const countBySource = useMemo(() => {
    const counts = new Map<MacroDataSource, number>()
    for (const meta of getConfiguredMacroIndicatorMetas()) {
      counts.set(meta.source, (counts.get(meta.source) ?? 0) + 1)
    }
    return counts
  }, [])

  const chinaCount = useMemo(
    () => getConfiguredMacroIndicatorMetas().filter((meta) => meta.audience.includes("中国")).length,
    [],
  )

  return (
    <Card className="gap-2 py-3">
      <CardContent className="px-3">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="flex w-full items-start justify-between gap-3 text-left"
          aria-expanded={open}
        >
          <div>
            <p className="text-sm font-semibold">{t("macro.sources.title")}</p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
              {SOURCE_ROWS.map((row) => `${row.label[lang].split("（")[0].split(" (")[0]} ${countBySource.get(row.source) ?? 0}`).join(" · ")}
              {" · "}
              {lang === "zh" ? `中国相关 ${chinaCount}` : `China-related ${chinaCount}`}
              {" · "}
              {t("macro.sources.asOf", { date: `${CHINA_SNAPSHOT_AS_OF} · SAFE/CFETS ${CHINA_MANUAL_SNAPSHOT_AS_OF}` })}
            </p>
          </div>
          <span className="flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] text-muted-foreground">
            {open ? t("macro.sources.collapse") : t("macro.sources.toggle")}
            <ChevronDown className={`size-3 transition-transform ${open ? "rotate-180" : ""}`} />
          </span>
        </button>

        {open && (
          <div className="mt-3 space-y-4 text-[11px]">
            <p className="text-muted-foreground">{t("macro.sources.subtitle")}</p>

            <section>
              <p className="mb-1.5 font-medium">{t("macro.sources.live")} / {t("macro.sources.snapshot")}</p>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] border-collapse">
                  <thead>
                    <tr className="border-b text-left text-[10px] text-muted-foreground">
                      <th className="py-1 pr-3 font-medium">{lang === "zh" ? "来源" : "Source"}</th>
                      <th className="py-1 pr-3 font-medium">{lang === "zh" ? "指标数" : "Series"}</th>
                      <th className="py-1 pr-3 font-medium">{lang === "zh" ? "更新节奏" : "Cadence"}</th>
                      <th className="py-1 pr-3 font-medium">{lang === "zh" ? "接入方式" : "Access"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {SOURCE_ROWS.map((row) => (
                      <tr key={row.source} className="border-b border-dashed align-top last:border-0">
                        <td className="py-1.5 pr-3">
                          <a
                            href={row.homepage}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 underline-offset-2 hover:underline"
                          >
                            {row.label[lang]}
                            <ExternalLink className="size-2.5 text-muted-foreground" />
                          </a>
                        </td>
                        <td className="py-1.5 pr-3 tabular-nums">
                          {t("macro.sources.count", { count: countBySource.get(row.source) ?? 0 })}
                        </td>
                        <td className="py-1.5 pr-3 text-muted-foreground">{row.cadence[lang]}</td>
                        <td className="py-1.5 pr-3 text-muted-foreground">{row.access[lang]}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section>
              <p className="mb-1.5 font-medium">{t("macro.sources.gaps")}</p>
              <ul className="space-y-1.5">
                {SKIPPED_INDICATORS.map((item) => (
                  <li key={item.name} className="leading-relaxed">
                    <span className="font-medium">{item.name}</span>
                    {item.url && (
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noreferrer"
                        className="ml-1 inline-flex items-center gap-0.5 text-muted-foreground underline-offset-2 hover:underline"
                      >
                        {lang === "zh" ? "官方页面" : "official page"}
                        <ExternalLink className="size-2.5" />
                      </a>
                    )}
                    <span className="text-muted-foreground"> — {item.reason}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
