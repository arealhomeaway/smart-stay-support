import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Fragment, useMemo, useState } from "react";
import { useRole } from "@/hooks/useRole";
import { useDemo } from "@/components/DemoProvider";
import { BackToDatabases, DbLinkButton, ModeChip } from "@/components/databases/DatabaseParts";
import { TicketTabs } from "@/components/databases/TicketTabs";
import { ArrivalReadiness } from "@/components/databases/ArrivalReadiness";
import { canMoveToQueue } from "@/lib/ticket-tabs";
import { CLAIM_PIPELINE, CLAIM_STAGE_LABELS } from "@/lib/claims";
import {
  ALL,
  CLAIMS_EDIT_BAR,
  CLAIMS_TO_WORK_FILTER,
  CLAIMS_TO_WORK_OPTIONS,
  CLAIM_EDIT_FIELDS,
  DATABASES_NO_DELETE,
  HISTORICAL_FILTER,
  HISTORICAL_OPTIONS,
  PAGE_WORK,
  VIEW_ONLY_BAR,
  VIEW_ONLY_ROW,
  applyList,
  canEditInList,
  claimChanges,
  countLine,
  databaseCard,
  databaseMode,
  filterOptions,
  opsFinanceOnlyLine,
  rowLinkLabel,
  savedLine,
  type DatabaseCard,
  type DatabaseMode,
  type DbRow,
  CLAIM_PERIOD_FILTER,
  CLAIM_SORT_FILTER,
  CLAIM_SORT_OPTIONS,
  CLAIM_STATUS_FILTER,
  CLAIM_STATUS_OPTIONS,
  CLAIM_VIEW_DEFAULT,
  MONTH_NAMES,
  PERIOD_OPTIONS,
  applyClaimView,
  centralDay,
  claimTotals,
  claimTotalsLine,
  type ClaimSortChoice,
  type ClaimStatusChoice,
  type ClaimView,
  type PeriodKind,
} from "@/lib/databases";
import { databaseQueryKey, hasStore, loadDatabase, saveClaimOrRefund } from "@/lib/databases-data";

type ListSearch = { q?: string };

export const Route = createFileRoute("/_authenticated/databases/$key")({
  validateSearch: (raw: Record<string, unknown>): ListSearch =>
    typeof raw["q"] === "string" && raw["q"] ? { q: raw["q"] } : {},
  head: ({ params }) => {
    const name = databaseCard(params.key)?.name ?? "Database";
    const about = databaseCard(params.key)?.about ?? "A list kept in Resolve.";
    return {
      meta: [
        { title: `${name} | Databases | ARHA Resolve` },
        { name: "description", content: about },
        { property: "og:title", content: `${name} | Databases | ARHA Resolve` },
        { property: "og:description", content: about },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary" },
      ],
    };
  },
  component: DatabaseListPage,
});

function DatabaseListPage() {
  const { key } = Route.useParams();
  const { q } = Route.useSearch();
  const card = databaseCard(key);
  const { roles, seats, isLoading } = useRole();
  if (!card) return <Navigate to="/databases" />;
  if (isLoading) return <p role="status" className="p-6">Loading…</p>;
  if (card.page === "/properties") return <Navigate to="/properties" search={{}} />;
  if (card.page === "/vendors") return <Navigate to="/vendors" search={{}} />;
  if (card.page === "/onboarding") return <Navigate to="/onboarding" search={{}} />;
  const mode = databaseMode(card.key, { roles, seats });
  if (mode === "hidden") return <Navigate to="/databases" />;
  return <DatabaseList card={card} mode={mode} initialTerm={q ?? ""} />;
}

function DatabaseList({ card, mode, initialTerm }: { card: DatabaseCard; mode: Exclude<DatabaseMode, "hidden">; initialTerm: string }) {
  const { roles, seats, canOpen, readOnly, can } = useRole();
  const { demoMode, demoReady } = useDemo();
  const [term, setTerm] = useState(initialTerm);
  const [chosen, setChosen] = useState<Record<string, string>>({});
  const [open, setOpen] = useState<string | null>(null);
  const columns = card.columns ?? [];
  const readable = mode === "edit" || mode === "view";
  const editable = canEditInList(card.key, { roles, seats }) && !readOnly;

  const data = useQuery({
    queryKey: databaseQueryKey(card.key, demoMode),
    queryFn: () => loadDatabase(card.key, { demo: demoMode, canOpen }),
    enabled: readable && demoReady && hasStore(card.key),
    staleTime: 30_000,
  });
  const rows = data.data?.rows ?? [];
  const isClaims = card.key === "claims";
  // Tickets: tabs across the top with the same filters on each (Emily, Nov 9; register P3).
  const isTickets = card.key === "tickets";
  const [view, setView] = useState<ClaimView>(CLAIM_VIEW_DEFAULT);
  const shown = useMemo(() => {
    const listed = applyList(rows, columns, term, chosen);
    return isClaims ? applyClaimView(listed, view) : listed;
  }, [rows, columns, term, chosen, isClaims, view]);
  const totals = isClaims ? claimTotalsLine(claimTotals(shown)) : null;

  const filters: { name: string; options: readonly string[] }[] = [
    ...(card.filters ?? []).slice(0, 2).map((f) => ({ name: f, options: filterOptions(rows, columns, f) })),
    ...(card.key === "tickets"
      ? [
          { name: HISTORICAL_FILTER, options: HISTORICAL_OPTIONS },
          { name: CLAIMS_TO_WORK_FILTER, options: CLAIMS_TO_WORK_OPTIONS },
        ]
      : []),
  ];
  const workTo = PAGE_WORK[card.key];
  const showWork = mode === "edit" && workTo && card.work && canOpen(workTo);

  return (
    <div data-db="list" className="px-4 pb-16 pt-6 md:px-9 md:pt-7">
      <div className="flex max-w-[920px] flex-col gap-[18px]">
        <BackToDatabases />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h1 className="m-0 text-3xl font-semibold">{card.name}</h1>
            <span className="text-sm text-muted-foreground">{card.former}</span>
          </div>
          <ModeChip mode={mode} size="md" />
        </div>

        {mode === "ops_finance" ? (
          <div className="rounded-[14px] border border-dashed border-border p-7 text-[15px]">{opsFinanceOnlyLine(card)}</div>
        ) : (
          <>
            {editable ? (
              <div className="rounded-xl border border-warning/50 bg-warning/10 px-4 py-3 text-sm text-warning-ink">{CLAIMS_EDIT_BAR}</div>
            ) : (
              <div className="rounded-xl border border-border bg-muted px-4 py-3 text-sm">{VIEW_ONLY_BAR}</div>
            )}

            {showWork && workTo && (
              <DbLinkButton link={{ kind: "page", to: workTo }} tone="solid">
                {card.work}
              </DbLinkButton>
            )}

            {data.data?.tiles && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {data.data.tiles.map((t) => (
                  <div key={t.label} className="rounded-xl border border-border p-4">
                    <div className="text-sm text-muted-foreground">{t.label}</div>
                    <div className="text-3xl font-bold">{t.value}</div>
                  </div>
                ))}
              </div>
            )}

            {card.key === "arrival-readiness" ? (
              <ArrivalReadiness demoMode={demoMode} />
            ) : isTickets ? (
              data.error ? (
                <p role="alert" className="text-destructive">
                  This list could not be loaded. Try again in a moment.
                </p>
              ) : (
                <TicketTabs rows={rows} loading={data.isPending} canFixHome={can("audit_history") && !readOnly} demoMode={demoMode} canMoveToQueue={canMoveToQueue(seats, readOnly)} />
              )
            ) : (
            <>
            <div className="flex flex-col gap-3 rounded-[14px] border border-border p-3.5">
              <label className="flex flex-col gap-1 text-[13px] text-muted-foreground">
                Search {card.name}
                <input
                  type="text"
                  value={term}
                  onChange={(e) => setTerm(e.target.value)}
                  placeholder="Type to search"
                  className="h-11 rounded-lg border border-input bg-background px-3 text-[15px] text-foreground"
                />
              </label>
              {filters.length > 0 && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {filters.map((f) => (
                    <label key={f.name} className="flex flex-col gap-1 text-[13px] text-muted-foreground">
                      {f.name}
                      <select
                        value={chosen[f.name] ?? ALL}
                        onChange={(e) => setChosen((c) => ({ ...c, [f.name]: e.target.value }))}
                        className="h-11 rounded-lg border border-input bg-background px-3 text-[15px] text-foreground"
                      >
                        {f.options.map((o) => (
                          <option key={o} value={o}>
                            {o}
                          </option>
                        ))}
                      </select>
                    </label>
                  ))}
                  {isClaims && <ClaimViewControls view={view} onChange={setView} rows={rows} />}
                </div>
              )}
              <span className="text-[13px] text-muted-foreground" role="status">
                {data.isPending && hasStore(card.key) ? "Loading…" : countLine(shown.length, rows.length)}
              </span>
              {isClaims && !data.isPending && totals && (
                <span data-claim-totals className="text-sm font-semibold">
                  {totals}
                </span>
              )}
            </div>

            {data.error ? (
              <p role="alert" className="text-destructive">
                This list could not be loaded. Try again in a moment.
              </p>
            ) : !hasStore(card.key) || (!data.isPending && rows.length === 0) ? (
              <p className="rounded-[14px] border border-border p-6 text-[15px]">Nothing here yet.</p>
            ) : data.isPending ? null : shown.length === 0 ? (
              <p className="rounded-[14px] border border-border p-6 text-[15px]">Nothing matches.</p>
            ) : (
              <RecordTable
                card={card}
                mode={mode}
                columns={columns}
                rows={shown}
                open={open}
                onToggle={(id) => setOpen((o) => (o === id ? null : id))}
                editable={editable}
              />
            )}
            </>
            )}
          </>
        )}

        <span className="text-[13px] text-muted-foreground">{DATABASES_NO_DELETE}</span>
      </div>
    </div>
  );
}

const SELECT_CLASS = "h-11 rounded-lg border border-input bg-background px-3 text-[15px] text-foreground";
const LABEL_CLASS = "flex flex-col gap-1 text-[13px] text-muted-foreground";

/** Claims and refunds: Period and Status beside Type, and the opened date sort. */
function ClaimViewControls({ view, onChange, rows }: { view: ClaimView; onChange: (v: ClaimView) => void; rows: DbRow[] }) {
  const today = centralDay(new Date().toISOString())!;
  const thisYear = Number(today.slice(0, 4));
  const thisMonth = Number(today.slice(5, 7));
  // Every year a claim or refund was opened in, newest first, and always this year.
  const years = [
    ...new Set([thisYear, ...rows.map((r) => Number(centralDay(r.claim?.openedAt)?.slice(0, 4))).filter((y) => Number.isFinite(y) && y > 0)]),
  ].sort((a, b) => b - a);
  const p = view.period;
  return (
    <>
      <label className={LABEL_CLASS}>
        {CLAIM_PERIOD_FILTER}
        <select
          value={p.kind}
          onChange={(e) => {
            const kind = e.target.value as PeriodKind;
            onChange({
              ...view,
              period: kind === "month_of" ? { kind, year: thisYear, month: thisMonth } : kind === "range" ? { kind, from: "", to: "" } : { kind },
            });
          }}
          className={SELECT_CLASS}
        >
          {PERIOD_OPTIONS.map((o) => (
            <option key={o.kind} value={o.kind}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      <label className={LABEL_CLASS}>
        {CLAIM_STATUS_FILTER}
        <select
          value={view.status}
          onChange={(e) => onChange({ ...view, status: e.target.value as ClaimStatusChoice })}
          className={SELECT_CLASS}
        >
          {CLAIM_STATUS_OPTIONS.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </label>
      {p.kind === "month_of" && (
        <>
          <label className={LABEL_CLASS}>
            Month
            <select
              value={p.month ?? thisMonth}
              onChange={(e) => onChange({ ...view, period: { ...p, month: Number(e.target.value) } })}
              className={SELECT_CLASS}
            >
              {MONTH_NAMES.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
          </label>
          <label className={LABEL_CLASS}>
            Year
            <select
              value={p.year ?? thisYear}
              onChange={(e) => onChange({ ...view, period: { ...p, year: Number(e.target.value) } })}
              className={SELECT_CLASS}
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </label>
        </>
      )}
      {p.kind === "range" && (
        <>
          <label className={LABEL_CLASS}>
            From
            <input
              type="date"
              value={p.from ?? ""}
              onChange={(e) => onChange({ ...view, period: { ...p, from: e.target.value } })}
              className={SELECT_CLASS}
            />
          </label>
          <label className={LABEL_CLASS}>
            To
            <input
              type="date"
              value={p.to ?? ""}
              onChange={(e) => onChange({ ...view, period: { ...p, to: e.target.value } })}
              className={SELECT_CLASS}
            />
          </label>
        </>
      )}
      <label className={LABEL_CLASS}>
        {CLAIM_SORT_FILTER}
        <select
          value={view.sort}
          onChange={(e) => onChange({ ...view, sort: e.target.value as ClaimSortChoice })}
          className={SELECT_CLASS}
        >
          {CLAIM_SORT_OPTIONS.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </label>
    </>
  );
}

function RecordTable(props: {
  card: DatabaseCard;
  mode: Exclude<DatabaseMode, "hidden">;
  columns: string[];
  rows: DbRow[];
  open: string | null;
  onToggle: (id: string) => void;
  editable: boolean;
}) {
  const { columns, rows, open, onToggle } = props;
  const openButton = (r: DbRow) => (
    <button
      type="button"
      aria-expanded={open === r.id}
      onClick={() => onToggle(r.id)}
      className="inline-flex min-h-11 w-[70px] items-center justify-center rounded-lg border border-primary text-sm font-semibold text-primary hover:bg-primary/5"
    >
      {open === r.id ? "Close" : "Open"}
    </button>
  );
  return (
    <div className="overflow-hidden rounded-[14px] border border-border">
      {/* Wide screens: the table on the board. */}
      <table className="hidden w-full text-sm md:table">
        <thead className="bg-muted/60 text-left text-[13px] font-bold text-foreground/80">
          <tr>
            {columns.map((c) => (
              <th key={c} className="px-3 py-2.5">
                {c}
              </th>
            ))}
            <th className="w-[86px] px-3 py-2.5">
              <span className="sr-only">Open</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <Fragment key={r.id}>
              <tr className="border-t border-border align-middle">
                {r.cells.map((v, i) => (
                  <td key={i} className={i === 0 ? "px-3 py-2 font-semibold" : "px-3 py-2"}>
                    {v}
                  </td>
                ))}
                <td className="px-3 py-2">{openButton(r)}</td>
              </tr>
              {open === r.id && (
                <tr className="border-t border-border bg-muted/30">
                  <td colSpan={columns.length + 1} className="p-4">
                    <RecordDetail {...props} row={r} />
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
      {/* Phones: one card per record. */}
      <ul className="md:hidden">
        {rows.map((r) => (
          <li key={r.id} className="border-t border-border p-3 first:border-t-0">
            <div className="flex items-start justify-between gap-3">
              <dl className="grid min-w-0 flex-1 gap-1">
                {r.cells.map((v, i) =>
                  v ? (
                    <div key={i} className="min-w-0">
                      <dt className="text-xs text-muted-foreground">{columns[i]}</dt>
                      <dd className={i === 0 ? "break-words font-semibold" : "break-words text-sm"}>{v}</dd>
                    </div>
                  ) : null,
                )}
              </dl>
              {openButton(r)}
            </div>
            {open === r.id && (
              <div className="mt-3 rounded-lg bg-muted/30 p-3">
                <RecordDetail {...props} row={r} />
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function RecordDetail({ card, mode, columns, row, editable }: { card: DatabaseCard; mode: Exclude<DatabaseMode, "hidden">; columns: string[]; row: DbRow; editable: boolean }) {
  const qc = useQueryClient();
  const { demoMode } = useDemo();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const linkLabel = rowLinkLabel(card, mode);
  const canEdit = editable && Boolean(row.edit);

  const fields = [...columns.map((c, i) => ({ label: c, value: row.cells[i] ?? "" })), ...row.fields];

  const save = async () => {
    if (!row.edit) return;
    const { changes, error: problem } = claimChanges(row.edit, draft);
    if (problem) return setError(problem);
    if (!Object.keys(changes).length) {
      setEditing(false);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const { savedAt: at } = await saveClaimOrRefund(row.edit, changes);
      setSavedAt(at);
      setEditing(false);
      await qc.invalidateQueries({ queryKey: databaseQueryKey(card.key, demoMode) });
      await qc.invalidateQueries({ queryKey: databaseQueryKey("tickets", demoMode) });
      await qc.invalidateQueries({ queryKey: ["claims"] });
    } catch (e) {
      setError(e instanceof Error ? e.message : "This could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {editing && row.edit ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {CLAIM_EDIT_FIELDS[row.edit.kind].map((f) => {
            const value = draft[f.key] ?? "";
            const id = `db-${row.id}-${f.key}`;
            return (
              <label key={f.key} htmlFor={id} className="flex flex-col gap-1 text-xs text-muted-foreground">
                {f.label}
                {f.type === "stage" ? (
                  <select
                    id={id}
                    value={value}
                    onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
                    className="h-11 rounded-lg border border-input bg-background px-3 text-sm text-foreground"
                  >
                    {CLAIM_PIPELINE.map((s) => (
                      <option key={s} value={s}>
                        {CLAIM_STAGE_LABELS[s]}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    id={id}
                    type={f.type === "date" ? "date" : "text"}
                    inputMode={f.type === "money" ? "decimal" : undefined}
                    value={value}
                    onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
                    className="h-11 rounded-lg border border-input bg-background px-3 text-sm text-foreground"
                  />
                )}
              </label>
            );
          })}
        </div>
      ) : (
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {fields
            .filter((f) => f.value)
            .map((f, i) => (
              <div key={`${f.label}-${i}`} className="min-w-0">
                <dt className="text-xs text-muted-foreground">{f.label}</dt>
                <dd className="break-words text-sm">{f.value}</dd>
              </div>
            ))}
        </dl>
      )}

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {savedAt && !editing && <p className="text-xs text-success">{savedLine(savedAt)}</p>}

      <div className="flex flex-wrap gap-2">
        {canEdit && !editing && (
          <button
            type="button"
            onClick={() => {
              setDraft({ ...row.edit!.values });
              setError(null);
              setEditing(true);
            }}
            className="inline-flex min-h-11 items-center rounded-lg border border-primary px-4 text-sm font-semibold text-primary hover:bg-primary/5"
          >
            Edit
          </button>
        )}
        {editing && (
          <>
            <button
              type="button"
              disabled={saving}
              onClick={() => void save()}
              className="inline-flex min-h-11 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => {
                setEditing(false);
                setError(null);
              }}
              className="inline-flex min-h-11 items-center rounded-lg border border-border px-4 text-sm font-semibold hover:bg-muted"
            >
              Cancel
            </button>
          </>
        )}
        {!editing && row.link && linkLabel && <DbLinkButton link={row.link}>{linkLabel}</DbLinkButton>}
      </div>
      {mode === "view" && <p className="text-xs text-muted-foreground">{VIEW_ONLY_ROW}</p>}
    </div>
  );
}
