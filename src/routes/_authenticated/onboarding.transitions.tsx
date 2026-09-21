import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo } from "react";
import { CheckCircle2, CircleDashed } from "lucide-react";
import { EmptyState, LoadingPage, PageHeader } from "@/components/ui/page";
import { StatusBadge } from "@/components/ui/status";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { transitionQueueFn } from "@/lib/transition-readiness.functions";
import {
  countByHolder,
  filterQueue,
  HOLDER_LABEL,
  HOLDERS,
  TRANSITION_LABEL,
  type Holder,
  type TransitionItem,
  type TransitionKind,
} from "@/lib/transition-readiness";

type Search = {
  kind?: TransitionKind | "all";
  holder?: Holder | "all";
  state?: "all" | "ready" | "blocked";
  find?: string;
  showTest?: boolean;
};

export const Route = createFileRoute("/_authenticated/onboarding/transitions")({
  head: () => ({
    meta: [
      { title: "Transitions — Resolve" },
      {
        name: "description",
        content:
          "One queue for every home moving into Operations and every homeowner moving into the Active Owner program, with the readiness gates each one still has to clear.",
      },
      { property: "og:title", content: "Transitions — Resolve" },
      {
        property: "og:description",
        content: "Readiness gates and handoff queue in one place, filtered by who is holding it up.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  validateSearch: (raw: Record<string, unknown>): Search => {
    const out: Search = {};
    if (typeof raw["kind"] === "string" && raw["kind"]) out.kind = raw["kind"] as Search["kind"];
    if (typeof raw["holder"] === "string" && raw["holder"])
      out.holder = raw["holder"] as Search["holder"];
    if (typeof raw["state"] === "string" && raw["state"])
      out.state = raw["state"] as Search["state"];
    if (typeof raw["find"] === "string" && raw["find"]) out.find = raw["find"];
    if (raw["showTest"] === true || raw["showTest"] === "true") out.showTest = true;
    return out;
  },
  component: Transitions,
  errorComponent: () => (
    <p className="text-muted-foreground">The transition queue could not be loaded.</p>
  ),
});

function Transitions() {
  const load = useServerFn(transitionQueueFn);
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const set = (patch: Search) => {
    void navigate({ search: { ...search, ...patch }, replace: true });
  };

  const { data, isLoading } = useQuery({
    queryKey: ["transition-queue"],
    queryFn: () => load(),
  });

  const all = useMemo(
    () => (data ?? []).filter((i) => (search.showTest ? true : !i.isTest)),
    [data, search.showTest],
  );
  const shown = useMemo(
    () =>
      filterQueue(all, {
        kind: search.kind ?? "all",
        holder: search.holder ?? "all",
        state: search.state ?? "all",
        ...(search.find ? { find: search.find } : {}),
      }),
    [all, search.kind, search.holder, search.state, search.find],
  );
  const holders = useMemo(() => countByHolder(all), [all]);
  const testCount = (data ?? []).filter((i) => i.isTest).length;

  if (isLoading) return <LoadingPage />;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Transitions"
        description="Every home moving into Operations and every homeowner moving into the Active Owner program, with what each one is still waiting on."
      />

      <div className="flex flex-wrap items-center gap-2">
        {holders.map((h) => (
          <button
            key={h.holder}
            type="button"
            onClick={() => set({ holder: search.holder === h.holder ? "all" : h.holder })}
            className={`chip ${
              search.holder === h.holder
                ? "border-primary/40 bg-primary/10 text-foreground"
                : "border-cool-grey/25 bg-cool-grey/10 text-cool-grey"
            }`}
          >
            {HOLDER_LABEL[h.holder]} · {h.count}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <Input
          value={search.find ?? ""}
          onChange={(e) => set({ find: e.target.value })}
          placeholder="Find a home or homeowner"
          className="w-56"
          aria-label="Find a home or homeowner"
        />
        <Select value={search.kind ?? "all"} onValueChange={(v) => set({ kind: v as never })}>
          <SelectTrigger className="w-56" aria-label="Transition">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Both transitions</SelectItem>
            <SelectItem value="home_to_operations">
              {TRANSITION_LABEL.home_to_operations}
            </SelectItem>
            <SelectItem value="owner_to_active">{TRANSITION_LABEL.owner_to_active}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={search.holder ?? "all"} onValueChange={(v) => set({ holder: v as never })}>
          <SelectTrigger className="w-52" aria-label="Waiting on">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Anyone</SelectItem>
            {HOLDERS.map((h) => (
              <SelectItem key={h} value={h}>
                {HOLDER_LABEL[h]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={search.state ?? "all"} onValueChange={(v) => set({ state: v as never })}>
          <SelectTrigger className="w-44" aria-label="State">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Everything</SelectItem>
            <SelectItem value="blocked">Still blocked</SelectItem>
            <SelectItem value="ready">Cleared</SelectItem>
          </SelectContent>
        </Select>
        {testCount > 0 && (
          <button
            type="button"
            className="chip border-cool-grey/25 bg-cool-grey/10 text-cool-grey"
            onClick={() => set({ showTest: !search.showTest })}
          >
            {search.showTest ? "Hide" : "Show"} {testCount} test record(s)
          </button>
        )}
      </div>

      {shown.length === 0 ? (
        <EmptyState title="Nothing in transition" description="No record matches this view." />
      ) : (
        <ul className="space-y-3">
          {shown.map((item) => (
            <QueueCard key={item.id} item={item} />
          ))}
        </ul>
      )}
    </div>
  );
}

function QueueCard({ item }: { item: TransitionItem }) {
  const cleared = item.gates.length - item.openGates.length;
  return (
    <li className="surface p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-base font-semibold tracking-tight">{item.title}</h3>
        <span className="chip border-cool-grey/25 bg-cool-grey/10 text-cool-grey">
          {TRANSITION_LABEL[item.kind]}
        </span>
        <StatusBadge tone={item.ready ? "resolved" : "waiting"}>
          {item.ready ? "Cleared" : `Waiting on ${HOLDER_LABEL[item.holder!]}`}
        </StatusBadge>
        <span className="ml-auto text-xs text-muted-foreground">
          {cleared} of {item.gates.length} gates cleared
        </span>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        {item.subtitle} · Next: {item.stage}
      </p>

      <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
        {item.gates.map((g) => (
          <li key={g.key} className="flex items-start gap-2 text-sm">
            {g.passed ? (
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald" />
            ) : (
              <CircleDashed className="mt-0.5 size-4 shrink-0 text-amber" />
            )}
            <span className={g.passed ? "text-muted-foreground" : ""}>
              <span className="font-medium">{g.label}</span>
              {!g.passed && <span className="block text-xs text-muted-foreground">{g.detail}</span>}
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-3 flex flex-wrap gap-3 text-sm">
        {item.propertyId && item.kind === "home_to_operations" && (
          <Link
            to="/onboarding/$propertyId"
            params={{ propertyId: item.propertyId }}
            className="font-medium text-primary hover:underline"
          >
            Open the project
          </Link>
        )}
        {item.propertyId && (
          <Link
            to="/property/$propertyId"
            params={{ propertyId: item.propertyId }}
            className="font-medium text-primary hover:underline"
          >
            Open the home
          </Link>
        )}
        {item.kind === "owner_to_active" && (
          <Link to="/owner-programs" className="font-medium text-primary hover:underline">
            Open owner programs
          </Link>
        )}
      </div>
    </li>
  );
}
