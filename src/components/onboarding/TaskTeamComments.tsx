/**
 * Team comments on one onboarding Task (Task drawer, B3). The thread is the
 * existing onboarding_notes record for the Task; @ a role notifies the person
 * holding that role on this home through the existing note mention notice.
 * Internal only: homeowners and vendors never see it.
 */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AttachmentsPanel } from "@/components/AttachmentsPanel";
import { addOnboardingNoteFn } from "@/lib/onboarding.functions";
import { readProjectTeam } from "@/lib/onboarding-team.functions";
import { listAttachmentsFn } from "@/lib/attachments.functions";
import { mentionIds } from "@/lib/task-drawer";
import { usDateTime } from "@/lib/dates";

type Person = { id: string; full_name: string | null; email: string | null };
type Note = { id: string; body: string; mentions: string[] | null; author_id: string | null; created_at: string };

export function TaskTeamComments({
  taskId,
  propertyId,
  people,
  disabled,
}: {
  taskId: string;
  propertyId: string;
  people: Person[];
  disabled: boolean;
}) {
  const [body, setBody] = useState("");
  const [role, setRole] = useState("none");
  const [attaching, setAttaching] = useState(false);
  const [attached, setAttached] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const qc = useQueryClient();
  const add = useServerFn(addOnboardingNoteFn);
  const team = useServerFn(readProjectTeam);
  const listFiles = useServerFn(listAttachmentsFn);
  const key = ["task-team-comments", taskId];

  const notes = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("onboarding_notes")
        .select("id, body, mentions, author_id, created_at")
        .eq("task_id", taskId)
        .is("archived_at", null)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Note[];
    },
  });
  const roles = useQuery({ queryKey: ["project-team", propertyId], queryFn: () => team({ data: { propertyId } }) });
  const files = useQuery({
    queryKey: ["attachments", "onboarding_task", taskId],
    queryFn: () => listFiles({ data: { entityType: "onboarding_task", entityId: taskId } }),
  });
  const roleList = roles.data?.roles ?? [];
  const nameOf = (id: string | null) => {
    const p = people.find((x) => x.id === id);
    return p?.full_name || p?.email || "Teammate";
  };

  const post = useMutation({
    mutationFn: async () => {
      const names = attached
        .map((id) => (files.data?.files ?? []).find((f) => f.id === id))
        .map((f) => f?.title || f?.original_filename)
        .filter(Boolean);
      const chosen = roleList.find((r) => r.code === role);
      const text = [
        chosen ? `@${chosen.name} ${body.trim()}` : body.trim(),
        names.length ? `Attached: ${names.join(", ")}` : "",
      ].filter(Boolean).join("\n");
      return add({ data: { propertyId, taskId, body: text, mentions: mentionIds(chosen) } });
    },
    onSuccess: () => {
      setBody("");
      setRole("none");
      setAttached([]);
      setAttaching(false);
      void qc.invalidateQueries({ queryKey: key });
    },
    onError: (e: Error) => toast.error(e.message || "The comment could not be posted."),
  });

  return (
    <section className="space-y-3" aria-label="Team comments">
      <p className="eyebrow">Team comments</p>
      {(notes.data ?? []).length === 0 ? (
        <p className="text-sm text-muted-foreground">{notes.isLoading ? "Loading…" : "No comments yet."}</p>
      ) : (
        <ul className="space-y-2">
          {(notes.data ?? []).map((n) => (
            <li key={n.id} className="rounded-md border border-border p-3 text-sm">
              <p className="whitespace-pre-wrap">{n.body}</p>
              <p className="mt-1 text-xs text-muted-foreground">{nameOf(n.author_id)} · {usDateTime(n.created_at)}</p>
            </li>
          ))}
        </ul>
      )}
      {!disabled && (
        <div className="space-y-2">
          <Textarea
            rows={2}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Add a comment"
            aria-label="Add a comment"
          />
          <div className="flex flex-wrap items-center gap-2">
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger className="h-11 w-56" aria-label="Notify a role">
                <SelectValue placeholder="@ a role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No one</SelectItem>
                {roleList.map((r) => (
                  <SelectItem key={r.code} value={r.code} disabled={mentionIds(r).length === 0}>@{r.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" className="min-h-11" onClick={() => setAttaching((v) => !v)} aria-expanded={attaching}>
              Attach
            </Button>
            <Button
              className="min-h-11"
              disabled={post.isPending || uploading || body.trim().length === 0}
              onClick={() => post.mutate()}
            >
              Post comment
            </Button>
          </div>
          {attaching && (
            <AttachmentsPanel
              entityType="onboarding_task"
              entityId={taskId}
              title=""
              onUploadBusyChange={setUploading}
              onUploaded={(ids) => setAttached((cur) => [...cur.filter((id) => !ids.includes(id)), ...ids])}
            />
          )}
        </div>
      )}
    </section>
  );
}
