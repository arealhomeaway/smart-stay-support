import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/page";
import { stateChip } from "@/lib/semantic";
import { usDateTime } from "@/lib/dates";
import { propertyForms, type FormTask } from "@/lib/property-forms";

const STATUS: Record<string, { label: string; tone: Parameters<typeof stateChip>[0] }> = {
  complete: { label: "Complete", tone: "done" },
  in_progress: { label: "In progress", tone: "info" },
  not_started: { label: "Not started", tone: "waiting" },
  not_found: { label: "No Task on this plan", tone: "waiting" },
};

/**
 * Assessments & Forms — a read-only index over existing workflow Tasks.
 * Opening a form opens its Task (same record, attachments and history);
 * nothing here creates work or touches handoff.
 */
export function AssessmentsFormsPanel({
  tasks,
  people,
  onOpenTask,
}: {
  tasks: FormTask[];
  people: { id: string; full_name?: string | null; email?: string | null }[];
  onOpenTask: (id: string) => void;
}) {
  const forms = useMemo(() => propertyForms(tasks), [tasks]);
  const name = (id: string | null) => {
    const p = people.find((x) => x.id === id);
    return p ? (p.full_name ?? p.email ?? "Assigned") : "Unassigned";
  };
  return (
    <section className="surface space-y-3 p-4" aria-label="Assessments and forms">
      <div>
        <h2 className="font-semibold">Assessments &amp; Forms</h2>
        <p className="text-xs text-muted-foreground">
          Each form lives on its workflow Task. Opening one shows that Task — its files and history.
        </p>
      </div>
      <ul className="divide-y">
        {forms.map((f) => {
          const s = STATUS[f.status];
          return (
            <li key={f.key} className="flex flex-wrap items-center gap-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{f.label}</p>
                <p className="text-xs text-muted-foreground">
                  {f.sourceLabel}
                  {f.tasks.length > 0 && (
                    <>
                      {" · "}
                      {name(f.responsible)}
                      {f.lastUpdate ? ` · Updated ${usDateTime(f.lastUpdate)}` : ""}
                    </>
                  )}
                </p>
              </div>
              <Chip className={stateChip(s.tone)}>{s.label}</Chip>
              {f.tasks.map((t, i) => (
                <Button key={t.id} size="sm" variant="outline" onClick={() => onOpenTask(t.id)}>
                  {f.tasks.length > 1 ? `Open ${i + 1}` : f.status === "complete" ? "View record" : "Open"}
                </Button>
              ))}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
