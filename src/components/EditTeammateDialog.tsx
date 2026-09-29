import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { updateTeammate } from "@/lib/access.functions";
import { ASSIGNABLE_ROLES, ROLE_LABELS, primaryRole, type AppRole } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type TeammateRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  roles: string[];
  state: "invited" | "redeemed" | "active" | "disabled";
};

export function EditTeammateDialog({
  person,
  onClose,
}: {
  person: TeammateRow;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const save = useServerFn(updateTeammate);
  const current = primaryRole(person.roles as AppRole[]);
  const [firstName, setFirstName] = useState(person.first_name ?? "");
  const [lastName, setLastName] = useState(person.last_name ?? "");
  const [displayName, setDisplayName] = useState(person.full_name ?? "");
  const [role, setRole] = useState<AppRole>(current);
  const [active, setActive] = useState(person.state !== "disabled");
  const [confirm, setConfirm] = useState(false);
  const broadens = role !== current && (role === "admin" || role === "manager");

  const m = useMutation({
    mutationFn: () =>
      save({
        data: {
          userId: person.id,
          firstName,
          lastName,
          displayName,
          role,
          active,
          confirmPrivilege: confirm,
        },
      }),
    onSuccess: (r) => {
      toast.success(r.changes.length ? "Changes saved." : "Nothing changed.");
      for (const k of ["team-access", "people-directory", "my-roles", "team"])
        void qc.invalidateQueries({ queryKey: [k] });
      onClose();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save"),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit {person.full_name ?? person.email}</DialogTitle>
          <DialogDescription>
            Changes apply to this existing person. No new account or invite is created.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="fn">First name</Label>
              <Input id="fn" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ln">Last name</Label>
              <Input id="ln" value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="dn">Display name</Label>
            <Input id="dn" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
            <p className="text-xs text-muted-foreground">Shown everywhere this person appears.</p>
          </div>
          <div className="space-y-1">
            <Label>Email</Label>
            <Input value={person.email ?? ""} disabled />
            <p className="text-xs text-muted-foreground">
              Email is the sign-in address and can't be changed here yet.
            </p>
          </div>
          <div className="space-y-1">
            <Label>Access</Label>
            <Select value={role} onValueChange={(v) => { setRole(v as AppRole); setConfirm(false); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ASSIGNABLE_ROLES.map((r) => (
                  <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {broadens && (
            <label className="flex items-start gap-2 rounded-md border border-destructive/40 p-3 text-sm">
              <Checkbox checked={confirm} onCheckedChange={(c) => setConfirm(c === true)} />
              <span>
                I confirm {displayName || "this person"} should get {ROLE_LABELS[role]} access,
                which widens what they can see and change.
              </span>
            </label>
          )}
          <div className="flex items-center justify-between rounded-md border border-border p-3">
            <div>
              <p className="text-sm font-medium">Can sign in</p>
              <p className="text-xs text-muted-foreground">
                Turning this off blocks sign-in but keeps the person and their history.
              </p>
            </div>
            <Switch checked={active} onCheckedChange={setActive} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            disabled={m.isPending || displayName.trim().length < 2 || (broadens && !confirm)}
            onClick={() => m.mutate()}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
