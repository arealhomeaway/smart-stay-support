/**
 * Active Owner Showcase — an isolated, frontend-only demonstration surface.
 *
 * Everything on this page is simulated in local state. It performs no network
 * request, reads no backend data and writes nothing. It exists purely to show
 * what the Active Owner experience feels like. The production owner portal at
 * /owner is untouched by this file.
 */
import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  Award,
  BookOpen,
  CalendarClock,
  Camera,
  Check,
  ClipboardList,
  Download,
  FileText,
  Home,
  Lock,
  MapPin,
  MessageSquare,
  Sparkles,
} from "lucide-react";
import heroImage from "@/assets/hero-arha-property.jpg";
import propertyImage from "@/assets/home-hero.jpg";
import { Button } from "@/components/ui/button";
import { StatusBadge, type StatusTone } from "@/components/ui/status";
import { Celebrate } from "@/components/ui/feedback";
import { usDate } from "@/lib/dates";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/owner-showcase")({
  head: () => ({
    meta: [
      { title: "Active Owner Portal — A Real Home Away" },
      {
        name: "description",
        content:
          "A preview of the A Real Home Away owner experience: your home, your participation, and one clear record of it.",
      },
      { property: "og:title", content: "Active Owner Portal — A Real Home Away" },
      {
        property: "og:description",
        content: "Your home. Your participation. One clear record.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: OwnerShowcase,
});

/* ---------------------------------------------------------------- fixture */

const OWNER = { firstName: "Dana", fullName: "Dana Reyes" };
const HOME = {
  name: "ZZ QA AO — Willow",
  location: "Willow Bend, Round Rock, TX",
  status: "Active",
  window: "07/01/2026 – 09/29/2026",
  phase: "Peak season participation",
  milestone: { label: "Quarterly home review with your coordinator", date: "09/19/2026" },
};
const GOAL_HOURS = 100;
const LOGGED_HOURS = 62.5;

type Accent = "sky" | "lavender" | "aqua" | "amber" | "sage";

const ACCENT: Record<
  Accent,
  { chip: string; icon: string; edge: string; tone: StatusTone; wash: string }
> = {
  sky: {
    chip: "bg-sky/12 text-sky",
    icon: "bg-sky/12 text-sky",
    edge: "bg-sky",
    tone: "progress",
    wash: "bg-sky/[0.04]",
  },
  lavender: {
    chip: "bg-lavender/12 text-lavender",
    icon: "bg-lavender/14 text-lavender",
    edge: "bg-lavender",
    tone: "review",
    wash: "bg-lavender/[0.04]",
  },
  aqua: {
    chip: "bg-aqua/14 text-aqua",
    icon: "bg-aqua/16 text-aqua",
    edge: "bg-aqua",
    tone: "context",
    wash: "bg-aqua/[0.04]",
  },
  amber: {
    chip: "bg-amber/14 text-amber",
    icon: "bg-amber/14 text-amber",
    edge: "bg-amber",
    tone: "waiting",
    wash: "bg-amber/[0.05]",
  },
  sage: {
    chip: "bg-sage/12 text-sage",
    icon: "bg-sage/12 text-sage",
    edge: "bg-sage",
    tone: "resolved",
    wash: "bg-sage/[0.04]",
  },
};

type Opportunity = {
  id: string;
  title: string;
  why: string;
  time: string;
  timing: string;
  accent: Accent;
  state: string;
  cta: string;
  icon: typeof Camera;
};

const OPPORTUNITIES: Opportunity[] = [
  {
    id: "o1",
    title: "Approve the new patio furniture",
    why: "Guests have asked for more outdoor seating. Your decision keeps the order moving.",
    time: "About 15 minutes",
    timing: "Available now",
    accent: "sky",
    state: "Ready for you",
    cta: "Respond",
    icon: MessageSquare,
  },
  {
    id: "o2",
    title: "Walk the home and note anything you'd change",
    why: "Your eye on the home catches the small things guests notice first.",
    time: "About 1 hour",
    timing: "Available now",
    accent: "aqua",
    state: "Ready for you",
    cta: "Log time",
    icon: Home,
  },
  {
    id: "o3",
    title: "Review your fall rate strategy",
    why: "Ahead of the shoulder season, your input shapes how the home is priced.",
    time: "About 45 minutes",
    timing: "Opens 09/14/2026",
    accent: "amber",
    state: "Coming up",
    cta: "Log time",
    icon: CalendarClock,
  },
  {
    id: "o4",
    title: "Refresh the photo set for the living room",
    why: "New photos of your recent updates help the listing show the home at its best.",
    time: "About 30 minutes",
    timing: "Available now",
    accent: "lavender",
    state: "Ready for you",
    cta: "Log time",
    icon: Camera,
  },
];

type HistoryItem = {
  id: string;
  title: string;
  date: string;
  hours: number;
  accent: Accent;
  note: string;
  icon: typeof Camera;
};

const HISTORY: HistoryItem[] = [
  {
    id: "h1",
    title: "Approved the deep-clean schedule for August",
    date: "2026-08-28",
    hours: 0.5,
    accent: "sky",
    note: "Decision recorded",
    icon: MessageSquare,
  },
  {
    id: "h2",
    title: "Met the landscaper at the home",
    date: "2026-08-21",
    hours: 2,
    accent: "aqua",
    note: "On site",
    icon: MapPin,
  },
  {
    id: "h3",
    title: "Reviewed the summer guest feedback",
    date: "2026-08-12",
    hours: 1.5,
    accent: "lavender",
    note: "Notes shared",
    icon: ClipboardList,
  },
  {
    id: "h4",
    title: "Chose the replacement porch railing",
    date: "2026-07-30",
    hours: 1,
    accent: "sage",
    note: "Completed",
    icon: Check,
  },
  {
    id: "h5",
    title: "Photographed the refreshed primary bedroom",
    date: "2026-07-18",
    hours: 1.5,
    accent: "lavender",
    note: "Photos added",
    icon: Camera,
  },
];

const LEARNING = [
  {
    id: "l1",
    title: "How pricing works in your market",
    blurb: "A short walkthrough of how nightly rates move through the year in Round Rock.",
    time: "20 minutes",
    progress: 100,
    accent: "sage" as Accent,
    state: "Completed",
  },
  {
    id: "l2",
    title: "What guests notice first",
    blurb: "The five details that shape a review before a guest unpacks.",
    time: "15 minutes",
    progress: 40,
    accent: "lavender" as Accent,
    state: "In progress",
  },
];

const BADGES = [
  { code: "b1", name: "First hour documented", earned: true, date: "2026-07-05" },
  { code: "b2", name: "Ten hours documented", earned: true, date: "2026-07-22" },
  { code: "b3", name: "First on-site visit", earned: true, date: "2026-07-14" },
  { code: "b4", name: "Five decisions made", earned: true, date: "2026-08-02" },
  { code: "b5", name: "Halfway to your goal", earned: true, date: "2026-08-19" },
  { code: "b6", name: "Learning completed", earned: true, date: "2026-08-24" },
  { code: "b7", name: "Full season participation", earned: false, date: null },
];

const RECORD_ROWS = [
  {
    date: "2026-08-28",
    activity: "Approved the deep-clean schedule",
    duration: "0.5 hr",
    type: "Decision",
    detail: "Approval recorded in writing",
  },
  {
    date: "2026-08-21",
    activity: "Met the landscaper at the home",
    duration: "2.0 hr",
    type: "On site",
    detail: "Visit noted with scope discussed",
  },
  {
    date: "2026-08-12",
    activity: "Reviewed summer guest feedback",
    duration: "1.5 hr",
    type: "Review",
    detail: "Written notes attached",
  },
  {
    date: "2026-07-30",
    activity: "Chose the replacement porch railing",
    duration: "1.0 hr",
    type: "Decision",
    detail: "Option selected from three quotes",
  },
];

/* ------------------------------------------------------------- components */

function DemoNote() {
  return (
    <span className="chip bg-cool-grey/12 text-cool-grey">
      <span className="chip-dot" aria-hidden="true" /> Demonstration
    </span>
  );
}

function Band({ title, hint, action }: { title: string; hint?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-[1.375rem] font-semibold tracking-tight">{title}</h2>
        {hint ? <p className="mt-1 text-[0.9375rem] text-muted-foreground">{hint}</p> : null}
      </div>
      {action}
    </div>
  );
}

function ProgressDial({ pct }: { pct: number }) {
  const size = 168;
  const r = (size - 16) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${Math.round(pct)}% of your 100-hour goal documented`}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--border)"
          strokeWidth="12"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--sage)"
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct / 100)}
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="numeric text-[2.25rem] font-semibold leading-none text-sage">
          {Math.round(pct)}%
        </span>
        <span className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">
          of your goal
        </span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------- page */

function OwnerShowcase() {
  const [logged, setLogged] = useState(LOGGED_HOURS);
  const [done, setDone] = useState<string[]>([]);
  const [cheer, setCheer] = useState<string | null>(null);
  const [extra, setExtra] = useState<HistoryItem[]>([]);

  const remaining = Math.max(0, GOAL_HOURS - logged);
  const pct = (logged / GOAL_HOURS) * 100;
  const history = useMemo(() => [...extra, ...HISTORY], [extra]);

  function simulate(o: Opportunity) {
    const hours = o.cta === "Respond" ? 0.5 : 1;
    setLogged((h) => Math.round((h + hours) * 10) / 10);
    setDone((d) => [...d, o.id]);
    setExtra((e) => [
      {
        id: `sim-${o.id}`,
        title: o.title,
        date: new Date().toISOString(),
        hours,
        accent: o.accent,
        note: "Just added",
        icon: o.icon,
      },
      ...e,
    ]);
    setCheer(o.title);
    toast.success("Participation logged", {
      description: "Nice work! Your demo record has been updated.",
    });
  }

  return (
    <div className="min-h-svh bg-background">
      <div className="mx-auto w-full max-w-[1180px] px-6 py-8 lg:px-10 lg:py-10">
        {/* 1 — Hero */}
        <section className="relative overflow-hidden rounded-3xl">
          <img
            src={heroImage}
            alt="The Willow home managed by A Real Home Away"
            className="absolute inset-0 size-full object-cover"
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-r from-[oklch(0.22_0.03_200/0.88)] via-[oklch(0.22_0.03_200/0.62)] to-[oklch(0.22_0.03_200/0.15)]"
          />
          <div className="relative px-8 py-14 lg:px-14 lg:py-20">
            <div className="mb-4 flex items-center gap-2">
              <span className="chip bg-white/15 text-white">
                <span className="chip-dot bg-sage" aria-hidden="true" /> Active Owner
              </span>
              <span className="chip bg-white/10 text-white/80">{HOME.name}</span>
            </div>
            <h1 className="max-w-3xl font-display text-[2.75rem] font-normal leading-[1.05] tracking-tight text-white lg:text-[3.75rem]">
              Good afternoon, {OWNER.firstName}.
            </h1>
            <p className="mt-4 max-w-xl text-lg leading-relaxed text-white/85">
              Your home. Your participation. One clear record.
            </p>
          </div>
        </section>

        {/* 2 — Progress */}
        <section className="-mt-10 relative mx-2 rounded-3xl border border-border bg-card px-8 py-8 shadow-[0_18px_45px_-30px_oklch(0.3_0.05_200/0.55)] lg:mx-8">
          <div className="flex flex-col items-center gap-8 lg:flex-row lg:gap-12">
            <ProgressDial pct={pct} />
            <div className="min-w-0 flex-1">
              <p className="eyebrow text-sage">Your participation</p>
              <p className="mt-2 text-[1.75rem] font-semibold leading-tight">
                <span className="numeric">{logged}</span> hours documented
                <span className="text-muted-foreground"> of {GOAL_HOURS}</span>
              </p>
              <p className="mt-1.5 text-[0.9375rem] text-muted-foreground">
                <span className="numeric font-medium text-foreground">{remaining}</span> hours
                remaining this season. You&rsquo;re on track.
              </p>
              <div className="mt-5 h-3 w-full overflow-hidden rounded-full bg-sunken">
                <div
                  className="h-full rounded-full bg-sage transition-all duration-700 ease-out"
                  style={{ width: `${Math.min(100, pct)}%` }}
                />
              </div>
              <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                <span>Season start</span>
                <span>100-hour goal</span>
              </div>
            </div>
          </div>
          {cheer ? (
            <Celebrate title="Nice work! 🎉" className="mt-6">
              {cheer} was added to your record.
            </Celebrate>
          ) : null}
        </section>

        {/* 3 — The home */}
        <section className="mt-14">
          <Band title="Your home" hint="Where your participation is happening." />
          <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
            <img
              src={propertyImage}
              alt={`${HOME.name} — A Real Home Away property`}
              className="h-[300px] w-full rounded-2xl object-cover"
            />
            <div className="flex flex-col justify-center gap-5">
              <div>
                <h3 className="text-[1.5rem] font-semibold tracking-tight">{HOME.name}</h3>
                <p className="mt-1 flex items-center gap-1.5 text-[0.9375rem] text-muted-foreground">
                  <MapPin className="size-4 text-aqua" aria-hidden="true" /> {HOME.location}
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="eyebrow">Status</p>
                  <div className="mt-1.5">
                    <StatusBadge tone="resolved">{HOME.status}</StatusBadge>
                  </div>
                </div>
                <div>
                  <p className="eyebrow">Participation window</p>
                  <p className="numeric mt-1.5 text-[0.9375rem]">{HOME.window}</p>
                </div>
                <div>
                  <p className="eyebrow">Current phase</p>
                  <p className="mt-1.5 text-[0.9375rem]">{HOME.phase}</p>
                </div>
                <div>
                  <p className="eyebrow">Coming up</p>
                  <p className="mt-1.5 text-[0.9375rem]">
                    {HOME.milestone.label}
                    <span className="numeric block text-sm text-amber">
                      {usDate(HOME.milestone.date)}
                    </span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 4 — Available participation */}
        <section className="mt-16">
          <Band
            title="Ways to take part"
            hint="Pick what fits your week. Everything here counts toward your record."
            action={<DemoNote />}
          />
          <div className="grid gap-4 md:grid-cols-2">
            {OPPORTUNITIES.map((o) => {
              const a = ACCENT[o.accent];
              const Icon = o.icon;
              const complete = done.includes(o.id);
              return (
                <article
                  key={o.id}
                  className={cn(
                    "relative overflow-hidden rounded-2xl border border-border p-6 transition-shadow hover:shadow-[0_14px_35px_-28px_oklch(0.3_0.05_200/0.7)]",
                    complete ? ACCENT.sage.wash : a.wash,
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "absolute inset-y-0 left-0 w-1",
                      complete ? ACCENT.sage.edge : a.edge,
                    )}
                  />
                  <div className="flex items-start gap-4">
                    <span
                      className={cn(
                        "flex size-11 shrink-0 items-center justify-center rounded-xl",
                        complete ? ACCENT.sage.icon : a.icon,
                      )}
                      aria-hidden="true"
                    >
                      {complete ? <Check className="size-5" /> : <Icon className="size-5" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge tone={complete ? "resolved" : a.tone}>
                          {complete ? "Logged" : o.state}
                        </StatusBadge>
                        <span className="numeric text-[0.8125rem] text-muted-foreground">
                          {o.time}
                        </span>
                      </div>
                      <h3 className="mt-2.5 text-[1.0625rem] font-semibold leading-snug">
                        {o.title}
                      </h3>
                      <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-muted-foreground">
                        {o.why}
                      </p>
                      <div className="mt-4 flex flex-wrap items-center gap-3">
                        {complete ? (
                          <span className="text-[0.9375rem] font-medium text-sage">
                            Added to your record
                          </span>
                        ) : (
                          <Button size="sm" onClick={() => simulate(o)}>
                            {o.cta}
                          </Button>
                        )}
                        <span className="text-[0.8125rem] text-muted-foreground">{o.timing}</span>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        {/* 5 — Recent participation */}
        <section className="mt-16 grid gap-12 lg:grid-cols-[1.25fr_1fr]">
          <div>
            <Band title="Recent participation" hint="What you've already done this season." />
            <ul className="divide-y divide-border/70">
              {history.map((h) => {
                const a = ACCENT[h.accent];
                const Icon = h.icon;
                return (
                  <li key={h.id} className="flex items-center gap-4 py-3.5">
                    <span
                      aria-hidden="true"
                      className={cn(
                        "flex size-9 shrink-0 items-center justify-center rounded-full",
                        a.icon,
                      )}
                    >
                      <Icon className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[0.9375rem] font-medium">{h.title}</p>
                      <p className="numeric text-[0.8125rem] text-muted-foreground">
                        {usDate(h.date)} · {h.note}
                      </p>
                    </div>
                    <span className="numeric shrink-0 text-[0.9375rem] font-semibold text-sage">
                      {h.hours} hr
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* 6 — Learning */}
          <div>
            <Band title="Learning" hint="Short reads that count toward your participation." />
            <div className="space-y-4">
              {LEARNING.map((l) => {
                const a = ACCENT[l.accent];
                return (
                  <div key={l.id} className={cn("rounded-2xl p-5", a.wash)}>
                    <div className="flex items-start gap-3">
                      <span
                        aria-hidden="true"
                        className={cn(
                          "flex size-10 shrink-0 items-center justify-center rounded-xl",
                          a.icon,
                        )}
                      >
                        {l.progress === 100 ? (
                          <Check className="size-5" />
                        ) : (
                          <BookOpen className="size-5" />
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[1.0625rem] font-semibold leading-snug">{l.title}</p>
                        <p className="mt-1 text-[0.9375rem] leading-relaxed text-muted-foreground">
                          {l.blurb}
                        </p>
                        <div className="mt-3 flex items-center gap-3">
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/70">
                            <div
                              className={cn("h-full rounded-full", a.edge)}
                              style={{ width: `${l.progress}%` }}
                            />
                          </div>
                          <span className="numeric text-xs text-muted-foreground">{l.time}</span>
                        </div>
                        <p className="mt-2 text-[0.8125rem] font-medium text-muted-foreground">
                          {l.state}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* 7 — Milestones */}
        <section className="mt-16">
          <Band title="Your milestones" hint="Moments worth marking along the way." />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {BADGES.map((b) => (
              <div
                key={b.code}
                className={cn(
                  "flex items-center gap-3 rounded-2xl p-4",
                  b.earned ? "bg-sage/8" : "bg-sunken",
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "flex size-11 shrink-0 items-center justify-center rounded-full",
                    b.earned ? "bg-sage/15 text-sage" : "bg-muted text-muted-foreground",
                  )}
                >
                  {b.earned ? <Award className="size-5" /> : <Lock className="size-4" />}
                </span>
                <div className="min-w-0">
                  <p className="text-[0.9375rem] font-semibold leading-snug">{b.name}</p>
                  <p className="numeric text-[0.8125rem] text-muted-foreground">
                    {b.earned && b.date ? `Earned ${usDate(b.date)}` : "Not yet"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 8 — Participation record */}
        <section className="mt-16">
          <Band
            title="Your participation record"
            hint="Your documented activities are organized here so you have a clear record of your participation."
            action={
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  toast.success("Report preview", {
                    description: "A formatted copy of your record would open here.",
                  })
                }
              >
                <FileText className="size-4" /> Preview report
              </Button>
            }
          />
          <div className="overflow-hidden rounded-2xl border border-border">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-sunken px-6 py-4">
              <div>
                <p className="eyebrow">Prepared for</p>
                <p className="text-[1.0625rem] font-semibold">{OWNER.fullName}</p>
              </div>
              <div className="text-right">
                <p className="eyebrow">Documented hours</p>
                <p className="numeric text-[1.0625rem] font-semibold text-sage">{logged} hr</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[0.9375rem]">
                <thead>
                  <tr className="border-b border-border text-[0.75rem] uppercase tracking-wide text-muted-foreground">
                    <th className="px-6 py-3 font-medium">Date</th>
                    <th className="px-6 py-3 font-medium">Activity</th>
                    <th className="px-6 py-3 font-medium">Duration</th>
                    <th className="px-6 py-3 font-medium">Home</th>
                    <th className="px-6 py-3 font-medium">Type</th>
                    <th className="px-6 py-3 font-medium">Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {RECORD_ROWS.map((r) => (
                    <tr key={r.date} className="border-b border-border/60 last:border-0">
                      <td className="numeric whitespace-nowrap px-6 py-3.5">{usDate(r.date)}</td>
                      <td className="px-6 py-3.5">{r.activity}</td>
                      <td className="numeric whitespace-nowrap px-6 py-3.5">{r.duration}</td>
                      <td className="whitespace-nowrap px-6 py-3.5 text-muted-foreground">
                        {HOME.name}
                      </td>
                      <td className="px-6 py-3.5">
                        <span className="chip bg-aqua/14 text-aqua">{r.type}</span>
                      </td>
                      <td className="px-6 py-3.5 text-muted-foreground">{r.detail}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
              <p className="max-w-xl text-[0.8125rem] leading-relaxed text-muted-foreground">
                This record reflects the activities you documented yourself. A Real Home Away keeps
                it organized for you.
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  toast.success("Copy ready", { description: "Your record would download here." })
                }
              >
                <Download className="size-4" /> Download a copy
              </Button>
            </div>
          </div>
        </section>

        <footer className="mt-16 flex flex-wrap items-center gap-3 border-t border-border pt-6 text-[0.8125rem] text-muted-foreground">
          <Sparkles className="size-4 text-primary" aria-hidden="true" />
          A Real Home Away · Active Owner experience preview. Everything shown here is illustrative.
        </footer>
      </div>
    </div>
  );
}
