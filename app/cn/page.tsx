import type { Metadata } from "next"
import Observatory from "@/components/cn/observatory"
export const metadata: Metadata = {
  title: "中国研究台 | EatFear · 宏观专题与标的研究",
  description: "从官方与第三方历史数据，理解政策、信用、财政与市场。宏观证据、行业传导、股票与ETF候选池、财报对比、估值情景及研究笔记。",
}
export default function ChinaPage() { return <Observatory /> }
