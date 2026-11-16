/**
 * "What the homeowner has" (approved by the Admin, Nov 16). Read only: the homeowner cards for a
 * home, grouped the way the homeowner portal reads them, and every owner item or approval the
 * team sent for the homeowner's answer. Same component on both home pages and on Active Owner.
 */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Eye, FileText } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useViewAs } from "@/hooks/useViewAs";
import { attachmentUrlFn } from "@/lib/attachments.functions";
import { setOwnerPreview } from "@/lib/owner-preview";
import {
  HAS_COPY,
  homeownerCardGroups,
  sentForAnswer,
  type HasCardItem,
  type HasGroup,
  type HasSentItem,
} from "@/lib/homeowner-has";
import { loadHomeProgram, loadHomeownerHas, loadTaskHomeownerLines } from "@/lib/homeowner-has.data";

const VISIBLE_GROUPS: HasGroup[] = ["answer", "open", "waiting", "done"];

function GroupList({ group, items }: { group: HasGroup; items: HasCardItem[] }) {
  return (
    <div className="space-y-1.5">
      <h5 className="text-sm font-medium">
        {HAS_COPY.groups[group]} ({items.length})
      </h5>
      {items.length === 0 ? null : (
        <ul className="divide-y divide-border rounded-md border border-border">
          {items.map((i) => (
            <li key={i.id} className="px-3 py-2 text-sm">
              <p className="font-medium">{i.title}</p>
              <p className={group === "answer" ? "text-xs font-medium text-warning-ink" : "text-xs text-muted-foreground"}>{i.line}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SentList({ items }: { items: HasSentItem[] }) {
  const fileUrl = useServerFn(attachmentUrlFn);
  const open = async (id: string) => {
    try {
      const { url } = await fileUrl({ data: { documentId: id } });
      window.open(url, "_blank", "noopener");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "That file could not open.");
    }
  };
  if (items.length === 0) return <p className="text-sm text-muted-foreground">{HAS_COPY.noSent}</p>;
  return (
    <ul className="divide-y divide-border rounded-md border border-border">
      {items.map((i) => (
        <li key={i.key} className="space-y-1 px-3 py-2 text-sm">
          <p className="font-medium">{i.title}</p>
          <p className="text-xs text-muted-foreground">{i.sentLine}</p>
          <p className={i.waiting ? "text-xs font-medium text-warning-ink" : "text-xs text-foreground"}>{i.statusLine}</p>
          {i.files.length > 0 ? (
            <div className="flex flex-wrap gap-2 pt-1">
              {i.files.map((f) => (
                <Button key={f.id} type="button" variant="outline" size="sm" className="min-h-11" onClick={() => void open(f.id)}>
                  <FileText className="size-4" aria-hidden="true" /> {f.name}
                </Button>
              ))}
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

/** Opens the existing read-only homeowner preview for a program. */
export function PreviewAsHomeownerButton({ programId, ownerName, demo, origin }: { programId: string; ownerName: string; demo: boolean; origin: string }) {
  const router = useRouter();
  const { setViewAs } = useViewAs();
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      className="min-h-11"
      onClick={() => {
        setOwnerPreview({ programId, ownerName, demo, origin });
        setViewAs("owner");
        void router.navigate({ to: "/owner" });
      }}
    >
      <Eye className="size-4" aria-hidden="true" /> {HAS_COPY.preview}
    </Button>
  );
}

/**
 * The two lists for one program. `homes` is one home (home pages) or every home in the program
 * (Active Owner page, one card list per home, then one sent list).
 */
export function HomeownerHasLists({
  programId,
  demo,
  homes,
}: {
  programId: string;
  demo: boolean;
  homes: { id: string; name: string }[];
}) {
  const ids = homes.map((h) => h.id);
  const q = useQuery({
    queryKey: ["homeowner-has", programId, ids.join(","), demo],
    queryFn: () => loadHomeownerHas({ programId, propertyIds: ids, demo }),
    enabled: ids.length > 0,
    retry: false,
  });
  const view = useMemo(() => {
    if (!q.data) return null;
    const d = q.data;
    const perHome = homes.map((h) => ({
      home: h,
      groups: homeownerCardGroups(
        d.cards.filter((c) => c.propertyId === h.id),
        { planOn: (p) => d.planOn[p] === true, hourEntries: d.hourEntries },
      ),
      total: d.cards.filter((c) => c.propertyId === h.id).length,
    }));
    const sent = sentForAnswer(d.reviews, d.approvals, (id) => (id ? d.roles[id] ?? "Our team" : "Our team"));
    return { perHome, sent };
  }, [q.data, homes]);

  if (ids.length === 0) return <p className="text-sm text-muted-foreground">{HAS_COPY.noCards}</p>;
  if (q.isLoading) return <p className="text-sm text-muted-foreground">{HAS_COPY.loading}</p>;
  if (q.isError || !view)
    return (
      <div className="space-y-2" role="alert">
        <p className="text-sm text-destructive">{HAS_COPY.failed}</p>
        <Button size="sm" variant="outline" className="min-h-11" onClick={() => void q.refetch()}>
          {HAS_COPY.tryAgain}
        </Button>
      </div>
    );

  const multi = homes.length > 1;
  return (
    <div className="space-y-5">
      <section className="space-y-3" aria-label={HAS_COPY.cards}>
        <h4 className="text-sm font-semibold">{HAS_COPY.cards}</h4>
        {view.perHome.map(({ home, groups, total }) => (
          <div key={home.id} className="space-y-3">
            {multi ? <p className="eyebrow">{home.name}</p> : null}
            {total === 0 ? (
              <p className="text-sm text-muted-foreground">{HAS_COPY.noCards}</p>
            ) : (
              <>
                {VISIBLE_GROUPS.map((g) => (
                  <GroupList key={g} group={g} items={groups[g]} />
                ))}
                {groups.hidden.length > 0 ? (
                  <details className="rounded-md border border-border">
                    <summary className="flex min-h-11 cursor-pointer items-center px-3 text-sm font-medium">
                      {HAS_COPY.groups.hidden} ({groups.hidden.length})
                    </summary>
                    <ul className="divide-y divide-border border-t border-border">
                      {groups.hidden.map((i) => (
                        <li key={i.id} className="px-3 py-2 text-sm">
                          <p>{i.title}</p>
                          <p className="text-xs text-muted-foreground">{i.line}</p>
                        </li>
                      ))}
                    </ul>
                  </details>
                ) : null}
              </>
            )}
          </div>
        ))}
      </section>
      <section className="space-y-2" aria-label={HAS_COPY.sent}>
        <h4 className="text-sm font-semibold">
          {HAS_COPY.sent} ({view.sent.length})
        </h4>
        <SentList items={view.sent} />
      </section>
    </div>
  );
}

/** Home page section: finds the home's Active Owner program; shows nothing for other homes. */
export function HomeownerHasSection({ propertyId, homeName, origin }: { propertyId: string; homeName: string; origin: string }) {
  const q = useQuery({ queryKey: ["home-program", propertyId], queryFn: () => loadHomeProgram(propertyId), retry: false });
  const homes = useMemo(() => [{ id: propertyId, name: homeName }], [propertyId, homeName]);
  if (q.isLoading) return null;
  if (q.isError)
    return (
      <section className="surface space-y-2 p-4" role="alert">
        <h3 className="font-semibold">{HAS_COPY.title}</h3>
        <p className="text-sm text-destructive">{HAS_COPY.failed}</p>
      </section>
    );
  const program = q.data;
  if (!program) return null;
  return (
    <section className="surface space-y-4 p-4" aria-label={HAS_COPY.title} id="homeowner-has">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">{HAS_COPY.title}</h3>
        <PreviewAsHomeownerButton programId={program.id} ownerName={program.ownerName} demo={program.isDemo} origin={origin} />
      </div>
      <HomeownerHasLists programId={program.id} demo={program.isDemo} homes={homes} />
    </section>
  );
}

/** Task drawer: what finishing or sending this Task did for the homeowner. Read only. */
export function TaskHomeownerLines({ taskId, done, completedAt }: { taskId: string; done: boolean; completedAt: string | null }) {
  const q = useQuery({
    queryKey: ["task-homeowner-lines", taskId, done, completedAt],
    queryFn: () => loadTaskHomeownerLines({ taskId, done, completedAt }),
    retry: false,
  });
  const lines = q.data ? [...q.data.opened, ...(q.data.sent ? [q.data.sent] : [])] : [];
  if (lines.length === 0) return null;
  return (
    <div className="space-y-0.5 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm" data-testid="task-homeowner-lines">
      {lines.map((l) => (
        <p key={l}>{l}</p>
      ))}
    </div>
  );
}
