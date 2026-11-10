import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { NO_REPLY_WARNING, PORTAL_COPY, portalLinkFrom, type PortalState, portalAnswerState } from "@/lib/portal-requests";

const BIG = "min-h-12 px-6 text-[15px] font-semibold";

/** "Open in partner portal": a new tab, no referrer; nothing when no listed link is stored. */
export function PartnerPortalButton({ href, className }: { href: string | null | undefined; className?: string }) {
  const link = portalLinkFrom(href);
  if (!link) return null;
  return (
    <Button variant="outline" className={cn("min-h-11 self-start px-4 font-semibold border-primary text-primary", className)} asChild>
      <a href={link} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">
        <ExternalLink className="size-4" aria-hidden />
        {PORTAL_COPY.openPortal}
      </a>
    </Button>
  );
}

/** The plain warning shown while the reply address is a no reply sender. */
export function NoReplyWarning() {
  return (
    <p role="alert" data-part="no-reply-warning" className="rounded-lg border border-amber/40 bg-amber/10 px-3 py-2 text-sm">
      {NO_REPLY_WARNING}
    </p>
  );
}

/**
 * Answer in the partner's portal: Copy the reply, a one line note and
 * "I answered in the partner's portal". During the approval period the quote
 * goes to a supervisor for OK first.
 */
export function PortalAnswerPanel({
  state,
  note,
  onNote,
  onCopy,
  onAnswer,
  onAskOk,
  busy = false,
  approvedForPortal = false,
}: {
  state: PortalState;
  note: string;
  onNote: (v: string) => void;
  onCopy: () => void;
  onAnswer: () => void;
  onAskOk?: () => void;
  busy?: boolean;
  approvedForPortal?: boolean;
}) {
  const check = portalAnswerState(state);
  return (
    <div data-part="portal-answer" className="flex flex-col gap-2.5 rounded-xl border border-border bg-muted/30 p-3">
      <strong className="text-[15px]">{PORTAL_COPY.sectionTitle}</strong>
      <span className="text-[13px] text-muted-foreground">{PORTAL_COPY.sectionHint}</span>
      {approvedForPortal ? <strong role="status" className="text-sm">{PORTAL_COPY.approvedForPortal}</strong> : null}
      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        {PORTAL_COPY.noteLabel}
        <Input
          aria-label={PORTAL_COPY.noteLabel}
          className="h-11 text-sm text-foreground"
          maxLength={200}
          placeholder={PORTAL_COPY.notePlaceholder}
          value={note}
          onChange={(e) => onNote(e.target.value.replace(/[\r\n]+/g, " "))}
        />
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" className={cn(BIG, "border-primary text-primary")} onClick={onCopy} data-action="copy-reply">
          {PORTAL_COPY.copyReply}
        </Button>
        {check.needsOk && onAskOk ? (
          <Button type="button" className={BIG} disabled={busy} onClick={onAskOk} data-action="portal-ask-ok">
            {PORTAL_COPY.askOk}
          </Button>
        ) : null}
        <Button type="button" className={BIG} disabled={busy || !check.allowed} onClick={onAnswer} data-action="portal-answer">
          {PORTAL_COPY.answer}
        </Button>
      </div>
      {check.reason ? (
        <span className="text-[13px] text-muted-foreground">{check.needsOk ? PORTAL_COPY.askOkHelp : check.reason}</span>
      ) : null}
    </div>
  );
}
