/**
 * The conversation on one owner item that a Task was sent as (Active Owner fix, Fix 7).
 * Homeowner side: read every message and write back. Staff side: reply, resolve, reopen.
 * Renders `fallback` while the item is not a conversation or the staged functions are not applied.
 */
import { useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { loadOwnerItemDetail, manageOwnerItem, replyToOwnerItem } from "@/lib/ao-data";
import { linkifyText } from "@/lib/linkify";

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { timeZone: "America/Chicago", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

export function OwnerItemConversation({
  reviewId,
  side,
  readOnly,
  fallback = null,
  onChanged,
}: {
  reviewId: string;
  side: "owner" | "staff";
  readOnly: boolean;
  fallback?: ReactNode;
  onChanged?: () => void;
}) {
  const qc = useQueryClient();
  const key = ["owner-item-detail", reviewId];
  const q = useQuery({ queryKey: key, queryFn: () => loadOwnerItemDetail(reviewId), retry: false });
  const [text, setText] = useState("");
  const done = () => { setText(""); void qc.invalidateQueries({ queryKey: key }); onChanged?.(); };
  const send = useMutation({
    mutationFn: () => (side === "owner" ? replyToOwnerItem(reviewId, text.trim()) : manageOwnerItem(reviewId, "reply", text.trim())),
    onSuccess: () => { toast.success(side === "owner" ? "Sent to your ARHA team" : "Reply sent"); done(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const manage = useMutation({
    mutationFn: (action: "resolve" | "reopen") => manageOwnerItem(reviewId, action),
    onSuccess: (_d, action) => { toast.success(action === "resolve" ? "Conversation resolved" : "Conversation reopened"); done(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const detail = q.data?.available ? q.data.data : null;
  if (!detail?.conversation) return <>{fallback}</>;
  const messages = detail.messages.filter((m) => !m.event);
  const busy = send.isPending || manage.isPending;

  return (
    <section className="space-y-3 rounded-xl border border-border p-3" aria-label="Conversation">
      <p className="text-sm font-medium">{side === "owner" ? "Talk it through with your ARHA team" : "Conversation with the homeowner"}</p>
      {messages.length === 0 ? (
        <p className="text-sm text-muted-foreground">{side === "owner" ? "No messages yet. Write your feedback below." : "No answer from the homeowner yet."}</p>
      ) : (
        <ol className="space-y-2">
          {messages.map((m) => (
            <li key={m.id} className={m.author_type === "homeowner" ? "rounded-md bg-muted p-3 text-sm" : "rounded-md border p-3 text-sm"}>
              <p className="text-xs text-muted-foreground">
                {side === "owner" && m.author_type === "homeowner" ? "You" : m.author_name} · {when(m.created_at)}
              </p>
              <p className="whitespace-pre-wrap">{linkifyText(m.body)}</p>
            </li>
          ))}
        </ol>
      )}
      {!detail.open && side === "owner" ? (
        <p className="text-xs text-muted-foreground">Resolved. Write again any time and your team will pick it back up.</p>
      ) : null}
      {readOnly ? null : (
        <div className="space-y-2">
          {side === "owner" || detail.open ? (
            <>
              <Textarea
                rows={3}
                maxLength={5000}
                aria-label={side === "owner" ? "Your feedback" : "Reply to the homeowner"}
                placeholder={side === "owner" ? "Write your feedback or question" : "Write your reply"}
                value={text}
                onChange={(e) => setText(e.target.value)}
                disabled={busy}
              />
              <div className="flex flex-wrap gap-2">
                <Button className="min-h-11" size="sm" disabled={busy || !text.trim()} onClick={() => send.mutate()}>Send</Button>
                {side === "staff" ? (
                  <Button className="min-h-11" size="sm" variant="outline" disabled={busy} onClick={() => manage.mutate("resolve")}>Mark resolved</Button>
                ) : null}
              </div>
            </>
          ) : (
            <Button className="min-h-11" size="sm" variant="outline" disabled={busy} onClick={() => manage.mutate("reopen")}>Reopen</Button>
          )}
        </div>
      )}
    </section>
  );
}
