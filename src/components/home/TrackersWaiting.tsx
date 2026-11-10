/**
 * Needs you now, Build 14 (register BN7, BN9): Team records left to review, the weekly scorecard
 * due or returned (the Operations Supervisor), and a submitted scorecard or double checks waiting
 * (the Director of Operations). The database decides who sees what (public.trackers_waiting).
 */
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, ClipboardCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Item = { kind: string; title: string; link: "/team-records" | "/weekly-scorecard"; due_on?: string; week_start?: string };

export function TrackersWaiting() {
  const q = useQuery({
    queryKey: ["trackers-waiting"],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<Item[]> => {
      const { data, error } = await supabase.rpc("trackers_waiting");
      if (error) return [];
      return (data ?? []) as unknown as Item[];
    },
  });
  return (
    <>
      {(q.data ?? []).map((i) => (
        <Link
          key={`${i.kind}:${i.due_on ?? i.week_start ?? ""}`}
          to={i.link}
          search={i.link === "/weekly-scorecard" ? { due: i.due_on } : { week: i.week_start }}
          data-needs-row={`tracker-${i.kind}`}
          className="surface-row flex min-h-11 w-full items-center gap-3 px-4 py-3 text-left"
        >
          <ClipboardCheck className="size-4 shrink-0 text-primary" aria-hidden="true" />
          <span className="min-w-0 flex-1">
            <span className="block font-medium">{i.title}</span>
          </span>
          <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
        </Link>
      ))}
    </>
  );
}
