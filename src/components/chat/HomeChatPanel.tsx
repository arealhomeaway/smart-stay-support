/**
 * Property page Part 2 (2.2): the chat panel on one home, over the page from the right (about 440 px,
 * full screen on a phone). Two chats: With the owner (amber) and Team only (gray). Esc or Close hides it;
 * the page and its tab stay where they were.
 */
import { useEffect, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { MessageSquare, X } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { homeChatInboxFn, linkChatTaskFn } from "@/lib/owner-tab.functions";
import { CHAT_STYLE, type ChatKind } from "@/lib/owner-tab";
import { ChatThread, CHAT_TONE } from "./ChatThread";
import { cn } from "@/lib/utils";

/** Unread chats for the viewer (top bar Chats, the Chat button, the unread dots). Live on new messages. */
export function useHomeChatInbox() {
  const load = useServerFn(homeChatInboxFn);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["home-chat-inbox"], queryFn: () => load(), staleTime: 30_000 });
  const staged = q.data?.staged === true;
  useEffect(() => {
    if (!staged) return;
    const channel = supabase
      .channel(`home-chat-inbox-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "home_chat_messages" }, () => void qc.invalidateQueries({ queryKey: ["home-chat-inbox"] }))
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [staged, qc]);
  return q;
}

export function useHomeUnread(propertyId: string) {
  const q = useHomeChatInbox();
  const rows = (q.data?.rows ?? []).filter((r) => r.property_id === propertyId);
  const by = (k: ChatKind) => rows.find((r) => r.kind === k)?.unread ?? 0;
  return { owner: by("owner"), team: by("team"), total: by("owner") + by("team") };
}

export function ChatButton({ propertyId, onOpen }: { propertyId: string; onOpen: () => void }) {
  const unread = useHomeUnread(propertyId).total;
  return (
    <Button variant="outline" className="min-h-11 w-full gap-2 sm:w-auto" onClick={onOpen} aria-label={unread ? `Chat, ${unread} unread` : "Chat"}>
      <MessageSquare className="size-4" aria-hidden="true" />
      Chat
      {unread > 0 ? (
        <span className="numeric inline-flex min-w-5 items-center justify-center rounded-full bg-danger px-1.5 text-xs font-semibold text-danger-foreground">{unread}</span>
      ) : null}
    </Button>
  );
}

export function HomeChatPanel(p: {
  propertyId: string;
  homeName: string;
  open: boolean;
  kind: ChatKind;
  onKind: (k: ChatKind) => void;
  onClose: () => void;
  canPostOwner: boolean;
  canPostTeam: boolean;
  people: { id: string; name: string }[];
  /** Renders Add task (1.7) filled in with the message; calls back with the new Task id. */
  makeTask?: (input: { body: string; onAdded: (taskId: string) => void; onCancel: () => void }) => ReactNode;
}) {
  const unread = useHomeUnread(p.propertyId);
  const link = useServerFn(linkChatTaskFn);
  const [making, setMaking] = useState<{ id: string; body: string } | null>(null);
  const kinds: ChatKind[] = ["owner", "team"];
  return (
    <Sheet open={p.open} onOpenChange={(o) => (o ? undefined : p.onClose())}>
      <SheetContent side="right" className="flex h-dvh w-full flex-col gap-3 p-4 sm:max-w-[440px] [&>button.absolute]:hidden">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <SheetTitle className="truncate text-base">Chat · {p.homeName}</SheetTitle>
            <SheetDescription className="sr-only">Messages about this home</SheetDescription>
          </div>
          <Button variant="ghost" className="min-h-11 gap-1" onClick={p.onClose}>
            <X className="size-4" aria-hidden="true" /> Close
          </Button>
        </div>
        <div role="tablist" aria-label="Chats" className="grid grid-cols-2 gap-1 rounded-lg bg-muted/50 p-1">
          {kinds.map((k) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={p.kind === k}
              data-state={p.kind === k ? "active" : "inactive"}
              onClick={() => p.onKind(k)}
              className={cn("relative inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-3 text-sm font-medium text-muted-foreground", CHAT_TONE[k].tab, p.kind === k && "shadow-sm")}
            >
              {CHAT_STYLE[k].label}
              {unread[k] > 0 ? <span className="size-2 rounded-full bg-danger" aria-label="Unread" /> : null}
            </button>
          ))}
        </div>
        {making && p.makeTask ? (
          <div className="rounded-md border border-border p-2">
            {p.makeTask({
              body: making.body,
              onAdded: (taskId) => {
                void link({ data: { messageId: making.id, taskId } }).catch(() => undefined);
                setMaking(null);
              },
              onCancel: () => setMaking(null),
            })}
          </div>
        ) : null}
        <ChatThread
          key={p.kind}
          className="flex-1"
          propertyId={p.propertyId}
          kind={p.kind}
          canPost={p.kind === "owner" ? p.canPostOwner : p.canPostTeam}
          people={p.people}
          {...(p.makeTask ? { onMakeTask: (m: { id: string; body: string }) => setMaking(m) } : {})}
        />
      </SheetContent>
    </Sheet>
  );
}

/** Top bar "Chats" with a red count: every home with unread messages for the viewer, newest first. */
export function ChatsInbox() {
  const q = useHomeChatInbox();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const rows = q.data?.rows ?? [];
  if (!q.data?.staged) return null;
  const total = rows.reduce((n, r) => n + r.unread, 0);
  return (
    <>
      <Button variant="ghost" className="relative min-h-11 gap-1.5 px-2" onClick={() => setOpen(true)} aria-label={total ? `Chats, ${total} unread` : "Chats"}>
        <MessageSquare className="size-4" aria-hidden="true" />
        <span className="hidden sm:inline">Chats</span>
        {total > 0 ? <span className="numeric inline-flex min-w-5 items-center justify-center rounded-full bg-danger px-1.5 text-xs font-semibold text-danger-foreground">{total}</span> : null}
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full sm:max-w-[440px]">
          <SheetTitle>Chats</SheetTitle>
          <SheetDescription className="sr-only">Homes with unread messages</SheetDescription>
          {rows.length === 0 ? <p className="mt-4 text-sm text-muted-foreground">No unread messages.</p> : null}
          <ul className="mt-4 divide-y divide-border">
            {rows.map((r) => (
              <li key={`${r.property_id}-${r.kind}`}>
                <button
                  type="button"
                  className="flex min-h-14 w-full items-center gap-3 py-2 text-left hover:bg-muted/50"
                  onClick={() => {
                    setOpen(false);
                    void navigate({ to: "/onboarding/$propertyId", params: { propertyId: r.property_id }, search: { chat: r.kind } as never });
                  }}
                >
                  <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", r.kind === "owner" ? "bg-amber/20" : "bg-muted")}>{CHAT_STYLE[r.kind].label}</span>
                  <span className="min-w-0 flex-1 truncate font-medium">{r.home}</span>
                  <span className="numeric inline-flex min-w-5 items-center justify-center rounded-full bg-danger px-1.5 text-xs font-semibold text-danger-foreground">{r.unread}</span>
                </button>
              </li>
            ))}
          </ul>
        </SheetContent>
      </Sheet>
    </>
  );
}
