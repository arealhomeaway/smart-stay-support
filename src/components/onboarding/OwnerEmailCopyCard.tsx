/**
 * Homeowner email wording the onboarding director controls.
 *
 * Only the wrapper is editable — subject, greeting, standing sentence,
 * sign-off and button label. The detail of each alert is still written by
 * Resolve, so nothing here can change what a homeowner is told happened.
 */
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Mail, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DEFAULT_OWNER_EMAIL_COPY,
  OWNER_EMAIL_VARIANT_HINTS,
  OWNER_EMAIL_VARIANT_LABELS,
  renderOwnerEmail,
  type OwnerEmailCopyConfig,
  type OwnerEmailVariant,
} from "@/lib/owner-email-copy";
import { readOwnerEmailCopyFn, saveOwnerEmailCopyFn } from "@/lib/owner-email-copy.functions";

const VARIANTS: OwnerEmailVariant[] = ["dispatch", "alert"];

const SAMPLE = {
  dispatch: {
    title: "Participation opportunity ready",
    body: "Open your owner portal to review this property work and whether an owner response is required.",
  },
  alert: {
    title: "Property work update",
    body: "A property matter was recorded for your home. Open your owner portal to review it.",
  },
};

export function OwnerEmailCopyCard({ canEdit }: { canEdit: boolean }) {
  const qc = useQueryClient();
  const read = useServerFn(readOwnerEmailCopyFn);
  const save = useServerFn(saveOwnerEmailCopyFn);
  const [draft, setDraft] = useState<OwnerEmailCopyConfig | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["owner-email-copy"],
    queryFn: () => read(),
  });

  useEffect(() => {
    if (data) setDraft(data);
  }, [data]);

  const doSave = useMutation({
    mutationFn: (value: OwnerEmailCopyConfig) => save({ data: value }),
    onSuccess: () => {
      toast.success("Homeowner email wording saved.");
      void qc.invalidateQueries({ queryKey: ["owner-email-copy"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const set = (variant: OwnerEmailVariant, field: keyof OwnerEmailCopyConfig["alert"], v: string) =>
    setDraft((current) =>
      current ? { ...current, [variant]: { ...current[variant], [field]: v } } : current,
    );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Mail className="h-4 w-4" /> Homeowner email wording
        </CardTitle>
        <CardDescription>
          The subject line, greeting, standing sentence, sign-off and button on the automatic emails
          homeowners receive. Use {"{first_name}"}, {"{owner_name}"} and {"{title}"} to fill in the
          homeowner and what the email is about.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading || !draft ? (
          <p className="text-muted-foreground text-sm">Loading…</p>
        ) : (
          <Tabs defaultValue="dispatch">
            <TabsList>
              {VARIANTS.map((v) => (
                <TabsTrigger key={v} value={v}>
                  {OWNER_EMAIL_VARIANT_LABELS[v]}
                </TabsTrigger>
              ))}
            </TabsList>
            {VARIANTS.map((v) => {
              const preview = renderOwnerEmail(draft[v], {
                title: SAMPLE[v].title,
                body: SAMPLE[v].body,
                ownerName: "Victor Alvarez",
              });
              return (
                <TabsContent key={v} value={v} className="space-y-3 pt-3">
                  <p className="text-muted-foreground text-xs">{OWNER_EMAIL_VARIANT_HINTS[v]}</p>
                  <div className="space-y-1">
                    <Label>Subject line</Label>
                    <Input
                      value={draft[v].subject}
                      disabled={!canEdit}
                      onChange={(e) => set(v, "subject", e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Greeting</Label>
                    <Input
                      value={draft[v].greeting}
                      disabled={!canEdit}
                      onChange={(e) => set(v, "greeting", e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Standing sentence before the detail</Label>
                    <Textarea
                      rows={2}
                      value={draft[v].intro}
                      disabled={!canEdit}
                      onChange={(e) => set(v, "intro", e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Sign-off</Label>
                    <Textarea
                      rows={2}
                      value={draft[v].closing}
                      disabled={!canEdit}
                      onChange={(e) => set(v, "closing", e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Button label</Label>
                    <Input
                      value={draft[v].actionLabel}
                      disabled={!canEdit}
                      onChange={(e) => set(v, "actionLabel", e.target.value)}
                    />
                  </div>

                  <div className="bg-muted/40 space-y-2 rounded-md border p-3">
                    <p className="text-xs font-medium">Preview</p>
                    <p className="text-sm font-semibold">{preview.subject}</p>
                    <p className="text-muted-foreground text-sm whitespace-pre-wrap">
                      {preview.body}
                    </p>
                    <p className="text-xs font-medium">[ {preview.actionLabel} ]</p>
                  </div>

                  {canEdit ? (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        disabled={doSave.isPending}
                        onClick={() => doSave.mutate(draft)}
                      >
                        {doSave.isPending ? "Saving…" : "Save wording"}
                      </Button>
                      <Button
                        variant="ghost"
                        disabled={doSave.isPending}
                        onClick={() =>
                          setDraft((current) =>
                            current ? { ...current, [v]: DEFAULT_OWNER_EMAIL_COPY[v] } : current,
                          )
                        }
                      >
                        <RotateCcw className="mr-1 h-4 w-4" /> Reset to default
                      </Button>
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-xs">
                      Only the onboarding director can change this wording.
                    </p>
                  )}
                </TabsContent>
              );
            })}
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
}
