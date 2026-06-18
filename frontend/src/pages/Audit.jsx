import { useMemo, useState } from "react"
import { ChevronDown, ChevronUp, Search } from "lucide-react"
import { api } from "@/services/api"
import { useApi } from "@/hooks/useApi"
import { PageHeader } from "@/components/PageHeader"
import { Card, CardContent } from "@/components/ui/Card"
import { Input, Select } from "@/components/ui/Field"
import { LoadingState, ErrorState, EmptyState } from "@/components/StateViews"
import { DecisionBadge } from "@/components/DecisionBadge"
import { HighlightedContent } from "@/components/HighlightedContent"
import { JsonBlock } from "@/components/JsonBlock"
import { formatDate, titleCase } from "@/lib/utils"

export default function Audit() {
  const { data, loading, error } = useApi(() => api.moderations(500), [])
  const [search, setSearch] = useState("")
  const [decision, setDecision] = useState("")
  const [open, setOpen] = useState("")
  const visible = useMemo(() => (data || []).filter((item) => (!decision || item.decision === decision) && `${item.content} ${item.context} ${item.top_category}`.toLowerCase().includes(search.toLowerCase())), [data, search, decision])
  return (
    <>
      <PageHeader eyebrow="Permanent record" title="Audit log" description="Inspect original inputs, model artifacts, policy snapshots, calibrated confidence, and final decisions." />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row"><div className="relative flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input className="pl-9" placeholder="Search content, context, or category" value={search} onChange={(e) => setSearch(e.target.value)} /></div><Select className="sm:w-48" value={decision} onChange={(e) => setDecision(e.target.value)}><option value="">All decisions</option><option value="AUTO_APPROVE">Auto approved</option><option value="HUMAN_REVIEW">Human review</option><option value="AUTO_REJECT">Auto rejected</option></Select></div>
      {loading ? <LoadingState /> : error ? <ErrorState message={error} /> : !visible.length ? <EmptyState>No audit events match your filters.</EmptyState> :
      <div className="space-y-3">{visible.map((item) => <Card key={item.id}><button className="flex w-full items-center gap-4 p-4 text-left" onClick={() => setOpen(open === item.id ? "" : item.id)}><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{item.content}</p><p className="mt-1 text-xs text-muted-foreground">{formatDate(item.created_at)} · {titleCase(item.platform)} · {titleCase(item.top_category)} · {(item.confidence * 100).toFixed(1)}%</p></div><DecisionBadge decision={item.decision} />{open === item.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</button>
      {open === item.id && <CardContent className="space-y-5 border-t pt-5"><div className="grid gap-5 lg:grid-cols-2"><div><p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Original content</p><div className="rounded-lg border p-4"><HighlightedContent content={item.content} trigger={item.trigger_segment} /></div></div><div><p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Context</p><div className="min-h-14 rounded-lg border p-4 text-sm">{item.context || "No additional context provided."}</div></div></div><div><p className="mb-2 text-xs font-semibold">Generated prompt</p><JsonBlock value={item.generated_prompt} /></div><div className="grid gap-4 lg:grid-cols-2"><div><p className="mb-2 text-xs font-semibold">Raw Gemini response</p><JsonBlock value={item.raw_model_response} /></div><div><p className="mb-2 text-xs font-semibold">Policy used</p><JsonBlock value={item.policy_snapshot} /></div></div></CardContent>}</Card>)}</div>}
    </>
  )
}

