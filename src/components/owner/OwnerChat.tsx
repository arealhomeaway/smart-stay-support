/**
 * Homeowner portal "Chat with ARHA" (approved mockup, Nov 16): the top bar button with the unread
 * count, and the right-hand panel. The conversation is the existing home chat (kind owner) through
 * ChatThread, the same chat the team sees as "With the owner". One conversation per home.
 */
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ChatThread } from "@/components/chat/ChatThread";
import { homeChatInboxFn } from "@/lib/owner-tab.functions";
import { ownerChatPanel, ownerUnread, useOwnerChatPanel } from "@/lib/owner-chat-panel";
import { cn } from "@/lib/utils";

export function OwnerChatButton() {
  const s = useOwnerChatPanel();
  const load = useServerFn(homeChatInboxFn);
  const inbox = useQuery({ queryKey: ["home-chat-inbox"], queryFn: () => load(), staleTime: 30_000, enabled: s.homes.length > 0 });
  if (s.homes.length === 0) return null;
  const unread = ownerUnread(inbox.data?.rows ?? [], s.homes);
  return (
    <Button
      type="button"
      variant="outline"
      className="relative min-h-11 border-portal-primary text-portal-primary hover:bg-portal-primary/10 hover:text-portal-primary"
      onClick={() => ownerChatPanel.open()}
      aria-label={unread > 0 ? `Chat with ARHA, ${unread} unread` : "Chat with ARHA"}
    >
      <MessageCircle className="size-4" aria-hidden="true" />
      <span>Chat with ARHA</span>
      {unread > 0 ? (
        <span className="numeric ml-1 inline-flex min-w-5 items-center justify-center rounded-full bg-portal-badge px-1.5 text-xs font-semibold text-portal-badge-foreground">
          {unread}
        </span>
      ) : null}
    </Button>
  );
}

export function OwnerChatPanel() {
  const s = useOwnerChatPanel();
  const current = s.homes.find((h) => h.propertyId === s.selected) ?? null;
  const multi = s.homes.length > 1;
  return (
    <Sheet open={s.open} onOpenChange={(v) => (v ? ownerChatPanel.open() : ownerChatPanel.close())}>
      <SheetContent side="right" className="flex w-full max-w-none flex-col gap-0 p-0 sm:max-w-[440px] [&>button.absolute]:hidden">
        <SheetHeader className="space-y-1 border-b border-portal-border px-5 pb-4 pt-5 text-left">
          <div className="flex items-start justify-between gap-3">
            <SheetTitle className="font-display text-2xl font-normal text-portal-ink">Chat with ARHA</SheetTitle>
            <Button type="button" variant="ghost" className="min-h-11 text-portal-primary" onClick={() => ownerChatPanel.close()}>
              Close
            </Button>
          </div>
          <SheetDescription className="text-left text-portal-muted">
            {current ? `${current.name} · your Onboarding and Operations team` : "Your Onboarding and Operations team"}
          </SheetDescription>
          {multi ? (
            <div className="flex flex-wrap gap-2 pt-2" role="tablist" aria-label="Your homes">
              {s.homes.map((h) => (
                <button
                  key={h.propertyId}
                  type="button"
                  role="tab"
                  aria-selected={h.propertyId === current?.propertyId}
                  onClick={() => ownerChatPanel.select(h.propertyId)}
                  className={cn(
                    "min-h-11 rounded-full border px-4 text-sm",
                    h.propertyId === current?.propertyId ? "border-portal-primary bg-portal-primary text-portal-primary-foreground" : "border-portal-border text-portal-ink",
                  )}
                >
                  {h.name}
                </button>
              ))}
            </div>
          ) : null}
        </SheetHeader>
        <div className="flex min-h-0 flex-1 flex-col px-5 py-4">
          {current ? (
            <ChatThread
              key={current.propertyId}
              propertyId={current.propertyId}
              kind="owner"
              canPost={s.canPost}
              ownerSide
              lockedComposer
              hideBanner
              placeholder="Message"
              className="min-h-0 flex-1"
            />
          ) : (
            <p className="text-sm text-portal-muted">Pick a home first.</p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
