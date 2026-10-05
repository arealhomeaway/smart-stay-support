/**
 * "Conversation with homeowner" — one thread shared by the staff Opportunity
 * view and the homeowner's portal. Only messages intentionally sent to the
 * homeowner live here; internal notes and Task history never do.
 */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  CONVERSATION_STATE_META,
  buildThread,
  conversationState,
  openResponseRequest,
  type LegacyResponse,
} from "@/lib/owner-conversation";
import {
  postOwnerConversationMessage,
  readOwnerConversation,
  reopenOwnerRequest,
  requestOwnerResponse,
  resolveOwnerRequest,
} from "@/lib/owner-conversation.functions";

function when(ts: string) {
  return new Date(ts).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function OwnerConversation({
  workItemId,
  status,
  legacy,
  viewer,
  readOnly = false,
  refreshKeys = [],
}: {
  workItemId: string;
  status: string;
  legacy: LegacyResponse[];
  viewer: "staff" | "homeowner";
  readOnly?: boolean;
  refreshKeys?: unknown[][];
}) {
  const qc = useQueryClient();
  const read = useServerFn(readOwnerConversation);
  const post = useServerFn(postOwnerConversationMessage);
  const resolve = useServerFn(resolveOwnerRequest);
  const reopen = useServerFn(reopenOwnerRequest);
  const ask = useServerFn(requestOwnerResponse);
  const [text, setText] = useState("");
  const [askKind, setAskKind] = useState<"" | "feedback" | "decision">("");
  const key = ["owner-conversation", workItemId];
  const q = useQuery({ queryKey: key, queryFn: () => read({ data: { id: workItemId } }) });

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: key });
    for (const k of refreshKeys) void qc.invalidateQueries({ queryKey: k });
  };
  const onError = (e: unknown) => toast.error(e instanceof Error ? e.message : "Something went wrong.");
  const send = useMutation({
    mutationFn: () =>
      askKind ? ask({ data: { id: workItemId, body: text, kind: askKind } }) : post({ data: { id: workItemId, body: text } }),
    onSuccess: () => { setText(""); setAskKind(""); toast.success(viewer === "staff" ? "Reply sent to the homeowner." : "Sent to your ARHA team."); refresh(); },
    onError,
  });
  const doResolve = useMutation({
    mutationFn: () => resolve({ data: { id: workItemId } }),
    onSuccess: () => { toast.success("Resolved. The conversation stays in history."); refresh(); },
    onError,
  });
  const doReopen = useMutation({
    mutationFn: () => reopen({ data: { id: workItemId } }),
    onSuccess: () => { toast.success("Reopened. The same conversation continues."); refresh(); },
    onError,
  });

  const thread = buildThread(legacy, q.data ?? []);
  const state = conversationState(status, thread);
  const meta = CONVERSATION_STATE_META[state];
  const resolved = state === "resolved";
  const pending = openResponseRequest(thread);
  const self = (a: string) => (viewer === "staff" ? a === "staff" : a === "homeowner");

  return (
    <section className="space-y-2" aria-label="Conversation with homeowner">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">{viewer === "staff" ? "Conversation with homeowner" : "Conversation with your ARHA team"}</p>
        <span className="flex gap-1">
          {pending && !resolved ? (
            <span className="rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-xs">
              {viewer === "staff" ? "Response requested" : "Your response is requested"} · {pending === "decision" ? "Decision" : "Feedback"}
            </span>
          ) : null}
          <span className={`rounded-full border px-2 py-0.5 text-xs ${meta.tone}`}>{meta.label}</span>
        </span>
      </div>
      {thread.length ? (
        <ol className="space-y-2">
          {thread.map((e) =>
            e.author === "system" ? (
              <li key={e.id} className="text-center text-xs text-muted-foreground">
                {e.text} · {when(e.at)}
              </li>
            ) : (
              <li key={e.id} className={`rounded-md p-2 text-sm ${self(e.author) ? "ml-6 bg-primary/10" : "mr-6 bg-muted/60"}`}>
                <p className="text-xs text-muted-foreground">
                  {e.author === "staff" ? `${e.name} · ARHA` : `${e.name} · Homeowner`}
                  {e.label ? ` · ${e.label}` : ""} · {when(e.at)}
                </p>
                {e.text ? <p className="whitespace-pre-wrap">{e.text}</p> : null}
              </li>
            ),
          )}
        </ol>
      ) : (
        <p className="text-xs text-muted-foreground">No messages yet.</p>
      )}

      {!readOnly && !resolved ? (
        <div className="space-y-2">
          <Textarea
            rows={3}
            value={text}
            maxLength={5000}
            onChange={(e) => setText(e.target.value)}
            placeholder={viewer === "staff" ? "Reply to the homeowner…" : "Reply to your ARHA team…"}
            aria-label={viewer === "staff" ? "Reply to the homeowner" : "Reply to your ARHA team"}
          />
          {viewer === "staff" ? (
            <label className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              This message
              <select
                className="rounded-md border bg-background px-2 py-1 text-xs text-foreground"
                value={askKind}
                onChange={(e) => setAskKind(e.target.value as typeof askKind)}
                aria-label="Message type"
              >
                <option value="">is informational (no response needed)</option>
                <option value="feedback">asks the homeowner for feedback</option>
                <option value="decision">asks the homeowner for a decision</option>
              </select>
            </label>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={send.isPending || !text.trim()} onClick={() => send.mutate()}>
              {viewer === "staff" ? (askKind ? "Send request" : "Send reply") : "Send"}
            </Button>
            {viewer === "staff" ? (
              <Button size="sm" variant="outline" disabled={doResolve.isPending} onClick={() => doResolve.mutate()}>
                Resolve conversation
              </Button>
            ) : null}
          </div>
          {viewer === "staff" ? (
            <p className="text-xs text-muted-foreground">Replies are visible to the homeowner. Internal notes stay on the Task. Resolving closes this conversation only — complete the internal Task on its own.</p>
          ) : null}
        </div>
      ) : null}
      {!readOnly && resolved && viewer === "staff" ? (
        <Button size="sm" variant="outline" disabled={doReopen.isPending} onClick={() => doReopen.mutate()}>
          Reopen
        </Button>
      ) : null}
    </section>
  );
}
