import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/ui/page";
import {
  decideItemMap, decideStepLink, loadItemMap, loadMapTemplateTitles, loadStepLinkSuggestions, loadStepTitles,
} from "@/lib/ao-data";
import { LOCK_SUGGESTION_LABEL, describeMatch } from "@/lib/ao-dedupe";

const human = (s: string) => s.replace(/^./, (c) => c.toUpperCase());

/** Card library: "Suggested step links" for Admin and the Onboarding Director. Accepting writes the link only. */
export function SuggestedStepLinks({ canEdit }: { canEdit: boolean }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["ao-step-link-suggestions"], queryFn: loadStepLinkSuggestions, retry: false });
  const rows = q.data?.available ? q.data.data : [];
  const ids = [...new Set(rows.flatMap((r) => r.template_task_ids))];
  const titles = useQuery({ queryKey: ["ao-step-titles", ids.join(",")], queryFn: () => loadStepTitles(ids), enabled: ids.length > 0 });
  const decide = useMutation({
    mutationFn: (v: { id: string; accept: boolean }) => decideStepLink(v.id, v.accept),
    onSuccess: (s) => { toast.success(s === "accepted" ? "Accepted" : "Rejected"); void qc.invalidateQueries({ queryKey: ["ao-step-link-suggestions"] }); void qc.invalidateQueries({ queryKey: ["ao-library"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  if (!q.data?.available) return null;
  const open = rows.filter((r) => r.status === "suggested");
  return (
    <SectionCard>
      <div className="space-y-1">
        <p className="font-medium">Suggested step links</p>
        <p className="text-sm text-muted-foreground">
          Locked cards open when their linked step is done. Accept a suggestion to link the step. Nothing changes until you accept.
        </p>
      </div>
      {open.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">No suggestions waiting.</p> : (
        <ul className="mt-3 divide-y">
          {open.map((r) => (
            <li key={r.id} className="flex flex-wrap items-start justify-between gap-3 py-2 text-sm">
              <div className="space-y-1">
                <p><span className="font-mono">{r.card_code}</span> <Badge variant="secondary">{human(r.confidence)} confidence</Badge></p>
                {r.suggestion_kind === "link" ? (
                  <ul className="list-disc pl-5">
                    {r.template_task_ids.map((id) => (
                      <li key={id}>{titles.data?.[id]?.title ?? "Step"} <span className="text-muted-foreground">({titles.data?.[id]?.template ?? "plan"})</span></li>
                    ))}
                  </ul>
                ) : <p>{LOCK_SUGGESTION_LABEL[r.proposed_lock ?? ""] ?? r.proposed_lock}</p>}
                <p className="text-muted-foreground">{r.note}</p>
              </div>
              {canEdit ? (
                <div className="flex gap-2">
                  <Button size="sm" disabled={decide.isPending} onClick={() => decide.mutate({ id: r.id, accept: true })}>Accept</Button>
                  <Button size="sm" variant="outline" disabled={decide.isPending} onClick={() => decide.mutate({ id: r.id, accept: false })}>Reject</Button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

/** Card library: existing owner items that already cover a card. Only confirmed matches count. */
export function ExistingItemMatches({ canEdit }: { canEdit: boolean }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["ao-item-map"], queryFn: loadItemMap, retry: false });
  const rows = q.data?.available ? q.data.data : [];
  const tplIds = rows.filter((r) => r.match_kind === "template_id").map((r) => r.match_value);
  const tpl = useQuery({ queryKey: ["ao-map-templates", tplIds.join(",")], queryFn: () => loadMapTemplateTitles(tplIds), enabled: tplIds.length > 0 });
  const decide = useMutation({
    mutationFn: (v: { id: string; status: "confirmed" | "rejected" | "suggested" }) => decideItemMap(v.id, v.status),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["ao-item-map"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  if (!q.data?.available) return null;
  return (
    <SectionCard>
      <div className="space-y-1">
        <p className="font-medium">Existing items that cover a card</p>
        <p className="text-sm text-muted-foreground">
          When a home already has one of these owner items, switching on its plan marks the card as already covered, and new sends point to the card.
          Only confirmed matches count.
        </p>
      </div>
      <ul className="mt-3 divide-y">
        {rows.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-2 text-sm">
            <div>
              <span className="font-mono">{r.card_code}</span> {describeMatch(r, tpl.data ?? {})}
              <Badge className="ml-2" variant={r.status === "confirmed" ? "default" : "secondary"}>{human(r.status)}</Badge>
            </div>
            {canEdit ? (
              <div className="flex gap-2">
                {r.status !== "confirmed" ? <Button size="sm" disabled={decide.isPending} onClick={() => decide.mutate({ id: r.id, status: "confirmed" })}>Confirm</Button> : null}
                {r.status !== "rejected" ? <Button size="sm" variant="outline" disabled={decide.isPending} onClick={() => decide.mutate({ id: r.id, status: "rejected" })}>Reject</Button> : null}
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}
