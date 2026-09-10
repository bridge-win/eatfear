import { ResearchWorkbench } from "@/components/research-workbench"

// Evidence is a frozen snapshot, so the page has no runtime data dependency.
export const dynamic = "force-static"

export default function ResearchPage() {
  return <ResearchWorkbench />
}
