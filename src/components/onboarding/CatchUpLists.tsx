/** Lists shared by the plan catch-up forms: Tasks left as they are, and owner cards no longer sent. */
export function HeldList({ held, title = "Not changed" }: { held: { taskId: string; title: string; reason: string }[]; title?: string }) {
  if (held.length === 0) return null;
  return (
    <div>
      <p className="text-sm font-medium">{title} ({held.length})</p>
      <ul className="mt-1 max-h-40 space-y-1 overflow-y-auto rounded-md border border-border p-2 text-xs text-muted-foreground">
        {held.map((h) => (
          <li key={h.taskId}>
            <span className="font-medium text-foreground">{h.title}</span>: {h.reason}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function CoveredList({ covered }: { covered: { taskId: string; title: string; code: string }[] }) {
  if (covered.length === 0) return null;
  return (
    <div>
      <p className="text-sm font-medium">The owner will not get these cards (already covered)</p>
      <ul className="mt-1 max-h-40 space-y-1 overflow-y-auto rounded-md border border-border p-2 text-sm">
        {covered.map((c) => (
          <li key={`${c.code}-${c.taskId}`}>{c.title}</li>
        ))}
      </ul>
    </div>
  );
}

