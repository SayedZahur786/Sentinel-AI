import { useMemo, useState } from "react"
import { Check, Search, X } from "lucide-react"
import { api } from "@/services/api"
import { useApi } from "@/hooks/useApi"
import { PageHeader } from "@/components/PageHeader"
import { Card, CardContent } from "@/components/ui/Card"
import { Input, Label, Select, Textarea } from "@/components/ui/Field"
import { Button } from "@/components/ui/Button"
import { LoadingState, ErrorState, EmptyState } from "@/components/StateViews"
import { HighlightedContent } from "@/components/HighlightedContent"
import { ScoreBars } from "@/components/ScoreBars"
import { DecisionBadge } from "@/components/DecisionBadge"
import { formatDate, titleCase } from "@/lib/utils"
import { CATEGORIES as categories } from "@/lib/categories"

export default function Reviews() {
  const [status, setStatus] = useState("pending")
  const { data, loading, error, refresh } = useApi(() => api.reviews(status), [status])
  const [search, setSearch] = useState("")
  const [selected, setSelected] = useState(null)
  const [notes, setNotes] = useState("")
  const [override, setOverride] = useState("")
  const [saving, setSaving] = useState(false)
  const visible = useMemo(() => (data || []).filter((item) => item.moderation.content.toLowerCase().includes(search.toLowerCase())), [data, search])
  async function decide(decision) {
    setSaving(true)
    try {
      await api.decideReview(selected.id, { decision, reviewer_notes: notes, override_category: override || null })
      setSelected(null); setNotes(""); setOverride(""); await refresh()
    } finally { setSaving(false) }
  }
  return (
    <>
      <PageHeader eyebrow="Human oversight" title="Review queue" description="Resolve uncertain cases and feed moderator outcomes into future confidence calibration." actions={<Select className="w-40" value={status} onChange={(e) => { setStatus(e.target.value); setSelected(null) }}><option value="pending">Pending</option><option value="">All reviews</option><option value="approved">Approved</option><option value="rejected">Rejected</option></Select>} />
      <div className="relative mb-4 max-w-md"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search review content" /></div>
      {loading ? <LoadingState /> : error ? <ErrorState message={error} /> : !visible.length ? <EmptyState>No review items match this view.</EmptyState> :
      <div className="grid gap-4 lg:grid-cols-[.9fr_1.1fr]">
        <Card className="overflow-hidden"><div className="divide-y">{visible.map((item) => <button key={item.id} className={`w-full p-4 text-left transition hover:bg-muted/50 ${selected?.id === item.id ? "bg-muted" : ""}`} onClick={() => { setSelected(item); setNotes(item.reviewer_notes || ""); setOverride(item.override_category || "") }}><div className="flex items-start justify-between gap-3"><p className="line-clamp-2 text-sm font-medium leading-5">{item.moderation.content}</p><DecisionBadge decision={item.status} /></div><div className="mt-3 flex gap-3 text-xs text-muted-foreground"><span>{titleCase(item.moderation.top_category)}</span><span>{Math.round(item.moderation.confidence * 100)}%</span><span>{formatDate(item.moderation.created_at)}</span></div></button>)}</div></Card>
        {!selected ? <EmptyState>Select an item to inspect the full analysis.</EmptyState> :
        <Card><CardContent className="space-y-5 pt-5">
          <div className="flex items-center justify-between"><div><p className="text-xs text-muted-foreground">{titleCase(selected.moderation.platform)} policy</p><h2 className="mt-1 text-lg font-semibold">{titleCase(selected.moderation.top_category)}</h2></div><DecisionBadge decision={selected.status} /></div>
          <div className="rounded-lg border p-4"><HighlightedContent content={selected.moderation.content} trigger={selected.moderation.trigger_segment} /></div>
          {selected.moderation.context && <div><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Context</p><p className="mt-1 text-sm">{selected.moderation.context}</p></div>}
          <div><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">AI explanation</p><p className="mt-1 text-sm leading-6">{selected.moderation.reasoning}</p></div>
          <ScoreBars scores={selected.moderation.scores} />
          {selected.status === "pending" ? <div className="space-y-4 border-t pt-5"><div><Label>Override category</Label><Select value={override} onChange={(e) => setOverride(e.target.value)}><option value="">Keep AI category</option>{categories.map((category) => <option key={category} value={category}>{titleCase(category)}</option>)}</Select></div><div><Label>Reviewer notes</Label><Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Explain the decision for future audit and calibration." /></div><div className="grid grid-cols-2 gap-3"><Button variant="outline" disabled={saving} onClick={() => decide("approved")}><Check className="h-4 w-4" />Approve</Button><Button variant="danger" disabled={saving} onClick={() => decide("rejected")}><X className="h-4 w-4" />Reject</Button></div></div> :
          <div className="rounded-lg bg-muted p-4 text-sm"><p className="font-medium">Review complete</p><p className="mt-1 text-muted-foreground">{selected.reviewer_notes || "No reviewer notes were recorded."}</p></div>}
        </CardContent></Card>}
      </div>}
    </>
  )
}

