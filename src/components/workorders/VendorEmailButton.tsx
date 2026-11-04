/** "Email work order to vendor" for accepted vendors Breezeway cannot reach. Never calls Breezeway. */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Mail } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { prepareVendorWorkOrderEmail, sendVendorWorkOrderEmail } from "@/lib/vendor-email.functions";
import { NO_VENDOR_EMAIL, vendorEmailProblems } from "@/lib/vendor-email";
import { usDateTime } from "@/lib/dates";

export function VendorEmailButton({ workOrderId }: { workOrderId: string }) {
  const qc = useQueryClient();
  const prepare = useServerFn(prepareVendorWorkOrderEmail);
  const send = useServerFn(sendVendorWorkOrderEmail);
  const key = ["vendor-wo-email", workOrderId];
  const q = useQuery({ queryKey: key, queryFn: () => prepare({ data: { workOrderId } }) });
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const m = useMutation({
    mutationFn: () => send({ data: { workOrderId, subject, body } }),
    onSuccess: (r) => {
      if (r.ok) { toast.success(r.message); setOpen(false); } else toast.error(r.message);
      void qc.invalidateQueries({ queryKey: key });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "The email was not sent."),
  });
  if (!q.data) return null;
  if (!q.data.offered) {
    return (
      <span className="inline-flex items-center gap-2">
        <Button size="sm" variant="outline" disabled title={q.data.notOfferedReason ?? undefined}>
          <Mail className="mr-1 size-4" /> Email work order to vendor
        </Button>
        <span className="text-xs text-muted-foreground">{q.data.notOfferedReason}</span>
      </span>
    );
  }
  const problems = vendorEmailProblems(`${subject}\n${body}`);
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => { setSubject(q.data!.subject); setBody(q.data!.body); setOpen(true); }}>
        <Mail className="mr-1 size-4" /> Email work order to vendor
      </Button>
      {q.data.lastSentAt ? <span className="text-xs text-muted-foreground">Sent to vendor by email {usDateTime(q.data.lastSentAt)}</span> : null}
      {open ? (
        <Dialog open onOpenChange={(o) => !o && setOpen(false)}>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
            <DialogHeader><DialogTitle>Email work order to vendor</DialogTitle></DialogHeader>
            {!q.data.email ? (
              <p className="text-sm text-destructive">{NO_VENDOR_EMAIL}</p>
            ) : (
              <div className="space-y-3 text-sm">
                <p className="text-muted-foreground">To: {q.data.email}. Replies come back to you. This does not create a Breezeway task.</p>
                <div className="space-y-1"><Label htmlFor="ve-subj">Subject</Label><Input id="ve-subj" value={subject} onChange={(e) => setSubject(e.target.value)} /></div>
                <div className="space-y-1"><Label htmlFor="ve-body">Message</Label><Textarea id="ve-body" rows={14} value={body} onChange={(e) => setBody(e.target.value)} /></div>
                <p className="text-xs text-muted-foreground">Never include door or lock codes, guest names or the owner's financial details.</p>
                {problems.length ? <ul className="list-disc pl-5 text-xs text-destructive">{problems.map((p) => <li key={p}>{p}</li>)}</ul> : null}
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button disabled={!q.data.email || m.isPending || problems.length > 0} onClick={() => m.mutate()}>{m.isPending ? "Sending…" : "Send email"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </>
  );
}
