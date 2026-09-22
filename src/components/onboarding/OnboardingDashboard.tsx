import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CalendarDays, NotebookPen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { DialogFooter } from "@/components/ui/dialog";
import { setOnboardingProgramTypeFn } from "@/lib/onboarding.functions";
import type { HandoffDateSource } from "@/lib/onboarding-dates";
import { usDateTime } from "@/lib/dates";
import { PersonAvatar } from "@/components/PersonAvatar";
import { HomeownerCard } from "@/components/property/HomeownerCard";

type Note = {
  id: string;
  body: string;
  author_id: string | null;
  created_at: string;
  task_id: string | null;
};
type Person = { id: string; full_name: string | null; email: string | null };

/**
 * The home's dashboard: the dates everyone asks for, how far the plan has got,
 * and every note written on its work — all above the section tabs.
 */
export function OnboardingDashboard({
  propertyId,
  plannedClosingOn,
  actualClosingOn,
  actualAccessOn,
  targetHandoffOn,
  handoffSource,
  activeOwner,
  canEdit,
  done,
  total,
  notes,
  people,
  taskTitle,
}: {
  propertyId: string;
  plannedClosingOn: string | null;
  actualClosingOn: string | null;
  actualAccessOn: string | null;
  targetHandoffOn: string | null;
  handoffSource: HandoffDateSource;
  activeOwner: boolean;
  canEdit: boolean;
  done: number;
  total: number;
  notes: Note[];
  people: Person[];
  taskTitle: (taskId: string) => string | null;
}) {
  const [openNotes, setOpenNotes] = useState(false);

  const percent = total > 0 ? Math.round((done / total) * 100) : 0;

  const nameOf = (id: string | null) => {
    const person = people.find((p) => p.id === id);
    return person?.full_name || person?.email || "Teammate";
  };


  return (
    <section className="surface space-y-4 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <CalendarDays className="size-4 text-muted-foreground" />
          <p className="eyebrow">This home</p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <ProgramTypeControl
            propertyId={propertyId}
            activeOwner={activeOwner}
            canEdit={canEdit}
          />
          <Button type="button" size="sm" variant="outline" onClick={() => setOpenNotes(true)}>
            <NotebookPen className="mr-1.5 size-4" />
            Notes ({notes.length})
          </Button>
        </div>
      </div>

      <HomeownerCard propertyId={propertyId} canManage={canEdit} />

      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">Progress</span>
          <span className="text-muted-foreground">
            {done} of {total} steps complete · {percent}%
          </span>
        </div>
        <Progress value={percent} />
      </div>

      <Dialog open={openNotes} onOpenChange={setOpenNotes}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Notes on this home&apos;s work</DialogTitle>
            <DialogDescription>
              Every internal note written on this home and its steps, newest first.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {notes.length === 0 && (
              <p className="text-sm text-muted-foreground">No notes have been written yet.</p>
            )}
            {[...notes]
              .sort((a, b) => b.created_at.localeCompare(a.created_at))
              .map((note) => (
                <div key={note.id} className="rounded-md border p-3 text-sm">
                  <div className="flex items-center gap-2">
                    <PersonAvatar name={nameOf(note.author_id)} size="sm" />
                    <span className="font-medium">{nameOf(note.author_id)}</span>
                    <span className="text-xs text-muted-foreground">
                      {usDateTime(note.created_at)}
                    </span>
                  </div>
                  {note.task_id && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      On: {taskTitle(note.task_id) ?? "a step"}
                    </p>
                  )}
                  <p className="mt-2 whitespace-pre-wrap">{note.body}</p>
                </div>
              ))}
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}

/**
 * Standard or Active Owner, changed while onboarding is under way. It is a
 * scope change, so it carries a reason and the handoff date follows the new
 * program unless someone typed their own.
 */
function ProgramTypeControl({
  propertyId,
  activeOwner,
  canEdit,
}: {
  propertyId: string;
  activeOwner: boolean;
  canEdit: boolean;
}) {
  const router = useRouter();
  const setType = useServerFn(setOnboardingProgramTypeFn);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      setType({ data: { propertyId, activeOwner: !activeOwner, reason } } as never),
    onSuccess: () => {
      setOpen(false);
      setReason("");
      toast.success(
        activeOwner
          ? "This home is now a standard home."
          : "This home is now in the Active Owner Program.",
      );
      void router.invalidate();
    },
    onError: (error: Error) => toast.error(error.message || "The program could not be changed."),
  });

  return (
    <>
      <span className="rounded-full border px-2.5 py-1 text-xs text-muted-foreground">
        {activeOwner ? "Active Owner Program" : "Standard home"}
      </span>
      {canEdit && (
        <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
          {activeOwner ? "Change to standard" : "Move to Active Owner"}
        </Button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {activeOwner ? "Change to a standard home" : "Move to the Active Owner Program"}
            </DialogTitle>
            <DialogDescription>
              {activeOwner
                ? "Owner participation steps stop applying and the target handoff goes back to three weeks after access."
                : "Owner participation steps apply and the target handoff becomes four weeks after access."}{" "}
              A hand-set handoff date is left alone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">
              Why is this changing? (kept in this home&apos;s history)
            </Label>
            <Textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Owner signed the Active Owner agreement on the closing call."
            />
          </div>
          <DialogFooter>
            <Button
              disabled={reason.trim().length < 5 || mutation.isPending}
              onClick={() => mutation.mutate()}
            >
              {mutation.isPending ? "Saving…" : "Save the change"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
