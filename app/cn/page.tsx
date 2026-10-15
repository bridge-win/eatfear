import type { Metadata } from "next"
import Observatory from "@/components/cn/observatory"
export const metadata: Metadata = {
  title: "中国观察台 | EatFear · 宏观经济与化债研究",
  description: "从官方与第三方历史数据，理解政策、信用、财政与市场。交互式趋势、异常评估、化债传导、历史复盘与透明研究方法。",
}
export default function ChinaPage() { return <Observatory /> }
