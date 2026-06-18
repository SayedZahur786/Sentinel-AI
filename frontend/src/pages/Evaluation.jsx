import { useState } from "react"
import { Play } from "lucide-react"
import { api } from "@/services/api"
import { useApi } from "@/hooks/useApi"
import { PageHeader } from "@/components/PageHeader"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { Select } from "@/components/ui/Field"
import { LoadingState, ErrorState } from "@/components/StateViews"
import { titleCase } from "@/lib/utils"
import { CATEGORIES as categories, PLATFORMS } from "@/lib/categories"

export default function Evaluation() {
  const { data: samples, loading, error } = useApi(api.samples, [])
  const [platform, setPlatform] = useState("social")
  const [limit, setLimit] = useState(20)
  const [result, setResult] = useState(null)
  const [running, setRunning] = useState(false)
  const [runError, setRunError] = useState("")
  async function run() { setRunning(true); setRunError(""); try { setResult(await api.evaluate({ platform, limit: Number(limit) })) } catch (err) { setRunError(err.message) } finally { setRunning(false) } }
  if (loading) return <LoadingState />
  if (error) return <ErrorState message={error} />
  return (
    <>
      <PageHeader eyebrow="Quality measurement" title="Dataset evaluation" description="Compare top-category predictions against 100 seeded labels. Each sample uses one independent Gemini call." actions={<div className="flex gap-2"><Select className="w-44" value={platform} onChange={(e) => setPlatform(e.target.value)}>{PLATFORMS.map((p) => <option key={p.slug} value={p.slug}>{p.label}</option>)}</Select><Select className="w-28" value={limit} onChange={(e) => setLimit(e.target.value)}><option value="10">10 rows</option><option value="20">20 rows</option><option value="50">50 rows</option><option value="100">100 rows</option></Select><Button onClick={run} disabled={running}><Play className="h-4 w-4" />{running ? "Running..." : "Run"}</Button></div>} />
      {runError && <ErrorState message={runError} />}
      {result && <><div className="mb-4 grid gap-4 sm:grid-cols-3">{[["Accuracy", result.accuracy], ["Macro precision", result.precision], ["Macro recall", result.recall]].map(([label, value]) => <Card key={label}><CardContent className="pt-5"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-2 text-2xl font-semibold">{(value * 100).toFixed(1)}%</p></CardContent></Card>)}</div>
      <Card className="mb-4 overflow-hidden"><CardHeader><CardTitle>Confusion matrix</CardTitle><p className="text-xs text-muted-foreground">Rows are ground truth; columns are predictions.</p></CardHeader><CardContent className="overflow-x-auto"><table className="w-full min-w-[720px] text-center text-xs"><thead><tr><th className="p-2 text-left">Actual \ Predicted</th>{categories.map((c) => <th key={c} className="p-2 font-medium">{titleCase(c)}</th>)}</tr></thead><tbody>{categories.map((truth) => <tr key={truth} className="border-t"><th className="p-2 text-left font-medium">{titleCase(truth)}</th>{categories.map((pred) => { const count = result.confusion_matrix[truth][pred]; return <td key={pred} className={`p-3 ${count ? truth === pred ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200" : "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200" : ""}`}>{count}</td> })}</tr>)}</tbody></table></CardContent></Card></>}
      <Card><CardHeader><CardTitle>{result ? "Sample predictions" : `Seeded dataset · ${samples.length} samples`}</CardTitle></CardHeader><CardContent className="overflow-x-auto"><table className="w-full min-w-[700px] text-left text-sm"><thead className="text-xs text-muted-foreground"><tr><th className="pb-3">Content</th><th className="pb-3">Ground truth</th>{result && <><th className="pb-3">Prediction</th><th className="pb-3 text-right">Confidence</th></>}</tr></thead><tbody>{(result?.predictions || samples).slice(0, 100).map((row) => <tr key={row.id} className="border-t"><td className="max-w-md py-3 pr-4">{row.text}</td><td className="py-3 pr-4">{titleCase(row.ground_truth || row.ground_truth_category)}</td>{result && <><td className={`py-3 ${row.prediction === row.ground_truth ? "text-emerald-600" : "text-red-600"}`}>{titleCase(row.prediction)}</td><td className="py-3 text-right tabular-nums">{Math.round(row.confidence * 100)}%</td></>}</tr>)}</tbody></table></CardContent></Card>
    </>
  )
}

