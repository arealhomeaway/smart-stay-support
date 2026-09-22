import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, CircleDashed, FileCheck2, Gauge, KeyRound } from "lucide-react";
import { EmptyState, LoadingPage, PageHeader } from "@/components/ui/page";
import { StatusBadge } from "@/components/ui/status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UTILITY_STATUS_LABELS, type UtilityStatus } from "@/lib/onboarding-finance";
import { saveUtilityAccountFn } from "@/lib/onboarding-finance.functions";
import { utilitiesBoardFn } from "@/lib/onboarding-utilities.functions";
import {
  boardSummary,
  CORE_UTILITIES,
  filterUtilityBoard,
  UTILITY_BOARD_STATUSES,
  type PropertyUtilities,
  type UtilityCard,
} from "@/lib/onboarding-utilities";
import { usCalendarDate } from "@/lib/dates";

type Search = {
  status?: UtilityStatus | "all" | "outstanding";
  service?: string;
  find?: string;
  showTest?: boolean;
};

export const Route = createFileRoute("/_authenticated/onboarding/utilities")({
  head: () => ({
    meta: [
      { title: "Utilities & Accounts — Resolve" },
      {
        name: "description",
        content:
          "One dashboard for utility setup across every home in onboarding: providers, account numbers, meters, transfer dates, confirmations, logins and status for electric, gas, water, trash and internet.",
      },
      { property: "og:title", content: "Utilities & Accounts — Resolve" },
      {
        property: "og:description",
        content: "Set up and track every utility account across onboarding homes from one view.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  validateSearch: (raw: Record<string, unknown>): Search => {
    const out: Search = {};
    if (typeof raw["status"] === "string" && raw["status"]) out.status = raw["status"] as never;
    if (typeof raw["service"] === "string" && raw["service"]) out.service = raw["service"];
    if (typeof raw["find"] === "string" && raw["find"]) out.find = raw["find"];
    if (raw["showTest"] === true || raw["showTest"] === "true") out.showTest = true;
    return out;
  },
  component: UtilitiesBoard,
  errorComponent: () => (
    <p className="text-muted-foreground">The utilities dashboard could not be loaded.</p>
  ),
});

function UtilitiesBoard() {
  const load = useServerFn(utilitiesBoardFn);
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const set = (patch: Search) => {
    void navigate({ search: { ...search, ...patch }, replace: true });
  };

  const { data, isLoading } = useQuery({
    queryKey: ["utilities-board"],
    queryFn: () => load(),
  });

  const homes = useMemo(() => (data ?? []) as PropertyUtilities[], [data]);
  const shown = useMemo(
    () =>
      filterUtilityBoard(homes, {
        status: search.status ?? "all",
        utilityType: search.service ?? "all",
        ...(search.find ? { find: search.find } : {}),
        ...(search.showTest ? { showTest: true } : {}),
      }),
    [homes, search.status, search.service, search.find, search.showTest],
  );
  const summary = useMemo(
    () => boardSummary(homes.filter((h) => (search.showTest ? true : !h.isTest))),
    [homes, search.showTest],
  );
  const testCount = homes.filter((h) => h.isTest).length;

  if (isLoading) return <LoadingPage />;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Utilities & Accounts"
        description="Every utility account across the homes in onboarding — providers, numbers, meters, transfer dates and logins. Nothing else."
      />

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() =>
            set({ status: search.status === "outstanding" ? "all" : "outstanding" })
          }
          className={`chip ${
            search.status === "outstanding"
              ? "border-primary/40 bg-primary/10 text-foreground"
              : "border-amber/30 bg-amber/10 text-amber"
          }`}
        >
          Still to set up · {summary.outstanding}
        </button>
        {summary.byStatus.map((s) => (
          <button
            key={s.status}
            type="button"
            onClick={() => set({ status: search.status === s.status ? "all" : s.status })}
            className={`chip ${
              search.status === s.status
                ? "border-primary/40 bg-primary/10 text-foreground"
                : "border-cool-grey/25 bg-cool-grey/10 text-cool-grey"
            }`}
          >
            {s.label} · {s.count}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <Input
          value={search.find ?? ""}
          onChange={(e) => set({ find: e.target.value })}
          placeholder="Find a home or provider"
          className="w-56"
          aria-label="Find a home or provider"
        />
        <Select value={search.service ?? "all"} onValueChange={(v) => set({ service: v })}>
          <SelectTrigger className="w-48" aria-label="Service">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Every service</SelectItem>
            {CORE_UTILITIES.map((t) => (
              <SelectItem key={t} value={t}>
                {SERVICE_LABEL[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {testCount > 0 && (
          <button
            type="button"
            className="chip border-cool-grey/25 bg-cool-grey/10 text-cool-grey"
            onClick={() => set({ showTest: !search.showTest })}
          >
            {search.showTest ? "Hide" : "Show"} {testCount} test home(s)
          </button>
        )}
      </div>

      {shown.length === 0 ? (
        <EmptyState
          title="Nothing to set up here"
          hint="No utility account matches this view."
        />
      ) : (
        <div className="space-y-5">
          {shown.map((home) => (
            <HomeSection key={home.property.id} home={home} />
          ))}
        </div>
      )}
    </div>
  );
}

const SERVICE_LABEL: Record<string, string> = {
  electric: "Electric",
  gas: "Gas",
  water_sewer: "Water / sewer",
  trash: "Trash",
  internet: "Internet",
};

function HomeSection({ home }: { home: PropertyUtilities }) {
  return (
    <section className="surface p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-base font-semibold tracking-tight">{home.title}</h2>
        {home.location && <span className="text-sm text-muted-foreground">{home.location}</span>}
        <StatusBadge tone={home.outstanding === 0 ? "resolved" : "waiting"}>
          {home.outstanding === 0
            ? "All services handled"
            : `${home.outstanding} still to set up`}
        </StatusBadge>
        <Link
          to="/onboarding/$propertyId"
          params={{ propertyId: home.property.id }}
          className="ml-auto text-sm font-medium text-primary hover:underline"
        >
          Open the project
        </Link>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {home.cards.map((card) => (
          <UtilityCardView key={card.key} card={card} />
        ))}
      </div>
    </section>
  );
}

function UtilityCardView({ card }: { card: UtilityCard }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({
    provider: card.provider ?? "",
    accountLabel: card.accountNumber ?? "",
    serviceStartOn: card.transferDate ?? "",
    notes: card.setupNotes ?? "",
  });

  const save = useMutation({
    mutationFn: useServerFn(saveUtilityAccountFn),
    onSuccess: () => {
      toast.success("Utility updated.");
      void queryClient.invalidateQueries({ queryKey: ["utilities-board"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const submit = (status: string, extra?: Partial<typeof draft>) => {
    const next = { ...draft, ...extra };
    save.mutate({
      data: {
        ...(card.account ? { id: card.account.id } : {}),
        propertyId: card.propertyId,
        utilityType: card.utilityType,
        provider: next.provider,
        accountLabel: next.accountLabel,
        status,
        responsible: card.responsible,
        serviceStartOn: next.serviceStartOn || null,
        notes: next.notes || null,
      },
    } as never);
  };

  return (
    <article className="rounded-xl border border-border/70 bg-card p-3 shadow-card">
      <div className="flex items-center gap-2">
        {card.outstanding ? (
          <CircleDashed className="size-4 shrink-0 text-amber" />
        ) : (
          <CheckCircle2 className="size-4 shrink-0 text-emerald" />
        )}
        <h3 className="text-sm font-semibold">{card.typeLabel}</h3>
        <span className="ml-auto text-xs text-muted-foreground">
          {card.responsible === "arha" ? "ARHA" : card.responsible === "owner" ? "Owner" : "HOA"}
        </span>
      </div>

      <dl className="mt-2 space-y-1 text-sm">
        <Line label="Provider" value={card.provider} />
        <Line label="Account #" value={card.accountNumber} />
        <Line
          label="Transfer date"
          value={card.transferDate ? usCalendarDate(card.transferDate) : null}
        />
      </dl>

      {card.setupNotes && (
        <p className="mt-2 whitespace-pre-wrap text-xs text-muted-foreground">{card.setupNotes}</p>
      )}

      <div className="mt-2 space-y-1 text-xs text-muted-foreground">
        {card.credential && (
          <p className="flex items-center gap-1.5">
            <KeyRound className="size-3.5" aria-hidden />
            {card.credential.label}
            {card.credential.username ? ` · ${card.credential.username}` : ""}
          </p>
        )}
        {card.meters.map((m) => (
          <p key={m.id} className="flex items-center gap-1.5">
            <Gauge className="size-3.5" aria-hidden />
            {m.name}
            {m.location ? ` · ${m.location}` : ""}
          </p>
        ))}
        {card.documents.map((d) => (
          <p key={d.id} className="flex items-center gap-1.5">
            <FileCheck2 className="size-3.5" aria-hidden />
            {d.title}
          </p>
        ))}
      </div>

      <div className="mt-3 flex items-center gap-2">
        <Select value={card.status} onValueChange={(v) => submit(v)} disabled={save.isPending}>
          <SelectTrigger className="h-9 w-full" aria-label={`${card.typeLabel} status`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {UTILITY_BOARD_STATUSES.map((status) => (
              <SelectItem key={status} value={status}>
                {UTILITY_STATUS_LABELS[status]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          {open ? "Close" : "Details"}
        </Button>
      </div>

      {open && (
        <div className="mt-3 space-y-2 border-t pt-3">
          <Field label="Provider">
            <Input
              value={draft.provider}
              onChange={(e) => setDraft({ ...draft, provider: e.target.value })}
            />
          </Field>
          <Field label="Account number">
            <Input
              value={draft.accountLabel}
              onChange={(e) => setDraft({ ...draft, accountLabel: e.target.value })}
            />
          </Field>
          <Field label="Transfer date">
            <Input
              type="date"
              value={draft.serviceStartOn}
              onChange={(e) => setDraft({ ...draft, serviceStartOn: e.target.value })}
            />
          </Field>
          <Field label="Setup notes">
            <Input
              value={draft.notes}
              onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
              placeholder="Meter location, confirmation number, who to call"
            />
          </Field>
          <Button size="sm" disabled={save.isPending} onClick={() => submit(card.status)}>
            Save
          </Button>
        </div>
      )}
    </article>
  );
}

function Line({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex gap-2">
      <dt className="w-24 shrink-0 text-xs text-muted-foreground">{label}</dt>
      <dd className={value ? "break-words" : "text-muted-foreground"}>{value ?? "Not recorded"}</dd>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}
