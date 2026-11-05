import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Upload as UploadIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { uploadSop } from "@/lib/sop-upload.functions";
import { SOP_UPLOAD_HINT, validateSopFile, type SopReceipt } from "@/lib/sop-upload";

export function SopUpload({ onSaved }: { onSaved: (receipt: SopReceipt) => void }) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [owner, setOwner] = useState("");
  const [effectiveDate, setDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const upload = useServerFn(uploadSop);
  const people = useQuery({ queryKey: ["sop-upload-people"], enabled: open, queryFn: async () => {
    const user = await supabase.auth.getUser();
    if (user.error || !user.data.user) throw new Error("Could not find your account.");
    const rows = await supabase.from("profiles").select("id,full_name").order("full_name");
    if (rows.error) throw new Error("Could not load SOP owners.");
    return { uploader: user.data.user.id, rows: rows.data };
  }});
  const show = () => {
    const now = new Date();
    setDate(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`);
    setFile(null); setOwner(""); setError(""); setOpen(true);
  };
  return <>
    <div className="max-w-xs"><TooltipProvider><Tooltip><TooltipTrigger asChild><Button variant="outline" onClick={show} aria-describedby="sop-upload-hint"><UploadIcon className="size-4" />Upload</Button></TooltipTrigger><TooltipContent>{SOP_UPLOAD_HINT}</TooltipContent></Tooltip></TooltipProvider>
      <p id="sop-upload-hint" className="mt-1 hidden text-xs text-muted-foreground [@media(hover:none)]:block">{SOP_UPLOAD_HINT}</p>
    </div>
    <Dialog open={open} onOpenChange={(value) => { if (!busy) setOpen(value); }}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md"><DialogHeader><DialogTitle>Upload SOP</DialogTitle></DialogHeader>
      <form className="space-y-4" onSubmit={async (event) => {
        event.preventDefault(); if (!file || !people.data) return;
        setBusy(true); setError("");
        try {
          validateSopFile(file);
          const { readSopText } = await import("@/lib/sop-text.browser");
          const text = await readSopText(file);
          const data = new FormData(); data.set("file", file); data.set("text", text); data.set("owner", owner || people.data.uploader); data.set("effectiveDate", effectiveDate);
          const receipt = await upload({ data }); setOpen(false); onSaved(receipt);
        } catch (err) { setError(err instanceof Error ? err.message : "Saved nothing. Try again or check Admin > Integrations"); }
        finally { setBusy(false); }
      }}>
        <div className="space-y-2"><Label htmlFor="sop-file">Word or PDF, up to 20 MB</Label><Input id="sop-file" type="file" accept=".docx,.pdf" required disabled={busy} onChange={(e) => { const selected = e.target.files?.[0]; setFile(null); setError(""); if (selected) { try { validateSopFile(selected); setFile(selected); } catch (err) { setError(err instanceof Error ? err.message : "Choose a Word or PDF file."); } } }} /></div>
        <div className="space-y-2"><Label>SOP owner</Label><Select value={owner || people.data?.uploader || ""} onValueChange={setOwner} disabled={busy}><SelectTrigger aria-label="SOP owner"><SelectValue placeholder="Your account" /></SelectTrigger><SelectContent>{people.data?.rows.map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name || "Unnamed teammate"}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-2"><Label htmlFor="sop-date">Effective date</Label><Input id="sop-date" type="date" value={effectiveDate} required disabled={busy} onChange={(e) => setDate(e.target.value)} /></div>
        {people.isError && <p role="alert" className="text-sm text-destructive">Could not load SOP owners. Reopen this window to try again.</p>}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <div className="flex gap-2"><Button type="submit" disabled={busy || !file || !people.data}>{busy ? "Reading and saving…" : "Create drafts"}</Button><Button type="button" variant="outline" disabled={busy} onClick={() => setOpen(false)}>Cancel</Button></div>
      </form>
    </DialogContent></Dialog>
  </>;
}