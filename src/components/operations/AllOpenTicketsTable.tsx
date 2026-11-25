/**
 * Oversight "All open tickets" (change 4, item 2): every open ticket across both teams,
 * with checkboxes and three bulk actions. All writes go through the shared bulk update,
 * which adds an update to each ticket touched with who did it and the reason.
 */
import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SectionCard } from "@/components/ui/page";
import { displayName, useStaffDirectory } from "@/hooks/useTeam";
import { formatPropertyLabel } from "@/lib/property-label";
import { rollUpReported, teamBTab } from "@/lib/team-b-view";
import { bulkUpdateTicketsFn } from "@/lib/queue-bulk.functions";
import { BULK_LIMIT } from "@/lib/queue-bulk";
import { selectedTicketIds, anyLocked, type OpenRow } from "@/lib/oversight-bulk";

type Action = "due" | "assign" | "close" | "";

export function AllOpenTicketsTable({ tickets }: { tickets: OpenRow[] }) {
  const qc = useQueryClient();
  const { data: staff } = useStaffDirectory();
  const rows = useMemo(() => {
    const reported = tickets.filter((t) => teamBTab(t as never) === "reported");
    const other = tickets.filter((t) => teamBTab(t as never) !== "reported");
    return [...other, ...rollUpReported(reported as never)] as OpenRow[];
  }, [tickets]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [action, setAction] = useState<Action>("");
  const [dueOn, setDueOn] = useState("");
  const [assignee, setAssignee] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const chosen = rows.filter((r) => picked.has(r.id));
  const ids = selectedTicketIds(chosen);
  const locked = anyLocked(chosen);
  const allOn = rows.length > 0 && rows.every((r) => picked.has(r.id));
  const toggle = (id: string) => setPicked((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const ready = action === "due" ? Boolean(dueOn) && (!locked || reason.trim().length >= 3)
    : action === "assign" ? Boolean(assignee) : action === "close";

  const run = async () => {
    if (!action) return;
    setBusy(true);
    let updated = 0; const skipped: string[] = [];
    try {
      for (let i = 0; i < ids.length; i += BULK_LIMIT) {
        const r = await bulkUpdateTicketsFn({ data: {
          ticketIds: ids.slice(i, i + BULK_LIMIT), action,
          ...(action === "due" ? { dueOn, anyLocked: locked, ...(reason.trim() ? { reason: reason.trim() } : {}) } : {}),
          ...(action === "assign" ? { assigneeId: assignee } : {}),
        } });
        updated += r.updated;
        skipped.push(...r.skipped.map((s) => `${s.ref ? `#${s.ref}: ` : ""}${s.why}`));
      }
      toast.success(`${updated} ticket${updated === 1 ? "" : "s"} updated`);
      if (skipped.length) toast.error(`Not changed: ${skipped.slice(0, 3).join("; ")}${skipped.length > 3 ? ` and ${skipped.length - 3} more` : ""}`);
      setPicked(new Set()); setAction(""); setReason(""); setDueOn(""); setAssignee("");
      await qc.invalidateQueries({ queryKey: ["oversight"] });
      await qc.invalidateQueries({ queryKey: ["team-queue"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "That change could not be saved.");
    } finally { setBusy(false); }
  };

  return (
    <SectionCard title={`All open tickets (${rows.length})`}>
      {picked.size > 0 ? (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-3">
          <span className="text-sm font-medium">{ids.length} selected</span>
          <Button variant={action === "due" ? "default" : "outline"} className="min-h-11" onClick={() => setAction("due")}>Move due date</Button>
          <Button variant={action === "assign" ? "default" : "outline"} className="min-h-11" onClick={() => setAction("assign")}>Reassign</Button>
          <Button variant={action === "close" ? "default" : "outline"} className="min-h-11" onClick={() => setAction("close")}>Close selected</Button>
          {action === "due" ? (<>
            <Input type="date" className="w-44" aria-label="New due date" value={dueOn} onChange={(e) => setDueOn(e.target.value)} />
            {locked ? <Input className="w-64" aria-label="Short reason" placeholder="Short reason (some are locked)" value={reason} onChange={(e) => setReason(e.target.value)} /> : null}
          </>) : null}
          {action === "assign" ? (
            <Select value={assignee} onValueChange={setAssignee}>
              <SelectTrigger className="w-56" aria-label="Choose a person"><SelectValue placeholder="Choose a person" /></SelectTrigger>
              <SelectContent>{(staff ?? []).map((p) => <SelectItem key={p.id} value={p.id}>{displayName(p)}</SelectItem>)}</SelectContent>
            </Select>
          ) : null}
          {action ? <Button className="min-h-11" disabled={!ready || busy} onClick={() => void run()}>{busy ? "Saving..." : "Apply"}</Button> : null}
          <Button variant="ghost" className="min-h-11" onClick={() => { setPicked(new Set()); setAction(""); }}>Clear</Button>
        </div>
      ) : null}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted-foreground">
            <tr>
              <th className="p-2"><input type="checkbox" aria-label="Select all" className="h-5 w-5" checked={allOn} onChange={() => setPicked(allOn ? new Set() : new Set(rows.map((r) => r.id)))} /></th>
              <th className="p-2">Description</th><th className="p-2">Property</th><th className="p-2">Priority</th>
              <th className="p-2">Owner</th><th className="p-2">Status</th><th className="p-2">Due</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="p-2"><input type="checkbox" className="h-5 w-5" aria-label={`Select ${r.title ?? "ticket"}`} checked={picked.has(r.id)} onChange={() => toggle(r.id)} /></td>
                <td className="p-2"><Link to="/tickets/$ticketId" params={{ ticketId: r.id }} className="font-medium hover:underline">{r.ref && !r.rollup ? `#${r.ref} ` : ""}{r.title ?? "Ticket"}</Link></td>
                <td className="p-2">{r.properties ? formatPropertyLabel(r.properties as never).full : ""}</td>
                <td className="p-2">{String(r.priority ?? "").toUpperCase()}</td>
                <td className="p-2">{r.assigned_to ? displayName((staff ?? []).find((p) => p.id === r.assigned_to) ?? null) : "Unassigned"}</td>
                <td className="p-2">{r.status.replace(/_/g, " ")}</td>
                <td className="p-2 whitespace-nowrap">{r.due_on ?? ""}{r.due_locked ? <Lock className="ml-1 inline h-3 w-3" aria-label="Locked" /> : null}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}
