/**
 * Onboarding plan templates. The onboarding director creates and edits the
 * plans; project managers work the projects those plans create.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { CopyPlus, LayoutTemplate, Star } from "lucide-react";
import { PageHeader } from "@/components/ui/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { TemplateEditor } from "@/components/onboarding/TemplateEditor";
import { useRole } from "@/hooks/useRole";
import {
  createOnboardingTemplateFn,
  ensureBuiltInTemplateFn,
  listOnboardingTemplatesFn,
  setDefaultOnboardingTemplateFn,
  updateOnboardingTemplateFn,
} from "@/lib/onboarding-template-admin.functions";

export const Route = createFileRoute("/_authenticated/onboarding/templates")({
  head: () => ({
    meta: [
      { title: "Onboarding templates — Resolve" },
      {
        name: "description",
        content:
          "Create and edit the onboarding plans Resolve applies to a new home: steps, stages, owners, deadlines, homeowner approvals and evidence rules.",
      },
      { property: "og:title", content: "Onboarding templates — Resolve" },
      {
        property: "og:description",
        content: "Author the onboarding plan every new home is set up from.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TemplatesPage,
  errorComponent: () => (
    <p className="text-muted-foreground">The templates page could not be loaded.</p>
  ),
  notFoundComponent: () => <p className="text-muted-foreground">Template not found.</p>,
});

function TemplatesPage() {
  const { can } = useRole();
  const qc = useQueryClient();
  const list = useServerFn(listOnboardingTemplatesFn);
  const create = useServerFn(createOnboardingTemplateFn);
  const update = useServerFn(updateOnboardingTemplateFn);
  const setDefault = useServerFn(setDefaultOnboardingTemplateFn);
  const ensureBuiltIn = useServerFn(ensureBuiltInTemplateFn);

  const [selected, setSelected] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const allowed = can("onboarding_templates");
  const { data, isLoading } = useQuery({
    queryKey: ["onboarding-templates"],
    queryFn: () => list(),
    enabled: allowed,
  });

  const refresh = () => void qc.invalidateQueries({ queryKey: ["onboarding-templates"] });

  const doCreate = useMutation({
    mutationFn: (copyBuiltIn: boolean) =>
      create({ data: { name, description, copyBuiltIn } }),
    onSuccess: (r) => {
      toast.success(r.steps ? `Template created with ${r.steps} steps.` : "Template created.");
      setNewOpen(false);
      setName("");
      setDescription("");
      setSelected(r.id);
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // The built-in plan is editable in place: the first edit saves the shipped
  // plan as a real template under the same name, so there is no copy to keep
  // in step with it.
  const editBuiltIn = useMutation({
    mutationFn: () => ensureBuiltIn(),
    onSuccess: (r) => {
      setSelected(r.id);
      if (r.created) refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const doDefault = useMutation({
    mutationFn: (templateId: string | null) => setDefault({ data: { templateId } }),
    onSuccess: () => {
      toast.success("Default plan updated. New homes start from it.");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const doArchive = useMutation({
    mutationFn: (v: { templateId: string; isArchived: boolean }) =>
      update({ data: { templateId: v.templateId, isArchived: v.isArchived } }),
    onSuccess: () => {
      toast.success("Template updated.");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!allowed) {
    return (
      <p className="text-muted-foreground">
        Onboarding plans are managed by the onboarding director.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Onboarding templates"
        description="The plan a new home is set up from. Edit the ARHA plan directly, or build another one alongside it."
        actions={
          <Button onClick={() => setNewOpen(true)}>
            <CopyPlus className="mr-1 h-4 w-4" /> New template
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <LayoutTemplate className="h-4 w-4" /> Plans
          </CardTitle>
          <CardDescription>
            The plan marked default is used when a home starts onboarding. With none marked, the
            built-in ARHA plan is used.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {isLoading ? <p className="text-muted-foreground text-sm">Loading…</p> : null}
          {(data ?? []).map((t) => (
            <div
              key={t.key}
              className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3"
            >
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-sm font-medium">
                  {t.name}
                  {t.isDefault ? <Badge>Default</Badge> : null}
                  {t.builtIn ? <Badge variant="outline">Built in</Badge> : null}
                  {t.isArchived ? <Badge variant="outline">Archived</Badge> : null}
                </p>
                <p className="text-muted-foreground text-xs">
                  {t.taskCount} steps · {t.subtaskCount} subtasks
                  {t.description ? ` · ${t.description}` : ""}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {t.builtIn && !t.id ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={editBuiltIn.isPending}
                    onClick={() => editBuiltIn.mutate()}
                  >
                    {editBuiltIn.isPending ? "Opening…" : "Edit steps"}
                  </Button>
                ) : (
                  <>
                    <Button size="sm" variant="outline" onClick={() => setSelected(t.id)}>
                      Edit steps
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={t.isDefault || t.isArchived}
                      onClick={() => doDefault.mutate(t.id)}
                    >
                      <Star className="mr-1 h-4 w-4" /> Make default
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        doArchive.mutate({ templateId: t.id as string, isArchived: !t.isArchived })
                      }
                    >
                      {t.isArchived ? "Restore" : "Archive"}
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))}
          {(data ?? []).some((t) => t.isDefault) ? (
            <Button size="sm" variant="ghost" onClick={() => doDefault.mutate(null)}>
              Use the built-in plan for new homes
            </Button>
          ) : null}
        </CardContent>
      </Card>

      {selected ? <TemplateEditor templateId={selected} /> : null}

      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New onboarding template</DialogTitle>
            <DialogDescription>
              Start from the built-in ARHA plan, or from an empty plan you build yourself.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Description</Label>
              <Textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={doCreate.isPending || name.trim().length < 3}
              onClick={() => doCreate.mutate(false)}
            >
              Start empty
            </Button>
            <Button
              disabled={doCreate.isPending || name.trim().length < 3}
              onClick={() => doCreate.mutate(true)}
            >
              {doCreate.isPending ? "Creating…" : "Copy the built-in plan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
