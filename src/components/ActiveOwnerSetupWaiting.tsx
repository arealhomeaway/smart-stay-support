import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, UserPlus } from "lucide-react";
import { myActiveOwnerSetupItems } from "@/lib/active-owner-auto-enroll.functions";
import { useDemo } from "@/components/DemoProvider";

/** Needs you now: Active Owner homes waiting on a detail (homeowner email, closing date) or a fix. */
export function ActiveOwnerSetupWaiting() {
  const { demoMode } = useDemo();
  const load = useServerFn(myActiveOwnerSetupItems);
  const q = useQuery({ queryKey: ["active-owner-setup-items"], enabled: !demoMode, queryFn: () => load(), staleTime: 30_000 });
  const rows = q.data?.rows ?? [];
  if (demoMode || rows.length === 0) return null;
  return (
    <>
      {rows.map((r) => (
        <a
          key={r.id}
          href={r.link_path}
          data-needs-row="active_owner_setup"
          className="surface-row flex min-h-11 w-full items-center gap-3 px-4 py-3 text-left"
        >
          <UserPlus className="size-4 shrink-0 text-primary" aria-hidden="true" />
          <span className="min-w-0 flex-1">
            <span className="block font-medium">{r.title}</span>
            {r.detail ? <span className="block text-sm text-muted-foreground">{r.detail}</span> : null}
          </span>
          <ArrowRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        </a>
      ))}
    </>
  );
}
