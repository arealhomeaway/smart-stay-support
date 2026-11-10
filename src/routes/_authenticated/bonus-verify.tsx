/**
 * Bonus verify (Build 13; register BN6): the reviewer checks a person's numbers, enters what
 * Resolve cannot count, asks the COO to excuse a record or approve a system problem, and
 * verifies. The Director of Operations verifies the Operations Supervisor, the COO the Director,
 * the Operations Supervisor the coordinators. The COO, the CEO and Admin see everyone. The
 * database decides who appears (public.bonus_people) and who may act.
 */
import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { EmptyState, PageHeader, SectionCard } from "@/components/ui/page";
import { useShellPageLabel } from "@/components/nav/ShellNav";
import { BonusPeriodView } from "@/components/bonus/BonusPeriodView";
import { BONUS_COPY, VERIFY_COPY, type BonusPerson } from "@/lib/bonus";

type Search = { plan?: string; user?: string; start?: string };

export const Route = createFileRoute("/_authenticated/bonus-verify")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    plan: typeof s.plan === "string" ? s.plan : undefined,
    user: typeof s.user === "string" ? s.user : undefined,
    start: typeof s.start === "string" ? s.start : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Bonus verify · Resolve" },
      { name: "description", content: "Check and verify the bonus numbers for the people you review." },
      { property: "og:title", content: "Bonus verify · Resolve" },
      { property: "og:description", content: "Check and verify the bonus numbers for the people you review." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BonusVerifyPage,
});

const SELECT_CLASS = "h-11 rounded-lg border border-input bg-background px-3 text-[15px] text-foreground";

function BonusVerifyPage() {
  useShellPageLabel(VERIFY_COPY.title);
  const search = Route.useSearch();
  const people = useQuery({
    queryKey: ["bonus-people"],
    queryFn: async (): Promise<BonusPerson[]> => {
      const { data, error } = await supabase.rpc("bonus_people");
      if (error) throw error;
      return (data ?? []) as unknown as BonusPerson[];
    },
  });
  const list = people.data ?? [];
  const initial = list.find((p) => p.plan === search.plan && p.user_id === search.user) ?? list.find((p) => p.periods.some((x) => x.status === "ready")) ?? list[0];
  const [chosen, setChosen] = useState<string | null>(null);
  const person = list.find((p) => `${p.plan}:${p.user_id}` === chosen) ?? initial;
  const periods = useMemo(() => {
    if (!person) return [];
    const out = person.periods.map((x) => ({ start: x.period_start, label: `${x.label}, ${BONUS_COPY.status[x.status]}` }));
    if (person.current_start && !out.some((x) => x.start === person.current_start)) {
      out.unshift({ start: person.current_start, label: `This period, ${BONUS_COPY.status.in_progress}` });
    }
    return out;
  }, [person]);
  const [startChoice, setStartChoice] = useState<string | null>(null);
  const start =
    (startChoice && periods.some((p) => p.start === startChoice) ? startChoice : null) ??
    (search.start && periods.some((p) => p.start === search.start) ? search.start : null) ??
    periods.find((p) => person?.periods.find((x) => x.period_start === p.start)?.status === "ready")?.start ??
    periods[0]?.start ??
    null;

  return (
    <div className="space-y-6" data-bonus-verify-page>
      <PageHeader title={VERIFY_COPY.title} description={VERIFY_COPY.hint} />
      {people.isPending ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : people.error ? (
        <p role="alert" className="text-sm">{BONUS_COPY.loadError}</p>
      ) : list.length === 0 || !person ? (
        <EmptyState title={VERIFY_COPY.none} />
      ) : (
        <>
          <SectionCard title={VERIFY_COPY.choose}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-[13px] text-muted-foreground">
                {VERIFY_COPY.person}
                <select
                  className={SELECT_CLASS}
                  value={`${person.plan}:${person.user_id}`}
                  onChange={(e) => {
                    setChosen(e.target.value);
                    setStartChoice(null);
                  }}
                  data-bonus-person
                >
                  {list.map((p) => (
                    <option key={`${p.plan}:${p.user_id}`} value={`${p.plan}:${p.user_id}`}>
                      {p.name}, {p.plan_name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-[13px] text-muted-foreground">
                {BONUS_COPY.period}
                <select className={SELECT_CLASS} value={start ?? ""} onChange={(e) => setStartChoice(e.target.value)} data-bonus-period>
                  {periods.map((p) => (
                    <option key={p.start} value={p.start}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </SectionCard>
          {start ? <BonusPeriodView plan={person.plan} user={person.user_id} start={start} /> : <EmptyState title={BONUS_COPY.notCountedYet} />}
        </>
      )}
    </div>
  );
}
