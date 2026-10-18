import type { Metadata } from "next"
import Observatory from "@/components/cn/observatory"
export const metadata: Metadata = {
  title: "中国研究台 | EatFear · 经济判断与A股全市场筛选",
  description: "用真实宏观数据理解中国经济，按经济专题、日终估值和公司财务筛选沪深北A股。查看具体公司入选原因、反向证据、来源与报告期。",
}
export default function ChinaPage() { return <Observatory /> }
