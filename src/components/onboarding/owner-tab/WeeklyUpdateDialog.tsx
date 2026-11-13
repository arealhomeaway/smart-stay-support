/**
 * Property page Part 2 (2.5): Review and send this week's owner update. Edit, Not now, Send to the owner.
 * Owners with a portal get it in the portal and by email; others get it from the signed-in person's mailbox.
 */
import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { EmailComposer } from "@/components/EmailComposer";
import { saveWeeklyTextFn, sendWeeklyFn } from "@/lib/owner-tab.functions";
import { weeklySendClosed } from "@/lib/owner-tab";

export function WeeklyUpdateDialog(p: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  propertyId: string;
  homeName: string;
  weekly: { id: string; weekStart: string; text: string };
  hasPortal: boolean;
  onSent: () => void;
}) {
  const [text, setText] = useState(p.weekly.text);
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    if (p.open) {
      setText(p.weekly.text);
      setEditing(false);
    }
  }, [p.open, p.weekly.text]);
  const save = useServerFn(saveWeeklyTextFn);
  const send = useServerFn(sendWeeklyFn);
  const closed = weeklySendClosed(new Date());
  const subject = `This week at ${p.homeName}`;
  const saveText = useMutation({
    mutationFn: () => save({ data: { id: p.weekly.id, text } }),
    onSuccess: () => {
      setEditing(false);
      toast.success("Saved.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const sendIt = useMutation({
    mutationFn: (emailedSubject: string | null) => send({ data: { id: p.weekly.id, text, emailedSubject } }),
    onSuccess: () => {
      p.onOpenChange(false);
      p.onSent();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open={p.open} onOpenChange={p.onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>This week's update</DialogTitle>
          <DialogDescription>Written from this week's Tasks. Review, edit if needed, and send.</DialogDescription>
        </DialogHeader>
        {editing ? (
          <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={14} maxLength={8000} aria-label="This week's update" />
        ) : (
          <pre className="whitespace-pre-wrap rounded-md border border-border bg-muted/30 p-3 font-sans text-sm">{text}</pre>
        )}
        {closed ? <p className="text-sm text-muted-foreground">Sending opens again on Monday.</p> : null}
        <DialogFooter className="flex-wrap gap-2 sm:justify-between">
          {editing ? (
            <Button variant="outline" className="min-h-11" disabled={saveText.isPending} onClick={() => saveText.mutate()}>
              Save changes
            </Button>
          ) : (
            <Button variant="outline" className="min-h-11" onClick={() => setEditing(true)}>
              Edit
            </Button>
          )}
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" className="min-h-11" onClick={() => p.onOpenChange(false)}>
              Not now
            </Button>
            {p.hasPortal ? (
              <Button className="min-h-11" disabled={closed || sendIt.isPending} onClick={() => sendIt.mutate(null)}>
                Send to the owner
              </Button>
            ) : closed ? (
              <Button className="min-h-11" disabled>
                Send to the owner
              </Button>
            ) : (
              <div className="[&_button]:min-h-11">
                <EmailComposer
                  key={`weekly-${text}`}
                  context="property"
                  recordId={p.propertyId}
                  label="Send to the owner"
                  variant="primary"
                  initialSubject={subject}
                  initialBody={text}
                  onSent={(info) => sendIt.mutate(info.subject)}
                />
              </div>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
