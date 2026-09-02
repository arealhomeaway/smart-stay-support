/**
 * The canonical Special Handling list for one property.
 *
 * One source of truth. Everyone reads it; Onboarding and Operations
 * supervisors maintain it. Rules are typed so Resolve can act on them rather
 * than asking a coordinator to remember them.
 */
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState, SectionCard } from "@/components/ui/page";
import { usePropertySpecialHandling } from "@/components/SpecialHandlingNotice";
import {
  MOMENTS,
  MOMENT_LABELS,
  RULE_TYPES,
  RULE_TYPE_HINTS,
  RULE_TYPE_LABELS,
  SEVERITY_LABELS,
  isBlocking,
  ruleTypeLabel,
  severityLabel,
  type SpecialHandlingRow,
  type SpecialHandlingRuleType,
  type SpecialHandlingSeverity,
} from "@/lib/special-handling";

type Draft = {
  rule_type: SpecialHandlingRuleType;
  title: string;
  instruction: string;
  vendor_name: string;
  trade: string;
  threshold_amount: string;
  owner_notification_required: boolean;
  applies_to: string[];
  severity: SpecialHandlingSeverity;
};

const EMPTY: Draft = {
  rule_type: "note",
  title: "",
  instruction: "",
  vendor_name: "",
  trade: "",
  threshold_amount: "",
  owner_notification_required: false,
  applies_to: ["any"],
  severity: "standard",
};

export function SpecialHandlingPanel({
  propertyId,
  canEdit,
}: {
  propertyId: string;
  canEdit: boolean;
}) {
  const qc = useQueryClient();
  const { data, isLoading } = usePropertySpecialHandling(propertyId);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);

  const rules = (data ?? []).slice().sort((a, b) => Number(isBlocking(b)) - Number(isBlocking(a)));

  const save = useMutation({
    mutationFn: async () => {
      if (!draft) return;
      if (!draft.title.trim() || !draft.instruction.trim()) {
        throw new Error("Give the rule a short name and say what to do.");
      }
      const payload = {
        property_id: propertyId,
        rule_type: draft.rule_type,
        title: draft.title.trim(),
        instruction: draft.instruction.trim(),
        vendor_name: draft.vendor_name.trim() || null,
        trade: draft.trade.trim() || null,
        threshold_amount: draft.threshold_amount ? Number(draft.threshold_amount) : null,
        owner_notification_required: draft.owner_notification_required,
        applies_to: draft.applies_to.length ? draft.applies_to : ["any"],
        severity: draft.severity,
      };
      const { error } =
        editing && editing !== "new"
          ? await supabase.from("special_handling").update(payload).eq("id", editing)
          : await supabase.from("special_handling").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["special-handling", propertyId] });
      setEditing(null);
      setDraft(null);
      toast.success("Special handling updated.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("special_handling").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["special-handling", propertyId] });
      toast.success("Rule removed.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function startEdit(rule: SpecialHandlingRow) {
    setEditing(rule.id);
    setDraft({
      rule_type: rule.rule_type as SpecialHandlingRuleType,
      title: rule.title,
      instruction: rule.instruction,
      vendor_name: rule.vendor_name ?? "",
      trade: rule.trade ?? "",
      threshold_amount: rule.threshold_amount != null ? String(rule.threshold_amount) : "",
      owner_notification_required: rule.owner_notification_required,
      applies_to: rule.applies_to?.length ? rule.applies_to : ["any"],
      severity: rule.severity as SpecialHandlingSeverity,
    });
  }

  return (
    <SectionCard
      title="Special handling"
      description="The rules that make this home different. Resolve shows these before the actions they affect."
      tone={rules.some(isBlocking) ? "attention" : "default"}
      actions={
        canEdit && !editing ? (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              setEditing("new");
              setDraft(EMPTY);
            }}
          >
            <Plus className="size-4" /> Add a rule
          </Button>
        ) : null
      }
      bodyClassName="space-y-3"
    >
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : rules.length === 0 && editing !== "new" ? (
        <EmptyState
          title="No special handling recorded."
          hint={
            canEdit
              ? "Add the vendor rules, owner preferences and access quirks the team currently keeps in their heads."
              : "Anything unusual about this home would be listed here."
          }
        />
      ) : (
        rules.map((rule) =>
          editing === rule.id && draft ? (
            <RuleForm
              key={rule.id}
              draft={draft}
              setDraft={setDraft}
              saving={save.isPending}
              onSave={() => save.mutate()}
              onCancel={() => {
                setEditing(null);
                setDraft(null);
              }}
            />
          ) : (
            <div
              key={rule.id}
              className={`rounded-lg border px-4 py-3 ${
                isBlocking(rule) ? "border-warning/40 bg-warning/5" : "border-border"
              }`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{ruleTypeLabel(rule.rule_type)}</Badge>
                {rule.trade && <Badge variant="secondary">{rule.trade}</Badge>}
                <span className="text-sm font-semibold">{rule.title}</span>
                <span className="ml-auto text-xs text-muted-foreground">
                  {severityLabel(rule.severity)}
                </span>
              </div>
              <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed">{rule.instruction}</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                {rule.vendor_name && <span>Vendor: {rule.vendor_name}</span>}
                {rule.threshold_amount != null && (
                  <span>Limit: ${Number(rule.threshold_amount).toLocaleString()}</span>
                )}
                {rule.owner_notification_required && <span>Owner must be told first</span>}
                <span>
                  Applies to:{" "}
                  {(rule.applies_to?.length ? rule.applies_to : ["any"])
                    .map((m) => MOMENT_LABELS[m as keyof typeof MOMENT_LABELS] ?? m)
                    .join(", ")}
                </span>
                {canEdit && (
                  <span className="ml-auto flex items-center gap-1">
                    <Button size="sm" variant="ghost" onClick={() => startEdit(rule)}>
                      <Pencil className="size-3.5" /> Edit
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => remove.mutate(rule.id)}>
                      <Trash2 className="size-3.5" /> Remove
                    </Button>
                  </span>
                )}
              </div>
            </div>
          ),
        )
      )}

      {editing === "new" && draft && (
        <RuleForm
          draft={draft}
          setDraft={setDraft}
          saving={save.isPending}
          onSave={() => save.mutate()}
          onCancel={() => {
            setEditing(null);
            setDraft(null);
          }}
        />
      )}
    </SectionCard>
  );
}

function RuleForm({
  draft,
  setDraft,
  saving,
  onSave,
  onCancel,
}: {
  draft: Draft;
  setDraft: (d: Draft) => void;
  saving: boolean;
  onSave: () => void;
  onCancel: () => void;
}) {
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft({ ...draft, [key]: value });

  return (
    <div className="space-y-3 rounded-lg border border-dashed border-border p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>What kind of rule is this?</Label>
          <select
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={draft.rule_type}
            onChange={(e) => set("rule_type", e.target.value as SpecialHandlingRuleType)}
          >
            {RULE_TYPES.map((t) => (
              <option key={t} value={t}>
                {RULE_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">{RULE_TYPE_HINTS[draft.rule_type]}</p>
        </div>
        <div className="space-y-1.5">
          <Label>How important is it?</Label>
          <select
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={draft.severity}
            onChange={(e) => set("severity", e.target.value as SpecialHandlingSeverity)}
          >
            {(Object.keys(SEVERITY_LABELS) as SpecialHandlingSeverity[]).map((s) => (
              <option key={s} value={s}>
                {SEVERITY_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Short name</Label>
        <Input
          value={draft.title}
          onChange={(e) => set("title", e.target.value)}
          placeholder="HVAC goes to Bell Brothers only"
        />
      </div>

      <div className="space-y-1.5">
        <Label>What should the team do?</Label>
        <Textarea
          rows={2}
          value={draft.instruction}
          onChange={(e) => set("instruction", e.target.value)}
          placeholder="Write it as an instruction, not a description."
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label>Vendor (optional)</Label>
          <Input value={draft.vendor_name} onChange={(e) => set("vendor_name", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Trade (optional)</Label>
          <Input
            value={draft.trade}
            onChange={(e) => set("trade", e.target.value)}
            placeholder="HVAC, plumbing…"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Spend limit (optional)</Label>
          <Input
            inputMode="decimal"
            value={draft.threshold_amount}
            onChange={(e) => set("threshold_amount", e.target.value)}
            placeholder="350"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>When should Resolve show this?</Label>
        <div className="flex flex-wrap gap-2">
          {MOMENTS.map((m) => {
            const on = draft.applies_to.includes(m);
            return (
              <button
                key={m}
                type="button"
                onClick={() =>
                  set(
                    "applies_to",
                    on ? draft.applies_to.filter((v) => v !== m) : [...draft.applies_to, m],
                  )
                }
                className={`h-9 rounded-lg border px-3 text-sm transition-colors ${
                  on ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-secondary"
                }`}
              >
                {MOMENT_LABELS[m]}
              </button>
            );
          })}
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <Switch
          checked={draft.owner_notification_required}
          onCheckedChange={(v) => set("owner_notification_required", v)}
        />
        The owner must be told before this work happens
      </label>

      <div className="flex gap-2">
        <Button onClick={onSave} disabled={saving}>
          Save rule
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
