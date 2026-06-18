export function JsonBlock({ value }) {
  return (
    <pre className="max-h-96 overflow-auto rounded-lg border bg-slate-950 p-4 text-xs leading-5 text-slate-200">
      {typeof value === "string" ? value : JSON.stringify(value, null, 2)}
    </pre>
  )
}

