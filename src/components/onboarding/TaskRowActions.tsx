/**
 * One Task's actions on a list row: Mark done, Not needed for this home and Change due date.
 * The same forms and saves as the plan catch-up bar on a home's Tasks tab, so My Tasks and the
 * home page change a Task the same way; the database re-checks every change.
 */
import { useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { BulkCompleteDialog } from "@/components/onboarding/BulkCompleteDialog";
import { CatchUpActionDialog } from "@/components/onboarding/PlanCatchUp";
import { rowActionsFor, resultLine, type RowAction } from "@/lib/plan-catch-up";
import { undoPlanCatchUpFn } from "@/lib/plan-catch-up.functions";

export function TaskRowActions({
  propertyId,
  homeName,
  task,
  onChanged,
}: {
  propertyId: string;
  homeName: string;
  task: { id: string; title: string; status: string };
  onChanged: () => void;
}) {
  const [dialog, setDialog] = useState<RowAction | null>(null);
  const undo = useServerFn(undoPlanCatchUpFn);
  const actions = rowActionsFor(task);
  const saved = (line: string, batchId: string | null | undefined) => {
    setDialog(null);
    onChanged();
    toast.success(line, {
      duration: 10_000,
      ...(batchId
        ? {
            action: {
              label: "Undo",
              onClick: () => {
                void undo({ data: { batchId } })
                  .then(() => {
                    toast.success("Undone.");
                    onChanged();
                  })
                  .catch((e: Error) => toast.error(e.message));
              },
            },
          }
        : {}),
    });
  };
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="size-11 shrink-0" aria-label={`Change "${task.title}"`}>
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {actions.includes("mark_done") ? (
            <DropdownMenuItem className="min-h-11" onSelect={() => setDialog("mark_done")}>Mark done</DropdownMenuItem>
          ) : null}
          <DropdownMenuItem className="min-h-11" onSelect={() => setDialog("not_needed")}>Not needed for this home</DropdownMenuItem>
          <DropdownMenuItem className="min-h-11" onSelect={() => setDialog("due_date")}>Change due date…</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {dialog === "mark_done" ? (
        <BulkCompleteDialog
          propertyId={propertyId}
          homeName={homeName}
          selectedIds={[task.id]}
          onClose={() => setDialog(null)}
          onSaved={(r, doneOn) =>
            saved(resultLine({ action: "mark_done", done: r.completed, doneOn, covered: r.covered?.length ?? 0, skipped: r.held.length }), r.batchId)
          }
        />
      ) : null}
      {dialog === "not_needed" || dialog === "due_date" ? (
        <CatchUpActionDialog
          action={dialog}
          propertyId={propertyId}
          homeName={homeName}
          selectedIds={[task.id]}
          people={[]}
          onClose={() => setDialog(null)}
          onSaved={(r) => saved(resultLine({ action: dialog, done: r.done, covered: r.covered?.length ?? 0, skipped: r.held.length }), r.batchId)}
        />
      ) : null}
    </>
  );
}
