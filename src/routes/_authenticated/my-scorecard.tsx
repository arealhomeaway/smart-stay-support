/**
 * My scorecard (register A19, Build 9 D2): a person's own scorecard records, read only.
 * Reached from the My scorecard button on Home, which shows only for a person who has a
 * record. No Analytics access is needed; the database shows each person only their own rows
 * (scorecard_records_read). Rules and wording live in src/lib/home-needs.ts.
 * Build 13 (register BN5): My bonus sits on top for a person with a bonus plan.
 * Build 14: links to Team records, Coaching and the Weekly scorecard for those who may open them.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, SectionCard } from "@/components/ui/page";
import { useCurrentUserId } from "@/hooks/useTeam";
import { useShellPageLabel } from "@/components/nav/ShellNav";
import { usDate } from "@/lib/dates";
import { MY_SCORECARD_COPY, myScorecardGroups, type MyScorecardRow } from "@/lib/home-needs";
import { BonusVerifyLink, MyBonus } from "@/components/bonus/MyBonus";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useRole } from "@/hooks/useRole";

/** Build 14 (register BN7, BN8, BN9): the tracker pages this person may open. */
const TRACKER_LINKS = [
  { to: "/team-records", label: "Team records" },
  { to: "/coaching", label: "Coaching" },
  { to: "/weekly-scorecard", label: "Weekly scorecard" },
] as const;

function TrackerLinks() {
  const role = useRole();
  const links = TRACKER_LINKS.filter((l) => role.canOpen(l.to));
  if (links.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2" data-tracker-links>
      {links.map((l) => (
        <Button key={l.to} asChild variant="outline" className="min-h-11">
          <Link to={l.to}>{l.label}</Link>
        </Button>
      ))}
    </div>
  );
}

export const Route = createFileRoute("/_authenticated/my-scorecard")({
  component: MyScorecardPage,
  head: () => ({
    meta: [
      { title: "My scorecard · Resolve" },
      { name: "description", content: "Your own scorecard records in Resolve, read only." },
      { property: "og:title", content: "My scorecard · Resolve" },
      { property: "og:description", content: "Your own scorecard records in Resolve, read only." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function MyScorecardPage() {
  useShellPageLabel(MY_SCORECARD_COPY.title);
  const userId = useCurrentUserId();
  const q = useQuery({
    queryKey: ["my-scorecard-page", userId],
    enabled: Boolean(userId),
    queryFn: async (): Promise<MyScorecardRow[]> => {
      const { data, error } = await supabase
        .from("scorecard_records")
        .select("id, kind, recorded_at, recorded_by, about_user_id, note")
        .or(`recorded_by.eq.${userId},about_user_id.eq.${userId}`)
        .eq("is_demo", false)
        .order("recorded_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as MyScorecardRow[];
    },
  });
  const groups = userId ? myScorecardGroups(q.data ?? [], userId) : [];
  return (
    <div className="space-y-6" data-my-scorecard-page>
      <PageHeader title={MY_SCORECARD_COPY.title} description={MY_SCORECARD_COPY.description} />
      {/* Build 13 (register BN5): the person's own bonus bars and dollars, when they have a plan. */}
      <BonusVerifyLink />
      <TrackerLinks />
      {userId && <MyBonus userId={userId} />}
      {q.isPending ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : q.error ? (
        <p role="alert" className="text-sm">Your scorecard could not be loaded. Try again.</p>
      ) : groups.length === 0 ? (
        <p className="rounded-[14px] border border-border p-6 text-[15px]">{MY_SCORECARD_COPY.empty}</p>
      ) : (
        groups.map((g) => (
          <SectionCard key={g.kind} title={`${g.label} (${g.count})`}>
            <ul className="divide-y divide-border">
              {g.rows.map((r) => (
                <li key={r.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-3 text-sm">
                  <span className="font-medium">{usDate(r.recorded_at)}</span>
                  <span className="text-muted-foreground">
                    {r.about_user_id === userId ? MY_SCORECARD_COPY.recordedAbout : MY_SCORECARD_COPY.recordedBy}
                  </span>
                  {r.note ? <span className="w-full break-words">{r.note}</span> : null}
                </li>
              ))}
            </ul>
          </SectionCard>
        ))
      )}
    </div>
  );
}
