import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ExternalLink, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BREEZEWAY_DEPARTMENTS, BREEZEWAY_PRIORITIES } from "@/lib/breezeway-outbound";
import {
  breezewayOutboundState,
  createBreezewayOutboundTask,
} from "@/lib/breezeway-outbound.functions";

type Props = {
  sourceType: "ticket" | "onboarding_task";
  sourceId: string;
  defaultTitle: string;
  defaultDescription?: string | null;
};

const STATUS_LABEL: Record<string, string> = {
  creating: "Sending",
  created: "Created in Breezeway",
  synced: "Confirmed by Breezeway",
  error: "Failed",
};

/**
 * Send-to-Breezeway control for one Resolve record.
 *
 * Resolve stays the source of truth: this creates a downstream Breezeway task
 * and records the link. A fresh request key is minted per composed request, so
 * double-clicks and retries can never produce two Breezeway tasks — only a
 * deliberate new send does.
 */
export function BreezewayTaskPanel({
  sourceType,
  sourceId,
  defaultTitle,
  defaultDescription,
}: Props) {
  const qc = useQueryClient();
  const stateFn = useServerFn(breezewayOutboundState);
  const createFn = useServerFn(createBreezewayOutboundTask);

  const [title, setTitle] = useState(defaultTitle);
  const [description, setDescription] = useState(defaultDescription ?? "");
  const [department, setDepartment] = useState<string>("maintenance");
  const [priority, setPriority] = useState<string>("normal");
  const [scheduledDate, setScheduledDate] = useState("");
  const [requestKey, setRequestKey] = useState(() => crypto.randomUUID());

  useEffect(() => {
    setTitle(defaultTitle);
  }, [defaultTitle]);

  const queryKey = useMemo(() => ["breezeway-outbound", sourceType, sourceId], [sourceType, sourceId]);

  const state = useQuery({
    queryKey,
    queryFn: () => stateFn({ data: { sourceType, sourceId } }),
  });

  const send = useMutation({
    mutationFn: () =>
      createFn({
        data: {
          sourceType,
          sourceId,
          requestKey,
          title,
          description: description || null,
          department,
          priority,
          scheduledDate: scheduledDate || null,
        },
      }),
    onSuccess: (result) => {
      if (result && "ok" in result && !result.ok) {
        toast.error(result.message);
      } else {
        toast.success("Sent to Breezeway.");
        // A new key means the next send is a deliberate second task, not a retry.
        setRequestKey(crypto.randomUUID());
      }
      void qc.invalidateQueries({ queryKey });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (state.isLoading || !state.data) return null;

  const { eligibility, links } = state.data;
  if (!eligibility.enabled && links.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ExternalLink className="size-4" /> Breezeway
          <Badge variant={eligibility.eligible ? "default" : "secondary"}>
            {eligibility.eligible ? "Pilot property" : "Unavailable"}
          </Badge>
        </CardTitle>
        <CardDescription>
          Creates a Breezeway task from this record. Resolve stays the source of truth — Breezeway
          never changes anything here.
          {eligibility.reason ? ` ${eligibility.reason}` : ""}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {links.length ? (
          <ul className="space-y-2">
            {links.map((link) => (
              <li
                key={link.id}
                className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-3 text-xs"
              >
                <Badge variant={link.status === "error" ? "destructive" : "outline"}>
                  {STATUS_LABEL[link.status] ?? link.status}
                </Badge>
                <span className="font-medium">{link.title}</span>
                {link.breezewayTaskId ? (
                  <span className="font-mono text-muted-foreground">#{link.breezewayTaskId}</span>
                ) : null}
                <span className="text-muted-foreground">
                  {new Date(link.createdAt).toLocaleString()}
                </span>
                {link.errorMessage ? (
                  <span className="text-destructive">{link.errorMessage}</span>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}

        {eligibility.eligible ? (
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="bz-title">Task title</Label>
              <Input id="bz-title" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="bz-desc">Description</Label>
              <Textarea
                id="bz-desc"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="grid gap-1.5">
                <Label>Department</Label>
                <Select value={department} onValueChange={setDepartment}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BREEZEWAY_DEPARTMENTS.map((d) => (
                      <SelectItem key={d} value={d}>
                        {d}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>Priority</Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BREEZEWAY_PRIORITIES.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="bz-date">Scheduled date</Label>
                <Input
                  id="bz-date"
                  type="date"
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                />
              </div>
            </div>
            <div>
              <Button disabled={send.isPending || !title.trim()} onClick={() => send.mutate()}>
                <Send className="size-4" />
                {send.isPending ? "Sending…" : "Send to Breezeway"}
              </Button>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
