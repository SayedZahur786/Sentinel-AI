import { useState } from "react"
import { BrainCircuit, ChevronDown, ChevronUp, Plus, Send, Trash2 } from "lucide-react"
import { api } from "@/services/api"
import { PageHeader } from "@/components/PageHeader"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { Input, Label, Select, Textarea } from "@/components/ui/Field"
import { Badge } from "@/components/ui/Badge"
import { DecisionBadge } from "@/components/DecisionBadge"
import { ScoreBars } from "@/components/ScoreBars"
import { HighlightedContent } from "@/components/HighlightedContent"
import { JsonBlock } from "@/components/JsonBlock"
import { PLATFORMS } from "@/lib/categories"
import { titleCase } from "@/lib/utils"

const EMPTY = { content: "", context: "", platform: "social", user_history_summary: "" }

export default function Analyzer() {
  const [form, setForm] = useState(EMPTY)
  const [thread, setThread] = useState([])
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [transparency, setTransparency] = useState(false)
  const set = (key) => (event) => setForm({ ...form, [key]: event.target.value })

  function addMessage() { setThread([...thread, { author: "user", text: "" }]) }
  function updateMessage(i, key, value) { setThread(thread.map((m, idx) => (idx === i ? { ...m, [key]: value } : m))) }
  function removeMessage(i) { setThread(thread.filter((_, idx) => idx !== i)) }

  async function submit(event) {
    event.preventDefault()
    setLoading(true); setError("")
    try {
      const conversation_thread = thread.filter((m) => m.text.trim())
      setResult(await api.moderate({ ...form, conversation_thread }))
    } catch (err) { setError(err.message) } finally { setLoading(false) }
  }

  return (
    <>
      <PageHeader eyebrow="Classify and route" title="Content analyzer" description="Inspect the model analysis, confidence calibration, and final policy decision in one place." />
      <div className="grid gap-5 xl:grid-cols-[.9fr_1.1fr]">
        <Card><CardHeader><CardTitle>Moderation request</CardTitle></CardHeader><CardContent>
          <form className="space-y-5" onSubmit={submit}>
            <div><Label htmlFor="content">Content</Label><Textarea id="content" rows={6} value={form.content} onChange={set("content")} required placeholder="Enter the content to analyze..." /><p className="mt-1 text-right text-xs text-muted-foreground">{form.content.length} / 20,000</p></div>
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <Label className="mb-0">Conversation thread <span className="font-normal text-muted-foreground">(optional)</span></Label>
                <Button type="button" variant="outline" size="sm" onClick={addMessage}><Plus className="h-3.5 w-3.5" />Message</Button>
              </div>
              <p className="mb-2 text-xs text-muted-foreground">Prior messages give the model the context that decides intent.</p>
              <div className="space-y-2">
                {thread.map((message, i) => (
                  <div key={i} className="flex gap-2">
                    <Input className="w-28 shrink-0" value={message.author} onChange={(e) => updateMessage(i, "author", e.target.value)} placeholder="author" />
                    <Input value={message.text} onChange={(e) => updateMessage(i, "text", e.target.value)} placeholder="message text" />
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeMessage(i)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                ))}
              </div>
            </div>
            <div><Label htmlFor="context">Situation / context</Label><Textarea id="context" rows={3} value={form.context} onChange={set("context")} placeholder="Where was this posted? Is it quoted, fictional, educational, or part of a game?" /></div>
            <div><Label htmlFor="history">User history summary <span className="font-normal text-muted-foreground">(optional)</span></Label><Textarea id="history" rows={2} value={form.user_history_summary} onChange={set("user_history_summary")} placeholder="Recent warnings, prior behavior, or account context" /></div>
            <div><Label htmlFor="platform">Platform policy</Label><Select id="platform" value={form.platform} onChange={set("platform")}>{PLATFORMS.map((p) => <option key={p.slug} value={p.slug}>{p.label}</option>)}</Select></div>
            {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{error}</p>}
            <Button className="w-full" disabled={loading || !form.content.trim()}><Send className="h-4 w-4" />{loading ? "Analyzing..." : "Analyze content"}</Button>
          </form>
        </CardContent></Card>
        <div>
          {!result ? <Card className="grid min-h-[36rem] place-items-center border-dashed shadow-none"><div className="max-w-xs text-center"><div className="mx-auto mb-4 grid h-11 w-11 place-items-center rounded-xl bg-muted"><BrainCircuit className="h-5 w-5" /></div><p className="text-sm font-medium">Analysis will appear here</p><p className="mt-1 text-xs leading-5 text-muted-foreground">One model call classifies the content. Backend policy code applies the final route.</p></div></Card> :
          <div className="space-y-4">
            <Card><CardHeader className="flex flex-row items-center justify-between"><div><p className="mb-1 text-xs text-muted-foreground">Final policy route</p><CardTitle className="text-lg">{titleCase(result.routed_category || result.top_category)}</CardTitle></div><DecisionBadge decision={result.decision} /></CardHeader><CardContent>
              <div className="grid gap-4 sm:grid-cols-3"><div className="rounded-lg bg-muted p-3"><p className="text-xs text-muted-foreground">Raw confidence</p><p className="mt-1 text-lg font-semibold">{(result.raw_confidence * 100).toFixed(1)}%</p></div><div className="rounded-lg bg-muted p-3"><p className="text-xs text-muted-foreground">Calibrated</p><p className="mt-1 text-lg font-semibold">{(result.confidence * 100).toFixed(1)}%</p></div><div className="rounded-lg bg-muted p-3"><p className="text-xs text-muted-foreground">Platform</p><p className="mt-1 text-lg font-semibold">{titleCase(result.platform)}</p></div></div>
              {result.disabled_categories?.length > 0 && <div className="mt-4 flex flex-wrap items-center gap-2"><span className="text-xs text-muted-foreground">Disabled on this platform:</span>{result.disabled_categories.map((c) => <Badge key={c} tone="neutral">{titleCase(c)}</Badge>)}</div>}
              {result.top_category !== result.routed_category && result.routed_category && <p className="mt-3 text-xs text-muted-foreground">Model's top signal was <strong>{titleCase(result.top_category)}</strong>, but routing used the highest <em>enabled</em> category for this platform.</p>}
            </CardContent></Card>
            <Card><CardHeader><CardTitle>Explainable analysis</CardTitle></CardHeader><CardContent className="space-y-4"><div className="rounded-lg border p-4"><HighlightedContent content={result.content} trigger={result.trigger_segment} /></div><div><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Reasoning</p><p className="mt-1 text-sm leading-6">{result.reasoning}</p></div></CardContent></Card>
            <Card><CardHeader><CardTitle>Category confidence</CardTitle></CardHeader><CardContent><ScoreBars scores={result.scores} /></CardContent></Card>
            <Card><button className="flex w-full items-center justify-between p-5 text-left text-sm font-semibold" onClick={() => setTransparency(!transparency)}>Transparency record {transparency ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</button>{transparency && <CardContent className="space-y-4"><div><p className="mb-2 text-xs font-semibold">Generated model prompt</p><JsonBlock value={result.generated_prompt} /></div><div><p className="mb-2 text-xs font-semibold">Raw model response</p><JsonBlock value={result.raw_model_response} /></div><div><p className="mb-2 text-xs font-semibold">Policy snapshot</p><JsonBlock value={result.policy_snapshot} /></div></CardContent>}</Card>
          </div>}
        </div>
      </div>
    </>
  )
}
