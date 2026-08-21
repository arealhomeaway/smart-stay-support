import { useEffect, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { Search } from "lucide-react";
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
 * Keyboard-first jump list across the destinations the signed-in person may
 * open. It never invents a destination: the caller passes the same authorised
 * navigation the sidebar renders.
 */
export function GlobalSearch({ targets }: { targets: SearchTarget[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

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
        <CommandInput placeholder="Jump to a section…" />
        <CommandList>
          <CommandEmpty>Nothing matches that.</CommandEmpty>
          {groups.map((group) => (
            <CommandGroup key={group} heading={group}>
              {targets
                .filter((t) => t.group === group)
                .map((t) => (
                  <CommandItem
                    key={t.to}
                    value={`${t.label} ${t.keywords ?? ""}`}
                    onSelect={() => {
                      setOpen(false);
                      void router.navigate({ to: t.to });
                    }}
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
