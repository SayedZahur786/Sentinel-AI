export function HighlightedContent({ content, trigger }) {
  if (!trigger) return <p className="whitespace-pre-wrap text-sm leading-6">{content}</p>
  const index = content.toLowerCase().indexOf(trigger.toLowerCase())
  if (index < 0) return <p className="whitespace-pre-wrap text-sm leading-6">{content}</p>
  return (
    <p className="whitespace-pre-wrap text-sm leading-6">
      {content.slice(0, index)}
      <mark className="rounded bg-red-100 px-1 text-red-900 dark:bg-red-950 dark:text-red-200">
        {content.slice(index, index + trigger.length)}
      </mark>
      {content.slice(index + trigger.length)}
    </p>
  )
}

