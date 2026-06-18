import { useEffect, useState } from "react"
import { Plus, Save, Trash2 } from "lucide-react"
import { api } from "@/services/api"
import { useApi } from "@/hooks/useApi"
import { PageHeader } from "@/components/PageHeader"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { Input, Label, Select } from "@/components/ui/Field"
import { LoadingState, ErrorState } from "@/components/StateViews"
import { DecisionBadge } from "@/components/DecisionBadge"
import { CATEGORIES, CATEGORY_LABELS } from "@/lib/categories"

function route(confidence, review, reject) { return confidence >= reject ? "AUTO_REJECT" : confidence >= review ? "HUMAN_REVIEW" : "AUTO_APPROVE" }

export default function Policies() {
  const { data, loading, error, setData } = useApi(api.policies, [])
  const [slug, setSlug] = useState("kids")
  const [form, setForm] = useState(null)
  const [preview, setPreview] = useState(.65)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")
  useEffect(() => {
    const policy = data?.find((item) => item.slug === slug)
    if (policy) setForm(JSON.parse(JSON.stringify(policy)))
  }, [data, slug])
  if (loading || !form) return <LoadingState />
  if (error) return <ErrorState message={error} />

  const settings = form.settings_json
  const multipliers = settings.category_threshold_multipliers || {}
  const toggles = settings.category_toggles || {}
  const rules = settings.custom_rules || []
  const setSettings = (patch) => setForm({ ...form, settings_json: { ...settings, ...patch } })
  function setMultiplier(category, value) { setSettings({ category_threshold_multipliers: { ...multipliers, [category]: Number(value) } }) }
  function setToggle(category, enabled) { setSettings({ category_toggles: { ...toggles, [category]: enabled } }) }
  function setRule(i, value) { setSettings({ custom_rules: rules.map((r, idx) => (idx === i ? value : r)) }) }
  function addRule() { setSettings({ custom_rules: [...rules, ""] }) }
  function removeRule(i) { setSettings({ custom_rules: rules.filter((_, idx) => idx !== i) }) }

  async function save() {
    setSaving(true); setMessage("")
    try {
      const cleaned = { ...settings, custom_rules: rules.map((r) => r.trim()).filter(Boolean) }
      const updated = await api.updatePolicy(slug, { review_threshold: Number(form.review_threshold), reject_threshold: Number(form.reject_threshold), settings_json: cleaned })
      setData(data.map((item) => item.slug === slug ? updated : item)); setMessage("Policy saved and applied to all new moderation requests.")
    } catch (err) { setMessage(err.message) } finally { setSaving(false) }
  }

  return (
    <>
      <PageHeader eyebrow="Deterministic enforcement" title="Policy configuration" description="Tune routing thresholds, category sensitivity, on/off toggles, and custom rules independently from the AI classifier." actions={<Select className="w-56" value={slug} onChange={(e) => setSlug(e.target.value)}>{data.map((policy) => <option key={policy.slug} value={policy.slug}>{policy.name}</option>)}</Select>} />
      <div className="grid gap-5 lg:grid-cols-[1.1fr_.9fr]">
        <Card><CardHeader><CardTitle>{form.name}</CardTitle><p className="mt-1 text-xs text-muted-foreground">{settings.description}</p></CardHeader><CardContent className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2"><div><Label>Human review threshold</Label><Input type="number" min="0" max="1" step=".01" value={form.review_threshold} onChange={(e) => setForm({ ...form, review_threshold: Number(e.target.value) })} /></div><div><Label>Auto reject threshold</Label><Input type="number" min="0" max="1" step=".01" value={form.reject_threshold} onChange={(e) => setForm({ ...form, reject_threshold: Number(e.target.value) })} /></div></div>

          <div>
            <div className="mb-3"><p className="text-sm font-semibold">Categories</p><p className="text-xs text-muted-foreground">Toggle a category off to stop moderating it entirely. Multipliers tune sensitivity before routing.</p></div>
            <div className="divide-y rounded-lg border">
              {CATEGORIES.map((category) => {
                const enabled = toggles[category] !== false
                return (
                  <div key={category} className="flex items-center justify-between gap-3 p-3">
                    <label className="flex items-center gap-2.5">
                      <input type="checkbox" className="h-4 w-4 accent-slate-900" checked={enabled} onChange={(e) => setToggle(category, e.target.checked)} />
                      <span className={`text-sm ${enabled ? "" : "text-muted-foreground line-through"}`}>{CATEGORY_LABELS[category]}</span>
                    </label>
                    <div className={`flex items-center gap-2 ${enabled ? "" : "opacity-40"}`}>
                      <input className="w-28 accent-slate-900" type="range" min=".5" max="1.5" step=".05" disabled={!enabled} value={multipliers[category] || 1} onChange={(e) => setMultiplier(category, e.target.value)} />
                      <span className="w-10 text-right text-xs tabular-nums">{(multipliers[category] || 1).toFixed(2)}x</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between"><div><p className="text-sm font-semibold">Custom rules</p><p className="text-xs text-muted-foreground">Plain-language rules injected into the classifier prompt.</p></div><Button type="button" variant="outline" size="sm" onClick={addRule}><Plus className="h-3.5 w-3.5" />Rule</Button></div>
            <div className="space-y-2">
              {rules.length === 0 && <p className="text-xs text-muted-foreground">No custom rules yet.</p>}
              {rules.map((rule, i) => (
                <div key={i} className="flex gap-2"><Input value={rule} onChange={(e) => setRule(i, e.target.value)} placeholder="e.g. Fictional combat language is acceptable." /><Button type="button" variant="ghost" size="icon" onClick={() => removeRule(i)}><Trash2 className="h-4 w-4" /></Button></div>
              ))}
            </div>
          </div>

          <label className="flex items-center justify-between rounded-lg border p-4"><span><span className="block text-sm font-medium">Allow violent / fictional context</span><span className="block text-xs text-muted-foreground">Lets the classifier discount fictional combat and reported violence.</span></span><input type="checkbox" className="h-4 w-4 accent-slate-900" checked={Boolean(settings.allow_violence_context)} onChange={(e) => setSettings({ allow_violence_context: e.target.checked })} /></label>
          {message && <p className="text-sm text-muted-foreground">{message}</p>}<Button onClick={save} disabled={saving || form.review_threshold >= form.reject_threshold}><Save className="h-4 w-4" />{saving ? "Saving..." : "Save policy"}</Button>
        </CardContent></Card>
        <Card className="h-fit"><CardHeader><CardTitle>Live routing preview</CardTitle></CardHeader><CardContent className="space-y-5"><div className="rounded-xl bg-muted p-5 text-center"><p className="text-xs text-muted-foreground">Example calibrated confidence</p><p className="my-2 text-4xl font-semibold tabular-nums">{Math.round(preview * 100)}%</p><DecisionBadge decision={route(preview, form.review_threshold, form.reject_threshold)} /></div><input className="w-full accent-slate-900" type="range" min="0" max="1" step=".01" value={preview} onChange={(e) => setPreview(Number(e.target.value))} /><div className="space-y-2 text-xs text-muted-foreground"><div className="flex justify-between"><span>Below {Math.round(form.review_threshold * 100)}%</span><span>Auto approve</span></div><div className="flex justify-between"><span>{Math.round(form.review_threshold * 100)}% to {Math.round(form.reject_threshold * 100)}%</span><span>Human review</span></div><div className="flex justify-between"><span>{Math.round(form.reject_threshold * 100)}% and above</span><span>Auto reject</span></div></div></CardContent></Card>
      </div>
    </>
  )
}
