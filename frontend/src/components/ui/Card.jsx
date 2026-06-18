import { cn } from "@/lib/utils"

export function Card({ className, ...props }) {
  return <div className={cn("rounded-xl border bg-card shadow-soft", className)} {...props} />
}
export function CardHeader({ className, ...props }) {
  return <div className={cn("p-5 pb-3", className)} {...props} />
}
export function CardTitle({ className, ...props }) {
  return <h3 className={cn("text-sm font-semibold", className)} {...props} />
}
export function CardContent({ className, ...props }) {
  return <div className={cn("p-5 pt-2", className)} {...props} />
}

