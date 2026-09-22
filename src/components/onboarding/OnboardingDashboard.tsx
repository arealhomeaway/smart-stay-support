import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CalendarDays, NotebookPen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  saveOnboardingMilestonesFn,
  setOnboardingProgramTypeFn,
} from "@/lib/onboarding.functions";
import { autoHandoffDate, handoffExplainer, type HandoffDateSource } from "@/lib/onboarding-dates";
import { usDate, usDateTime } from "@/lib/dates";
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
  const router = useRouter();
  const save = useServerFn(saveOnboardingMilestonesFn);
  const [openNotes, setOpenNotes] = useState(false);
  const [closing, setClosing] = useState(actualClosingOn ?? "");
  const [planned, setPlanned] = useState(plannedClosingOn ?? "");
  const [access, setAccess] = useState(actualAccessOn ?? "");
  const [handoff, setHandoff] = useState(targetHandoffOn ?? "");
  const [handoffTouched, setHandoffTouched] = useState(false);

  const percent = total > 0 ? Math.round((done / total) * 100) : 0;
  const autoHandoff = autoHandoffDate(access || null, activeOwner);

  const mutation = useMutation({
    mutationFn: async () =>
      save({
        data: {
          propertyId,
          plannedClosingOn: planned || null,
          actualClosingOn: closing || null,
          actualAccessOn: access || null,
          ...(handoffTouched ? { targetHandoffOn: handoff || null } : {}),
        },
      } as never),
    onSuccess: () => {
      setHandoffTouched(false);
      toast.success("Dates saved. Deadlines were recalculated from the access date.");
      void router.invalidate();
    },
    onError: (error: Error) => toast.error(error.message || "Those dates could not be saved."),
  });

  const nameOf = (id: string | null) => {
    const person = people.find((p) => p.id === id);
    return person?.full_name || person?.email || "Teammate";
  };

  const dirty =
    (planned || "") !== (plannedClosingOn ?? "") ||
    (closing || "") !== (actualClosingOn ?? "") ||
    (access || "") !== (actualAccessOn ?? "") ||
    handoffTouched;

  return (
    <section className="surface space-y-4 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <CalendarDays className="size-4 text-muted-foreground" />
          <p className="eyebrow">Key dates</p>
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

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <DateField
          label="Expected closing"
          value={planned}
          onChange={setPlanned}
          disabled={!canEdit}
        />
        <DateField label="Closing" value={closing} onChange={setClosing} disabled={!canEdit} />
        <DateField
          label="Access (possession)"
          value={access}
          onChange={setAccess}
          disabled={!canEdit}
          hint="Every task deadline is calculated from this date."
        />
        <DateField
          label="Target handoff"
          value={handoff}
          onChange={(v) => {
            setHandoff(v);
            setHandoffTouched(true);
          }}
          disabled={!canEdit}
          hint={handoffExplainer(activeOwner, handoffTouched ? "manual" : handoffSource)}
          placeholderDate={autoHandoff}
        />
      </div>

      {canEdit && (
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" disabled={!dirty || mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending ? "Saving…" : "Save dates"}
          </Button>
          {handoffSource === "manual" && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setHandoff("");
                setHandoffTouched(true);
              }}
            >
              Go back to the automatic handoff date
            </Button>
          )}
        </div>
      )}

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

function DateField({
  label,
  value,
  onChange,
  disabled,
  hint,
  placeholderDate,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  hint?: string;
  placeholderDate?: string | null;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input
        type="date"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      />
      {!value && placeholderDate && (
        <p className="text-xs text-muted-foreground">Suggested: {usDate(placeholderDate)}</p>
      )}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
