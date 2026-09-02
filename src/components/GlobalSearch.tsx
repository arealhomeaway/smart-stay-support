import { useEffect, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

export type SearchTarget = { to: string; label: string; group: string; keywords?: string };

/**
 * Search Resolve.
 *
 * Two things live here, and both are what the name promises: the destinations
 * the signed-in person may open, and the actual work — tickets by reference,
 * title or guest, and homes by name or address. Typing a ticket number should
 * open that ticket, not send the employee to a queue to search again.
 */
export function GlobalSearch({ targets }: { targets: SearchTarget[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const q = term.trim();
  const { data: records, isFetching } = useQuery({
    queryKey: ["global-search", q],
    enabled: open && q.length >= 2,
    staleTime: 15_000,
    queryFn: async () => {
      const like = `%${q}%`;
      const asRef = Number.parseInt(q.replace(/^#/, ""), 10);
      const ticketFilter = [
        `title.ilike.${like}`,
        `guest_name.ilike.${like}`,
        ...(Number.isFinite(asRef) ? [`ref.eq.${asRef}`] : []),
      ].join(",");

      const [tickets, properties] = await Promise.all([
        supabase
          .from("tickets")
          .select("id, ref, title, status, properties(name, nickname)")
          .is("archived_at", null)
          .or(ticketFilter)
          .order("reported_at", { ascending: false })
          .limit(6),
        supabase
          .from("properties")
          .select("id, name, nickname, address_line1, city")
          .or(`name.ilike.${like},nickname.ilike.${like},address_line1.ilike.${like}`)
          .limit(6),
      ]);

      return {
        tickets: tickets.data ?? [],
        properties: properties.data ?? [],
      };
    },
  });

  const go = (to: string) => {
    setOpen(false);
    setTerm("");
    void router.navigate({ to });
  };

  const groups = [...new Set(targets.map((t) => t.group))];

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="w-full justify-start gap-2 text-muted-foreground sm:w-64"
      >
        <Search className="size-4" aria-hidden="true" />
        <span className="truncate">Search Resolve</span>
        <kbd className="ml-auto hidden rounded border px-1.5 text-[0.65rem] sm:inline">⌘K</kbd>
      </Button>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          placeholder="Search tickets, homes and sections…"
          value={term}
          onValueChange={setTerm}
        />
        <CommandList>
          <CommandEmpty>{isFetching ? "Searching…" : "Nothing matches that."}</CommandEmpty>

          {(records?.tickets.length ?? 0) > 0 && (
            <CommandGroup heading="Tickets">
              {records?.tickets.map((t) => (
                <CommandItem
                  key={t.id}
                  value={`ticket ${t.ref} ${t.title}`}
                  onSelect={() => go(`/tickets/${t.id}`)}
                >
                  <span className="numeric mr-2 text-xs text-muted-foreground">#{t.ref}</span>
                  <span className="truncate">{t.title}</span>
                  <span className="ml-auto truncate pl-3 text-xs text-muted-foreground">
                    {t.properties?.nickname ?? t.properties?.name ?? ""}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {(records?.properties.length ?? 0) > 0 && (
            <CommandGroup heading="Homes">
              {records?.properties.map((p) => (
                <CommandItem
                  key={p.id}
                  value={`home ${p.nickname ?? ""} ${p.name} ${p.address_line1 ?? ""}`}
                  onSelect={() => go(`/property/${p.id}`)}
                >
                  <span className="truncate">{p.nickname ?? p.name}</span>
                  <span className="ml-auto truncate pl-3 text-xs text-muted-foreground">
                    {[p.address_line1, p.city].filter(Boolean).join(", ")}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {groups.map((group) => (
            <CommandGroup key={group} heading={group}>
              {targets
                .filter((t) => t.group === group)
                .map((t) => (
                  <CommandItem
                    key={t.to}
                    value={`${t.label} ${t.keywords ?? ""}`}
                    onSelect={() => go(t.to)}
                  >
                    {t.label}
                  </CommandItem>
                ))}
            </CommandGroup>
          ))}
        </CommandList>
      </CommandDialog>
    </>
  );
}
