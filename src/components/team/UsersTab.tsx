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
import { setOncallEligible, setTestAccount } from "@/lib/coverage-admin.functions";
import { toast } from "sonner";
import { clock, filterUsers, isStaff, isTestAccount, seatsHeldBy, STAFF_ROLES, userRows, type AccessPerson, type SOverride, type SPerson, type SRole, type SRoster, type SShift, type UserRow, type OncallPattern } from "@/lib/team-schedule";
import { buildModel, useCoverageModel } from "./ScheduleTab";
import { TimeOffDialog } from "./TimeOffDialog";
import { DeleteUserDialog } from "./DeleteUserDialog";
import { USER_REMOVAL_ENABLED } from "@/lib/user-removal";

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
  const [showTest, setShowTest] = useState(false);

  const roles = ((cov.data?.roles ?? []) as SRole[]).filter((r) => r.code !== "__none__");
  const testIds = (cov.data?.testAccountIds ?? []) as string[];
  const eligibleIds = (cov.data?.eligibleIds ?? []) as string[];
  const allPeople = (access.data?.people ?? []) as unknown as AccessPerson[];
  // Staff only: homeowners, co-owners and vendors are managed on their own pages.
  const people = allPeople.filter((p) => isStaff(p) && (showTest || !isTestAccount(p, testIds)));
  const rows = useMemo(
    () =>
      userRows(
        people,
        roles,
        (rs) => ROLE_LABELS[primaryRole(rs as never)],
        (c) => TEAMS.find((t) => t.value === teamOf(c))?.label ?? null,
        (c) => SEAT_LABELS[c] ?? roles.find((r) => r.code === c)?.name ?? c,
      ),
    [people, roles, showTest],
  );
  const shown = filterUsers(rows, { q, role, status });
  const roleOptions = STAFF_ROLES.map((r) => ROLE_LABELS[r]);

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
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={showTest} onChange={(e) => setShowTest(e.target.checked)} /> Show test accounts</label>
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
                <TableHead>Team and shift</TableHead><TableHead>Status</TableHead><TableHead>Last sign-in</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shown.map((r) => (
                <TableRow key={r.id} className="cursor-pointer" onClick={() => setOpenId(r.id)}>
                  <TableCell className="font-medium">{r.name}{isTestAccount(people.find((p) => p.id === r.id)!, testIds) && <Badge variant="outline" className="ml-2">Test</Badge>}</TableCell>
                  <TableCell className="text-muted-foreground">{r.email}</TableCell>
                  <TableCell>{r.role}</TableCell>
                  <TableCell>{r.seat === "None" ? "Not on the schedule yet" : `${r.seat} · ${r.team}`}</TableCell>
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
          <DialogContent className="flex max-h-[100dvh] max-w-2xl flex-col overflow-hidden sm:max-h-[90dvh]">
            <DialogHeader><DialogTitle>Add user</DialogTitle></DialogHeader>
            <div className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1"><TeamInvitePanel /></div>
          </DialogContent>
        </Dialog>
      )}

      {openId && rows.some((r) => r.id === openId) && (
        <UserPanel
          row={rows.find((r) => r.id === openId)!}
          person={people.find((p) => p.id === openId)!}
          roles={roles}
          shifts={(cov.data?.shifts ?? []) as SShift[]}
          overrides={(cov.data?.overrides ?? []) as SOverride[]}
          roster={(cov.data?.roster ?? []) as SRoster[]}
          people={cov.data ? (buildModel(cov.data).shiftPeople as SPerson[]) : []}
          pattern={cov.data ? buildModel(cov.data).pattern : null}
          isTest={isTestAccount(people.find((p) => p.id === openId) ?? { id: openId, full_name: null, email: null }, testIds)}
          flaggedTest={testIds.includes(openId)}
          eligible={eligibleIds.includes(openId)}
          onClose={() => setOpenId(null)}
          onChanged={() => { void qc.invalidateQueries({ queryKey: ["coverage-model"] }); }}
        />
      )}
    </div>
  );
}

function UserPanel({
  row, person, roles, shifts, overrides, roster, people, pattern, isTest, flaggedTest, eligible, onClose, onChanged,
}: {
  row: UserRow; person: AccessPerson; roles: SRole[]; shifts: SShift[]; overrides: SOverride[]; roster: SRoster[]; people: SPerson[];
  pattern: OncallPattern | null; isTest: boolean; flaggedTest: boolean; eligible: boolean;
  onClose: () => void; onChanged: () => void;
}) {
  const setElig = useServerFn(setOncallEligible);
  const setTest = useServerFn(setTestAccount);
  const toggle = async (fn: () => Promise<unknown>, msg: string) => {
    try { await fn(); toast.success(msg); onChanged(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "The change could not be saved."); }
  };
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
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
          <label className="flex items-center gap-2 pt-2">
            <input type="checkbox" checked={eligible} onChange={(e) => toggle(() => setElig({ data: { userId: person.id, eligible: e.target.checked } }), "On-call list updated.")} />
            Can be on call
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={isTest} disabled={isTest && !flaggedTest} onChange={(e) => toggle(() => setTest({ data: { userId: person.id, test: e.target.checked } }), "Test account setting updated.")} />
            Test account (hidden from lists and pickers)
          </label>
        </section>
        <section className="space-y-1 text-sm">
          <h3 className="font-semibold">Schedule</h3>
          <p>Team and shift: {row.seat === "None" ? "Not on the schedule yet" : row.seat}</p>
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
        {USER_REMOVAL_ENABLED && (
          <section className="border-t border-border pt-3">
            <Button size="sm" variant="destructive" onClick={() => setDeleting(true)}>Delete user</Button>
          </section>
        )}
        {deleting && <DeleteUserDialog userId={person.id} name={row.name} onClose={() => setDeleting(false)} onDeleted={() => { onChanged(); onClose(); }} />}
        {editing && <EditTeammateDialog person={person as unknown as TeammateRow} onClose={() => setEditing(false)} />}
        {timeOff && (
          <TimeOffDialog open onClose={() => setTimeOff(false)} onSaved={onChanged} people={people} roles={roles} roster={roster} overrides={overrides} pattern={pattern} defaultUserId={person.id} />
        )}
      </SheetContent>
    </Sheet>
  );
}
