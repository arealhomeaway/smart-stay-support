/**
 * Guest Access & Credentials — the card that sits at the top of the Property
 * Hub so a staff member on a guest call gets from the property to the WiFi
 * password in one tap.
 *
 * Values are masked until Reveal, are fetched one at a time from the server,
 * never enter a URL or a query cache key, and re-mask automatically. Copy puts
 * the value on the clipboard without ever painting it on screen.
 */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Check,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  archiveCredentialFn,
  listCredentialsFn,
  revealCredentialFn,
  saveCredentialFn,
  verifyCredentialFn,
} from "@/lib/credentials.functions";

const CATEGORIES = [
  { value: "wifi", label: "WiFi" },
  { value: "gate_community", label: "Gate / community" },
  { value: "property_access", label: "Property access" },
  { value: "garage", label: "Garage" },
  { value: "streaming", label: "Streaming" },
  { value: "supply_storage", label: "Supply / storage" },
  { value: "alarm_security", label: "Alarm / security" },
  { value: "lockbox", label: "Lockbox" },
  { value: "other", label: "Other" },
] as const;

type Category = (typeof CATEGORIES)[number]["value"];
type Row = Awaited<ReturnType<typeof listCredentialsFn>>["rows"][number];

const REVEAL_MS = 60_000;

function freshnessTone(f: Row["freshness"]) {
  if (f === "overdue") return "text-destructive";
  if (f === "stale") return "text-amber-600 dark:text-amber-500";
  if (f === "never") return "text-muted-foreground";
  return "text-muted-foreground";
}

function freshnessText(r: Row) {
  if (!r.lastVerifiedOn) return "Never verified";
  const prefix = r.freshness === "overdue" ? "Verified over a year ago —" : "Verified";
  return `${prefix} ${r.lastVerifiedOn}`;
}

export function PropertyCredentialsPanel({ propertyId }: { propertyId: string }) {
  const list = useServerFn(listCredentialsFn);
  const reveal = useServerFn(revealCredentialFn);
  const archive = useServerFn(archiveCredentialFn);
  const verify = useServerFn(verifyCredentialFn);
  const qc = useQueryClient();

  const [shown, setShown] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [editing, setEditing] = useState<Row | "new" | null>(null);

  const q = useQuery({
    queryKey: ["property-credentials", propertyId],
    queryFn: () => list({ data: { propertyId } }),
    retry: false,
  });

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ["property-credentials", propertyId] });

  async function onReveal(row: Row) {
    if (shown[row.id]) {
      setShown((s) => {
        const next = { ...s };
        delete next[row.id];
        return next;
      });
      return;
    }
    setBusy(row.id);
    try {
      const res = await reveal({ data: { credentialId: row.id, action: "reveal" } });
      setShown((s) => ({ ...s, [row.id]: res.value }));
      window.setTimeout(
        () =>
          setShown((s) => {
            const next = { ...s };
            delete next[row.id];
            return next;
          }),
        REVEAL_MS,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "That value could not be revealed.");
    } finally {
      setBusy(null);
    }
  }

  async function onCopy(row: Row) {
    setBusy(row.id);
    try {
      const res = await reveal({ data: { credentialId: row.id, action: "copy" } });
      await navigator.clipboard.writeText(res.value);
      setCopied(row.id);
      window.setTimeout(() => setCopied((c) => (c === row.id ? null : c)), 2000);
      toast.success(`${row.label} copied`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "That value could not be copied.");
    } finally {
      setBusy(null);
    }
  }

  if (q.isLoading) return <Skeleton className="h-40 w-full" />;

  if (q.isError) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <KeyRound className="h-4 w-4" /> Guest Access &amp; Credentials
          </CardTitle>
          <CardDescription>
            {q.error instanceof Error
              ? q.error.message
              : "Credentials could not be loaded right now."}
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const { rows, canManage, pendingIntake } = q.data!;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 pb-3">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <KeyRound className="h-4 w-4" /> Guest Access &amp; Credentials
          </CardTitle>
          <CardDescription>
            Available to every ARHA staff account, day or night. Values are encrypted, masked by
            default, and every reveal is logged.
          </CardDescription>
        </div>
        {canManage && (
          <Button size="sm" variant="outline" onClick={() => setEditing("new")}>
            <Plus className="mr-1 h-4 w-4" /> Add
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        {canManage && pendingIntake > 0 && (
          <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
            {pendingIntake} credential{pendingIntake === 1 ? "" : "s"} detected during import are
            waiting for review.
          </p>
        )}

        {rows.length === 0 && (
          <p className="py-4 text-sm text-muted-foreground">
            Nothing recorded for this home yet.
            {canManage ? " Add the WiFi, gate and access details staff need on a guest call." : ""}
          </p>
        )}

        {rows.map((row) => (
          <div
            key={row.id}
            className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border px-3 py-2"
          >
            <Badge variant="secondary" className="shrink-0">
              {row.categoryLabel}
            </Badge>
            <div className="min-w-40 flex-1">
              <p className="text-sm font-medium">{row.label}</p>
              {row.username && (
                <p className="text-xs text-muted-foreground">User: {row.username}</p>
              )}
              {row.instructions && (
                <p className="text-xs text-muted-foreground">{row.instructions}</p>
              )}
              <p className={`text-xs ${freshnessTone(row.freshness)}`}>{freshnessText(row)}</p>
            </div>

            <code className="min-w-28 rounded bg-muted px-2 py-1 font-mono text-sm">
              {row.hasSecret ? (shown[row.id] ?? "••••••••") : "not recorded"}
            </code>

            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="ghost"
                disabled={!row.hasSecret || busy === row.id}
                onClick={() => onReveal(row)}
                aria-label={shown[row.id] ? `Hide ${row.label}` : `Reveal ${row.label}`}
              >
                {busy === row.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : shown[row.id] ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={!row.hasSecret || busy === row.id}
                onClick={() => onCopy(row)}
                aria-label={`Copy ${row.label}`}
              >
                {copied === row.id ? (
                  <Check className="h-4 w-4 text-emerald-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
              {canManage && (
                <>
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={`Confirm ${row.label} is current`}
                    onClick={async () => {
                      await verify({ data: { credentialId: row.id } });
                      toast.success("Marked verified today");
                      invalidate();
                    }}
                  >
                    <ShieldCheck className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={`Edit ${row.label}`}
                    onClick={() => setEditing(row)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={`Remove ${row.label}`}
                    onClick={async () => {
                      await archive({ data: { credentialId: row.id } });
                      toast.success("Credential removed");
                      invalidate();
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
          </div>
        ))}
      </CardContent>

      {editing && (
        <CredentialDialog
          propertyId={propertyId}
          row={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            invalidate();
          }}
        />
      )}
    </Card>
  );
}

function CredentialDialog({
  propertyId,
  row,
  onClose,
  onSaved,
}: {
  propertyId: string;
  row: Row | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const save = useServerFn(saveCredentialFn);
  const [category, setCategory] = useState<Category>((row?.category as Category) ?? "wifi");
  const [label, setLabel] = useState(row?.label ?? "");
  const [username, setUsername] = useState(row?.username ?? "");
  const [secret, setSecret] = useState("");
  const [instructions, setInstructions] = useState(row?.instructions ?? "");

  const m = useMutation({
    mutationFn: () =>
      save({
        data: {
          id: row?.id,
          propertyId,
          category,
          label,
          username,
          secret: secret || null,
          instructions,
        },
      }),
    onSuccess: () => {
      toast.success(row ? "Credential updated" : "Credential added");
      onSaved();
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "That credential could not be saved."),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{row ? "Edit credential" : "Add credential"}</DialogTitle>
          <DialogDescription>
            The value is encrypted before it is stored and is never written to logs, search or
            reports. Leave it blank to keep the existing value.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Type</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as Category)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="cred-label">Label</Label>
            <Input
              id="cred-label"
              value={label}
              placeholder="Guest WiFi"
              onChange={(e) => setLabel(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="cred-user">Username / network (optional)</Label>
            <Input id="cred-user" value={username} onChange={(e) => setUsername(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="cred-secret">Value</Label>
            <Input
              id="cred-secret"
              type="password"
              autoComplete="new-password"
              value={secret}
              placeholder={row ? "Unchanged" : ""}
              onChange={(e) => setSecret(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="cred-notes">Instructions (never secret)</Label>
            <Textarea
              id="cred-notes"
              rows={2}
              value={instructions}
              placeholder="Keypad is on the left post; press # after the code."
              onChange={(e) => setInstructions(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={m.isPending || !label.trim()} onClick={() => m.mutate()}>
            {m.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />} Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
