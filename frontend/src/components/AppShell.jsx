import { createElement, useEffect, useState } from "react"
import { NavLink, Outlet } from "react-router-dom"
import {
  BarChart3, ClipboardCheck, FileSearch, FlaskConical, GitCompareArrows, Menu, Moon, Radar,
  ScrollText, Settings2, ShieldCheck, Sun, X,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/Button"

const nav = [
  { to: "/", label: "Dashboard", icon: BarChart3 },
  { to: "/analyzer", label: "Content Analyzer", icon: Radar },
  { to: "/context-lab", label: "Context Lab", icon: GitCompareArrows },
  { to: "/reviews", label: "Review Queue", icon: ClipboardCheck },
  { to: "/policies", label: "Policy Configuration", icon: Settings2 },
  { to: "/evaluation", label: "Dataset Evaluation", icon: FlaskConical },
  { to: "/audit", label: "Audit Log", icon: ScrollText },
]

export function AppShell() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [dark, setDark] = useState(() => localStorage.getItem("sentinel-theme") === "dark")
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark)
    localStorage.setItem("sentinel-theme", dark ? "dark" : "light")
  }, [dark])

  const sidebar = (
    <>
      <div className="flex h-16 items-center gap-3 border-b px-5">
        <div className="grid h-8 w-8 place-items-center rounded-lg bg-slate-950 text-white dark:bg-white dark:text-slate-950"><ShieldCheck className="h-4 w-4" /></div>
        <div><p className="text-sm font-semibold">Sentinel AI</p><p className="text-[10px] uppercase tracking-widest text-muted-foreground">Moderation OS</p></div>
      </div>
      <nav className="flex-1 space-y-1 p-3">
        {nav.map(({ to, label, icon }) => (
          <NavLink key={to} to={to} end={to === "/"} onClick={() => setMobileOpen(false)}
            className={({ isActive }) => cn("flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground", isActive && "bg-muted font-medium text-foreground")}>
            {createElement(icon, { className: "h-4 w-4" })}{label}
          </NavLink>
        ))}
      </nav>
      <div className="border-t p-4">
        <div className="rounded-lg border bg-muted/40 p-3">
          <div className="mb-1 flex items-center gap-2 text-xs font-semibold"><FileSearch className="h-3.5 w-3.5" />Explainable by design</div>
          <p className="text-[11px] leading-4 text-muted-foreground">AI classifies. Deterministic policy code decides.</p>
        </div>
      </div>
    </>
  )

  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r bg-card lg:flex">{sidebar}</aside>
      {mobileOpen && <div className="fixed inset-0 z-40 bg-slate-950/30 lg:hidden" onClick={() => setMobileOpen(false)} />}
      <aside className={cn("fixed inset-y-0 left-0 z-50 flex w-72 -translate-x-full flex-col border-r bg-card transition lg:hidden", mobileOpen && "translate-x-0")}>
        <Button variant="ghost" size="icon" className="absolute right-3 top-3" onClick={() => setMobileOpen(false)}><X className="h-4 w-4" /></Button>{sidebar}
      </aside>
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b bg-background/95 px-4 backdrop-blur sm:px-7">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileOpen(true)}><Menu className="h-5 w-5" /></Button>
          <div className="hidden text-xs text-muted-foreground sm:block">Content safety operations</div>
          <div className="ml-auto flex items-center gap-2">
            <span className="hidden items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-xs sm:flex"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />Pipeline active</span>
            <Button variant="ghost" size="icon" onClick={() => setDark(!dark)} aria-label="Toggle theme">{dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}</Button>
          </div>
        </header>
        <main className="mx-auto max-w-7xl p-4 sm:p-7"><Outlet /></main>
      </div>
    </div>
  )
}
