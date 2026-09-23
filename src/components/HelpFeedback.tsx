/**
 * Global Help & Feedback control. Rendered once by AppShell so every current and
 * future Resolve page inherits it. Reports about Resolve itself — never an
 * Operations ticket.
 */
import { useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { CircleHelp, Paperclip, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { submitHelpTicket } from "@/lib/help-feedback.functions";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function portalForPath(path: string): string {
  if (path.startsWith("/onboarding")) return "Onboarding";
  if (path.startsWith("/owner-") || path.startsWith("/homeowners")) return "Active Owner (staff)";
  if (path.startsWith("/owner")) return "Active Owner";
  if (path.startsWith("/vendor/") || path === "/vendor" || path.startsWith("/vendor.")) return "Vendor";
  if (path.startsWith("/vendors") || path.startsWith("/quarterly")) return "Vendor Hub";
  if (/^\/(integrations|audit|help-tickets|team|account)/.test(path)) return "Administration";
  if (/^\/(leads)/.test(path)) return "Guest & reservations";
  if (/^\/(command-center|analytics|ops-analytics)/.test(path)) return "Insight";
  return "Operations";
}

function pageContext(pathname: string, search: Record<string, unknown>) {
  const segs = pathname.split("/").filter(Boolean);
  let propertyId: string | null = null;
  if ((segs[0] === "onboarding" || segs[0] === "property") && segs[1] && UUID.test(segs[1])) propertyId = segs[1];
  for (const k of ["propertyId", "property", "home"]) {
    const v = search[k];
    if (!propertyId && typeof v === "string" && UUID.test(v)) propertyId = v;
  }
  let workItemId: string | null = null;
  if ((segs[0] === "tickets" || segs[0] === "vendor") && segs[1] && UUID.test(segs[1])) workItemId = segs[1];
  for (const k of ["task", "workItem", "opportunity", "ticket"]) {
    const v = search[k];
    if (!workItemId && typeof v === "string" && v.length < 100) workItemId = v;
  }
  return { propertyId, workItemId };
}

export function HelpFeedbackButton() {
  const loc = useRouterState({ select: (s) => s.location });
  const submit = useServerFn(submitHelpTicket);
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<"issue" | "suggestion" | null>(null);
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);

  function reset() {
    setKind(null);
    setText("");
    setFiles([]);
  }

  async function send() {
    if (!kind || !text.trim()) return;
    setBusy(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) throw new Error("Please sign in again.");
      const attachments: { path: string; name: string }[] = [];
      for (const f of files) {
        const path = `${uid}/${crypto.randomUUID()}-${f.name.replace(/[^\w.\-]+/g, "_").slice(0, 120)}`;
        const up = await supabase.storage.from("help-feedback").upload(path, f, { upsert: false });
        if (up.error) throw new Error(`${f.name}: ${up.error.message}`);
        attachments.push({ path, name: f.name });
      }
      const ctx = pageContext(loc.pathname, (loc.search ?? {}) as Record<string, unknown>);
      await submit({
        data: {
          kind,
          description: text.trim(),
          portal: portalForPath(loc.pathname),
          pageTitle: (document.title || loc.pathname).slice(0, 300),
          route: `${loc.pathname}${loc.searchStr ?? ""}`.slice(0, 1000),
          origin: window.location.origin,
          propertyId: ctx.propertyId,
          workItemId: ctx.workItemId,
          userAgent: navigator.userAgent.slice(0, 500),
          attachments,
        },
      });
      reset();
      setOpen(false);
      toast.success("Thanks — your feedback was sent.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not send feedback.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon"
              variant="outline"
              aria-label="Help & Feedback"
              onClick={() => setOpen(true)}
              className="fixed bottom-4 right-4 z-40 size-11 rounded-full shadow-md print:hidden"
            >
              <CircleHelp className="size-5" aria-hidden="true" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">Help & Feedback</TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <Dialog open={open} onOpenChange={(o) => !busy && setOpen(o)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Help & Feedback</DialogTitle>
            <DialogDescription>
              Tell us what's not working or what would make this page better.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-medium">What would you like to share?</p>
              <div className="flex flex-wrap gap-2" role="radiogroup">
                <Button
                  type="button"
                  role="radio"
                  aria-checked={kind === "issue"}
                  variant={kind === "issue" ? "default" : "outline"}
                  onClick={() => setKind("issue")}
                >
                  Something isn't working
                </Button>
                <Button
                  type="button"
                  role="radio"
                  aria-checked={kind === "suggestion"}
                  variant={kind === "suggestion" ? "default" : "outline"}
                  onClick={() => setKind("suggestion")}
                >
                  I have a suggestion
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="help-feedback-text">Tell us what happened or what you'd like to change</Label>
              <Textarea
                id="help-feedback-text"
                rows={6}
                maxLength={5000}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={
                  kind === "suggestion"
                    ? "What would make this page easier or more useful?"
                    : "What were you trying to do, and what happened instead?"
                }
              />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">
                Attach a screenshot or file <span className="font-normal text-muted-foreground">(optional)</span>
              </p>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-accent">
                <Paperclip className="size-4" aria-hidden="true" /> Upload
                <input
                  type="file"
                  multiple
                  className="sr-only"
                  onChange={(e) => {
                    const picked = Array.from(e.target.files ?? []);
                    setFiles((prev) => [...prev, ...picked].slice(0, 5));
                    e.target.value = "";
                  }}
                />
              </label>
              {files.length > 0 && (
                <ul className="space-y-1 text-sm">
                  {files.map((f, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <span className="truncate">{f.name}</span>
                      <button
                        type="button"
                        aria-label={`Remove ${f.name}`}
                        onClick={() => setFiles((p) => p.filter((_, j) => j !== i))}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <X className="size-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button onClick={send} disabled={busy || !kind || !text.trim()}>
              {busy ? "Sending…" : "Send Feedback"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
