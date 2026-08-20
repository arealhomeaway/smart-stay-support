import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { dispatchToBreezeway, syncBreezewayTask, getBreezewayStatus } from "@/lib/breezeway.functions";

/**
 * Field dispatch to Breezeway. Works today as a manual task link; once the
 * Breezeway API is switched on it dispatches and syncs automatically.
 */
export function BreezewayPanel({ ticketId }: { ticketId: string }) {
  const qc = useQueryClient();
  const [instructions, setInstructions] = useState("");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);

  const checkStatus = useServerFn(getBreezewayStatus);
  const { data: status } = useQuery({
    queryKey: ["breezeway-status"],
    queryFn: () => checkStatus(),
    staleTime: 10 * 60 * 1000,
    retry: false,
  });

  const { data: link } = useQuery({
    queryKey: ["breezeway-link", ticketId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tickets")
        .select(
          "breezeway_task_id, breezeway_task_url, breezeway_task_status, breezeway_synced_at, properties(breezeway_property_id)",
        )
        .eq("id", ticketId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const dispatch = useServerFn(dispatchToBreezeway);
  const sync = useServerFn(syncBreezewayTask);

  async function refresh() {
    await qc.invalidateQueries({ queryKey: ["breezeway-link", ticketId] });
    await qc.invalidateQueries({ queryKey: ["ticket", ticketId] });
  }

  async function runDispatch() {
    setBusy(true);
    try {
      const res = await dispatch({ data: { ticketId, ...(instructions ? { extraInstructions: instructions } : {}) } });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Dispatched to Breezeway with the full instruction set.");
      setInstructions("");
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Dispatch failed");
    } finally {
      setBusy(false);
    }
  }

  async function runSync() {
    setBusy(true);
    try {
      const res = await sync({ data: { ticketId } });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`Breezeway task is ${res.status}.`);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setBusy(false);
    }
  }

  async function saveUrl() {
    setBusy(true);
    try {
      const { error } = await supabase
        .from("tickets")
        .update({ breezeway_task_url: url || null, breezeway_synced_at: new Date().toISOString() })
        .eq("id", ticketId);
      if (error) throw error;
      toast.success("Breezeway task link saved.");
      setUrl("");
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save the link");
    } finally {
      setBusy(false);
    }
  }

  const connected = status?.connected ?? false;
  const linkedProperty = Boolean(
    (link?.properties as { breezeway_property_id: string | null } | null)?.breezeway_property_id,
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2">
          Breezeway
          <Badge variant={connected ? "default" : "secondary"}>
            {connected ? "Connected" : "Manual"}
          </Badge>
        </CardTitle>
        <CardDescription>
          Field dispatch. Every task carries the checklist plus the standing alarm rule: any device
          removed must be replaced the same visit.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {link?.breezeway_task_id && (
          <p className="text-muted-foreground">
            Task <span className="font-medium text-foreground">{link.breezeway_task_id}</span>
            {link.breezeway_task_status ? ` · ${link.breezeway_task_status}` : ""}
          </p>
        )}
        {link?.breezeway_task_url && (
          <a
            href={link.breezeway_task_url}
            target="_blank"
            rel="noreferrer"
            className="block truncate text-primary underline"
          >
            {link.breezeway_task_url}
          </a>
        )}

        {connected ? (
          <>
            {!linkedProperty && (
              <p className="text-muted-foreground">
                Link this home to a Breezeway property first, on the Properties page.
              </p>
            )}
            <div className="space-y-2">
              <Label>Extra instructions for the vendor</Label>
              <Textarea
                rows={3}
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder="Anything beyond the checklist the tech must do or confirm."
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={runDispatch} disabled={busy || !linkedProperty}>
                {link?.breezeway_task_id ? "Dispatch again" : "Dispatch to Breezeway"}
              </Button>
              {link?.breezeway_task_id && (
                <Button variant="outline" onClick={runSync} disabled={busy}>
                  Sync status
                </Button>
              )}
            </div>
          </>
        ) : (
          <div className="space-y-2">
            <p className="text-muted-foreground">
              Breezeway API access is not switched on yet. Paste the task link when you dispatch a
              vendor so the matter keeps the reference.
            </p>
            <Label>Breezeway task URL</Label>
            <div className="flex gap-2">
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://app.breezeway.io/task/…"
              />
              <Button variant="outline" onClick={saveUrl} disabled={busy || !url}>
                Save
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
