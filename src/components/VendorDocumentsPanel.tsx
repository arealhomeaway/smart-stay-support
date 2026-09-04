/**
 * Vendor paperwork.
 *
 * Two shapes of record, deliberately different:
 *   - Normal documents (insurance, licence, W-9, agreements, price lists) are
 *     filed with an expiry, and filing verified evidence ticks the matching
 *     screening line.
 *   - Identity is verified and discarded. A supervisor looks at the photo ID,
 *     records who they checked and how, and Resolve keeps no image — the
 *     database rejects one even if code tries.
 */

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { FileText, Lock, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { fileVendorDocument, verifyVendorIdentity } from "@/lib/vendors.functions";
import {
  DOC_TYPE_BY_CODE,
  IDENTITY_METHODS,
  VENDOR_DOC_TYPES,
  docTypeLabel,
} from "@/lib/vendor-documents";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";

type DocRow = {
  id: string;
  docType: string;
  title: string;
  restricted: boolean;
  verificationStatus: string;
  verifiedAt: string | null;
  expiresOn: string | null;
  note: string | null;
};

export function VendorDocumentsPanel({
  orgId,
  documents,
  canManage,
  onChanged,
}: {
  orgId: string;
  documents: DocRow[];
  canManage: boolean;
  onChanged: () => void;
}) {
  const fileDoc = useServerFn(fileVendorDocument);
  const verifyIdentity = useServerFn(verifyVendorIdentity);

  const [docType, setDocType] = useState("insurance");
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [expires, setExpires] = useState("");
  const [note, setNote] = useState("");

  const [subject, setSubject] = useState("");
  const [method, setMethod] = useState<string>(IDENTITY_METHODS[0]);
  const [idExpires, setIdExpires] = useState("");

  const spec = DOC_TYPE_BY_CODE.get(docType);
  const today = new Date().toISOString().slice(0, 10);

  const fileMutation = useMutation({
    mutationFn: () =>
      fileDoc({
        data: {
          orgId,
          docType,
          title,
          externalUrl: url || null,
          expiresOn: expires || null,
          note: note || null,
          verified: true,
        },
      }),
    onSuccess: () => {
      toast.success("Document filed and the matching screening item updated.");
      setTitle("");
      setUrl("");
      setExpires("");
      setNote("");
      onChanged();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const identityMutation = useMutation({
    mutationFn: () =>
      verifyIdentity({ data: { orgId, subject, method, expiresOn: idExpires || null } }),
    onSuccess: () => {
      toast.success("Identity check recorded. No image was stored.");
      setSubject("");
      setIdExpires("");
      onChanged();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4 pt-4">
      {documents.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing on file yet.</p>
      ) : (
        <div className="space-y-2">
          {documents.map((d) => {
            const expired = d.expiresOn != null && d.expiresOn < today;
            return (
              <div key={d.id} className="rounded-lg border p-3 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{d.title}</p>
                    <p className="text-muted-foreground">
                      {docTypeLabel(d.docType)} · {d.verificationStatus.replace("_", " ")}
                      {d.expiresOn && ` · ${expired ? "expired" : "expires"} ${d.expiresOn}`}
                    </p>
                    {d.note && <p className="mt-1 text-xs text-muted-foreground">{d.note}</p>}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    {expired && <Badge variant="destructive">Expired</Badge>}
                    {d.restricted && (
                      <Badge variant="secondary" className="gap-1">
                        <Lock className="h-3 w-3" /> Restricted
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {canManage && (
        <>
          <Separator />
          <div className="space-y-2 rounded-lg border p-3">
            <Label>File a document</Label>
            <Select
              value={docType}
              onValueChange={(v) => {
                setDocType(v);
                setUrl("");
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VENDOR_DOC_TYPES.filter((d) => d.retention === "store").map((d) => (
                  <SelectItem key={d.code} value={d.code}>
                    {d.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {spec && <p className="text-xs text-muted-foreground">{spec.blurb}</p>}
            <Input
              placeholder="Title — e.g. Pelican Pools 2026 service agreement"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={160}
            />
            <Input
              placeholder="Link to the file (SharePoint, Drive, Notion…)"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              maxLength={600}
            />
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">
                {spec?.expiryExpected ? "Expires on (renewal date)" : "Expires on (optional)"}
              </Label>
              <Input type="date" value={expires} onChange={(e) => setExpires(e.target.value)} />
            </div>
            <Textarea
              placeholder="What tickets about this document? Coverage limits, rate changes, exclusions…"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={1000}
            />
            <Button
              onClick={() => fileMutation.mutate()}
              disabled={title.trim().length < 2 || fileMutation.isPending}
            >
              <FileText className="mr-2 h-4 w-4" />
              File as verified
            </Button>
          </div>

          <div className="space-y-2 rounded-lg border border-dashed p-3">
            <Label>Identity check</Label>
            <p className="text-xs text-muted-foreground">
              Look at a government photo ID, then record the check here. Resolve stores the record
              and never the image — no licence scans, no ID numbers.
            </p>
            <Input
              placeholder="Who did you verify? Use their name as it appears on the ID."
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              maxLength={120}
            />
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {IDENTITY_METHODS.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">
                ID expiry shown on the document
              </Label>
              <Input type="date" value={idExpires} onChange={(e) => setIdExpires(e.target.value)} />
              {idExpires !== "" && idExpires < today && (
                <p className="text-xs text-destructive">
                  That ID is already expired — ask for current identification before recording the
                  check.
                </p>
              )}
            </div>
            <Button
              variant="secondary"
              onClick={() => identityMutation.mutate()}
              disabled={
                subject.trim().length < 2 ||
                identityMutation.isPending ||
                (idExpires !== "" && idExpires < today)
              }
            >
              <ShieldCheck className="mr-2 h-4 w-4" />
              Record identity verified
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
