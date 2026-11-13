/**
 * Property page Part 2 (2.2): the owner portal's "Messages with ARHA", one chat per home. The owner
 * sees only their home's owner chat; the team chat is never returned to an owner.
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChatThread, chatKey } from "@/components/chat/ChatThread";
import { readHomeChatFn } from "@/lib/owner-tab.functions";
import { cn } from "@/lib/utils";

export function OwnerMessagesWithArha({ homes, preview }: { homes: { propertyId: string; name: string }[]; preview: boolean }) {
  const [sel, setSel] = useState(homes[0]?.propertyId ?? null);
  const read = useServerFn(readHomeChatFn);
  const current = homes.find((h) => h.propertyId === sel) ?? homes[0] ?? null;
  const probe = useQuery({
    queryKey: current ? chatKey(current.propertyId, "owner") : ["home-chat", "none"],
    enabled: Boolean(current),
    queryFn: () => read({ data: { propertyId: current!.propertyId, kind: "owner" } }),
  });
  if (!current || !probe.data?.staged) return null;
  return (
    <section className="surface space-y-3 p-4" aria-label="Messages with ARHA">
      <h2 className="font-display text-lg">Messages with ARHA</h2>
      {homes.length > 1 ? (
        <div className="flex flex-wrap gap-1" role="tablist" aria-label="Homes">
          {homes.map((h) => (
            <button
              key={h.propertyId}
              type="button"
              role="tab"
              aria-selected={h.propertyId === current.propertyId}
              onClick={() => setSel(h.propertyId)}
              className={cn("min-h-11 rounded-full border px-4 text-sm", h.propertyId === current.propertyId ? "border-primary bg-primary/10 font-medium" : "border-border")}
            >
              {h.name}
            </button>
          ))}
        </div>
      ) : null}
      <ChatThread key={current.propertyId} propertyId={current.propertyId} kind="owner" canPost={!preview} ownerSide maxHeight="24rem" />
    </section>
  );
}
