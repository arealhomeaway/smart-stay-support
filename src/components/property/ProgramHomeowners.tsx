import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  addProgramCoOwner,
  listProgramHomeowners,
  removeProgramCoOwner,
  type ProgramHomeowner,
} from "@/lib/co-owners.functions";

export const MAIN_HOMEOWNER_LABEL = "Main homeowner, receives emails";

/** Staff list of everyone who shares this home's homeowner dashboard. */
export function ProgramHomeowners({ programId }: { programId: string }) {
  const qc = useQueryClient();
  const list = useServerFn(listProgramHomeowners);
  const addFn = useServerFn(addProgramCoOwner);
  const removeFn = useServerFn(removeProgramCoOwner);
  const key = ["program-homeowners", programId];
  const homeowners = useQuery({ queryKey: key, queryFn: () => list({ data: { programId } }) });
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"form" | "confirm">("form");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [removing, setRemoving] = useState<ProgramHomeowner | null>(null);

  const reset = () => {
    setOpen(false);
    setStep("form");
    setName("");
    setEmail("");
  };
  const add = useMutation({
    mutationFn: () => addFn({ data: { programId, name: name.trim(), email: email.trim() } }),
    onSuccess: (r) => {
      toast.success(
        r.held
          ? `${name.trim()} was added. This is a practice home, so the email is held.`
          : `${name.trim()} was added. A set-password email is on its way to them.`,
      );
      reset();
      void qc.invalidateQueries({ queryKey: key });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: (userId: string) => removeFn({ data: { programId, userId } }),
    onSuccess: () => {
      toast.success("Co-owner removed. Their hours and history stay on the program.");
      setRemoving(null);
      void qc.invalidateQueries({ queryKey: key });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const data = homeowners.data;
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const canContinue = name.trim().length >= 2 && validEmail;

  return (
    <div className="mt-4 rounded-md border p-3" aria-label="Homeowners">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-medium">
          <Users className="size-4" /> Homeowners
        </h3>
        {data?.ready ? (
          <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
            Add co-owner
          </Button>
        ) : null}
      </div>
      {homeowners.isLoading ? <p className="mt-2 text-sm text-muted-foreground">Loading…</p> : null}
      {homeowners.error ? <p className="mt-2 text-sm text-destructive">{(homeowners.error as Error).message}</p> : null}
      {data && !data.ready ? (
        <p className="mt-2 text-sm text-muted-foreground">Co-owner logins are not turned on yet.</p>
      ) : null}
      {data?.ready ? (
        <ul className="mt-2 divide-y">
          {data.homeowners.map((h) => (
            <li key={h.userId} className="flex items-center justify-between gap-2 py-2 text-sm">
              <div>
                <p className="font-medium">{h.name ?? h.email ?? "Homeowner"}</p>
                <p className="text-xs text-muted-foreground">
                  {h.email ? `${h.email} · ` : ""}
                  {h.role === "primary" ? MAIN_HOMEOWNER_LABEL : "Co-owner"}
                </p>
              </div>
              {h.role === "co_owner" ? (
                <Button size="sm" variant="ghost" onClick={() => setRemoving(h)}>
                  Remove
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : reset())}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{step === "form" ? "Add co-owner" : "Confirm co-owner"}</DialogTitle>
            <DialogDescription>
              A co-owner gets their own login and sees the same homeowner dashboard as the main homeowner.
            </DialogDescription>
          </DialogHeader>
          {step === "form" ? (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="co-owner-name">Full name</Label>
                <Input id="co-owner-name" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="co-owner-email">Email</Label>
                <Input id="co-owner-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
            </div>
          ) : (
            <p className="text-sm">
              {name.trim()} ({email.trim()}) will be added as a co-owner. A set-password email goes to them.
              Routine emails keep going to the main homeowner only.
            </p>
          )}
          <DialogFooter>
            {step === "form" ? (
              <Button disabled={!canContinue} onClick={() => setStep("confirm")}>
                Continue
              </Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => setStep("form")} disabled={add.isPending}>
                  Back
                </Button>
                <Button onClick={() => add.mutate()} disabled={add.isPending}>
                  {add.isPending ? "Adding…" : "Add co-owner"}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(removing)} onOpenChange={(v) => (!v ? setRemoving(null) : null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {removing?.name ?? "this co-owner"}?</AlertDialogTitle>
            <AlertDialogDescription>
              Their access ends right away. The hours they logged and their history stay on the program.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={remove.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (removing) remove.mutate(removing.userId);
              }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
