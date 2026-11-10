/** Close ticket and Reopen ticket, always both shown in the ticket header (register T12). */
import { Button } from "@/components/ui/button";
import { CLOSE_REOPEN_COPY, type CloseReopenState } from "@/lib/ticket-close-reopen";

export function CloseReopenButtons({
  state,
  onClose,
  onReopen,
}: {
  state: CloseReopenState;
  onClose: () => void;
  onReopen: () => void;
}) {
  if (!state) return null;
  const reason = state.close.reason ?? state.reopen.reason;
  return (
    <div className="space-y-1" data-testid="close-reopen">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          className="min-h-11"
          disabled={!state.close.enabled}
          aria-describedby={state.close.reason ? "close-reopen-reason" : undefined}
          onClick={onClose}
        >
          {CLOSE_REOPEN_COPY.close}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          disabled={!state.reopen.enabled}
          aria-describedby={state.reopen.reason ? "close-reopen-reason" : undefined}
          onClick={onReopen}
        >
          {CLOSE_REOPEN_COPY.reopen}
        </Button>
      </div>
      {reason && (
        <p id="close-reopen-reason" className="text-sm text-muted-foreground" data-testid="close-reopen-reason">
          {reason}
        </p>
      )}
    </div>
  );
}
