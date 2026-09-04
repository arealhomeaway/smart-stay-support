/**
 * Evidence Quality Gate — the one evidence surface.
 *
 * The same component serves Work Orders, Tickets, Onboarding tasks,
 * Assessments and property records. Whoever is holding the phone sees exactly
 * what is being asked for, and, if a photo is turned down, exactly what to
 * change. "Rejected" on its own is never shown.
 */
import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  Loader2,
  Plus,
  RefreshCw,
  ShieldCheck,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { beginUploadFn, completeUploadFn } from "@/lib/attachments.functions";
import {
  acceptEvidenceExceptionFn,
  addEvidenceRequirementFn,
  evidenceForRecord,
  recheckEvidenceFn,
  removeEvidenceRequirementFn,
  submitEvidenceFn,
} from "@/lib/evidence.functions";
import type { AttachmentEntity } from "@/lib/attachments";
import { usDateTime } from "@/lib/dates";
import {
  EVIDENCE_KINDS,
  ITEM_STATUS_LABEL,
  KIND_CRITERIA,
  KIND_LABEL,
  REASON_GUIDANCE,
  REQUIREMENT_STATUS_LABEL,
  type EvidenceItemView,
  type EvidenceKind,
  type EvidenceRequirementView,
  type EvidenceSubject,
} from "@/lib/evidence";

type Props = {
  subjectType: EvidenceSubject;
  subjectId: string;
  /** Where the uploaded file is filed. Work Order evidence files under the home. */
  attachTo: { entityType: AttachmentEntity; entityId: string };
  propertyId?: string | null;
  title?: string;
  description?: string;
};

function requirementTone(status: EvidenceRequirementView["status"]) {
  switch (status) {
    case "verified":
      return "default" as const;
    case "accepted_exception":
      return "secondary" as const;
    case "rejected":
      return "destructive" as const;
    default:
      return "outline" as const;
  }
}

function itemTone(status: EvidenceItemView["status"]) {
  switch (status) {
    case "verified":
      return "default" as const;
    case "accepted_exception":
      return "secondary" as const;
    case "rejected":
      return "destructive" as const;
    default:
      return "outline" as const;
  }
}

function ExceptionDialog({ item, onDone }: { item: EvidenceItemView; onDone: () => void }) {
  const accept = useServerFn(acceptEvidenceExceptionFn);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");

  const save = useMutation({
    mutationFn: () => accept({ data: { itemId: item.id, reason } }),
    onSuccess: (res) => {
      if (!res.ok) {
        toast.error(res.message ?? "Could not accept that photo.");
        return;
      }
      toast.success("Accepted with exception. It is on the record.");
      setOpen(false);
      setReason("");
      onDone();
    },
    onError: () => toast.error("Could not accept that photo."),
  });

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <ShieldCheck className="mr-1 size-3" /> Accept with exception
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Accept this photo with an exception</DialogTitle>
            <DialogDescription>
              You are taking responsibility for evidence that did not meet the standard. Your name,
              the reason and the time are recorded, and the original result is kept.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="exception-reason">Why is this acceptable?</Label>
            <Textarea
              id="exception-reason"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Crawl space has no light and the vendor has left the property; the repair is confirmed by the vendor comment."
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={reason.trim().length < 10 || save.isPending}
              onClick={() => save.mutate()}
            >
              Accept with exception
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ItemCard({
  item,
  canOverride,
  onChanged,
}: {
  item: EvidenceItemView;
  canOverride: boolean;
  onChanged: () => void;
}) {
  const recheck = useServerFn(recheckEvidenceFn);
  const again = useMutation({
    mutationFn: () => recheck({ data: { itemId: item.id } }),
    onSuccess: () => onChanged(),
    onError: () => toast.error("Could not check that photo again."),
  });

  return (
    <div className="flex gap-3 rounded-md border border-border/60 p-2">
      {item.url ? (
        <a href={item.url} target="_blank" rel="noreferrer" className="shrink-0">
          <img
            src={item.url}
            alt={`Evidence photo submitted ${usDateTime(item.createdAt)}`}
            className="size-20 rounded object-cover"
            loading="lazy"
          />
        </a>
      ) : (
        <div className="flex size-20 shrink-0 items-center justify-center rounded bg-muted">
          <Camera className="size-5 text-muted-foreground" />
        </div>
      )}

      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={itemTone(item.status)}>{ITEM_STATUS_LABEL[item.status]}</Badge>
          {item.source === "breezeway_photo" && <Badge variant="outline">From Breezeway</Badge>}
          <span className="text-xs text-muted-foreground">
            {usDateTime(item.createdAt)}
            {item.uploadedByName ? ` · ${item.uploadedByName}` : ""}
          </span>
        </div>

        {item.status === "rejected" && item.reasonCodes.length > 0 && (
          <div className="space-y-1 text-sm">
            <p className="font-medium text-destructive">
              {item.reasonCodes.map((c) => REASON_GUIDANCE[c].title).join(" · ")}
            </p>
            <ul className="list-disc pl-4 text-muted-foreground">
              {item.reasonCodes.map((c) => (
                <li key={c}>{REASON_GUIDANCE[c].fix}</li>
              ))}
            </ul>
          </div>
        )}

        {item.status === "unchecked" && item.guidance && (
          <p className="text-sm text-muted-foreground">{item.guidance}</p>
        )}

        {item.status === "accepted_exception" && (
          <div className="rounded bg-muted/50 p-2 text-xs text-muted-foreground">
            <p>
              <span className="font-medium text-foreground">Accepted with exception</span>
              {item.exceptionByName ? ` by ${item.exceptionByName}` : ""}
              {item.exceptionAt ? ` · ${usDateTime(item.exceptionAt)}` : ""}
            </p>
            {item.exceptionReason && <p className="mt-1">“{item.exceptionReason}”</p>}
            {item.originalRejection && <p className="mt-1">Originally: {item.originalRejection}</p>}
          </div>
        )}

        {(item.status === "rejected" || item.status === "unchecked") && (
          <div className="flex flex-wrap gap-2 pt-1">
            <Button
              variant="ghost"
              size="sm"
              disabled={again.isPending}
              onClick={() => again.mutate()}
            >
              <RefreshCw className={`mr-1 size-3 ${again.isPending ? "animate-spin" : ""}`} /> Check
              again
            </Button>
            {canOverride && <ExceptionDialog item={item} onDone={onChanged} />}
          </div>
        )}
      </div>
    </div>
  );
}

function RequirementCard({
  requirement,
  attachTo,
  canOverride,
  onChanged,
}: {
  requirement: EvidenceRequirementView;
  attachTo: { entityType: AttachmentEntity; entityId: string };
  canOverride: boolean;
  onChanged: () => void;
}) {
  const begin = useServerFn(beginUploadFn);
  const complete = useServerFn(completeUploadFn);
  const submit = useServerFn(submitEvidenceFn);
  const drop = useServerFn(removeEvidenceRequirementFn);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function upload(file: File) {
    setBusy(true);
    try {
      const uploadKey = crypto.randomUUID();
      const started = await begin({
        data: {
          entityType: attachTo.entityType,
          entityId: attachTo.entityId,
          uploadKey,
          filename: file.name,
          mimeType: file.type,
          sizeBytes: file.size,
          note: `Evidence: ${requirement.label}`,
        },
      });
      if (!started.alreadyStored) {
        if (!started.signedUrl) throw new Error("no slot");
        const put = await fetch(started.signedUrl, {
          method: "PUT",
          headers: { "Content-Type": file.type },
          body: file,
        });
        await complete({ data: { documentId: started.documentId!, ok: put.ok } });
        if (!put.ok) throw new Error("upload failed");
      }
      const res = await submit({
        data: { requirementId: requirement.id, documentId: started.documentId! },
      });
      if (res.status === "verified") toast.success("Evidence verified.");
      else if (res.status === "rejected") toast.error("Photo not accepted — see what to change.");
      else toast.message(res.message ?? "Photo saved.");
      onChanged();
    } catch {
      toast.error("That photo could not be uploaded. Try again.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const remove = useMutation({
    mutationFn: () => drop({ data: { requirementId: requirement.id } }),
    onSuccess: () => onChanged(),
    onError: () => toast.error("Could not remove that request."),
  });

  return (
    <div className="space-y-2 rounded-md border border-border/60 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium">
            {requirement.label}
            {!requirement.required && (
              <span className="ml-2 text-xs font-normal text-muted-foreground">optional</span>
            )}
          </p>
          <p className="text-xs text-muted-foreground">
            {requirement.instruction ?? KIND_CRITERIA[requirement.kind]}
          </p>
          {requirement.detail && (
            <p className="text-xs text-muted-foreground">Confirm: {requirement.detail}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={requirementTone(requirement.status)}>
            {REQUIREMENT_STATUS_LABEL[requirement.status]}
          </Badge>
          {canOverride && (
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Remove the ${requirement.label} evidence request`}
              onClick={() => remove.mutate()}
            >
              <X className="size-3" />
            </Button>
          )}
        </div>
      </div>

      {requirement.items.map((item) => (
        <ItemCard key={item.id} item={item} canOverride={canOverride} onChanged={onChanged} />
      ))}

      <div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void upload(f);
          }}
        />
        <Button
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
        >
          {busy ? (
            <>
              <Loader2 className="mr-1 size-3 animate-spin" /> Checking photo…
            </>
          ) : (
            <>
              <Upload className="mr-1 size-3" />
              {requirement.items.length ? "Add another photo" : "Add photo"}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

function AddRequirement({
  subjectType,
  subjectId,
  propertyId,
  onChanged,
}: {
  subjectType: EvidenceSubject;
  subjectId: string;
  propertyId?: string | null;
  onChanged: () => void;
}) {
  const add = useServerFn(addEvidenceRequirementFn);
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<EvidenceKind>("general");
  const [label, setLabel] = useState("");
  const [instruction, setInstruction] = useState("");
  const [detail, setDetail] = useState("");

  const save = useMutation({
    mutationFn: () =>
      add({
        data: {
          subjectType,
          subjectId,
          propertyId: propertyId ?? null,
          slotKey: `${kind}-${Date.now().toString(36)}`,
          label: label.trim() || KIND_LABEL[kind],
          kind,
          instruction: instruction.trim() || null,
          detail: detail.trim() || null,
        },
      }),
    onSuccess: () => {
      setOpen(false);
      setLabel("");
      setInstruction("");
      setDetail("");
      onChanged();
    },
    onError: () => toast.error("Could not add that evidence request."),
  });

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        <Plus className="mr-1 size-3" /> Ask for a photo
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ask for a photo</DialogTitle>
            <DialogDescription>
              Say exactly what has to be visible. The clearer the request, the fewer photos come
              back unusable.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>What kind of proof?</Label>
              <Select value={kind} onValueChange={(v) => setKind(v as EvidenceKind)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EVIDENCE_KINDS.map((k) => (
                    <SelectItem key={k} value={k}>
                      {KIND_LABEL[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{KIND_CRITERIA[kind]}</p>
            </div>
            <div className="space-y-1">
              <Label htmlFor="ev-label">Title</Label>
              <Input
                id="ev-label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder={KIND_LABEL[kind]}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ev-instruction">Instruction for whoever takes it</Label>
              <Textarea
                id="ev-instruction"
                rows={2}
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                placeholder="e.g. Photograph the label on the side of the water heater, straight on and close enough to read the serial."
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ev-detail">Specific detail to confirm (optional)</Label>
              <Input
                id="ev-detail"
                value={detail}
                onChange={(e) => setDetail(e.target.value)}
                placeholder="e.g. filter size 20x25x1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button disabled={save.isPending} onClick={() => save.mutate()}>
              Add request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function EvidenceQualityGate({
  subjectType,
  subjectId,
  attachTo,
  propertyId,
  title = "Evidence",
  description = "Photos are checked against one standard: can a reviewer clearly verify the work?",
}: Props) {
  const load = useServerFn(evidenceForRecord);
  const qc = useQueryClient();
  const key = ["evidence", subjectType, subjectId];

  const { data, isLoading } = useQuery({
    queryKey: key,
    queryFn: () => load({ data: { subjectType, subjectId } }),
  });

  const refresh = () => void qc.invalidateQueries({ queryKey: key });
  const requirements = data?.requirements ?? [];
  const outstanding = data?.completeness.outstanding ?? 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            {title}
            {requirements.length > 0 &&
              (outstanding === 0 ? (
                <Badge variant="default">
                  <CheckCircle2 className="mr-1 size-3" /> All evidence in
                </Badge>
              ) : (
                <Badge variant="outline">
                  <AlertTriangle className="mr-1 size-3" /> {outstanding} outstanding
                </Badge>
              ))}
          </CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        <AddRequirement
          subjectType={subjectType}
          subjectId={subjectId}
          propertyId={propertyId ?? null}
          onChanged={refresh}
        />
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <Skeleton className="h-20 w-full" />
        ) : requirements.length === 0 ? (
          <p className="text-sm text-muted-foreground">No photo has been asked for here yet.</p>
        ) : (
          requirements.map((r) => (
            <RequirementCard
              key={r.id}
              requirement={r}
              attachTo={attachTo}
              canOverride={Boolean(data?.canOverride)}
              onChanged={refresh}
            />
          ))
        )}
      </CardContent>
    </Card>
  );
}
