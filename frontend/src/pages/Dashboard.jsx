import { createElement } from "react"
import { Activity, Ban, CheckCircle2, ClipboardList, RotateCcw } from "lucide-react"
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { api } from "@/services/api"
import { useApi } from "@/hooks/useApi"
import { PageHeader } from "@/components/PageHeader"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card"
import { LoadingState, ErrorState, EmptyState } from "@/components/StateViews"
import { DecisionBadge } from "@/components/DecisionBadge"
import { formatDate, titleCase } from "@/lib/utils"

const COLORS = ["#0f172a", "#475569", "#94a3b8", "#cbd5e1", "#64748b", "#334155"]

export default function Dashboard() {
  const { data, loading, error } = useApi(api.dashboard, [])
  if (loading) return <LoadingState label="Loading operations dashboard" />
  if (error) return <ErrorState message={error} />
  const metrics = [
    ["Total Analyses", data.metrics.total_analyses, Activity],
    ["Auto Approved", data.metrics.auto_approved, CheckCircle2],
    ["Auto Rejected", data.metrics.auto_rejected, Ban],
    ["Human Review", data.metrics.human_review, ClipboardList],
    ["Override Rate", `${(data.metrics.moderator_override_rate * 100).toFixed(1)}%`, RotateCcw],
  ]
  return (
    <>
      <PageHeader eyebrow="Operations" title="Moderation overview" description="A live view of routing outcomes, category patterns, and human feedback." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {metrics.map(([label, value, icon]) => <Card key={label}><CardContent className="pt-5"><div className="mb-5 flex items-center justify-between"><span className="text-xs font-medium text-muted-foreground">{label}</span>{createElement(icon, { className: "h-4 w-4 text-muted-foreground" })}</div><p className="text-2xl font-semibold tabular-nums">{value}</p></CardContent></Card>)}
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2"><CardHeader><CardTitle>Category distribution</CardTitle></CardHeader><CardContent className="h-72">
          {data.category_distribution.length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={data.category_distribution} margin={{ left: -20 }}><CartesianGrid strokeDasharray="3 3" vertical={false} opacity={.3} /><XAxis dataKey="name" tickFormatter={titleCase} fontSize={11} /><YAxis fontSize={11} allowDecimals={false} /><Tooltip cursor={{ fill: "rgba(148,163,184,.08)" }} /><Bar dataKey="value" fill="#334155" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer> : <EmptyState>No moderation data yet</EmptyState>}
        </CardContent></Card>
        <Card><CardHeader><CardTitle>Platform mix</CardTitle></CardHeader><CardContent className="h-72">
          {data.platform_distribution.length ? <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={data.platform_distribution} dataKey="value" nameKey="name" innerRadius={58} outerRadius={85} paddingAngle={3}>{data.platform_distribution.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer> : <EmptyState>No platform data yet</EmptyState>}
        </CardContent></Card>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-2"><CardHeader><CardTitle>Confidence distribution</CardTitle></CardHeader><CardContent className="h-64">
          <ResponsiveContainer width="100%" height="100%"><BarChart data={data.confidence_distribution} margin={{ left: -25 }}><XAxis dataKey="name" fontSize={11} /><YAxis fontSize={11} allowDecimals={false} /><Tooltip /><Bar dataKey="value" fill="#64748b" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer>
        </CardContent></Card>
        <Card className="lg:col-span-3"><CardHeader><CardTitle>Recent activity</CardTitle></CardHeader><CardContent>
          {data.recent_activity.length ? <div className="divide-y">{data.recent_activity.map((item) => <div key={item.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{item.content}</p><p className="mt-1 text-xs text-muted-foreground">{titleCase(item.top_category)} · {formatDate(item.created_at)}</p></div><DecisionBadge decision={item.decision} /></div>)}</div> : <EmptyState>No recent analyses</EmptyState>}
        </CardContent></Card>
      </div>
    </>
  )
}
