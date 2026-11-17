/**
 * My Tasks "Done recently" (Admin, Nov 17): the person's own Tasks finished in the last 7 days,
 * each with its proof: who finished it (role) and when, its files, and when it went to the
 * homeowner. Read only; rules in src/lib/task-proof.ts.
 */
import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { centralDay } from "@/lib/homeowner-has";
import { doneByLine, filesLine, type DoneTask } from "@/lib/task-proof";

export type TaskProof = { files: Record<string, string[]>; sentAt: Record<string, string>; roles: Record<string, string> };

const FIRST_ROWS = 8;

/** The proof under one finished Task: "Done by Project Manager on 11/16/2026 · Files: a.pdf · Sent to the homeowner 11/16/2026". */
export function taskProofText(task: DoneTask & { evidence_note?: string | null }, proof: TaskProof | undefined): string {
  const role = task.completed_by ? proof?.roles[task.completed_by] ?? null : null;
  const parts = [doneByLine(role, task.completed_at)];
  const files = filesLine(proof?.files[task.id] ?? []);
  if (files) parts.push(files);
  const sent = proof?.sentAt[task.id];
  if (sent) parts.push(`Sent to the homeowner ${centralDay(sent)}`);
  return parts.join(" · ");
}

export function DoneRecentlySection({
  tasks,
  proof,
  propertyName,
  onOpen,
}: {
  tasks: (DoneTask & { evidence_note?: string | null })[];
  proof: TaskProof | undefined;
  propertyName: (id: string) => string;
  onOpen: (taskId: string) => void;
}) {
  const [all, setAll] = useState(false);
  const shown = all ? tasks : tasks.slice(0, FIRST_ROWS);
  return (
    <section aria-label="Done recently" className="surface space-y-2 p-3">
      <h2 className="text-base font-semibold">
        Done recently <span className="numeric text-muted-foreground">({tasks.length})</span>
      </h2>
      {tasks.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing finished in the last 7 days.</p>
      ) : (
        <>
          <ul className="divide-y divide-border rounded-md border border-border">
            {shown.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => onOpen(t.id)}
                  data-done-row={t.id}
                  className="flex min-h-11 w-full items-start gap-3 px-3 py-2 text-left text-sm hover:bg-muted/50"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{t.title}</span>
                    <span className="block text-xs text-muted-foreground">{propertyName(t.property_id)}</span>
                    <span className="block text-xs text-foreground">{taskProofText(t, proof)}</span>
                    {t.evidence_note?.trim() ? (
                      <span className="block truncate text-xs text-muted-foreground">Note: {t.evidence_note.trim()}</span>
                    ) : null}
                  </span>
                  <ArrowRight className="mt-1 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
          {tasks.length > FIRST_ROWS ? (
            <Button type="button" variant="ghost" size="sm" className="min-h-11" onClick={() => setAll((v) => !v)}>
              {all ? "Show fewer" : `Show all (${tasks.length})`}
            </Button>
          ) : null}
        </>
      )}
    </section>
  );
}
