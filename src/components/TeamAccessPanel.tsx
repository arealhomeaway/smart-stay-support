import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Pencil, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { listTeamAccessDetailed } from "@/lib/access.functions";
import { EditTeammateDialog, type TeammateRow } from "@/components/EditTeammateDialog";
import { useRole } from "@/hooks/useRole";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

import { ROLE_BLURBS, ROLE_LABELS, ASSIGNABLE_ROLES, primaryRole } from "@/lib/permissions";

const ROLE_LABEL: Record<string, string> = Object.fromEntries(
  ASSIGNABLE_ROLES.map((r) => [r, `${ROLE_LABELS[r]} — ${ROLE_BLURBS[r]}`]),
);

/** Admin-only: promote or demote teammates. Every change is enforced server side. */
export function TeamAccessPanel() {
  const { isAdmin, isLoading: roleLoading } = useRole();
  const listFn = useServerFn(listTeamAccessDetailed);

  const [editing, setEditing] = useState<TeammateRow | null>(null);
  const access = useQuery({
    queryKey: ["team-access"],
    enabled: isAdmin,
    queryFn: () => listFn(),
  });



  if (roleLoading || !isAdmin) return null;
  const STATE: Record<string, string> = { invited: "Invited", redeemed: "Redeemed", active: "Active", disabled: "Disabled" };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="size-4" /> Team access
        </CardTitle>
        <CardDescription>
          Permission role decides what a person may do. Their seat and team, set on the Seats board
          below, decide what work they own. Changing a role here takes effect everywhere, including
          the database.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {access.isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : (
          (access.data?.people ?? []).map((p) => {
            const current = primaryRole(p.roles as never);
            return (
              <div
                key={p.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md border border-border px-3 py-2 text-sm"
              >
                <span className="font-medium">{p.full_name ?? p.email ?? "Unnamed teammate"}</span>
                <span className="text-muted-foreground">{p.email}</span>
                <Badge variant="outline" className="uppercase">
                  {ROLE_LABELS[current]}
                </Badge>
                <Badge variant={p.state === "disabled" ? "destructive" : "secondary"} title={p.reason ?? undefined}>
                  {STATE[p.state]}
                </Badge>
                {p.reason && <span className="text-xs text-muted-foreground">{p.reason}</span>}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="ml-auto"
                  onClick={() => setEditing(p as TeammateRow)}
                >
                  <Pencil className="size-3.5" /> Edit
                </Button>
              </div>
            );
          })
        )}
      </CardContent>
      {editing && <EditTeammateDialog person={editing} onClose={() => setEditing(null)} />}
    </Card>
  );
}
