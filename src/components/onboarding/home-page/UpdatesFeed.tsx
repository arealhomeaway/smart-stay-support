/**
 * Property page Part 2 (2.6): Updates on Overview, newest first: team notes only. Owner messages,
 * calls, texts and weekly updates live only on the Owner tab.
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export type TeamNote = { id: string; body: string; author_id: string | null; created_at: string; task_id: string | null; kind?: string | null };

/** Team notes only: no call or text logs, no Task comments. */
export function teamUpdates(notes: TeamNote[]): TeamNote[] {
  return notes
    .filter((n) => !n.task_id && (!n.kind || n.kind === "note"))
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function UpdatesFeed(p: {
  notes: TeamNote[];
  nameOf: (id: string | null) => string;
  telegramUrl: string | null;
  canAdd: boolean;
  onAdd: (body: string) => void;
  adding: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const rows = teamUpdates(p.notes);
  const when = (iso: string) => new Date(iso).toLocaleString("en-US", { timeZone: "America/Chicago", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  return (
    <section className="surface space-y-3 p-4" aria-label="Updates">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Updates</h2>
        <div className="flex flex-wrap gap-2">
          {p.telegramUrl ? (
            <Button asChild variant="outline" className="min-h-11">
              <a href={p.telegramUrl} target="_blank" rel="noreferrer">
                Open Telegram group
              </a>
            </Button>
          ) : null}
          {p.canAdd ? (
            <Button variant="outline" className="min-h-11" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
              Add a note
            </Button>
          ) : null}
        </div>
      </div>
      {open ? (
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!body.trim()) return;
            p.onAdd(body.trim());
            setBody("");
            setOpen(false);
          }}
        >
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} maxLength={4000} aria-label="Note for the team" placeholder="A note for the team" />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" className="min-h-11" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" className="min-h-11" disabled={p.adding || !body.trim()}>
              Save
            </Button>
          </div>
        </form>
      ) : null}
      {rows.length === 0 ? <p className="text-sm text-muted-foreground">No team notes yet.</p> : null}
      <ol className="divide-y divide-border">
        {rows.slice(0, 20).map((n) => (
          <li key={n.id} className="space-y-1 py-2">
            <span className="inline-flex rounded bg-muted px-2 py-0.5 text-xs font-medium">Team note</span>
            <p className="whitespace-pre-wrap text-sm">{n.body}</p>
            <p className="text-xs text-muted-foreground">
              {p.nameOf(n.author_id)} · {when(n.created_at)}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}
