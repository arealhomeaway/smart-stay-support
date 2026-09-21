/**
 * The guided-action card — one step at a time, wherever work happens.
 *
 * It shows the single thing to do now, asks only for what Resolve needs
 * written down, and finishes with Complete & Advance: the step is recorded and
 * the surface moves straight on to the next one. Tickets and onboarding tasks
 * both render this; only the action description differs.
 */
import { useEffect, useState } from "react";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
import { fieldApplies, validateAction, type ActionValues, type GuidedAction } from "@/lib/guided-action";

export function GuidedActionCard({
  action,
  readOnly,
  onComplete,
  onHandoff,
  successMessage = "Step recorded — here's what's next.",
}: {
  action: GuidedAction;
  readOnly?: boolean;
  /** Record the step. Returning false leaves the answers on screen. */
  onComplete: (values: ActionValues) => Promise<boolean | void> | boolean | void;
  onHandoff?: (target: string) => void;
  successMessage?: string;
}) {
  const [values, setValues] = useState<ActionValues>({});
  const [saving, setSaving] = useState(false);

  // A new step starts with a clean form — never last step's answers.
  useEffect(() => {
    setValues({});
  }, [action.id, action.title]);

  function set(name: string, value: string) {
    setValues((v) => ({ ...v, [name]: value }));
  }

  async function complete() {
    const problem = validateAction(action, values);
    if (problem) {
      toast.error(problem);
      return;
    }
    setSaving(true);
    try {
      const result = await onComplete(values);
      if (result === false) return;
      setValues({});
      toast.success(successMessage);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "That step could not be recorded.");
    } finally {
      setSaving(false);
    }
  }

  const fields = action.fields.filter((f) => fieldApplies(f, values));

  return (
    <div className="rounded-xl border border-brand/30 bg-brand/5 p-4">
      <p className="eyebrow text-brand">Current action</p>
      <h2 className="mt-1 text-xl font-semibold">{action.title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{action.because}</p>

      {!readOnly && fields.length > 0 && (
        <div className="mt-4 space-y-3">
          {fields.map((f) => (
            <div key={f.name} className="space-y-1.5">
              <Label htmlFor={`action-${f.name}`}>
                {f.label}
                {f.required && <span className="ml-1 text-danger">*</span>}
              </Label>
              {f.type === "longtext" && (
                <Textarea
                  id={`action-${f.name}`}
                  rows={3}
                  value={values[f.name] ?? ""}
                  onChange={(e) => set(f.name, e.target.value)}
                />
              )}
              {f.type === "text" && (
                <Input
                  id={`action-${f.name}`}
                  value={values[f.name] ?? ""}
                  onChange={(e) => set(f.name, e.target.value)}
                />
              )}
              {(f.type === "datetime" || f.type === "date") && (
                <Input
                  id={`action-${f.name}`}
                  type={f.type === "date" ? "date" : "datetime-local"}
                  value={values[f.name] ?? ""}
                  onChange={(e) => set(f.name, e.target.value)}
                />
              )}
              {f.type === "choice" && (
                <Select value={values[f.name] ?? ""} onValueChange={(val) => set(f.name, val)}>
                  <SelectTrigger id={`action-${f.name}`}>
                    <SelectValue placeholder="Choose one" />
                  </SelectTrigger>
                  <SelectContent>
                    {(f.options ?? []).map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {f.help && <p className="text-xs text-muted-foreground">{f.help}</p>}
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {action.handoff ? (
          <Button size="lg" onClick={() => onHandoff?.(action.handoff!.target)}>
            {action.handoff.label}
            <ArrowRight className="ml-1 size-4" aria-hidden="true" />
          </Button>
        ) : (
          !readOnly && (
            <Button size="lg" onClick={complete} disabled={saving}>
              <CheckCircle2 className="mr-1 size-4" aria-hidden="true" />
              {saving ? "Recording…" : action.completeLabel}
            </Button>
          )
        )}
        {action.then && <p className="text-sm text-muted-foreground">{action.then}</p>}
      </div>
    </div>
  );
}
