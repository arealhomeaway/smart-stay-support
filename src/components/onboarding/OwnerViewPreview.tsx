import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { ownerViewPreview } from "@/lib/owner-view-preview.functions";
import type { PreviewItem } from "@/lib/owner-view-preview";

function List({ items, empty }: { items: PreviewItem[]; empty: string }) {
  if (items.length === 0) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <ul className="space-y-1.5">
      {items.map((i) => (
        <li key={i.id} className="text-sm">
          <span className="font-medium">{i.title}</span>{" "}
          <span className="text-xs text-muted-foreground">· {i.kind}</span>
          {i.detail ? <p className="line-clamp-2 text-xs text-muted-foreground">{i.detail}</p> : null}
        </li>
      ))}
    </ul>
  );
}

/** What the homeowner sees for this home — read-only, no new sharing. */
export function OwnerViewPreview({ propertyId }: { propertyId: string }) {
  const [open, setOpen] = useState(false);
  const load = useServerFn(ownerViewPreview);
  const q = useQuery({
    queryKey: ["owner-view-preview", propertyId],
    enabled: open,
    queryFn: () => load({ data: { propertyId } }),
  });
  return (
    <section className="surface space-y-3 p-4" aria-label="Owner view preview">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-semibold">Owner view preview</h2>
          <p className="text-xs text-muted-foreground">
            Read-only. Uses the same rules as the homeowner portal; nothing is shared from here.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => setOpen((v) => !v)}>
          {open ? "Hide preview" : "Show owner view"}
        </Button>
      </div>
      {open &&
        (q.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : q.error ? (
          <p className="text-sm text-destructive">The preview could not be loaded.</p>
        ) : q.data ? (
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <p className="eyebrow">Visible to the owner now</p>
              <List items={q.data.visible} empty="Nothing is shared with the owner yet." />
            </div>
            <div className="space-y-2">
              <p className="eyebrow">Draft — proposed for sharing</p>
              <List items={q.data.draft} empty="No drafts waiting." />
            </div>
            <div className="space-y-2">
              <p className="eyebrow">Internal only — never shown</p>
              <ul className="list-disc pl-4 text-sm text-muted-foreground">
                {q.data.internalOnly.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </div>
          </div>
        ) : null)}
    </section>
  );
}
