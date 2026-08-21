import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { listTeamAccess, setTeamRole } from "@/lib/access.functions";
import { useRole } from "@/hooks/useRole";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { ROLE_BLURBS, ROLE_LABELS, ASSIGNABLE_ROLES, primaryRole } from "@/lib/permissions";

const ROLE_LABEL: Record<string, string> = Object.fromEntries(
  ASSIGNABLE_ROLES.map((r) => [r, `${ROLE_LABELS[r]} — ${ROLE_BLURBS[r]}`]),
);

/** Admin-only: promote or demote teammates. Every change is enforced server side. */
export function TeamAccessPanel() {
  const { isAdmin, isLoading: roleLoading } = useRole();
  const qc = useQueryClient();
  const listFn = useServerFn(listTeamAccess);
  const setFn = useServerFn(setTeamRole);

  const access = useQuery({
    queryKey: ["team-access"],
    enabled: isAdmin,
    queryFn: () => listFn(),
  });

  const update = useMutation({
    mutationFn: (vars: { userId: string; role: "admin" | "manager" | "onboarding" | "tech" | "vendor" | "owner" }) =>
      setFn({ data: vars }),
    onSuccess: () => {
      toast.success("Access updated.");
      void qc.invalidateQueries({ queryKey: ["team-access"] });
      void qc.invalidateQueries({ queryKey: ["my-roles"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not update access"),
  });

  if (roleLoading || !isAdmin) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="size-4" /> Team access
        </CardTitle>
        <CardDescription>
          Permission role decides what a person may do. Their seat and team, set on the Seats board below,
          decide what work they own. Changing a role here takes effect everywhere, including the database.
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
                {current !== "tech" && (
                  <Badge variant="outline" className="uppercase">
                    {current === "admin" ? "Admin" : current === "vendor" ? "Vendor" : "Supervisor"}
                  </Badge>
                )}
                <div className="ml-auto w-56">
                  <Select
                    value={current}
                    disabled={update.isPending}
                    onValueChange={(role) =>
                      update.mutate({ userId: p.id, role: role as "admin" | "manager" | "onboarding" | "tech" | "vendor" | "owner" })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(ROLE_LABEL).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
