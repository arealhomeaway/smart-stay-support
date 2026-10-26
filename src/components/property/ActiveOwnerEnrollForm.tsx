import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { activeOwnerEnrollmentContext, enrollActiveOwner } from "@/lib/owner-welcome.functions";
import { enrollmentInput, type EnrollmentReceipt } from "@/lib/active-owner-enrollment";

export const activeOwnerDetailsOk = (name: string, email: string) =>
  name.trim().length >= 2 && /\S+@\S+\.\S+/.test(email.trim());
const STEP_NAMES = { account: "Homeowner login", enrollment: "Program and home linked", closing: "Closing date saved",
  activation: "Program active", onboarding: "Onboarding Opportunities released", operating: "Operating Opportunities released", welcome: "Welcome email" };
export function ActiveOwnerEnrollForm({ propertyId, propertyName, finishing = false, onDone }: {
  propertyId: string; propertyName: string; initialName?: string; initialEmail?: string; finishing?: boolean; onDone?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const load = useServerFn(activeOwnerEnrollmentContext);
  const context = useQuery({ queryKey: ["active-owner-enrollment-context", propertyId], enabled: open,
    queryFn: () => load({ data: { propertyId } }) });
  return <Dialog open={open} onOpenChange={setOpen}>
    <Button size="sm" onClick={() => setOpen(true)}>{finishing ? "Finish Active Owner setup" : "Enroll in Active Owner"}</Button>
    <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
      <DialogHeader><DialogTitle>{finishing ? "Finish Active Owner setup" : "Enroll in Active Owner"}</DialogTitle><DialogDescription>{propertyName}</DialogDescription></DialogHeader>
      {context.isPending ? <p>Checking homeowner details…</p> : context.error ? <p role="alert">{context.error.message}</p> : context.data ?
        <EnrollmentFields propertyId={propertyId} context={context.data} onDone={() => { onDone?.(); }} close={() => setOpen(false)} /> : null}
    </DialogContent>
  </Dialog>;
}
function EnrollmentFields({ propertyId, context, onDone, close }: {
  propertyId: string; context: Awaited<ReturnType<typeof activeOwnerEnrollmentContext>>; onDone: () => void; close: () => void;
}) {
  const qc = useQueryClient();
  const enroll = useServerFn(enrollActiveOwner);
  const load = useServerFn(activeOwnerEnrollmentContext);
  const [requestId] = useState(() => crypto.randomUUID());
  const [name, setName] = useState(context.owner.name ?? "");
  const [email, setEmail] = useState(context.owner.email ?? "");
  const [closingDate, setClosingDate] = useState(context.closingDate ?? "");
  const [reason, setReason] = useState("");
  const [onboardingLead, setOnboardingLead] = useState<string | null>(context.program?.onboarding_lead ?? null);
  const [operationsLead, setOperationsLead] = useState<string | null>(context.program?.operations_lead ?? null);
  const [notes, setNotes] = useState(context.program?.internal_notes ?? "");
  const [receipt, setReceipt] = useState<EnrollmentReceipt | null>(null);
  const account = useQuery({ queryKey: ["active-owner-email-check", propertyId, email],
    enabled: email !== context.owner.email && activeOwnerDetailsOk(name, email),
    queryFn: () => load({ data: { propertyId, email } }) });
  const input = { requestId, propertyId, ownerRecordId: context.owner.id, name, email, closingDate, reason, onboardingLead, operationsLead, notes };
  const changedConfirmed = Boolean(context.actualClosing && closingDate !== context.actualClosing);
  const run = useMutation({ mutationFn: () => enroll({ data: enrollmentInput.parse(input) }), onSuccess: (r) => {
    setReceipt(r); void qc.invalidateQueries(); if (r.complete) onDone();
  }, onError: (e: Error) => toast.error(e.message) });
  if (receipt) return <div className="space-y-4" role="status">
    <h3 className="font-semibold">{receipt.complete ? "Enrollment complete" : "Enrollment needs attention"}</h3>
    {receipt.accountId && !receipt.programId ? <p className="text-sm text-destructive">The homeowner login exists, but its program has not been linked yet. Retry to finish setup.</p> : null}
    <ol className="space-y-3">{receipt.steps.map((step) => <li key={step.key} className="text-sm">
      <strong>{step.key === "welcome" && step.status === "done" ? (receipt.welcomeHeld ? "Welcome email held until the wording is approved" : "Welcome email queued") : STEP_NAMES[step.key]}</strong>
      {step.key !== "welcome" || step.status !== "done" ? ` — ${step.status === "done" ? "Done" : step.status === "failed" ? "Failed" : "Not reached"}` : ""}
      {step.detail ? <p className="text-destructive">{step.detail}</p> : null}
    </li>)}</ol>
    {receipt.complete ? <p className="text-sm">{receipt.onboardingAdded} onboarding and {receipt.operatingAdded} operating Opportunities added.</p> : null}
    <Button onClick={() => receipt.complete ? close() : run.mutate()} disabled={run.isPending}>{receipt.complete ? "Done" : run.isPending ? "Retrying…" : "Retry"}</Button>
  </div>;
  return <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); run.mutate(); }}>
    <section className="space-y-3"><h3 className="font-semibold">Homeowner</h3>
      {context.program ? <p className="text-sm text-muted-foreground">This homeowner already has an Active Owner program. This home will be added to it, and hours from the same closing year will add up together.</p> : null}
      {(account.data?.accountExists ?? context.accountExists) ? <p className="text-sm text-muted-foreground">This email already has a login. It will be reused.</p> : null}
      <Label htmlFor="enroll-name">Name</Label><Input id="enroll-name" value={name} maxLength={120} required onChange={(e) => setName(e.target.value)} />
      <Label htmlFor="enroll-email">Email</Label><Input id="enroll-email" value={email} type="email" required maxLength={255} onChange={(e) => setEmail(e.target.value)} />
    </section>
    <section className="space-y-3"><h3 className="font-semibold">Closing date</h3>
      <Label htmlFor="enroll-date">Closing date (expected if not closed yet)</Label><Input id="enroll-date" type="date" required value={closingDate} onChange={(e) => setClosingDate(e.target.value)} />
      {changedConfirmed ? <><Label htmlFor="enroll-reason">Reason for changing the confirmed date</Label><Textarea id="enroll-reason" required minLength={5} maxLength={1000} value={reason} onChange={(e) => setReason(e.target.value)} /></> : null}
    </section>
    <section className="space-y-3"><h3 className="font-semibold">Optional</h3>
      {([ ["Onboarding lead", onboardingLead, setOnboardingLead], ["Operations lead", operationsLead, setOperationsLead] ] as const).map(([label, value, set]) => <div key={label} className="space-y-2"><Label>{label}</Label><Select value={value ?? "none"} onValueChange={(v) => set(v === "none" ? null : v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">No lead selected</SelectItem>{context.staffChoices.map((person) => <SelectItem key={person.id} value={person.id}>{person.label}</SelectItem>)}</SelectContent></Select></div>)}
      <Label htmlFor="enroll-notes">Notes</Label><Textarea id="enroll-notes" value={notes} maxLength={4000} onChange={(e) => setNotes(e.target.value)} />
    </section>
    <Button type="submit" disabled={run.isPending || !enrollmentInput.safeParse(input).success || (changedConfirmed && reason.trim().length < 5)}>{run.isPending ? "Enrolling…" : "Enroll"}</Button>
  </form>;
}
