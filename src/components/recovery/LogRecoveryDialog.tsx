/**
 * "+ Log Guest refunds & credits" — starting a recovery from the recovery queue itself.
 *
 * A recovery always belongs to the ticket where the guest situation is being
 * handled, so the first thing this asks for is that ticket. Everything the
 * ticket already knows — home, guest, stay, priority — comes across by
 * reference; the only thing typed here is the decision itself. Authority and
 * evidence come from the central ARHA policy, never from this file.
 */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCurrentUserId } from "@/hooks/useTeam";
import { useRole } from "@/hooks/useRole";
import { OPEN_STATUSES } from "@/lib/tickets";
import {
  ESCALATION_FLAGS,
  ESCALATION_FLAG_LABELS,
  POLICY_VERSION,
  RECOVERY_ACTIONS,
  RECOVERY_ACTION_LABELS,
  SITUATION_LABELS,
  evaluateAuthority,
  evidenceSlots,
  findDuplicates,
  policyBoundaryLabel,
  type EscalationFlag,
  type RecoveryAction,
  type RecoverySituation,
} from "@/lib/guest-recovery";

type TicketOption = {
  id: string;
  title: string;
  description: string | null;
  property_id: string | null;
  guest_name: string | null;
  priority: string | null;
  is_demo: boolean | null;
  ownerrez_booking_id: string | null;
  ownerrez_channel: string | null;
  ownerrez_confirmation_code: string | null;
  ownerrez_arrival: string | null;
  ownerrez_departure: string | null;
};

const SITUATIONS = Object.keys(SITUATION_LABELS) as RecoverySituation[];

export function LogRecoveryDialog() {
  const qc = useQueryClient();
  const userId = useCurrentUserId();
  const { can, readOnly } = useRole();
  const allowed = can("claims_work") && !readOnly;

  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [situation, setSituation] = useState<RecoverySituation>("general");
  const [action, setAction] = useState<RecoveryAction | "">("");
  const [impact, setImpact] = useState("");
  const [requested, setRequested] = useState("");
  const [amount, setAmount] = useState("");
  const [policyFit, setPolicyFit] = useState<"unknown" | "within" | "outside">("unknown");
  const [flags, setFlags] = useState<EscalationFlag[]>([]);
  const [acknowledged, setAcknowledged] = useState(false);

  const tickets = useQuery({
    queryKey: ["recovery-log-tickets"],
    enabled: allowed && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tickets")
        .select(
          "id,title,description,property_id,guest_name,priority,is_demo,ownerrez_booking_id,ownerrez_channel,ownerrez_confirmation_code,ownerrez_arrival,ownerrez_departure",
        )
        .in("status", OPEN_STATUSES)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as unknown as TicketOption[];
    },
  });

  const term = search.trim().toLowerCase();
  const options = (tickets.data ?? []).filter((row) => {
    if (!term) return true;
    return [row.title, row.guest_name]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(term));
  });
  const ticket = (tickets.data ?? []).find((row) => row.id === ticketId) ?? null;

  const existing = useQuery({
    queryKey: ["recovery-for-ticket", ticketId],
    enabled: Boolean(ticketId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("guest_recovery")
        .select("id,ticket_id,ownerrez_booking_id,stage,title")
        .eq("ticket_id", ticketId!);
      if (error) throw error;
      return data ?? [];
    },
  });

  const withinPolicy = policyFit === "unknown" ? null : policyFit === "within";
  const verdict = evaluateAuthority({
    recovery_action: action || null,
    proposed_amount: amount || null,
    within_airbnb_policy: withinPolicy,
    escalation_flags: flags,
  });

  const duplicates = ticket
    ? findDuplicates(
        { ticket_id: ticket.id, ownerrez_booking_id: ticket.ownerrez_booking_id },
        (existing.data ?? []) as never,
      )
    : [];
  const blocked = duplicates.length > 0 && !acknowledged;

  function reset() {
    setSearch("");
    setTicketId(null);
    setSituation("general");
    setAction("");
    setImpact("");
    setRequested("");
    setAmount("");
    setPolicyFit("unknown");
    setFlags([]);
    setAcknowledged(false);
  }

  const create = useMutation({
    mutationFn: async () => {
      if (!ticket) throw new Error("Choose the ticket this guest situation is on.");
      if (!impact.trim()) throw new Error("Say what the guest actually lost.");
      const chosen = (action || null) as RecoveryAction | null;
      const escalations = verdict.escalations;
      const { data, error } = await supabase
        .from("guest_recovery")
        .insert({
          ticket_id: ticket.id,
          property_id: ticket.property_id,
          stage: "impact_confirmed",
          title: ticket.title,
          issue_summary: ticket.description,
          impact_detail: impact.trim(),
          recovery_action: chosen,
          guest_name: ticket.guest_name,
          reservation_channel: ticket.ownerrez_channel,
          reservation_confirmation: ticket.ownerrez_confirmation_code,
          ownerrez_booking_id: ticket.ownerrez_booking_id,
          stay_arrival: ticket.ownerrez_arrival,
          stay_departure: ticket.ownerrez_departure,
          priority: ticket.priority ?? "p3",
          guest_requested_amount: requested ? Number(requested) : null,
          proposed_amount: amount ? Number(amount) : null,
          within_airbnb_policy: withinPolicy,
          escalation_flags: escalations,
          authority_level: verdict.level,
          approval_status: verdict.level === "pc" ? "not_required" : "pending",
          policy_version: POLICY_VERSION,
          assigned_to: userId,
          created_by: userId,
          is_demo: ticket.is_demo ?? false,
        } as never)
        .select("id")
        .single();
      if (error) throw error;
      const recoveryId = (data as { id: string }).id;

      const slots = evidenceSlots(chosen, situation).map((slot) => ({
        subject_type: "guest_recovery",
        subject_id: recoveryId,
        property_id: ticket.property_id,
        slot_key: slot.key,
        label: slot.label,
        requirement_kind: slot.kind,
        instruction: slot.instruction,
        required: slot.required,
        status: "awaiting",
        created_by: userId,
      }));
      if (slots.length) {
        const { error: reqError } = await supabase.from("evidence_requirements").insert(slots);
        if (reqError) throw reqError;
      }

      await supabase.from("guest_recovery_activity").insert({
        recovery_id: recoveryId,
        author_id: userId,
        event_type: "created",
        body: chosen
          ? `Recovery logged from the recovery queue — proposed remedy: ${RECOVERY_ACTION_LABELS[chosen]}`
          : "Recovery logged from the recovery queue",
        detail: {
          authority: verdict.level,
          reason: verdict.reason,
          escalations,
          policy_version: POLICY_VERSION,
        },
        is_demo: ticket.is_demo ?? false,
      } as never);
      return recoveryId;
    },
    onSuccess: () => {
      setOpen(false);
      reset();
      qc.invalidateQueries({ queryKey: ["guest-recovery"] });
      toast.success("Guest refunds & credits logged");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (!allowed) return null;

  const toggleFlag = (flag: EscalationFlag) =>
    setFlags((current) =>
      current.includes(flag) ? current.filter((f) => f !== flag) : [...current, flag],
    );

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button>+ Log Guest refunds & credits</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Log a guest refund or credit</DialogTitle>
          <DialogDescription>
            Start from the ticket where the situation is being handled — the home, guest and stay
            come across from it.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <div className="space-y-1">
            <Label className="text-xs" htmlFor="rec-ticket-search">
              Which ticket is this guest situation on?
            </Label>
            <Input
              id="rec-ticket-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by ticket title or guest"
            />
            {tickets.isLoading ? (
              <p className="text-xs text-muted-foreground">Loading open tickets…</p>
            ) : options.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No open ticket matches. Open the ticket first, then log the recovery.
              </p>
            ) : (
              <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border p-1">
                {options.slice(0, 40).map((row) => (
                  <button
                    key={row.id}
                    type="button"
                    aria-pressed={row.id === ticketId}
                    onClick={() => setTicketId(row.id)}
                    className={`w-full rounded px-2 py-1.5 text-left text-xs ${row.id === ticketId ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                  >
                    {row.title}
                    {row.guest_name ? ` — ${row.guest_name}` : ""}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-1">
            <Label className="text-xs" htmlFor="rec-new-impact">
              What did the guest actually lose?
            </Label>
            <Textarea
              id="rec-new-impact"
              rows={2}
              value={impact}
              onChange={(e) => setImpact(e.target.value)}
              placeholder="No hot water for two nights; guest showered at the neighbours'."
            />
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs">Situation</Label>
              <Select value={situation} onValueChange={(v) => setSituation(v as RecoverySituation)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SITUATIONS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {SITUATION_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Proposed remedy</Label>
              <Select value={action} onValueChange={(v) => setAction(v as RecoveryAction)}>
                <SelectTrigger>
                  <SelectValue placeholder="Decide later" />
                </SelectTrigger>
                <SelectContent>
                  {RECOVERY_ACTIONS.map((a) => (
                    <SelectItem key={a} value={a}>
                      {RECOVERY_ACTION_LABELS[a]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            <div className="space-y-1">
              <Label className="text-xs" htmlFor="rec-new-requested">
                Guest asked for
              </Label>
              <Input
                id="rec-new-requested"
                type="number"
                value={requested}
                onChange={(e) => setRequested(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs" htmlFor="rec-new-amount">
                Proposed amount
              </Label>
              <Input
                id="rec-new-amount"
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Airbnb policy fit</Label>
              <Select value={policyFit} onValueChange={(v) => setPolicyFit(v as typeof policyFit)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unknown">Not confirmed yet</SelectItem>
                  <SelectItem value="within">Within normal policy</SelectItem>
                  <SelectItem value="outside">Outside normal policy</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Anything that raises the stakes?</Label>
            <div className="flex flex-wrap gap-2">
              {ESCALATION_FLAGS.filter(
                (f) => f !== "outside_policy" && f !== "multi_night_refund" && f !== "relocation",
              ).map((flag) => (
                <label
                  key={flag}
                  className="flex items-center gap-1 rounded border px-2 py-1 text-xs"
                >
                  <input
                    type="checkbox"
                    checked={flags.includes(flag)}
                    onChange={() => toggleFlag(flag)}
                  />
                  {ESCALATION_FLAG_LABELS[flag]}
                </label>
              ))}
            </div>
          </div>

          <div className="rounded-md border bg-muted/40 p-3">
            <p className="text-sm font-medium">{verdict.label}</p>
            <p className="text-xs text-muted-foreground">{verdict.reason}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {policyBoundaryLabel(withinPolicy)} · {POLICY_VERSION}
            </p>
          </div>

          {duplicates.length > 0 ? (
            <div className="rounded-md border border-warning/40 bg-warning/10 p-3">
              <p className="text-sm font-medium">Possible duplicate</p>
              <p className="text-xs text-muted-foreground">
                {duplicates[0]?.reason} Review before logging another.
              </p>
              <label className="mt-2 flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={acknowledged}
                  onChange={(e) => setAcknowledged(e.target.checked)}
                />
                This is a separate remedy
              </label>
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => {
              setOpen(false);
              reset();
            }}
          >
            Cancel
          </Button>
          <Button
            disabled={!ticket || !impact.trim() || blocked || create.isPending}
            onClick={() => create.mutate()}
          >
            Log recovery
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
