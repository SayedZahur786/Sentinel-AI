import { cn } from "@/lib/utils"

export function Label({ className, ...props }) {
  return <label className={cn("mb-1.5 block text-sm font-medium", className)} {...props} />
}
export function Input({ className, ...props }) {
  return <input className={cn("h-10 w-full rounded-lg border bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-slate-400/30", className)} {...props} />
}
export function Textarea({ className, ...props }) {
  return <textarea className={cn("w-full rounded-lg border bg-card px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-slate-400/30", className)} {...props} />
}
export function Select({ className, ...props }) {
  return <select className={cn("h-10 w-full rounded-lg border bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-slate-400/30", className)} {...props} />
}

