import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { enrollActiveOwner } from "@/lib/owner-welcome.functions";

export const activeOwnerDetailsOk = (name: string, email: string) =>
  name.trim().length >= 2 && /\S+@\S+\.\S+/.test(email.trim());

/**
 * The one staff entry point for Active Owner setup on a home: enrolls (or
 * reuses the program), links the homeowner account and queues one welcome.
 * Also finishes an incomplete enrollment — saving the details is enough.
 */
export function ActiveOwnerEnrollForm({
  propertyId,
  propertyName,
  initialName = "",
  initialEmail = "",
  finishing = false,
  onDone,
}: {
  propertyId: string;
  propertyName: string;
  initialName?: string;
  initialEmail?: string;
  /** Enrolled already, homeowner not linked yet. */
  finishing?: boolean;
  onDone?: () => void;
}) {
  const qc = useQueryClient();
  const enroll = useServerFn(enrollActiveOwner);
  const [name, setName] = useState(initialName);
  const [email, setEmail] = useState(initialEmail);
  const run = useMutation({
    mutationFn: () => enroll({ data: { propertyId, name: name.trim(), email: email.trim() } }),
    onSuccess: (r) => {
      toast.success(
        `${propertyName}: ${r.accountCreated ? "homeowner account created" : "existing homeowner account used"}, ${
          r.welcomeQueued ? "welcome queued" : "welcome already queued"
        }.`,
      );
      void qc.invalidateQueries();
      onDone?.();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const ok = activeOwnerDetailsOk(name, email);
  return (
    <div className="space-y-3">
      {finishing ? (
        <p className="text-sm text-muted-foreground">
          Setup isn&apos;t finished: add the homeowner&apos;s name and email to link their account
          and queue the welcome. Nothing else needs to be enrolled again.
        </p>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor={`ao-name-${propertyId}`}>Homeowner name</Label>
          <Input id={`ao-name-${propertyId}`} value={name} maxLength={120} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`ao-email-${propertyId}`}>Homeowner email</Label>
          <Input id={`ao-email-${propertyId}`} type="email" value={email} maxLength={255} onChange={(e) => setEmail(e.target.value)} />
        </div>
      </div>
      <Button size="sm" disabled={!ok || run.isPending} onClick={() => run.mutate()}>
        {run.isPending ? "Saving…" : finishing ? "Finish Active Owner setup" : "Enroll in Active Owner"}
      </Button>
    </div>
  );
}
