import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Search } from "lucide-react";
import { listTeamAccessDetailed } from "@/lib/access.functions";
import { EditTeammateDialog, type TeammateRow } from "@/components/EditTeammateDialog";
import { TeamInvitePanel } from "@/components/TeamInvitePanel";
import { useRole } from "@/hooks/useRole";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ROLE_LABELS, primaryRole } from "@/lib/permissions";
import { SEAT_LABELS, teamOf } from "@/lib/coverage-model";
import { TEAMS } from "@/lib/tickets";
import { usDateTime } from "@/lib/dates";
import { clock, filterUsers, seatsHeldBy, userRows, type AccessPerson, type SOverride, type SPerson, type SRole, type SRoster, type SShift, type UserRow } from "@/lib/team-schedule";
import { useCoverageModel } from "./ScheduleTab";
import { TimeOffDialog } from "./TimeOffDialog";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const STATUSES = ["Active", "Invite pending", "Off"] as const;

/** Admin only: every user, like a directory. Profile edits go through updateTeammate. */
export function UsersTab() {
  const { isAdmin, isLoading: roleLoading } = useRole();
  const qc = useQueryClient();
  const listFn = useServerFn(listTeamAccessDetailed);
  const access = useQuery({ queryKey: ["team-access"], enabled: isAdmin, queryFn: () => listFn() });
  const cov = useCoverageModel();
  const [q, setQ] = useState("");
  const [role, setRole] = useState("all");
  const [status, setStatus] = useState("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);

  const roles = ((cov.data?.roles ?? []) as SRole[]).filter((r) => r.code !== "__none__");
  const people = (access.data?.people ?? []) as unknown as AccessPerson[];
  const rows = useMemo(
    () =>
      userRows(
        people,
        roles,
        (rs) => ROLE_LABELS[primaryRole(rs as never)],
        (c) => TEAMS.find((t) => t.value === teamOf(c))?.label ?? null,
        (c) => SEAT_LABELS[c] ?? roles.find((r) => r.code === c)?.name ?? c,
      ),
    [people, roles],
  );
  const shown = filterUsers(rows, { q, role, status });
  const roleOptions = [...new Set(rows.map((r) => r.role))].sort();

  if (roleLoading) return <Skeleton className="h-40 w-full" />;
  if (!isAdmin) return <p className="text-sm text-muted-foreground">Only Admins can view and change users.</p>;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1">
          <Search className="absolute left-2 top-2.5 size-4 text-muted-foreground" />
          <Input aria-label="Search users" placeholder="Search by name or email" className="pl-8" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select aria-label="Role filter" className="h-9 rounded-md border border-input bg-background px-2 text-sm" value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="all">All roles</option>
          {roleOptions.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <select aria-label="Status filter" className="h-9 rounded-md border border-input bg-background px-2 text-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="all">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <Button size="sm" onClick={() => setInviting(true)}><Plus className="size-4" /> Add user</Button>
      </div>

      {access.isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <div className="surface overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Role</TableHead>
                <TableHead>Seat and team</TableHead><TableHead>Status</TableHead><TableHead>Last sign-in</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shown.map((r) => (
                <TableRow key={r.id} className="cursor-pointer" onClick={() => setOpenId(r.id)}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell className="text-muted-foreground">{r.email}</TableCell>
                  <TableCell>{r.role}</TableCell>
                  <TableCell>{r.seat === "None" ? "None" : `${r.seat} · ${r.team}`}</TableCell>
                  <TableCell><Badge variant={r.status === "Off" ? "destructive" : r.status === "Active" ? "secondary" : "outline"}>{r.status}</Badge></TableCell>
                  <TableCell className="text-muted-foreground">{r.lastSignIn ? usDateTime(r.lastSignIn) : "Never"}</TableCell>
                </TableRow>
              ))}
              {shown.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No users match.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {inviting && (
        <Dialog open onOpenChange={(o) => !o && setInviting(false)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>Add user</DialogTitle></DialogHeader>
            <TeamInvitePanel />
          </DialogContent>
        </Dialog>
      )}

      {openId && (
        <UserPanel
          row={rows.find((r) => r.id === openId)!}
          person={people.find((p) => p.id === openId)!}
          roles={roles}
          shifts={(cov.data?.shifts ?? []) as SShift[]}
          overrides={(cov.data?.overrides ?? []) as SOverride[]}
          roster={(cov.data?.roster ?? []) as SRoster[]}
          people={(cov.data?.people ?? []) as SPerson[]}
          onClose={() => setOpenId(null)}
          onChanged={() => qc.invalidateQueries({ queryKey: ["coverage-model"] })}
        />
      )}
    </div>
  );
}

function UserPanel({
  row, person, roles, shifts, overrides, roster, people, onClose, onChanged,
}: {
  row: UserRow; person: AccessPerson; roles: SRole[]; shifts: SShift[]; overrides: SOverride[]; roster: SRoster[]; people: SPerson[];
  onClose: () => void; onChanged: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [timeOff, setTimeOff] = useState(false);
  const seats = seatsHeldBy(roles, person.id);
  const myShifts = shifts.filter((s) => seats.includes(s.role_code) && s.active !== false).sort((a, b) => a.weekday - b.weekday || a.start_minute - b.start_minute);
  const myOff = overrides.filter((o) => o.kind === "off" && seats.includes(o.role_code) && new Date(o.ends_at) > new Date()).sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="space-y-5 overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{row.name}</SheetTitle>
          <SheetDescription>{row.email}</SheetDescription>
        </SheetHeader>
        <section className="space-y-1 text-sm">
          <h3 className="font-semibold">Profile</h3>
          <p>Role: {row.role}</p>
          <p>Status: {row.status}</p>
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}>Edit profile</Button>
        </section>
        <section className="space-y-1 text-sm">
          <h3 className="font-semibold">Schedule</h3>
          <p>Seat: {row.seat}</p>
          {myShifts.length === 0 ? (
            <p className="text-muted-foreground">No recurring shifts.</p>
          ) : (
            <ul>{myShifts.map((s) => <li key={s.id}>{DAYS[s.weekday]}: {clock(s.start_minute)} to {clock(s.end_minute)}</li>)}</ul>
          )}
        </section>
        <section className="space-y-1 text-sm">
          <h3 className="font-semibold">Time off</h3>
          {myOff.length === 0 ? (
            <p className="text-muted-foreground">No time off coming up.</p>
          ) : (
            <ul>{myOff.map((o) => <li key={o.id}>{usDateTime(o.starts_at)} to {usDateTime(o.ends_at)}{o.note ? ` · ${o.note}` : ""}</li>)}</ul>
          )}
          <Button size="sm" onClick={() => setTimeOff(true)}>Add time off</Button>
        </section>
        {editing && <EditTeammateDialog person={person as unknown as TeammateRow} onClose={() => setEditing(false)} />}
        {timeOff && (
          <TimeOffDialog open onClose={() => setTimeOff(false)} onSaved={onChanged} people={people} roles={roles} roster={roster} overrides={overrides} defaultUserId={person.id} />
        )}
      </SheetContent>
    </Sheet>
  );
}
