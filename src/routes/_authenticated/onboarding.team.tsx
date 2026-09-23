import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, UserMinus, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LoadingPage, SectionCard } from "@/components/ui/page";
import { PersonAvatar } from "@/components/PersonAvatar";
import { readOnboardingTeam } from "@/lib/onboarding-team.functions";
import { setSeatHolder } from "@/lib/coverage-admin.functions";

export const Route = createFileRoute("/_authenticated/onboarding/team")({
  head: () => ({
    meta: [
      { title: "Onboarding team — Resolve" },
      { name: "description", content: "Who holds each Onboarding role, and which roles still need a person." },
      { property: "og:title", content: "Onboarding team — Resolve" },
      { property: "og:description", content: "Manage the Onboarding team's roles in one place." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OnboardingTeamPage,
});

const KEY = ["onboarding-team"];

function OnboardingTeamPage() {
  const load = useServerFn(readOnboardingTeam);
  const setSeat = useServerFn(setSeatHolder);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: KEY, queryFn: () => load() });
  const [person, setPerson] = useState("");
  const [role, setRole] = useState("");

  const mutation = useMutation({
    mutationFn: (v: { roleCode: string; userId: string | null }) => setSeat({ data: v }),
    onSuccess: () => {
      toast.success("Onboarding team updated.");
      setPerson("");
      setRole("");
      void qc.invalidateQueries({ queryKey: KEY });
      void qc.invalidateQueries({ queryKey: ["staff-directory"] });
    },
    onError: (e: Error) => toast.error(e.message || "The change could not be saved."),
  });

  if (isLoading || !data) return <LoadingPage />;
  const nameOf = (id: string | null) => {
    const p = data.people.find((x) => x.id === id);
    return p?.full_name || p?.email || "Former teammate";
  };
  const unfilled = data.roles.filter((r) => !r.holder && r.required);
  const members = new Map<string, string[]>();
  for (const r of data.roles) {
    if (!r.holder) continue;
    members.set(r.holder, [...(members.get(r.holder) ?? []), r.code]);
  }
  const busy = mutation.isPending || !data.canEdit;

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow">Manage Onboarding</p>
        <h1 className="text-2xl font-semibold">Onboarding team</h1>
        <p className="text-sm text-muted-foreground">
          New onboarding Tasks go to whoever holds each role. Changing a person here never changes the
          workflow.
        </p>
      </div>

      {!data.canEdit && (
        <p className="rounded-md border p-3 text-sm text-muted-foreground">
          You can view the team. Only Onboarding or Operations leadership can change it.
        </p>
      )}

      {unfilled.length > 0 && (
        <SectionCard tone="critical" title="Roles that need a person">
          <ul className="space-y-1 text-sm">
            {unfilled.map((r) => (
              <li key={r.code} className="flex items-center gap-2">
                <AlertTriangle className="size-4 text-destructive" /> {r.name} — Tasks for this role
                have nobody to go to.
              </li>
            ))}
          </ul>
        </SectionCard>
      )}

      <SectionCard title="Roles" bodyClassName="divide-y">
        {data.roles.map((r) => (
          <div key={r.code} className="flex flex-wrap items-center gap-3 py-3">
            <div className="min-w-48 flex-1">
              <p className="font-medium">{r.name}</p>
              <p className="text-xs text-muted-foreground">
                {r.required ? "Used by the published workflow" : "Onboarding role"}
              </p>
            </div>
            <Select
              value={r.holder ?? ""}
              disabled={busy}
              onValueChange={(v) => mutation.mutate({ roleCode: r.code, userId: v })}
            >
              <SelectTrigger className="w-64">
                <SelectValue placeholder="Unfilled — choose a person" />
              </SelectTrigger>
              <SelectContent>
                {data.people.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.full_name || p.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {r.holder && (
              <Button
                size="sm"
                variant="ghost"
                disabled={busy}
                onClick={() => mutation.mutate({ roleCode: r.code, userId: null })}
              >
                Clear
              </Button>
            )}
          </div>
        ))}
      </SectionCard>

      <SectionCard title="Team members" bodyClassName="divide-y">
        {members.size === 0 && (
          <p className="text-sm text-muted-foreground">Nobody holds an Onboarding role yet.</p>
        )}
        {[...members.entries()].map(([id, codes]) => (
          <div key={id} className="flex items-center gap-3 py-3">
            <PersonAvatar name={nameOf(id)} size="sm" />
            <div className="flex-1">
              <p className="font-medium">{nameOf(id)}</p>
              <p className="text-xs text-muted-foreground">
                {codes.map((c) => data.roles.find((r) => r.code === c)?.name).join(", ")}
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={async () => {
                for (const c of codes) await mutation.mutateAsync({ roleCode: c, userId: null });
              }}
            >
              <UserMinus className="mr-1.5 size-4" /> Remove from team
            </Button>
          </div>
        ))}

        <div className="flex flex-wrap items-center gap-2 pt-4">
          <Select value={person} onValueChange={setPerson} disabled={busy}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Team member" />
            </SelectTrigger>
            <SelectContent>
              {data.people.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.full_name || p.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={role} onValueChange={setRole} disabled={busy}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Onboarding role" />
            </SelectTrigger>
            <SelectContent>
              {data.roles.map((r) => (
                <SelectItem key={r.code} value={r.code}>
                  {r.name}
                  {r.holder ? ` (replaces ${nameOf(r.holder)})` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            disabled={busy || !person || !role}
            onClick={() => mutation.mutate({ roleCode: role, userId: person })}
          >
            <UserPlus className="mr-1.5 size-4" /> Add to team
          </Button>
        </div>
      </SectionCard>

      <p className="text-xs text-muted-foreground">
        Need to invite someone new to Resolve? An administrator can do that from{" "}
        <Link to="/team" className="underline">
          Executive Administration
        </Link>
        .
      </p>
    </div>
  );
}
