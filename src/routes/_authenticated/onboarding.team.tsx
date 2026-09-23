import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LoadingPage, SectionCard } from "@/components/ui/page";
import { PersonAvatar } from "@/components/PersonAvatar";
import {
  addRolePoolMember,
  readOnboardingTeam,
  removeRolePoolMember,
  setOnboardingDirector,
  setProjectPrimaryPM,
} from "@/lib/onboarding-team.functions";

export const Route = createFileRoute("/_authenticated/onboarding/team")({
  head: () => ({
    meta: [
      { title: "Onboarding team — Resolve" },
      { name: "description", content: "The Onboarding Director, Project Managers and support roles, and each home's Primary Project Manager." },
      { property: "og:title", content: "Onboarding team — Resolve" },
      { property: "og:description", content: "Manage the Onboarding team's roles in one place." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OnboardingTeamPage,
});

const KEY = ["onboarding-team"];
type Person = { id: string; full_name: string | null; email: string | null };

function OnboardingTeamPage() {
  const load = useServerFn(readOnboardingTeam);
  const addFn = useServerFn(addRolePoolMember);
  const removeFn = useServerFn(removeRolePoolMember);
  const directorFn = useServerFn(setOnboardingDirector);
  const pmFn = useServerFn(setProjectPrimaryPM);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: KEY, queryFn: () => load() });

  const done = (msg = "Onboarding team updated.") => {
    toast.success(msg);
    void qc.invalidateQueries({ queryKey: KEY });
    void qc.invalidateQueries({ queryKey: ["staff-directory"] });
  };
  const onError = (e: Error) => toast.error(e.message || "The change could not be saved.");

  const add = useMutation({ mutationFn: (v: { roleCode: string; userId: string }) => addFn({ data: v }), onSuccess: () => done(), onError });
  const remove = useMutation({ mutationFn: (v: { roleCode: string; userId: string }) => removeFn({ data: v }), onSuccess: () => done(), onError });
  const director = useMutation({ mutationFn: (userId: string | null) => directorFn({ data: { userId } }), onSuccess: () => done(), onError });
  const pm = useMutation({
    mutationFn: (v: { projectId: string; userId: string | null; reassignPending: boolean }) => pmFn({ data: v }),
    onSuccess: (r) => done(r.moved ? `Project manager changed. ${r.moved} pending Task(s) moved.` : "Project manager changed."),
    onError,
  });

  if (isLoading || !data) return <LoadingPage />;
  const nameOf = (id: string | null) => {
    const p = data.people.find((x) => x.id === id);
    return p?.full_name || p?.email || "Former teammate";
  };
  const busy = !data.canEdit || add.isPending || remove.isPending || director.isPending || pm.isPending;
  const unfilled = [
    ...(data.director.holder ? [] : ["Onboarding Director"]),
    ...data.pools.filter((p) => p.required && p.members.length === 0).map((p) => p.name),
  ];
  const pmPool = data.pools.find((p) => p.code === "onboarding_project_manager")?.members ?? [];

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow">Manage Onboarding</p>
        <h1 className="text-2xl font-semibold">Onboarding team</h1>
        <p className="text-sm text-muted-foreground">
          Roles decide where Tasks go by default. The Onboarding Director can still take or reassign any
          Onboarding Task. Property Coordinators are managed by Operations.
        </p>
      </div>

      {!data.canEdit && (
        <p className="rounded-md border p-3 text-sm text-muted-foreground">
          You can view the team. Only the Onboarding Director or leadership can change it.
        </p>
      )}

      {unfilled.length > 0 && (
        <SectionCard tone="critical" title="Roles that need a person">
          <ul className="space-y-1 text-sm">
            {unfilled.map((n) => (
              <li key={n} className="flex items-center gap-2">
                <AlertTriangle className="size-4 text-destructive" /> {n}
              </li>
            ))}
          </ul>
        </SectionCard>
      )}

      <SectionCard title="Onboarding Director" description="One person. Leads onboarding and can work any Task.">
        <PersonSelect
          people={data.people}
          value={data.director.holder}
          disabled={busy}
          placeholder="Unfilled — choose the Director"
          onChange={(id) => director.mutate(id)}
        />
      </SectionCard>

      {data.pools.map((pool) => (
        <PoolCard
          key={pool.code}
          title={pool.name}
          description={
            pool.code === "onboarding_project_manager"
              ? "Everyone who can be a home's Primary Project Manager."
              : "Team members who take this role's Tasks."
          }
          members={pool.members}
          people={data.people}
          nameOf={nameOf}
          disabled={busy}
          onAdd={(userId) => add.mutate({ roleCode: pool.code, userId })}
          onRemove={(userId) => remove.mutate({ roleCode: pool.code, userId })}
        />
      ))}

      <SectionCard
        title="Primary Project Manager by home"
        description="Project Manager Tasks on each home go to that home's Primary Project Manager."
        bodyClassName="divide-y"
      >
        {data.projects.length === 0 && (
          <p className="text-sm text-muted-foreground">No homes are in onboarding right now.</p>
        )}
        {data.projects.map((p) => (
          <ProjectPMRow
            key={p.id}
            name={p.propertyName}
            current={p.projectManager}
            pool={data.people.filter((x) => pmPool.includes(x.id) || x.id === p.projectManager)}
            disabled={busy}
            onSave={(userId, reassignPending) => pm.mutate({ projectId: p.id, userId, reassignPending })}
          />
        ))}
      </SectionCard>

      <p className="text-xs text-muted-foreground">
        Need to invite someone new to Resolve? An administrator can do that from{" "}
        <Link to="/team" className="underline">Executive Administration</Link>.
      </p>
    </div>
  );
}

function PersonSelect({
  people,
  value,
  disabled,
  placeholder,
  onChange,
}: {
  people: Person[];
  value: string | null;
  disabled: boolean;
  placeholder: string;
  onChange: (id: string) => void;
}) {
  return (
    <Select value={value ?? ""} disabled={disabled} onValueChange={onChange}>
      <SelectTrigger className="w-64">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {people.map((p) => (
          <SelectItem key={p.id} value={p.id}>
            {p.full_name || p.email}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function PoolCard(props: {
  title: string;
  description: string;
  members: string[];
  people: Person[];
  nameOf: (id: string) => string;
  disabled: boolean;
  onAdd: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const [pick, setPick] = useState("");
  const candidates = props.people.filter((p) => !props.members.includes(p.id));
  return (
    <SectionCard title={props.title} description={props.description} bodyClassName="space-y-3">
      {props.members.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nobody yet.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {props.members.map((id) => (
            <span key={id} className="inline-flex items-center gap-2 rounded-full border py-1 pl-1 pr-2 text-sm">
              <PersonAvatar name={props.nameOf(id)} size="sm" />
              {props.nameOf(id)}
              <button
                type="button"
                aria-label={`Remove ${props.nameOf(id)}`}
                disabled={props.disabled}
                onClick={() => props.onRemove(id)}
                className="text-muted-foreground hover:text-foreground disabled:opacity-50"
              >
                <X className="size-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <PersonSelect people={candidates} value={pick || null} disabled={props.disabled} placeholder="Add a team member" onChange={setPick} />
        <Button
          size="sm"
          disabled={props.disabled || !pick}
          onClick={() => {
            props.onAdd(pick);
            setPick("");
          }}
        >
          <UserPlus className="mr-1.5 size-4" /> Add
        </Button>
      </div>
    </SectionCard>
  );
}

function ProjectPMRow(props: {
  name: string;
  current: string | null;
  pool: Person[];
  disabled: boolean;
  onSave: (userId: string | null, reassign: boolean) => void;
}) {
  const [next, setNext] = useState<string | null>(props.current);
  const [reassign, setReassign] = useState(true);
  const changed = next !== props.current;
  return (
    <div className="flex flex-wrap items-center gap-3 py-3">
      <p className="min-w-48 flex-1 font-medium">{props.name}</p>
      <PersonSelect people={props.pool} value={next} disabled={props.disabled} placeholder="No Primary PM" onChange={setNext} />
      {changed && (
        <>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={reassign} onCheckedChange={(v) => setReassign(v === true)} />
            Move pending PM Tasks to the new PM
          </label>
          <Button size="sm" disabled={props.disabled} onClick={() => props.onSave(next, reassign)}>
            Save
          </Button>
        </>
      )}
    </div>
  );
}
