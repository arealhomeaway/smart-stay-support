/** 2.3 Team: four round initials in role colors; a dashed circle when not assigned (Director, Admin pick from it). */
import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { HomeRow, Person, TeamRole } from "@/lib/onboarding-home";

export const ROLE_NAME: Record<TeamRole, string> = { pm: "PM", designer: "Designer", utilities: "Utilities", stager: "Stager" };
const FILL: Record<TeamRole, string> = {
  pm: "bg-role-you-bar text-primary-foreground",
  designer: "bg-role-designer-bar text-primary-foreground",
  utilities: "bg-role-utilities-bar text-primary-foreground",
  stager: "bg-role-director-bar text-primary-foreground",
};

export function initials(name: string): string {
  const parts = name.replace(/[^\p{L}\p{N} ]/gu, " ").trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1]![0] : "")).toUpperCase() || "?";
}

export type AssignChoice = { role: TeamRole; person: Person };

function Circle({ role, person }: { role: TeamRole; person: Person }) {
  return (
    <span
      title={`${ROLE_NAME[role]}: ${person.name}`}
      aria-label={`${ROLE_NAME[role]}: ${person.name}`}
      className={cn("inline-flex size-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ring-2 ring-card", FILL[role])}
    >
      {initials(person.name)}
    </span>
  );
}

function Empty(p: { role: TeamRole; options: Person[] | null; onPick: (person: Person) => void; busy: boolean }) {
  const [open, setOpen] = useState(false);
  const dashed = (
    <span
      title={`${ROLE_NAME[p.role]}: not assigned`}
      className="inline-flex size-8 shrink-0 items-center justify-center rounded-full border-2 border-dashed border-role-unassigned-border bg-role-unassigned-bg text-[10px] text-role-unassigned-fg"
    >
      {ROLE_NAME[p.role][0]}
    </span>
  );
  if (!p.options) return <span aria-label={`${ROLE_NAME[p.role]}: not assigned`}>{dashed}</span>;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Assign ${ROLE_NAME[p.role]}`}
          onClick={(e) => e.stopPropagation()}
          className="inline-flex size-11 items-center justify-center rounded-full hover:bg-muted"
        >
          {dashed}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-1" onClick={(e) => e.stopPropagation()}>
        <p className="px-2 py-1.5 text-xs font-medium text-muted-foreground">{p.role === "stager" ? "Staging vendors" : `People who hold ${ROLE_NAME[p.role]}`}</p>
        {p.options.length === 0 ? (
          <p className="px-2 py-1.5 text-sm text-muted-foreground">No one to pick yet.</p>
        ) : (
          <ul className="max-h-64 overflow-y-auto">
            {p.options.map((o) => (
              <li key={o.id}>
                <button
                  type="button"
                  disabled={p.busy}
                  onClick={() => {
                    setOpen(false);
                    p.onPick(o);
                  }}
                  className="flex min-h-11 w-full items-center rounded-md px-2 text-left text-sm hover:bg-muted disabled:opacity-50"
                >
                  {o.name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}

export function TeamCircles(p: {
  row: HomeRow;
  /** Pickers for Director and Admin; null for everyone else (the circle is not clickable). */
  pickers: Record<TeamRole, Person[]> | null;
  onAssign: (row: HomeRow, choice: AssignChoice) => void;
  busy: boolean;
}) {
  const t = p.row.team;
  const can = Boolean(p.pickers && p.row.projectId);
  const slot = (role: Exclude<TeamRole, "stager">, person: Person | null) =>
    person ? (
      <Circle key={role} role={role} person={person} />
    ) : (
      <Empty key={role} role={role} options={can ? p.pickers![role] : null} busy={p.busy} onPick={(x) => p.onAssign(p.row, { role, person: x })} />
    );
  return (
    <div className="flex items-center -space-x-1" aria-label="Team">
      {slot("pm", t.pm)}
      {slot("designer", t.designer)}
      {slot("utilities", t.utilities)}
      {t.stagers.length ? (
        t.stagers.map((s) => <Circle key={s.id} role="stager" person={s} />)
      ) : (
        <Empty role="stager" options={can ? p.pickers!.stager : null} busy={p.busy} onPick={(x) => p.onAssign(p.row, { role: "stager", person: x })} />
      )}
    </div>
  );
}

export function TeamLegend() {
  return (
    <ul className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground" aria-label="Team colors">
      {(Object.keys(ROLE_NAME) as TeamRole[]).map((r) => (
        <li key={r} className="inline-flex items-center gap-1.5">
          <span className={cn("inline-block size-3 rounded-full", FILL[r])} aria-hidden="true" />
          {ROLE_NAME[r]}
        </li>
      ))}
      <li className="inline-flex items-center gap-1.5">
        <span className="inline-block size-3 rounded-full border-2 border-dashed border-role-unassigned-border" aria-hidden="true" />
        Not assigned
      </li>
    </ul>
  );
}
