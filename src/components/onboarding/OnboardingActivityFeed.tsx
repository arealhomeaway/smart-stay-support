import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Bell, BellOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/ui/page";
import { usDateTime } from "@/lib/dates";
import { useDemo } from "@/components/DemoProvider";

type Event = { id: string; at: string; who: string; action: string; item: string; propertyId: string; taskId: string | null };

/**
 * Recent onboarding activity across the homes this person may read (RLS):
 * owner replies, Task completions and comments. Read-only.
 */
export function OnboardingActivityFeed() {
  const { demoMode } = useDemo();
  const q = useQuery({
    queryKey: ["onboarding-activity", demoMode],
    staleTime: 60_000,
    queryFn: async (): Promise<Event[]> => {
      const since = new Date(Date.now() - 14 * 864e5).toISOString();
      const [msgs, done, notes, ownerDone, reviews] = await Promise.all([
        supabase.from("owner_request_messages").select("id, created_at, author_name, property_id, task_id, work_item_id")
          .eq("author_type", "homeowner").eq("is_demo", demoMode).gte("created_at", since).order("created_at", { ascending: false }).limit(20),
        supabase.from("onboarding_tasks").select("id, title, completed_at, completed_by, property_id")
          .eq("status", "complete").eq("is_demo", demoMode).gte("completed_at", since).order("completed_at", { ascending: false }).limit(20),
        supabase.from("onboarding_notes").select("id, created_at, author_id, property_id, task_id")
          .not("task_id", "is", null).eq("is_demo", demoMode).is("archived_at", null).gte("created_at", since).order("created_at", { ascending: false }).limit(20),
        supabase.from("work_items").select("id, title, completed_at, property_id, source_task_id")
          .eq("kind", "opportunity").eq("status", "complete").eq("is_demo", demoMode).gte("completed_at", since).order("completed_at", { ascending: false }).limit(20),
        supabase.from("owner_completion_reviews").select("id, created_at, actor_id, status, owner_feedback_message_id, work_items(title, property_id, source_task_id)")
          .eq("is_demo", demoMode).gte("created_at", since).order("created_at", { ascending: false }).limit(20),
      ]);
      const ids = new Set<string>();
      done.data?.forEach((d) => d.completed_by && ids.add(d.completed_by));
      notes.data?.forEach((n) => n.author_id && ids.add(n.author_id));
      reviews.data?.forEach((r) => r.actor_id && ids.add(r.actor_id));
      const { data: people } = ids.size
        ? await supabase.from("profiles").select("id, full_name, email").in("id", [...ids])
        : { data: [] as { id: string; full_name: string | null; email: string | null }[] };
      const nm = (id: string | null) => {
        const p = people?.find((x) => x.id === id);
        return p?.full_name ?? p?.email ?? "A teammate";
      };
      const out: Event[] = [
        ...(msgs.data ?? []).map((m) => ({ id: `m${m.id}`, at: m.created_at, who: m.author_name ?? "Homeowner", action: "replied", item: "Owner conversation", propertyId: m.property_id!, taskId: m.task_id })),
        ...(done.data ?? []).map((d) => ({ id: `d${d.id}`, at: d.completed_at!, who: nm(d.completed_by), action: "completed", item: d.title, propertyId: d.property_id, taskId: d.id })),
        ...(notes.data ?? []).map((n) => ({ id: `n${n.id}`, at: n.created_at, who: nm(n.author_id), action: "commented", item: "Task comment", propertyId: n.property_id, taskId: n.task_id })),
        ...(ownerDone.data ?? []).map((w) => ({ id: `o${w.id}`, at: w.completed_at!, who: "Homeowner", action: "completed", item: w.title, propertyId: w.property_id!, taskId: w.source_task_id })),
        ...(reviews.data ?? []).map((r) => {
          const w = r.work_items as unknown as { title: string; property_id: string; source_task_id: string | null } | null;
          const verb = r.status === "reviewed" ? "reviewed owner completion" : r.status === "follow_up_needed" ? "flagged follow-up on" : "returned to review";
          return { id: `r${r.id}`, at: r.created_at, who: nm(r.actor_id), action: r.owner_feedback_message_id ? `${verb} (feedback sent)` : verb, item: w?.title ?? "Owner completion", propertyId: w?.property_id ?? "", taskId: w?.source_task_id ?? null };
        }),
      ].filter((e) => e.propertyId);
      return out.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 15);
    },
  });
  return (
    <SectionCard title="Recent activity" description="Owner replies, completions and comments from the last two weeks.">
      {(q.data ?? []).length === 0 ? (
        <p className="text-sm text-muted-foreground">No recent activity.</p>
      ) : (
        <ul className="divide-y">
          {q.data!.map((e) => (
            <li key={e.id} className="py-2 text-sm">
              <Link
                to="/onboarding/$propertyId"
                params={{ propertyId: e.propertyId }}
                search={{ tab: "work", ...(e.taskId ? { task: e.taskId } : {}) } as never}
                className="hover:underline"
              >
                <span className="font-medium">{e.who}</span> {e.action} · {e.item}
              </Link>
              <span className="numeric block text-xs text-muted-foreground">{usDateTime(e.at)}</span>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

/** Follow a home to get its owner replies, completions and comments in your bell. */
export function FollowHomeButton({ propertyId }: { propertyId: string }) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["onboarding-follow", propertyId],
    queryFn: async () => {
      const { data } = await supabase.from("onboarding_follows").select("property_id").eq("property_id", propertyId).maybeSingle();
      return Boolean(data);
    },
  });
  const toggle = async () => {
    if (q.data) await supabase.from("onboarding_follows").delete().eq("property_id", propertyId);
    else await supabase.from("onboarding_follows").insert({ property_id: propertyId });
    void qc.invalidateQueries({ queryKey: ["onboarding-follow", propertyId] });
  };
  return (
    <Button size="sm" variant="outline" onClick={toggle} disabled={q.isLoading}>
      {q.data ? <BellOff className="size-4" /> : <Bell className="size-4" />}
      {q.data ? "Unfollow" : "Follow this home"}
    </Button>
  );
}
