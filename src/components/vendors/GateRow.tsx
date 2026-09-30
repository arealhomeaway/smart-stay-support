/**
 * One Must Pass qualification gate: current state, who verified it and when,
 * expiration, supporting document/reference, and the reason for any permitted
 * exception. Verified-by/date are stamped by the database, never typed.
 */
import { useState } from "react";
import { AlertTriangle, CheckCircle2, CircleSlash, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  allowedResults,
  GATE_STATE_LABELS,
  GATEKEEPER_RESULT_LABELS,
  gateState,
  type GatekeeperLine,
  type GatekeeperResult,
} from "@/lib/vendors";
import { usDateTime } from "@/lib/dates";

export type GateSave = {
  requirementId: string;
  result: GatekeeperResult;
  expiresOn: string | null;
  documentId: string | null;
  evidenceReference: string | null;
  exceptionReason: string | null;
};

export function GateRow({
  line,
  documents,
  canManage,
  saving,
  onSave,
}: {
  line: GatekeeperLine;
  documents: { id: string; title: string; docType: string }[];
  canManage: boolean;
  saving: boolean;
  onSave: (v: GateSave) => void;
}) {
  const state = gateState(line);
  const [editing, setEditing] = useState(false);
  const [result, setResult] = useState<GatekeeperResult>(line.result);
  const [expiresOn, setExpiresOn] = useState(line.expiresOn ?? "");
  const [documentId, setDocumentId] = useState(line.documentId ?? "");
  const [reference, setReference] = useState(line.evidenceReference ?? "");
  const [reason, setReason] = useState(line.exceptionReason ?? "");

  const exception = result === "not_applicable" || result === "equivalent_verified";
  const passing = result === "verified_meets" || result === "equivalent_verified";
  const today = new Date().toISOString().slice(0, 10);
  const problems: string[] = [];
  if (exception && reason.trim().length < 10) problems.push("Write the reason (at least 10 characters).");
  if (passing && line.expiryRequired && !expiresOn) problems.push("Add the expiration date.");
  if (passing && expiresOn && expiresOn < today) problems.push("That date has already passed — an expired record can't pass.");
  if (passing && line.evidenceRequired && !documentId && reference.trim().length < 3)
    problems.push("Attach a document or enter a reference.");

  const Icon = state === "passed" ? CheckCircle2 : state === "failed" ? CircleSlash : state === "expired" ? Clock : AlertTriangle;
  const iconTone = state === "passed" ? "text-emerald-600" : state === "failed" || state === "expired" ? "text-destructive" : "text-amber-600";

  return (
    <div className="rounded-lg border p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Icon className={`h-4 w-4 ${iconTone}`} />
            <span className="text-sm font-medium">{line.label}</span>
            <Badge variant={state === "passed" ? "secondary" : "outline"}>{GATE_STATE_LABELS[state]}</Badge>
          </div>
          {line.detail && <p className="text-xs text-muted-foreground">{line.detail}</p>}
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
            <dt className="text-muted-foreground">Recorded</dt>
            <dd>{GATEKEEPER_RESULT_LABELS[line.result]}</dd>
            {line.verifiedAt && (
              <>
                <dt className="text-muted-foreground">Verified by</dt>
                <dd>
                  {line.verifiedByName ?? "Staff member"} · {usDateTime(line.verifiedAt)}
                </dd>
              </>
            )}
            {(line.expiryRequired || line.expiresOn) && (
              <>
                <dt className="text-muted-foreground">Expires</dt>
                <dd className={state === "expired" ? "font-medium text-destructive" : undefined}>
                  {line.expiresOn ?? "Not recorded"}
                </dd>
              </>
            )}
            {(line.evidenceRequired || line.documentTitle || line.evidenceReference) && (
              <>
                <dt className="text-muted-foreground">Support</dt>
                <dd className="break-words">
                  {[line.documentTitle, line.evidenceReference].filter(Boolean).join(" · ") || "None on file"}
                </dd>
              </>
            )}
            {line.exceptionReason && (
              <>
                <dt className="text-muted-foreground">Reason</dt>
                <dd className="break-words">{line.exceptionReason}</dd>
              </>
            )}
          </dl>
          {line.exceptionRule && <p className="text-xs text-muted-foreground">Exception rule: {line.exceptionRule}</p>}
        </div>
        {canManage && !editing && (
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
            Update
          </Button>
        )}
      </div>

      {editing && (
        <div className="mt-3 space-y-3 border-t pt-3">
          <div className="space-y-1">
            <Label>Result</Label>
            <Select value={result} onValueChange={(v) => setResult(v as GatekeeperResult)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {allowedResults(line).map((r) => (
                  <SelectItem key={r} value={r}>
                    {GATEKEEPER_RESULT_LABELS[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {passing && (
            <div className="space-y-1">
              <Label>Expiration date{line.expiryRequired ? " (required)" : " (if any)"}</Label>
              <Input type="date" value={expiresOn} onChange={(e) => setExpiresOn(e.target.value)} />
            </div>
          )}
          {(passing || exception) && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Supporting document</Label>
                <Select value={documentId || "none"} onValueChange={(v) => setDocumentId(v === "none" ? "" : v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {documents.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Reference</Label>
                <Input
                  placeholder="Policy #, licence #, where it's filed"
                  value={reference}
                  maxLength={300}
                  onChange={(e) => setReference(e.target.value)}
                />
              </div>
            </div>
          )}
          {exception && (
            <div className="space-y-1">
              <Label>{result === "not_applicable" ? "Why this does not apply" : "Documentation of the equivalent"}</Label>
              <Textarea value={reason} maxLength={1000} onChange={(e) => setReason(e.target.value)} />
            </div>
          )}
          {problems.length > 0 && (
            <ul className="list-disc pl-5 text-xs text-destructive">
              {problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          )}
          <p className="text-xs text-muted-foreground">You'll be recorded as the verifier, with today's date.</p>
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={saving || problems.length > 0}
              onClick={() => {
                onSave({
                  requirementId: line.requirementId,
                  result,
                  expiresOn: passing ? expiresOn || null : null,
                  documentId: passing || exception ? documentId || null : null,
                  evidenceReference: passing || exception ? reference.trim() || null : null,
                  exceptionReason: exception ? reason.trim() : null,
                });
                setEditing(false);
              }}
            >
              Save
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
