/**
 * The Current Action card — one step at a time on a ticket.
 *
 * It shows the single thing to do now, asks only for what Resolve needs
 * written down, and finishes with Complete & Advance: the step is recorded
 * and the card immediately becomes the next step, so nobody has to work out
 * what happens after.
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
import {
  fieldApplies,
  validateAction,
  type ActionValues,
  type CurrentAction,
} from "@/lib/ticket-current-action";
import { completeCurrentActionFn } from "@/lib/ticket-current-action.functions";

export function CurrentActionCard({
  ticketId,
  action,
  readOnly,
  onDone,
  onHandoff,
}: {
  ticketId: string;
  action: CurrentAction;
  readOnly?: boolean;
  /** Called after the step is recorded, so the ticket can reload and advance. */
  onDone: () => Promise<void> | void;
  onHandoff?: (target: NonNullable<CurrentAction["handoff"]>["target"]) => void;
}) {
  const [values, setValues] = useState<ActionValues>({});
  const [saving, setSaving] = useState(false);

  // A new step starts with a clean form — never last step's answers.
  useEffect(() => {
    setValues({});
  }, [action.id]);

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
      const result = await completeCurrentActionFn({
        data: { ticketId, actionId: action.id, values },
      });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      setValues({});
      await onDone();
      toast.success("Step recorded — here's what's next.");
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
              {f.type === "datetime" && (
                <Input
                  id={`action-${f.name}`}
                  type="datetime-local"
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
              {saving ? "Recording…" : "Complete & advance"}
            </Button>
          )
        )}
        {action.then && <p className="text-sm text-muted-foreground">{action.then}</p>}
      </div>
    </div>
  );
}
