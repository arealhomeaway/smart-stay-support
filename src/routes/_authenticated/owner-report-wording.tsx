import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { RequireCapability } from "@/components/RequireCapability";
import { EmptyState, LoadingPage, PageHeader, SectionCard } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useRole } from "@/hooks/useRole";
import { NOT_SET_UP } from "@/lib/ao-ui";
import { usDate } from "@/lib/ao-format";
import { wordingProblem } from "@/lib/report-v2";
import { loadWordingVersions, saveWordingVersion } from "@/lib/report-wording-data";

export const Route = createFileRoute("/_authenticated/owner-report-wording")({
  head: () => ({
    meta: [
      { title: "Report wording | Resolve" },
      { name: "description", content: "The six approved sentences printed on every participation report." },
      { property: "og:title", content: "Report wording | Resolve" },
      { property: "og:description", content: "Edit and version the approved participation report wording." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <RequireCapability capability="owner_program_admin">
      <WordingPage />
    </RequireCapability>
  ),
});

function WordingPage() {
  const role = useRole();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["report-wording"], queryFn: loadWordingVersions, retry: false });
  const current = q.data?.available ? q.data.data[0] : undefined;
  const [draft, setDraft] = useState<string[]>([]);
  const [note, setNote] = useState("");
  useEffect(() => {
    if (current) setDraft([...current.sentences]);
  }, [current?.version]);
  const save = useMutation({
    mutationFn: () => saveWordingVersion(draft, note),
    onSuccess: (v) => {
      toast.success(`Saved as version ${v}`);
      setNote("");
      void qc.invalidateQueries({ queryKey: ["report-wording"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });
  const header = <PageHeader eyebrow="Active Owner" title="Report wording" description="The six sentences every participation report prints. Each report records the version it used." />;

  if (q.isLoading) return <LoadingPage />;
  if (q.error) return <div className="space-y-6">{header}<EmptyState title="Could not load report wording" hint={(q.error as Error).message} /></div>;
  if (!q.data?.available || !current)
    return <div className="space-y-6">{header}<EmptyState title={NOT_SET_UP} hint="Reports use the standard wording until this is set up." /></div>;

  const problem = wordingProblem(draft);
  const changed = draft.some((s, i) => s !== current.sentences[i]);
  const versions = q.data.data;

  return (
    <div className="space-y-6">
      {header}
      <SectionCard title={`Current: version ${current.version}`}>
        <div className="space-y-4">
          {draft.map((s, i) => (
            <div key={i} className="space-y-1">
              <Label htmlFor={`w-${i}`} className="text-xs">Sentence {i + 1}</Label>
              <Textarea id={`w-${i}`} value={s} readOnly={!role.isAdmin} onChange={(e) => setDraft(draft.map((x, j) => (j === i ? e.target.value : x)))} />
            </div>
          ))}
          {role.isAdmin ? (
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <Label htmlFor="w-note" className="text-xs">What changed</Label>
                <Input id="w-note" value={note} onChange={(e) => setNote(e.target.value)} className="w-80" />
              </div>
              <Button onClick={() => save.mutate()} disabled={!changed || Boolean(problem) || save.isPending}>Save new version</Button>
              {changed && problem ? <p className="text-sm text-destructive">{problem}</p> : null}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Only an Admin can change report wording.</p>
          )}
        </div>
      </SectionCard>
      <SectionCard title="History">
        <ul className="divide-y">
          {versions.map((v) => (
            <li key={v.version} className="py-2 text-sm">
              <p className="font-medium">Version {v.version}, saved {usDate(v.created_at)}</p>
              {v.note ? <p className="text-xs text-muted-foreground">{v.note}</p> : null}
            </li>
          ))}
        </ul>
      </SectionCard>
    </div>
  );
}
