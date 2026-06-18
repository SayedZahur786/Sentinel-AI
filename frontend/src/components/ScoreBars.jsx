import { titleCase } from "@/lib/utils"

export function ScoreBars({ scores }) {
  return (
    <div className="space-y-3">
      {Object.entries(scores).sort((a, b) => b[1] - a[1]).map(([name, value]) => (
        <div key={name}>
          <div className="mb-1 flex justify-between text-xs">
            <span className="font-medium">{titleCase(name)}</span>
            <span className="tabular-nums text-muted-foreground">{Math.round(value * 100)}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className={value >= .8 ? "h-full bg-red-500" : value >= .5 ? "h-full bg-amber-500" : "h-full bg-slate-500"}
              style={{ width: `${value * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

