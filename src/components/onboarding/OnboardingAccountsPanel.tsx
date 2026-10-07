import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { SectionCard } from "@/components/ui/page";
import {
  createOnboardingAccountInvite,
  listOnboardingAccounts,
  setOnboardingAccountActive,
} from "@/lib/onboarding-accounts.functions";

const KEY = ["onboarding-accounts"];

/**
 * Onboarding Director: invite and turn sign-in on/off for Onboarding staff and
 * homeowner accounts only. Removing someone from a home's Project Team is done
 * in that home's Project Team panel and never turns off their sign-in.
 */
export function OnboardingAccountsPanel() {
  const qc = useQueryClient();
  const list = useServerFn(listOnboardingAccounts);
  const invite = useServerFn(createOnboardingAccountInvite);
  const setActive = useServerFn(setOnboardingAccountActive);
  const q = useQuery({ queryKey: KEY, queryFn: () => list() });
  const [form, setForm] = useState({ name: "", email: "", role: "onboarding" as "onboarding" | "owner", sendEmail: true });
  const [issued, setIssued] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: () => invite({ data: form }),
    onSuccess: (r) => {
      setIssued(r.code);
      toast.success(r.emailed ? "Invitation emailed." : "Invitation created. Share the code with them yourself.");
      setForm({ name: "", email: "", role: form.role, sendEmail: true });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const toggle = useMutation({
    mutationFn: (v: { userId: string; active: boolean; reason: string }) => setActive({ data: v }),
    onSuccess: (r, v) => {
      toast.success(
        v.active ? "Sign-in turned back on." :
          `Sign-in turned off. ${r.openTasks} open Task(s) and ${r.projectAssignments} Project Team spot(s) still name them — reassign them on each home.`,
      );
      void qc.invalidateQueries({ queryKey: KEY });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <SectionCard
      title="Onboarding and homeowner accounts"
      description="Invite new Onboarding staff or homeowners, and turn sign-in off or on. Turning sign-in off keeps their completed work, files and history; it does not remove them from Project Teams."
    >
      <form
        className="grid gap-3 rounded-md border p-3 sm:grid-cols-2"
        onSubmit={(e) => { e.preventDefault(); setIssued(null); create.mutate(); }}
      >
        <div className="space-y-1"><Label htmlFor="oa-name">Full name</Label><Input id="oa-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
        <div className="space-y-1"><Label htmlFor="oa-email">Email</Label><Input id="oa-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
        <div className="space-y-1">
          <Label htmlFor="oa-role">Access</Label>
          <select id="oa-role" className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as "onboarding" | "owner" })}>
            <option value="onboarding">Onboarding staff</option>
            <option value="owner">Homeowner</option>
          </select>
        </div>
        <label className="flex items-end gap-2 pb-2 text-sm">
          <Checkbox checked={form.sendEmail} onCheckedChange={(c) => setForm({ ...form, sendEmail: c === true })} />
          Email the invitation now
        </label>
        <div className="sm:col-span-2 flex flex-wrap items-center gap-3">
          <Button type="submit" size="sm" disabled={create.isPending || !form.name || !form.email}>Create invitation</Button>
          {issued ? <span className="text-sm">Invite code: <span className="font-mono font-medium">{issued}</span></span> : null}
        </div>
        <p className="sm:col-span-2 text-xs text-muted-foreground">
          They sign up with this email and enter the code. For a homeowner, then link their account on the Active Owner program.
        </p>
      </form>

      <ul className="mt-4 divide-y rounded-md border">
        {(q.data?.people ?? []).map((p) => (
          <AccountRow key={p.id} p={p} busy={toggle.isPending} onToggle={(active, reason) => toggle.mutate({ userId: p.id, active, reason })} />
        ))}
        {q.data && q.data.people.length === 0 ? <li className="p-3 text-sm text-muted-foreground">No accounts yet.</li> : null}
      </ul>
    </SectionCard>
  );
}

type Row = Awaited<ReturnType<typeof listOnboardingAccounts>>["people"][number];

function AccountRow({ p, busy, onToggle }: { p: Row; busy: boolean; onToggle: (active: boolean, reason: string) => void }) {
  const [reason, setReason] = useState("");
  const [confirming, setConfirming] = useState(false);
  const disabled = p.state === "disabled";
  return (
    <li className="space-y-2 p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-medium">{p.name ?? p.email}</p>
          <p className="text-xs text-muted-foreground">
            {p.email} · {p.roles.map((r) => (r === "owner" ? "Homeowner" : r === "onboarding" ? "Onboarding" : r)).join(", ")}
            {disabled ? " · Sign-in off" : ""}
            {p.openTasks || p.projectAssignments ? ` · ${p.openTasks} open Task(s), ${p.projectAssignments} Project Team spot(s)` : ""}
          </p>
          {!p.inScope ? <p className="text-xs text-muted-foreground">{p.outOfScopeReason}</p> : null}
        </div>
        {p.inScope ? (
          <Button size="sm" variant="outline" disabled={busy} onClick={() => setConfirming((v) => !v)}>
            {confirming ? "Cancel" : disabled ? "Turn sign-in on" : "Turn sign-in off"}
          </Button>
        ) : null}
      </div>
      {confirming ? (
        <div className="flex flex-wrap items-center gap-2">
          <Input className="max-w-sm" placeholder="Reason (kept in history)" value={reason} onChange={(e) => setReason(e.target.value)} />
          <Button size="sm" disabled={busy || reason.trim().length < 3} onClick={() => { onToggle(disabled, reason); setConfirming(false); setReason(""); }}>
            Confirm
          </Button>
          {!disabled && (p.openTasks || p.projectAssignments) ? (
            <p className="w-full text-xs text-destructive">Their open work stays assigned to them. Reassign it on each home's Project Team.</p>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}
