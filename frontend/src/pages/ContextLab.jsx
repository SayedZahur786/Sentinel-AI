import { useState } from "react"
import { GitCompareArrows, Lightbulb } from "lucide-react"
import { api } from "@/services/api"
import { PageHeader } from "@/components/PageHeader"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { Label, Select, Textarea } from "@/components/ui/Field"
import { DecisionBadge } from "@/components/DecisionBadge"
import { ScoreBars } from "@/components/ScoreBars"
import { ErrorState } from "@/components/StateViews"
import { PLATFORMS } from "@/lib/categories"
import { titleCase } from "@/lib/utils"

const PRESETS = [
  {
    label: "Trash talk vs. threat",
    content: "I'm going to destroy you.",
    a: { platform: "gaming", context: "Ranked match lobby chat, both players hyped before the game." },
    b: { platform: "social", context: "Sent as a private message after a heated public argument." },
  },
  {
    label: "Fiction vs. real intent",
    content: "He stabbed the man until there was blood everywhere.",
    a: { platform: "social", context: "Excerpt from a crime novel the user is reviewing." },
    b: { platform: "kids", context: "Posted on a feed for children under 13." },
  },
  {
    label: "Adult content by platform",
    content: "Subscribe to my OnlyFans for explicit nudes.",
    a: { platform: "adult", context: "Posted by a verified 18+ creator." },
    b: { platform: "kids", context: "Posted on a children's learning app." },
  },
]

function ResultColumn({ title, result, error }) {
  if (error) return <ErrorState message={error} />
  if (!result)
    return (
      <Card className="grid min-h-[18rem] place-items-center border-dashed shadow-none">
        <p className="text-xs text-muted-foreground">Run the comparison to see this side.</p>
      </Card>
    )
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground">{title}</p>
          <CardTitle className="mt-1 text-base">{titleCase(result.routed_category || result.top_category)}</CardTitle>
        </div>
        <DecisionBadge decision={result.decision} />
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-muted p-3"><p className="text-xs text-muted-foreground">Calibrated confidence</p><p className="mt-1 text-lg font-semibold tabular-nums">{(result.confidence * 100).toFixed(1)}%</p></div>
          <div className="rounded-lg bg-muted p-3"><p className="text-xs text-muted-foreground">Platform</p><p className="mt-1 text-lg font-semibold">{titleCase(result.platform)}</p></div>
        </div>
        <div><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">AI reasoning</p><p className="mt-1 text-sm leading-6">{result.reasoning}</p></div>
        <ScoreBars scores={result.scores} />
      </CardContent>
    </Card>
  )
}

export default function ContextLab() {
  const [content, setContent] = useState(PRESETS[0].content)
  const [a, setA] = useState(PRESETS[0].a)
  const [b, setB] = useState(PRESETS[0].b)
  const [results, setResults] = useState({ a: null, b: null })
  const [errors, setErrors] = useState({ a: "", b: "" })
  const [loading, setLoading] = useState(false)

  function applyPreset(preset) {
    setContent(preset.content); setA(preset.a); setB(preset.b)
    setResults({ a: null, b: null }); setErrors({ a: "", b: "" })
  }

  async function compare() {
    setLoading(true); setErrors({ a: "", b: "" })
    const run = (side) =>
      api.moderate({ content, platform: side.platform, context: side.context, user_history_summary: "", conversation_thread: [] })
    const [ra, rb] = await Promise.allSettled([run(a), run(b)])
    setResults({
      a: ra.status === "fulfilled" ? ra.value : null,
      b: rb.status === "fulfilled" ? rb.value : null,
    })
    setErrors({
      a: ra.status === "rejected" ? ra.reason.message : "",
      b: rb.status === "rejected" ? rb.reason.message : "",
    })
    setLoading(false)
  }

  const diverged =
    results.a && results.b && results.a.decision !== results.b.decision

  return (
    <>
      <PageHeader
        eyebrow="Context-aware analysis"
        title="Context lab"
        description="Send identical content through two different contexts and watch the decision change. The classifier weighs platform, thread, and intent — not just keywords."
        actions={
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((preset) => (
              <Button key={preset.label} variant="outline" size="sm" onClick={() => applyPreset(preset)}>{preset.label}</Button>
            ))}
          </div>
        }
      />
      <Card className="mb-5">
        <CardHeader><CardTitle>Shared content</CardTitle></CardHeader>
        <CardContent>
          <Textarea rows={3} value={content} onChange={(e) => setContent(e.target.value)} placeholder="One statement, judged two ways..." />
          <Button className="mt-4" onClick={compare} disabled={loading || !content.trim()}>
            <GitCompareArrows className="h-4 w-4" />{loading ? "Comparing..." : "Compare both contexts"}
          </Button>
        </CardContent>
      </Card>

      {diverged && (
        <div className="mb-5 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          <Lightbulb className="mt-0.5 h-4 w-4 shrink-0" />
          <p>Same words, different outcome: context <strong>A → {titleCase(results.a.decision)}</strong> while context <strong>B → {titleCase(results.b.decision)}</strong>. The deterministic policy never saw the text — only the calibrated scores the model produced for each context.</p>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-3">
          <Card><CardContent className="space-y-3 pt-5">
            <div><Label>Context A · platform</Label><Select value={a.platform} onChange={(e) => setA({ ...a, platform: e.target.value })}>{PLATFORMS.map((p) => <option key={p.slug} value={p.slug}>{p.label}</option>)}</Select></div>
            <div><Label>Context A · situation</Label><Textarea rows={3} value={a.context} onChange={(e) => setA({ ...a, context: e.target.value })} /></div>
          </CardContent></Card>
          <ResultColumn title="Decision in context A" result={results.a} error={errors.a} />
        </div>
        <div className="space-y-3">
          <Card><CardContent className="space-y-3 pt-5">
            <div><Label>Context B · platform</Label><Select value={b.platform} onChange={(e) => setB({ ...b, platform: e.target.value })}>{PLATFORMS.map((p) => <option key={p.slug} value={p.slug}>{p.label}</option>)}</Select></div>
            <div><Label>Context B · situation</Label><Textarea rows={3} value={b.context} onChange={(e) => setB({ ...b, context: e.target.value })} /></div>
          </CardContent></Card>
          <ResultColumn title="Decision in context B" result={results.b} error={errors.b} />
        </div>
      </div>
    </>
  )
}
