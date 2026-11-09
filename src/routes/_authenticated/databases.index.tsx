import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueries } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useRole } from "@/hooks/useRole";
import { useDemo } from "@/components/DemoProvider";
import { ModeChip } from "@/components/databases/DatabaseParts";
import {
  DATABASES_FOOTER,
  canReadList,
  hubGroups,
  normalize,
  resultsLine,
  searchEverything,
  databaseCard,
  type DatabaseCard,
  type DatabaseKey,
} from "@/lib/databases";
import { databaseQueryKey, hasStore, loadDatabase, loadPageHits, type PageHit } from "@/lib/databases-data";

export const Route = createFileRoute("/_authenticated/databases/")({
  head: () => ({
    meta: [
      { title: "Databases | ARHA Resolve" },
      { name: "description", content: "Everything we keep track of, in one place. Open one, or search them all." },
      { property: "og:title", content: "Databases | ARHA Resolve" },
      { property: "og:description", content: "Everything we keep track of, in one place. Open one, or search them all." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DatabasesHub,
});

function CardBody({ card }: { card: DatabaseCard & { mode: "edit" | "view" | "ops_finance" } }) {
  return (
    <>
      <span className="text-base font-bold text-foreground">{card.name}</span>
      <span className="text-[13px] text-muted-foreground">{card.former}</span>
      <span className="text-[13px] text-foreground/80">{card.about}</span>
      <span className="mt-auto pt-2">
        <ModeChip mode={card.mode} />
      </span>
    </>
  );
}

const CARD_CLASS =
  "flex min-h-[140px] flex-col items-start gap-1 rounded-[14px] border border-border bg-card p-4 text-left transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function DatabasesHub() {
  const { roles, seats, canOpen, isLoading } = useRole();
  const { demoMode, demoReady } = useDemo();
  const navigate = useNavigate();
  const [term, setTerm] = useState("");
  const viewer = { roles, seats };
  const groups = hubGroups(viewer);
  const searching = normalize(term).length > 0;

  // Search reads every list this person can open, plus homes and vendors by name.
  const listCards = groups.flatMap((g) => g.cards).filter((c) => !c.page && hasStore(c.key) && canReadList(c.key, viewer));
  const pageKeys = groups
    .flatMap((g) => g.cards)
    .filter((c) => (c.key === "properties" || c.key === "vendors") && c.mode !== "ops_finance")
    .map((c) => c.key as "properties" | "vendors");
  const ctx = { demo: demoMode, canOpen };
  const ready = searching && demoReady && !isLoading;
  const lists = useQueries({
    queries: listCards.map((c) => ({
      queryKey: databaseQueryKey(c.key, demoMode),
      queryFn: () => loadDatabase(c.key, ctx),
      enabled: ready,
      staleTime: 60_000,
    })),
  });
  const pages = useQueries({
    queries: [
      {
        queryKey: ["databases", "page-hits", pageKeys.join(","), demoMode],
        queryFn: () => loadPageHits(ctx, pageKeys),
        enabled: ready && pageKeys.length > 0,
        staleTime: 60_000,
      },
    ],
  });
  const loading = ready && (lists.some((q) => q.isPending) || (pageKeys.length > 0 && pages[0]!.isPending));

  const results = useMemo(() => {
    if (!searching) return [];
    const words = normalize(term).split(" ");
    const pageHits = ((pages[0]!.data ?? []) as PageHit[])
      .filter((h) => words.every((w) => normalize(`${h.label} ${h.sub}`).includes(w)))
      .slice(0, 25)
      .map((h) => ({ kind: "page" as const, hit: h }));
    const listHits = searchEverything(
      listCards.map((card, i) => ({ card, rows: lists[i]?.data?.rows ?? [] })),
      term,
    ).map((r) => ({ kind: "list" as const, hit: r }));
    return [...pageHits, ...listHits];
  }, [searching, term, pages, lists, listCards]);

  const openCard = (key: DatabaseKey) => {
    if (key === "properties") {
      if (canOpen("/properties")) void navigate({ to: "/properties", search: {} });
      else void navigate({ to: "/onboarding", search: { lens: "all" } });
    } else if (key === "vendors") void navigate({ to: "/vendors", search: {} });
    else if (key === "onboarding-projects") void navigate({ to: "/onboarding", search: {} });
    else void navigate({ to: "/databases/$key", params: { key }, search: {} });
  };

  if (isLoading) return <p role="status" className="p-6">Loading…</p>;

  return (
    <div data-db="hub" className="px-4 pb-16 pt-6 md:px-9 md:pt-7">
      <div className="flex max-w-[920px] flex-col gap-[18px]">
        <h1 className="m-0 text-3xl font-semibold">Databases</h1>
        <span className="text-[15px] text-muted-foreground">Everything we keep track of, in one place. Open one, or search them all.</span>
        <label className="flex flex-col gap-1 text-[13px] text-muted-foreground">
          Search every database
          <input
            type="text"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Try: Highpoint, Foxtail, ALE, refrigerator"
            className="h-12 rounded-[10px] border border-input bg-background px-3.5 text-[15px] text-foreground"
          />
        </label>

        {searching ? (
          <div className="overflow-hidden rounded-[14px] border border-primary">
            <div className="bg-primary/5 px-4 py-3 text-[15px] font-bold" role="status">
              {loading ? "Searching…" : resultsLine(results.length)}
            </div>
            {results.map((r) =>
              r.kind === "page" ? (
                <button
                  key={`${r.hit.key}:${r.hit.id}`}
                  type="button"
                  onClick={() =>
                    r.hit.key === "properties"
                      ? canOpen(`/property/${r.hit.id}`)
                        ? void navigate({ to: "/property/$propertyId", params: { propertyId: r.hit.id }, search: {} })
                        : void navigate({ to: "/onboarding/$propertyId", params: { propertyId: r.hit.id }, search: {} })
                      : void navigate({ to: "/vendors/$vendorId", params: { vendorId: r.hit.id } })
                  }
                  className="flex min-h-11 w-full flex-wrap items-center gap-x-3 gap-y-1 border-t border-border px-4 py-3 text-left hover:bg-muted/50"
                >
                  <ResultTag name={databaseCard(r.hit.key)!.name} />
                  <span className="text-[15px] font-bold">{r.hit.label}</span>
                  {r.hit.sub && <span className="w-full text-[13px] text-muted-foreground">{r.hit.sub}</span>}
                </button>
              ) : (
                <button
                  key={`${r.hit.key}:${r.hit.row.id}`}
                  type="button"
                  onClick={() => void navigate({ to: "/databases/$key", params: { key: r.hit.key }, search: { q: term.trim() } })}
                  className="flex min-h-11 w-full flex-wrap items-center gap-x-3 gap-y-1 border-t border-border px-4 py-3 text-left hover:bg-muted/50"
                >
                  <ResultTag name={r.hit.database} />
                  <span className="text-[15px] font-bold">{r.hit.label}</span>
                  {r.hit.sub && <span className="w-full text-[13px] text-muted-foreground">{r.hit.sub}</span>}
                </button>
              ),
            )}
          </div>
        ) : (
          groups.map((g) => (
            <section key={g.label} className="flex flex-col gap-3">
              <h2 className="m-0 text-lg font-semibold">{g.label}</h2>
              <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
                {g.cards.map((c) => (
                  <button key={c.key} type="button" className={CARD_CLASS} onClick={() => openCard(c.key)}>
                    <CardBody card={c} />
                  </button>
                ))}
              </div>
            </section>
          ))
        )}

        <span className="text-[13px] text-muted-foreground">{DATABASES_FOOTER}</span>
      </div>
    </div>
  );
}

function ResultTag({ name }: { name: string }) {
  return <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-bold text-foreground/80">{name}</span>;
}
