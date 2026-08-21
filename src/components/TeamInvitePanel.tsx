import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Copy, Mail, Ticket } from "lucide-react";
import { toast } from "sonner";
import {
  createTeamInvite,
  listTeamInvites,
  revokeTeamInvite,
} from "@/lib/team-invites.functions";
import { useRole } from "@/hooks/useRole";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type InviteRole = "admin" | "manager" | "onboarding" | "tech" | "vendor" | "owner";

const ROLE_LABEL: Record<InviteRole, string> = {
  admin: "Platform Owner — everything, including roles and settings",
  manager: "Supervisor — oversight, analytics and handoff review",
  onboarding: "Onboarding staff — pre-handoff work and readiness",
  tech: "Staff — their own assigned work",
  vendor: "Vendor — only their dispatched jobs",
  owner: "Homeowner — their own enrolled home",
};

/** Admin-only: issue single-use codes that grant a role when the new teammate signs up. */
export function TeamInvitePanel() {
  const { isAdmin, isLoading: roleLoading } = useRole();
  const qc = useQueryClient();
  const listFn = useServerFn(listTeamInvites);
  const createFn = useServerFn(createTeamInvite);
  const revokeFn = useServerFn(revokeTeamInvite);

  const [role, setRole] = useState<InviteRole>("tech");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");

  const invites = useQuery({
    queryKey: ["team-invites"],
    enabled: isAdmin,
    queryFn: () => listFn(),
  });

  const refresh = () => void qc.invalidateQueries({ queryKey: ["team-invites"] });

  const issue = useMutation({
    mutationFn: () =>
      createFn({ data: { role, email: email.trim(), name: name.trim(), note: "", expiresInDays: 30 } }),
    onSuccess: (res) => {
      void navigator.clipboard?.writeText(res.code);
      toast.success(`Code ${res.code} created and copied.`);
      setEmail("");
      setName("");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const revoke = useMutation({
    mutationFn: (inviteId: string) => revokeFn({ data: { inviteId } }),
    onSuccess: () => {
      toast.success("Code revoked.");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (roleLoading || !isAdmin) return null;

  const rows = invites.data?.invites ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Ticket className="size-4" /> Invite codes
        </CardTitle>
        <CardDescription>
          Issue a single-use code for a new coordinator, supervisor or vendor. They sign up on the normal login
          screen, then enter the code at <span className="font-mono">/join</span> — redeeming it sets their
          access straight away. Codes expire after 30 days.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-4">
          <div className="space-y-1.5 sm:col-span-1">
            <Label>Access</Label>
            <Select value={role} onValueChange={(v) => setRole(v as InviteRole)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(ROLE_LABEL) as InviteRole[]).map((r) => (
                  <SelectItem key={r} value={r}>
                    {ROLE_LABEL[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Name (optional)</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Jordan Reyes" />
          </div>
          <div className="space-y-1.5">
            <Label>Lock to email (optional)</Label>
            <Input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="vendor@example.com"
              type="email"
            />
          </div>
          <div className="flex items-end">
            <Button className="w-full" disabled={issue.isPending} onClick={() => issue.mutate()}>
              {issue.isPending ? "Creating…" : "Create code"}
            </Button>
          </div>
        </div>

        {invites.isLoading ? (
          <Skeleton className="h-20 w-full" />
        ) : rows.length === 0 ? (
          <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
            No invite codes yet.
          </p>
        ) : (
          <div className="space-y-2">
            {rows.map((i) => {
              const used = Boolean(i.redeemed_at);
              const revoked = Boolean(i.revoked_at);
              const expired = !used && !revoked && new Date(i.expires_at) < new Date();
              return (
                <div
                  key={i.id}
                  className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md border border-border px-3 py-2 text-sm"
                >
                  <button
                    type="button"
                    onClick={() => {
                      void navigator.clipboard?.writeText(i.code);
                      toast.success("Code copied.");
                    }}
                    className="flex items-center gap-2 font-mono font-medium hover:underline"
                  >
                    {i.code}
                    <Copy className="size-3.5 text-muted-foreground" />
                  </button>
                  <Badge variant="outline" className="uppercase">
                    {i.role}
                  </Badge>
                  {i.invitee_name && <span>{i.invitee_name}</span>}
                  {i.invitee_email && (
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Mail className="size-3.5" />
                      {i.invitee_email}
                    </span>
                  )}
                  <span className="ml-auto text-xs text-muted-foreground">
                    {used
                      ? "Redeemed"
                      : revoked
                        ? "Revoked"
                        : expired
                          ? "Expired"
                          : `Expires ${new Date(i.expires_at).toLocaleDateString()}`}
                  </span>
                  {!used && !revoked && (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={revoke.isPending}
                      onClick={() => revoke.mutate(i.id)}
                    >
                      Revoke
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
