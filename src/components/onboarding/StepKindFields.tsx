/** A2: "Kind of Task" on a plan step, with the per-kind pickers. Saved with the step. */
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  FILL_FIELDS,
  OUTSIDE_DEFAULT_MESSAGE,
  OUTSIDE_DOCUMENT_MAX,
  OUTSIDE_LOG_TIME_SENTENCE,
  OUTSIDE_MESSAGE_MAX,
  OUTSIDE_PLACES,
  TASK_KINDS,
  TASK_KIND_LABEL,
  type FillFieldCode,
  type KindSettings,
  type TaskKindCode,
} from "@/lib/onboarding-task-kinds";

export type StepKindValue = { kind: TaskKindCode; settings: KindSettings };

export function StepKindFields({
  value,
  onChange,
  emailTemplates,
  trades,
}: {
  value: StepKindValue;
  onChange: (v: StepKindValue) => void;
  emailTemplates: { id: string; name: string }[];
  trades: string[];
}) {
  const set = (patch: Partial<KindSettings>) => onChange({ ...value, settings: { ...value.settings, ...patch } });
  const fields = value.settings.fields ?? [];
  return (
    <div className="space-y-3 rounded-md border border-border p-3">
      <div className="space-y-1">
        <Label>Kind of Task</Label>
        <Select value={value.kind} onValueChange={(k) => onChange({ kind: k as TaskKindCode, settings: value.settings })}>
          <SelectTrigger className="min-h-11" aria-label="Kind of Task"><SelectValue /></SelectTrigger>
          <SelectContent>
            {TASK_KINDS.map((k) => <SelectItem key={k} value={k}>{TASK_KIND_LABEL[k]}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      {value.kind === "email" && (
        <div className="space-y-1">
          <Label>Email template</Label>
          <Select value={value.settings.emailTemplateId ?? "none"} onValueChange={(v) => set({ emailTemplateId: v === "none" ? null : v })}>
            <SelectTrigger className="min-h-11" aria-label="Email template"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Choose a template</SelectItem>
              {emailTemplates.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}
      {value.kind === "vendor_request" && (
        <div className="space-y-1">
          <Label>Trade</Label>
          <Select value={value.settings.trade ?? "none"} onValueChange={(v) => set({ trade: v === "none" ? null : v })}>
            <SelectTrigger className="min-h-11" aria-label="Trade"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Choose a trade</SelectItem>
              {trades.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}
      {value.kind === "fill_in" && (
        <div className="space-y-1">
          <Label>Fields</Label>
          <div className="grid gap-1 sm:grid-cols-2">
            {FILL_FIELDS.map((f) => (
              <label key={f.code} className="flex min-h-11 items-center gap-2 text-sm">
                <Checkbox
                  checked={fields.includes(f.code)}
                  onCheckedChange={(on) =>
                    set({ fields: on ? [...fields, f.code] : fields.filter((x: FillFieldCode) => x !== f.code) })
                  }
                />
                {f.label}
              </label>
            ))}
          </div>
        </div>
      )}
      {value.kind === "outside_resolve" && (
        <div className="space-y-1">
          <Label>Where it happens</Label>
          <Select value={value.settings.where ?? "none"} onValueChange={(v) => set({ where: v === "none" ? null : (v as KindSettings["where"]) })}>
            <SelectTrigger className="min-h-11" aria-label="Where it happens"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Choose</SelectItem>
              {OUTSIDE_PLACES.map((p) => <SelectItem key={p.code} value={p.code}>{p.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Label htmlFor="step-document-name" className="block pt-2">Document name</Label>
          <Input
            id="step-document-name"
            className="min-h-11"
            maxLength={OUTSIDE_DOCUMENT_MAX}
            placeholder="document"
            value={value.settings.documentName ?? ""}
            onChange={(e) => set({ documentName: e.target.value || null })}
          />
          <Label htmlFor="step-owner-message" className="block pt-2">Owner message</Label>
          <Textarea
            id="step-owner-message"
            rows={3}
            maxLength={OUTSIDE_MESSAGE_MAX}
            placeholder={`${OUTSIDE_DEFAULT_MESSAGE} ${OUTSIDE_LOG_TIME_SENTENCE}`}
            value={value.settings.ownerMessage ?? ""}
            onChange={(e) => set({ ownerMessage: e.target.value || null })}
          />
          <p className="text-xs text-muted-foreground">[document] and {"{where}"} fill in.</p>
        </div>
      )}
      {value.kind === "send_to_owner" && (
        <div className="space-y-1">
          <Label>For a standard owner (no portal)</Label>
          <Select value={value.settings.fallback ?? "none"} onValueChange={(v) => set({ fallback: v === "none" ? null : (v as "outside_resolve" | "email") })}>
            <SelectTrigger className="min-h-11" aria-label="Fallback for a standard owner"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Send to the homeowner section</SelectItem>
              <SelectItem value="outside_resolve">Done outside Resolve</SelectItem>
              <SelectItem value="email">Email</SelectItem>
            </SelectContent>
          </Select>
          {value.settings.fallback === "email" && (
            <Select value={value.settings.emailTemplateId ?? "none"} onValueChange={(v) => set({ emailTemplateId: v === "none" ? null : v })}>
              <SelectTrigger className="min-h-11" aria-label="Email template"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Choose a template</SelectItem>
                {emailTemplates.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
        </div>
      )}
      <label className="flex min-h-11 items-center gap-2 text-sm">
        <Checkbox
          checked={value.settings.requireFile === true}
          onCheckedChange={(on) => set({ requireFile: on === true ? true : undefined })}
        />
        Needs a file before sending
      </label>
    </div>
  );
}
