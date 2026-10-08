import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Mail } from "lucide-react";
import { SectionCard } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import {
  getWelcomeAdmin,
  previewWelcome,
  retryWelcome,
  reconcileWelcome,
  saveWelcomeTemplate,
  welcomeVideoUploadSlot,
} from "@/lib/owner-welcome.functions";
import { unknownPlaceholders, welcomeDateLabel, WELCOME_PLACEHOLDERS, type OwnerWelcomeTemplate } from "@/lib/owner-welcome";
import { usDate } from "@/lib/dates";

const STATUS: Record<string, string> = {
  queued: "Waiting to send", sending: "Sending", sent: "Sent", failed: "Not delivered", held_demo: "Demo — never sent",
};

export function WelcomeEmailEditor() {
  const qc = useQueryClient();
  const load = useServerFn(getWelcomeAdmin);
  const save = useServerFn(saveWelcomeTemplate);
  const slot = useServerFn(welcomeVideoUploadSlot);
  const preview = useServerFn(previewWelcome);
  const reconcileFn = useServerFn(reconcileWelcome);
  const [reconcileReasons, setReconcileReasons] = useState<Record<string, string>>({});
  const reconcile = useMutation({
    mutationFn: (data: { id: string; outcome: "delivered" | "not_delivered"; reason: string }) => reconcileFn({ data }),
    onSuccess: () => { toast.success("Delivery reconciliation recorded. Nothing was sent."); void qc.invalidateQueries({ queryKey: ["owner-welcome"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const retryFn = useServerFn(retryWelcome);
  const retry = useMutation({
    mutationFn: (id: string) => retryFn({ data: { id } }),
    onSuccess: () => { toast.success("Welcome put back in the queue."); void qc.invalidateQueries({ queryKey: ["owner-welcome"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const q = useQuery({ queryKey: ["owner-welcome"], queryFn: () => load() });
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [video, setVideo] = useState<OwnerWelcomeTemplate["video"]>(null);
  const [linkDraft, setLinkDraft] = useState("");
  const [uploading, setUploading] = useState(false);
  const [shown, setShown] = useState<{ subject: string; body: string } | null>(null);

  useEffect(() => {
    if (!q.data) return;
    setSubject(q.data.template.subject);
    setBody(q.data.template.body);
    setVideo(q.data.template.video);
    setLinkDraft(q.data.template.video?.kind === "link" ? q.data.template.video.url : "");
  }, [q.data]);

  const saveM = useMutation({
    mutationFn: (review: "draft" | "approved") => save({ data: { subject, body, video, review } }),
    onSuccess: (t) => {
      toast.success(t.review === "approved" ? `Version ${t.version} approved for sending.` : `Saved as draft (version ${t.version}).`);
      void qc.invalidateQueries({ queryKey: ["owner-welcome"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function upload(file: File) {
    if (file.size > 250 * 1024 * 1024) {
      toast.error("Videos must be 250 MB or smaller.");
      return;
    }
    setUploading(true);
    try {
      const s = await slot({ data: { name: file.name, size: file.size } });
      const { error } = await supabase.storage.from("owner-welcome-media").uploadToSignedUrl(s.path, s.token, file);
      if (error) throw new Error("Upload failed. Please try again.");
      setVideo({ kind: "upload", path: s.path, name: file.name });
      toast.success("Video uploaded. Save to use it.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  if (!q.data) return null;
  const { template, canEdit, canManageDelivery, recent } = q.data;
  const typos = unknownPlaceholders(`${subject}\n${body}`);

  return (
    <SectionCard
      title={<span className="flex items-center gap-2"><Mail className="size-4" /> Active Owner welcome email</span>}
      description="Sent once, automatically, after a homeowner is set up as an Active Owner. It only goes out after the wording is approved here."
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Badge variant={template.review === "approved" ? "success" : "warning"}>
            {template.review === "approved" ? `Approved · version ${template.version}` : `Draft — awaiting review · version ${template.version}`}
          </Badge>
          {template.review !== "approved" && (
            <span className="text-muted-foreground">Proposed wording from Emily Jimenez. Nothing sends until it is approved.</span>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="w-subj">Subject</Label>
          <Input id="w-subj" value={subject} disabled={!canEdit} onChange={(e) => setSubject(e.target.value)} maxLength={200} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="w-body">Message</Label>
          <Textarea id="w-body" value={body} disabled={!canEdit} onChange={(e) => setBody(e.target.value)} rows={18} />
          <p className="text-xs text-muted-foreground">Fill-ins: {WELCOME_PLACEHOLDERS.join(" · ")}. The video line is left out when no video is set.</p>
          {typos.length > 0 && <p className="text-sm text-destructive">Unrecognized fill-ins: {typos.join(", ")}</p>}
        </div>
        <div className="space-y-2">
          <Label>Welcome video (optional)</Label>
          <p className="text-sm text-muted-foreground">
            {video ? (video.kind === "link" ? `Link: ${video.url}` : `Uploaded: ${video.name} (only signed-in homeowners can watch)`) : "No video — the email leaves the video line out."}
          </p>
          {canEdit && (
            <div className="flex flex-wrap items-center gap-2">
              <Input className="max-w-sm" placeholder="https://…" value={linkDraft} onChange={(e) => setLinkDraft(e.target.value)} />
              <Button variant="outline" size="sm" disabled={!/^https:\/\/\S+$/.test(linkDraft)} onClick={() => setVideo({ kind: "link", url: linkDraft })}>Use link</Button>
              <Input className="max-w-xs" type="file" accept="video/mp4,video/quicktime,video/webm,.m4v" disabled={uploading}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = ""; }} />
              {video && <Button variant="ghost" size="sm" onClick={() => { setVideo(null); setLinkDraft(""); }}>Remove video</Button>}
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={async () => setShown(await preview({ data: { subject, body, hasVideo: !!video, videoUrl: video?.kind === "link" ? video.url : null } }))}>Preview</Button>
          {canEdit && (
            <>
              <Button variant="outline" disabled={saveM.isPending || typos.length > 0} onClick={() => saveM.mutate("draft")}>Save as draft</Button>
              <Button disabled={saveM.isPending || typos.length > 0} onClick={() => saveM.mutate("approved")}>Approve for sending</Button>
            </>
          )}
        </div>
        {shown && (
          <div className="rounded-md border border-border bg-muted/40 p-4 text-sm">
            <p className="font-medium">{shown.subject}</p>
            <p className="mt-2 whitespace-pre-wrap">{shown.body}</p>
            <p className="mt-2 text-xs text-muted-foreground">Sample homeowner and home shown.</p>
          </div>
        )}
        {recent.length > 0 && (
          <div className="space-y-1 text-sm">
            <p className="font-medium">Recent welcomes</p>
            {recent.map((r) => (
              <div key={r.id} className="text-muted-foreground">
                {r.recipient} · {STATUS[r.status] ?? r.status} · {welcomeDateLabel(r, usDate)}
                {r.template_version ? ` · v${r.template_version}` : ""}{r.error_message ? ` · ${r.error_message}` : ""}
                {canManageDelivery && r.status === "failed" && !r.is_demo ? (
                  <Button variant="link" size="sm" className="h-auto px-2" disabled={retry.isPending} onClick={() => retry.mutate(r.id)}>Retry</Button>
                ) : null}
                {r.status === "sending" ? " · sending or result uncertain — do not resend" : ""}
                {canManageDelivery && r.status === "sending" && r.error_message?.startsWith("Delivery uncertain: ") && !r.is_demo ? (
                  <div className="space-y-2 rounded border p-2">
                    <Label htmlFor={`reconcile-${r.id}`}>Mailbox/provider evidence confirming delivery or non-delivery</Label>
                    <Input id={`reconcile-${r.id}`} value={reconcileReasons[r.id] ?? ""} maxLength={1000}
                      onChange={(e) => setReconcileReasons((v) => ({ ...v, [r.id]: e.target.value }))} />
                    <p className="text-xs">An absent message alone may not prove non-delivery. Record the evidence before choosing an outcome.</p>
                    {(["delivered", "not_delivered"] as const).map((outcome) => (
                      <Button key={outcome} variant="outline" size="sm"
                        disabled={reconcile.isPending || (reconcileReasons[r.id] ?? "").trim().length < 5}
                        onClick={() => reconcile.mutate({ id: r.id, outcome, reason: reconcileReasons[r.id] ?? "" })}>
                        {outcome === "delivered" ? "Delivery confirmed" : "Non-delivery confirmed"}
                      </Button>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </SectionCard>
  );
}

