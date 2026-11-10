/**
 * Onboarding Home, as on the "Onboarding Home" board (register O1, Emily Nov 10):
 * banner, Today for me, Needs you now, homes in onboarding with Notion's five
 * views, and upcoming handoffs. Every view lists the same homes.
 */
import { Link } from "@tanstack/react-router";
import { ArrowRight, ClipboardList, Plus } from "lucide-react";
import type { ReactNode } from "react";
import { PageHero, SectionCard } from "@/components/ui/page";
import { PropertyPhoto } from "@/components/PropertyPhoto";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import {
  byStatus,
  daysBetween,
  dueLabel,
  ganttScale,
  handoffLabel,
  NOT_SET,
  shortDate,
  shown,
  workload,
  type HealthLevel,
  type Stepper,
} from "@/lib/onboarding-board";
import { HealthDot, StageBar } from "./BoardParts";

export type BoardView = "gallery" | "active" | "status" | "gantt" | "workload";
export const BOARD_VIEWS: { value: BoardView; label: string }[] = [
  { value: "gallery", label: "Gallery" },
  { value: "active", label: "Active Projects" },
  { value: "status", label: "By Status" },
  { value: "gantt", label: "Gantt" },
  { value: "workload", label: "Work Load" },
];

export type BoardHome = {
  propertyId: string;
  address: string;
  city: string;
  photo: string | null;
  stepper: Stepper;
  ownerType: string | null;
  greaterArea: string | null;
  pmaStatus: string | null;
  invoiceStatus: string | null;
  status: string | null;
  projectManager: string | null;
  closingOn: string | null;
  estimateOn: string | null;
  committedOn: string | null;
  handoffOn: string | null;
  health: { level: HealthLevel; label: string; reason: string | null; line: string };
};

export type TodayRow = {
  id: string;
  title: string;
  label: string;
  canTick: boolean;
};
export type TodayHome = { propertyId: string; address: string; stage: string; rows: TodayRow[] };
export type NeedRow = { key: string; title: string; why: string; propertyId: string };

type Props = {
  today: string;
  dateLine: string;
  greeting: string;
  banner: { photo: string; caption: string } | null;
  fallbackImage: string;
  onBannerError: () => void;
  addHome: ReactNode;
  countLine: string;
  todayHomes: TodayHome[];
  onTick: (taskId: string) => void;
  ticking: boolean;
  needs: NeedRow[];
  homes: BoardHome[];
  view: BoardView;
  onViewChange: (v: BoardView) => void;
  originToken?: string | undefined;
};

const btnLight =
  "inline-flex h-11 items-center gap-2 rounded-lg border border-white/40 bg-white/10 px-5 text-base font-medium text-white backdrop-blur transition-colors hover:bg-white/20";

export function OnboardingBoardHome(p: Props) {
  const homeLink = (propertyId: string, children: ReactNode, className?: string) => (
    <Link
      to="/onboarding/$propertyId"
      params={{ propertyId }}
      search={(p.originToken ? { from: p.originToken } : undefined) as never}
      className={className}
    >
      {children}
    </Link>
  );
  const upcoming = p.homes
    .filter((h) => h.handoffOn && daysBetween(p.today, h.handoffOn) >= 0 && daysBetween(p.today, h.handoffOn) <= 30)
    .sort((a, b) => (a.handoffOn ?? "").localeCompare(b.handoffOn ?? ""));

  return (
    <div className="space-y-6">
      <PageHero
        image={p.banner?.photo ?? p.fallbackImage}
        imageCaption={p.banner?.caption}
        onImageError={p.onBannerError}
        eyebrow={p.dateLine}
        title={p.greeting}
        description="From keys to kickoff."
        actions={
          <>
            {p.addHome}
            <Link to="/onboarding/my-work" search={{ who: "me" } as never} className={btnLight}>
              <ClipboardList className="size-4" /> My tasks
            </Link>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="Today, for me" description={p.countLine} bodyClassName="space-y-4">
          {p.todayHomes.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing due today. You are clear.</p>
          ) : (
            p.todayHomes.map((h) => (
              <section key={h.propertyId} aria-label={h.address} className="space-y-1.5">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  {homeLink(h.propertyId, h.address, "text-sm font-semibold hover:underline")}
                  <span className="text-xs text-muted-foreground">{h.stage}</span>
                </div>
                <ul className="divide-y divide-border rounded-md border border-border">
                  {h.rows.map((r) => (
                    <li key={r.id} className="flex min-h-11 items-center gap-3 px-2 py-1.5 text-sm">
                      <span className="flex size-11 shrink-0 items-center justify-center">
                        {r.canTick ? (
                          <Checkbox
                            aria-label={`Mark "${r.title}" done`}
                            disabled={p.ticking}
                            className="size-5"
                            onCheckedChange={(v) => {
                              if (v) p.onTick(r.id);
                            }}
                          />
                        ) : null}
                      </span>
                      <Link
                        to="/onboarding/my-work"
                        search={{ who: "me", task: r.id } as never}
                        className="min-w-0 flex-1 truncate hover:underline"
                      >
                        {r.title}
                      </Link>
                      <span
                        className={cn(
                          "numeric shrink-0 text-xs",
                          r.label.startsWith("Overdue") ? "font-medium text-state-blocked" : "text-muted-foreground",
                        )}
                      >
                        {r.label}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ))
          )}
        </SectionCard>

        <SectionCard title="Needs you now" bodyClassName="space-y-1.5">
          {p.needs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing needs you right now.</p>
          ) : (
            p.needs.map((n) =>
              homeLink(
                n.propertyId,
                <>
                  <span className="block font-medium">{n.title}</span>
                  <span className="block text-xs text-muted-foreground">{n.why}</span>
                </>,
                "block min-h-11 rounded-md border px-3 py-2 text-sm transition hover:bg-muted/40",
              ),
            )
          )}
        </SectionCard>
      </div>

      <SectionCard
        title="Homes in onboarding"
        description={`${p.homes.length} home${p.homes.length === 1 ? "" : "s"}`}
        bodyClassName="space-y-4"
      >
        <div role="tablist" aria-label="Views" className="flex flex-wrap gap-2">
          {BOARD_VIEWS.map((v) => (
            <button
              key={v.value}
              type="button"
              role="tab"
              aria-selected={p.view === v.value}
              onClick={() => p.onViewChange(v.value)}
              className={cn(
                "min-h-11 rounded-full border px-4 text-sm font-medium transition-colors",
                p.view === v.value ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted",
              )}
            >
              {v.label}
            </button>
          ))}
        </div>
        {p.homes.length === 0 ? (
          <p className="text-sm text-muted-foreground">No homes in onboarding right now.</p>
        ) : p.view === "gallery" ? (
          <Gallery homes={p.homes} today={p.today} homeLink={homeLink} />
        ) : p.view === "active" ? (
          <ActiveProjects homes={p.homes} homeLink={homeLink} />
        ) : p.view === "status" ? (
          <ByStatus homes={p.homes} today={p.today} homeLink={homeLink} />
        ) : p.view === "gantt" ? (
          <Gantt homes={p.homes} today={p.today} homeLink={homeLink} />
        ) : (
          <WorkLoad homes={p.homes} />
        )}
      </SectionCard>

      <SectionCard title="Upcoming handoffs" bodyClassName="space-y-1">
        {upcoming.length === 0 ? (
          <p className="text-sm text-muted-foreground">No handoffs in the next 30 days.</p>
        ) : (
          <ul className="divide-y divide-border">
            {upcoming.map((h) => (
              <li key={h.propertyId} className="flex min-h-11 items-center justify-between gap-3 py-2 text-sm">
                {homeLink(h.propertyId, h.address, "min-w-0 truncate font-medium hover:underline")}
                <span className="numeric shrink-0 text-muted-foreground">{handoffLabel(h.handoffOn, p.today)}</span>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}

type LinkFn = (propertyId: string, children: ReactNode, className?: string) => ReactNode;

function daysToHandoff(h: BoardHome, today: string) {
  if (!h.handoffOn) return "No handoff date";
  const d = daysBetween(today, h.handoffOn);
  if (d === 0) return "Handoff today";
  if (d > 0) return `${d} day${d === 1 ? "" : "s"} to handoff`;
  return `Handoff ${handoffLabel(h.handoffOn, today).toLowerCase()}`;
}

function Gallery({ homes, today, homeLink }: { homes: BoardHome[]; today: string; homeLink: LinkFn }) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-label="Gallery">
      {homes.map((h) => (
        <li key={h.propertyId} className="overflow-hidden rounded-xl border border-border bg-card">
          {homeLink(
            h.propertyId,
            <>
              <div className="relative aspect-[16/9] bg-sunken">
                <PropertyPhoto url={h.photo} name={h.address} rounded="rounded-none" className="size-full object-cover" />
                <span className="absolute left-2 top-2 rounded-full bg-background/90 px-2.5 py-1 text-xs font-medium">
                  {h.stepper.currentStage}
                </span>
                <span className="absolute right-2 top-2 rounded-full bg-background/90 px-2.5 py-1 text-xs font-medium numeric">
                  {daysToHandoff(h, today)}
                </span>
              </div>
              <div className="space-y-2 p-3">
                <div>
                  <p className="truncate font-semibold">{h.address}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {[h.city, shown(h.ownerType)].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <StageBar stepper={h.stepper} />
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="text-muted-foreground">{h.projectManager ?? "No Project Manager"}</span>
                  <span className="inline-flex items-center gap-1.5">
                    <HealthDot level={h.health.level} />
                    <span>{h.health.line}</span>
                  </span>
                </div>
              </div>
            </>,
            "block h-full transition hover:bg-muted/30",
          )}
        </li>
      ))}
    </ul>
  );
}

function ActiveProjects({ homes, homeLink }: { homes: BoardHome[]; homeLink: LinkFn }) {
  const cols = [
    "Owner Type",
    "Project name",
    "Greater Area",
    "PMA Status",
    "Invoice Status",
    "Project Manager",
    "Status",
    "Closing date",
    "Est. Hand Off Date",
  ];
  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full min-w-[960px] text-sm" aria-label="Active Projects">
        <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
          <tr>
            {cols.map((c) => (
              <th key={c} scope="col" className="px-3 py-2 font-medium">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {homes.map((h) => (
            <tr key={h.propertyId}>
              <td className="px-3 py-2">{shown(h.ownerType)}</td>
              <td className="px-3 py-2 font-medium">{homeLink(h.propertyId, h.address, "hover:underline")}</td>
              <td className="px-3 py-2">{shown(h.greaterArea)}</td>
              <td className="px-3 py-2">{shown(h.pmaStatus)}</td>
              <td className="px-3 py-2">{shown(h.invoiceStatus)}</td>
              <td className="px-3 py-2">{h.projectManager ?? NOT_SET}</td>
              <td className="px-3 py-2">{shown(h.status)}</td>
              <td className="numeric px-3 py-2">{h.closingOn ? shortDate(h.closingOn) : NOT_SET}</td>
              <td className="numeric px-3 py-2">{h.estimateOn ? shortDate(h.estimateOn) : NOT_SET}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ByStatus({ homes, today, homeLink }: { homes: BoardHome[]; today: string; homeLink: LinkFn }) {
  const columns = byStatus(homes);
  return (
    <div className="flex gap-3 overflow-x-auto pb-2" aria-label="By Status">
      {columns.map((c) => (
        <section key={c.status} aria-label={c.status} className="w-64 shrink-0 rounded-lg border border-border bg-muted/20 p-2">
          <p className="px-1 pb-2 text-sm font-semibold">
            {c.status} <span className="numeric font-normal text-muted-foreground">({c.homes.length})</span>
          </p>
          <ul className="space-y-2">
            {c.homes.map((h) => (
              <li key={h.propertyId}>
                {homeLink(
                  h.propertyId,
                  <>
                    <span className="block truncate font-medium">{h.address}</span>
                    <span className="block text-xs text-muted-foreground">
                      {h.stepper.currentStage} · {daysToHandoff(h, today)}
                    </span>
                  </>,
                  "block min-h-11 rounded-md border border-border bg-card px-2.5 py-2 text-sm hover:bg-muted/40",
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function Gantt({ homes, today, homeLink }: { homes: BoardHome[]; today: string; homeLink: LinkFn }) {
  const scale = ganttScale(homes.map((h) => ({ start: h.closingOn, end: h.estimateOn })), today);
  return (
    <div className="overflow-x-auto" aria-label="Gantt">
      <div className="min-w-[760px]">
        <div className="relative ml-48 h-6 border-b border-border text-xs text-muted-foreground">
          {scale.months.map((m) => (
            <span key={m.label} className="absolute top-0 -translate-x-0" style={{ left: `${m.left}%` }}>
              {m.label}
            </span>
          ))}
        </div>
        <ul className="relative">
          <span
            aria-label="Today"
            className="pointer-events-none absolute bottom-0 top-0 z-10 w-px bg-state-blocked"
            style={{ left: `calc(12rem + (100% - 12rem) * ${scale.today / 100})` }}
          />
          {homes.map((h) => {
            const start = h.closingOn ? scale.at(h.closingOn) : null;
            const end = h.estimateOn ? scale.at(h.estimateOn) : null;
            return (
              <li key={h.propertyId} className="flex min-h-11 items-center border-b border-border/60">
                {homeLink(h.propertyId, h.address, "w-48 shrink-0 truncate pr-2 text-sm font-medium hover:underline")}
                <div className="relative h-6 flex-1">
                  {start != null && end != null && end >= start ? (
                    <span
                      className="absolute top-1 h-4 rounded-full bg-primary/70"
                      style={{ left: `${start}%`, width: `${Math.max(1, end - start)}%` }}
                      title={`${shortDate(h.closingOn!)} to ${shortDate(h.estimateOn!)}`}
                    />
                  ) : (
                    <span className="absolute left-1 top-1 text-xs text-muted-foreground">
                      {!h.closingOn ? "No closing date" : "No handoff estimate"}
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
        <p className="mt-2 text-xs text-muted-foreground">Each bar runs from closing to the estimated handoff. The red line is today.</p>
      </div>
    </div>
  );
}

function WorkLoad({ homes }: { homes: BoardHome[] }) {
  const rows = workload(homes);
  const max = Math.max(1, ...rows.map((r) => r.homes));
  return (
    <ul className="space-y-2" aria-label="Work Load">
      {rows.map((r) => (
        <li key={r.name} className="flex min-h-11 items-center gap-3 text-sm">
          <span className="w-44 shrink-0 truncate">{r.name}</span>
          <span className="h-4 flex-1 overflow-hidden rounded-full bg-muted">
            <span className="block h-full rounded-full bg-primary" style={{ width: `${(r.homes / max) * 100}%` }} />
          </span>
          <span className="numeric w-28 shrink-0 text-right text-muted-foreground">
            {r.homes} active home{r.homes === 1 ? "" : "s"}
          </span>
        </li>
      ))}
    </ul>
  );
}

export { ArrowRight, Plus, dueLabel };
