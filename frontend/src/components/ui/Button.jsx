import { cn } from "@/lib/utils"

export function Button({ className, variant = "default", size = "default", ...props }) {
  const variants = {
    default: "bg-primary text-primary-foreground hover:opacity-90",
    outline: "border bg-card hover:bg-muted",
    ghost: "hover:bg-muted",
    danger: "bg-red-600 text-white hover:bg-red-700",
  }
  const sizes = { default: "h-10 px-4", sm: "h-8 px-3 text-xs", icon: "h-9 w-9" }
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg text-sm font-medium transition disabled:pointer-events-none disabled:opacity-50",
        variants[variant], sizes[size], className
      )}
      {...props}
    />
  )
}

