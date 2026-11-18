/**
 * "Add more or update" on something the homeowner already finished (approved Nov 18). One box,
 * one Save: a named Saved line on success, or the error with her words kept in the box.
 */
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { REOPEN_COPY } from "@/lib/homeowner-reopen";

export function AddMoreBox({
  title,
  onSave,
  onSaved,
  savedLine,
}: {
  title: string;
  onSave: (body: string) => Promise<unknown>;
  onSaved?: () => void;
  savedLine: string;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const save = useMutation({
    mutationFn: () => {
      if (!text.trim()) throw new Error("Type what you want to add first.");
      return onSave(text.trim());
    },
    onSuccess: () => {
      setText("");
      setOpen(false);
      toast.success(savedLine);
      onSaved?.();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  if (!open) {
    return (
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" className="min-h-11" onClick={() => setOpen(true)} data-testid="add-more-open">
          {REOPEN_COPY.addMoreTitle}
        </Button>
      </div>
    );
  }
  const id = `add-more-${title.replace(/\W+/g, "-").slice(0, 40)}`;
  return (
    <section aria-label={REOPEN_COPY.addMoreTitle} className="space-y-2" data-testid="add-more-box">
      <label htmlFor={id} className="text-sm font-semibold">{REOPEN_COPY.addMoreTitle}</label>
      <Textarea id={id} rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder="What you want to add or change" />
      <p className="text-xs text-muted-foreground">{REOPEN_COPY.keepNote}</p>
      {save.isError ? (
        <p role="alert" className="text-sm font-medium text-destructive">
          Not saved: {save.error.message} Your words are still here. Try Save again.
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button type="button" className="min-h-11" disabled={save.isPending || !text.trim()} onClick={() => save.mutate()}>
          {save.isPending ? "Saving…" : "Save"}
        </Button>
        <Button type="button" variant="ghost" className="min-h-11" disabled={save.isPending} onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </section>
  );
}
