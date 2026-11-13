/**
 * Property page Part 2 (2.2): one chat's messages and composer, shared by the chat panel, the Owner
 * tab's Reply and the owner portal's Messages with ARHA. Live through database realtime; read marks
 * are written when the thread is open.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Paperclip } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MultiFileUpload } from "@/components/MultiFileUpload";
import { createAttachmentUploader } from "@/lib/attachment-upload-client";
import { beginUploadFn, completeUploadFn } from "@/lib/attachments.functions";
import { chatAttachmentUrlFn, markHomeChatReadFn, postHomeChatFn, readHomeChatFn } from "@/lib/owner-tab.functions";
import { CHAT_FOLDERS, CHAT_STYLE, parseMentions, type ChatFolder, type ChatKind } from "@/lib/owner-tab";
import { cn } from "@/lib/utils";

export const CHAT_TONE: Record<ChatKind, { banner: string; send: string; tab: string }> = {
  owner: {
    banner: "border-amber/50 bg-amber/15 text-foreground",
    send: "bg-amber text-warning-ink hover:bg-amber/90",
    tab: "data-[state=active]:bg-amber/20 data-[state=active]:text-foreground",
  },
  team: {
    banner: "border-border bg-muted text-foreground",
    send: "bg-cool-grey text-primary-foreground hover:bg-cool-grey/90",
    tab: "data-[state=active]:bg-muted data-[state=active]:text-foreground",
  },
};

export function chatKey(propertyId: string, kind: ChatKind) {
  return ["home-chat", propertyId, kind] as const;
}

/** Live refresh: a new message on this chat refetches it (no polling, no manual refresh). */
export function useChatLive(chatId: string | null, onChange: () => void) {
  const latest = useRef(onChange);
  latest.current = onChange;
  useEffect(() => {
    if (!chatId) return;
    const channel = supabase
      .channel(`home-chat-${chatId}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "home_chat_messages", filter: `chat_id=eq.${chatId}` }, () => latest.current())
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [chatId]);
}

function when(iso: string) {
  return new Date(iso).toLocaleString("en-US", { timeZone: "America/Chicago", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function ChatThread(p: {
  propertyId: string;
  kind: ChatKind;
  canPost: boolean;
  /** Owner portal: no folders or files, the owner's own wording. */
  ownerSide?: boolean;
  people?: { id: string; name: string }[];
  /** "Make a Task" on a message (staff only). */
  onMakeTask?: (m: { id: string; body: string }) => void;
  /** Called after a message is sent (the Owner tab's green line). */
  onSent?: () => void;
  className?: string;
  maxHeight?: string;
}) {
  const qc = useQueryClient();
  const read = useServerFn(readHomeChatFn);
  const post = useServerFn(postHomeChatFn);
  const mark = useServerFn(markHomeChatReadFn);
  const openFile = useServerFn(chatAttachmentUrlFn);
  const q = useQuery({ queryKey: chatKey(p.propertyId, p.kind), queryFn: () => read({ data: { propertyId: p.propertyId, kind: p.kind } }) });
  const chatId = q.data?.chatId ?? null;
  useChatLive(chatId, () => void qc.invalidateQueries({ queryKey: chatKey(p.propertyId, p.kind) }));
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<{ document_id: string; name: string }[]>([]);
  const [folder, setFolder] = useState<ChatFolder | "">("");
  const [attaching, setAttaching] = useState(false);
  const [busy, setBusy] = useState(false);
  const bottom = useRef<HTMLDivElement | null>(null);
  const messages = q.data?.messages ?? [];
  const lastId = messages.at(-1)?.id;

  // Read marks: opening the thread, and each new message while it is open.
  useEffect(() => {
    if (!chatId || !lastId) return;
    void mark({ data: { chatId } }).then(() => void qc.invalidateQueries({ queryKey: ["home-chat-inbox"] })).catch(() => undefined);
    bottom.current?.scrollIntoView({ block: "end" });
  }, [chatId, lastId, mark, qc]);

  const begin = useServerFn(beginUploadFn);
  const complete = useServerFn(completeUploadFn);
  const folderRef = useRef(folder);
  folderRef.current = folder;
  const [upload] = useState(() =>
    createAttachmentUploader(begin, complete, (file, key) => ({
      entityType: "property" as const,
      entityId: p.propertyId,
      uploadKey: key,
      filename: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
      category: CHAT_FOLDERS.find((f) => f.id === folderRef.current)?.category ?? null,
    })),
  );
  const uploadNamed = async (file: File, progress: (v: number) => void, key: string) => ({ document_id: await upload(file, progress, key), name: file.name });

  const send = useMutation({
    mutationFn: () =>
      post({
        data: {
          propertyId: p.propertyId,
          kind: p.kind,
          body: body.trim(),
          attachments: folder ? files.map((f) => ({ ...f, folder })) : [],
          mentions: parseMentions(body, p.people ?? []),
        },
      }),
    onSuccess: () => {
      setBody("");
      setFiles([]);
      setAttaching(false);
      void qc.invalidateQueries({ queryKey: chatKey(p.propertyId, p.kind) });
      void qc.invalidateQueries({ queryKey: ["owner-tab", p.propertyId] });
      p.onSent?.();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const style = CHAT_STYLE[p.kind];
  const tone = CHAT_TONE[p.kind];
  const blockedFiles = files.length > 0 && !folder;
  const canSend = p.canPost && !send.isPending && !busy && !blockedFiles && (body.trim().length > 0 || files.length > 0);

  const ownReads = useMemo(() => q.data?.readMarks ?? [], [q.data]);
  return (
    <div className={cn("flex min-h-0 flex-col gap-3", p.className)}>
      <p className={cn("rounded-md border px-3 py-2 text-sm", tone.banner)}>{p.ownerSide ? "Messages with ARHA about this home." : style.banner}</p>
      {q.data && !q.data.staged ? (
        <p className="text-sm text-muted-foreground">Chat starts once it is switched on.</p>
      ) : null}
      <ol className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1" style={p.maxHeight ? { maxHeight: p.maxHeight } : undefined} aria-label={`${style.label} messages`}>
        {q.isPending ? <li className="text-sm text-muted-foreground">Loading messages…</li> : null}
        {!q.isPending && messages.length === 0 ? <li className="text-sm text-muted-foreground">No messages yet.</li> : null}
        {messages.map((m) => {
          const seen = m.mine && ownReads.some((r) => r.user_id !== m.author_id && r.last_read_at >= m.created_at);
          return (
            <li key={m.id} className={cn("flex flex-col", m.mine ? "items-end" : "items-start")}>
              <div className={cn("max-w-[85%] rounded-lg border px-3 py-2 text-sm", m.mine ? "border-brand-teal/30 bg-brand-teal/15" : "border-border bg-card")}>
                {m.body ? <p className="whitespace-pre-wrap break-words">{m.body}</p> : null}
                {m.attachments.length ? (
                  <ul className="mt-1 space-y-1">
                    {m.attachments.map((a) => (
                      <li key={a.document_id}>
                        <button
                          type="button"
                          className="inline-flex min-h-11 items-center gap-1 text-primary underline-offset-4 hover:underline"
                          onClick={async () => {
                            const w = window.open("", "_blank");
                            try {
                              const r = await openFile({ data: { messageId: m.id, documentId: a.document_id } });
                              if (w) w.location.href = r.url;
                            } catch (e) {
                              w?.close();
                              toast.error(e instanceof Error ? e.message : "Could not open the file.");
                            }
                          }}
                        >
                          <Paperclip className="size-3.5" aria-hidden="true" />
                          {a.name || "File"}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
              <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>
                  {m.authorName} · {when(m.created_at)}
                </span>
                {seen ? <span>Read</span> : null}
                {p.onMakeTask && !p.ownerSide ? (
                  <button type="button" className="min-h-11 text-primary hover:underline" onClick={() => p.onMakeTask?.({ id: m.id, body: m.body })}>
                    Make a Task
                  </button>
                ) : null}
              </p>
            </li>
          );
        })}
        <div ref={bottom} />
      </ol>
      {p.canPost ? (
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (canSend) send.mutate();
          }}
        >
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            maxLength={4000}
            placeholder={p.ownerSide ? "Write to ARHA" : p.kind === "team" ? "Write to the team. Type @ and a name to alert a teammate." : "Write to the owner"}
            aria-label="Message"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && canSend) send.mutate();
            }}
          />
          {attaching && !p.ownerSide ? (
            <div className="space-y-2 rounded-md border border-border p-2">
              <label className="block text-sm">
                <span className="text-xs text-muted-foreground">Save the files in</span>
                <select
                  className="mt-1 h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={folder}
                  onChange={(e) => setFolder(e.target.value as ChatFolder | "")}
                  aria-label="Folder for the files"
                >
                  <option value="">Pick a folder</option>
                  {CHAT_FOLDERS.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </label>
              {folder ? (
                <MultiFileUpload autoStart upload={uploadNamed} onBusyChange={setBusy} onResults={(r) => setFiles(r)} label="Add photos or files" />
              ) : (
                <p className="text-xs text-muted-foreground">Pick a folder first.</p>
              )}
            </div>
          ) : null}
          <div className="flex flex-wrap items-center justify-end gap-2">
            {!p.ownerSide ? (
              <Button type="button" variant="ghost" className="min-h-11" onClick={() => setAttaching((v) => !v)} aria-expanded={attaching}>
                <Paperclip className="size-4" aria-hidden="true" /> Attach
              </Button>
            ) : null}
            <Button type="submit" className={cn("min-h-11", tone.send)} disabled={!canSend}>
              Send
            </Button>
          </div>
        </form>
      ) : (
        <p className="text-sm text-muted-foreground">{p.kind === "owner" ? "You can read this chat. The home's team writes to the owner." : "You can read this chat."}</p>
      )}
    </div>
  );
}
