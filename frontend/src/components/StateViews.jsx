import { AlertCircle, LoaderCircle } from "lucide-react"

export function LoadingState({ label = "Loading" }) {
  return <div className="flex min-h-56 items-center justify-center gap-2 text-sm text-muted-foreground"><LoaderCircle className="h-4 w-4 animate-spin" />{label}</div>
}
export function ErrorState({ message }) {
  return <div className="flex min-h-40 items-center justify-center gap-2 rounded-xl border bg-card text-sm text-red-600"><AlertCircle className="h-4 w-4" />{message}</div>
}
export function EmptyState({ children }) {
  return <div className="flex min-h-48 items-center justify-center rounded-xl border border-dashed text-sm text-muted-foreground">{children}</div>
}

