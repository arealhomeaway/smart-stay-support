/**
 * The Current Action card on a ticket — the shared guided-action card wired to
 * the ticket's Complete & Advance door.
 */
import { GuidedActionCard } from "@/components/GuidedActionCard";
import { toast } from "sonner";
import type { ActionValues } from "@/lib/guided-action";
import type { CurrentAction } from "@/lib/ticket-current-action";
import { completeCurrentActionFn } from "@/lib/ticket-current-action.functions";

export function CurrentActionCard({
  ticketId,
  action,
  readOnly,
  onDone,
  onHandoff,
}: {
  ticketId: string;
  action: CurrentAction;
  readOnly?: boolean;
  /** Called after the step is recorded, so the ticket can reload and advance. */
  onDone: () => Promise<void> | void;
  onHandoff?: (target: string) => void;
}) {
  return (
    <GuidedActionCard
      action={action}
      {...(readOnly === undefined ? {} : { readOnly })}
      {...(onHandoff ? { onHandoff } : {})}
      onComplete={async (values: ActionValues) => {
        const result = await completeCurrentActionFn({
          data: { ticketId, actionId: action.id, values },
        });
        if (!result.ok) {
          toast.error(result.message);
          return false;
        }
        await onDone();
        return true;
      }}
    />
  );
}
