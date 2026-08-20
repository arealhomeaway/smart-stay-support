import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Camera, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CATEGORIES, labelFor } from "@/lib/tickets";

export const Route = createFileRoute("/_authenticated/playbooks")({
  head: () => ({
    meta: [
      { title: "Playbooks — Resolve Operations" },
      { name: "description", content: "Standard operating steps that load onto every ticket by category." },
      { property: "og:title", content: "Playbooks — Resolve Operations" },
      { property: "og:description", content: "Standard operating steps that load onto every ticket." },
    ],
  }),
  component: PlaybooksPage,
});

function PlaybooksPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["playbooks-full"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("playbooks")
        .select("*, playbook_steps(*)")
        .order("category");
      if (error) throw error;
      return data;
    },
  });

  if (isLoading || !data) return <Skeleton className="h-96 w-full" />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Playbooks</h1>
        <p className="mt-1 text-muted-foreground">
          These steps get copied onto a ticket the moment it is created. Edit them here and every future
          ticket follows the new process.
        </p>
      </div>

      <Accordion type="multiple" className="space-y-3">
        {data.map((pb) => {
          const steps = [...(pb.playbook_steps ?? [])].sort((a, b) => a.position - b.position);
          return (
            <AccordionItem key={pb.id} value={pb.id} className="rounded-lg border border-border bg-card px-4">
              <AccordionTrigger className="hover:no-underline">
                <div className="text-left">
                  <p className="font-medium">{pb.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {labelFor(CATEGORIES, pb.category)} · {steps.length} steps
                  </p>
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-4 pb-4">
                {pb.summary && <p className="text-sm text-muted-foreground">{pb.summary}</p>}
                <ol className="space-y-2">
                  {steps.map((s) => (
                    <li key={s.id} className="rounded-md border border-border p-3">
                      <p className="text-sm font-medium">
                        {s.position}. {s.instruction}
                      </p>
                      {s.detail && <p className="mt-1 text-sm text-muted-foreground">{s.detail}</p>}
                      <div className="mt-2 flex gap-2">
                        {s.required && (
                          <Badge variant="outline" className="text-xs">
                            Required
                          </Badge>
                        )}
                        {s.photo_required && (
                          <Badge variant="outline" className="gap-1 text-xs">
                            <Camera className="size-3" /> Photo proof
                          </Badge>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
                <AddStep
                  playbookId={pb.id}
                  nextPosition={(steps.at(-1)?.position ?? 0) + 1}
                  onSaved={() => qc.invalidateQueries({ queryKey: ["playbooks-full"] })}
                />
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>

      <NewPlaybook onSaved={() => qc.invalidateQueries({ queryKey: ["playbooks-full"] })} />
    </div>
  );
}

function AddStep({
  playbookId,
  nextPosition,
  onSaved,
}: {
  playbookId: string;
  nextPosition: number;
  onSaved: () => void;
}) {
  const [instruction, setInstruction] = useState("");
  const [detail, setDetail] = useState("");
  const [required, setRequired] = useState(true);
  const [photo, setPhoto] = useState(false);

  async function save() {
    if (!instruction.trim()) return;
    const { error } = await supabase.from("playbook_steps").insert({
      playbook_id: playbookId,
      position: nextPosition,
      instruction: instruction.trim(),
      detail: detail.trim() || null,
      required,
      photo_required: photo,
    });
    if (error) return toast.error(error.message);
    setInstruction("");
    setDetail("");
    toast.success("Step added.");
    onSaved();
  }

  return (
    <div className="space-y-3 rounded-md border border-dashed border-border p-3">
      <Input
        placeholder="Add a step to this playbook"
        value={instruction}
        onChange={(e) => setInstruction(e.target.value)}
      />
      <Input placeholder="Extra detail (optional)" value={detail} onChange={(e) => setDetail(e.target.value)} />
      <div className="flex flex-wrap items-center gap-6">
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={required} onCheckedChange={setRequired} /> Required to close
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={photo} onCheckedChange={setPhoto} /> Photo proof
        </label>
        <Button size="sm" variant="secondary" onClick={save} className="ml-auto">
          <Plus className="size-4" /> Add step
        </Button>
      </div>
    </div>
  );
}

function NewPlaybook({ onSaved }: { onSaved: () => void }) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("other");
  const [summary, setSummary] = useState("");

  async function save() {
    if (!title.trim()) return;
    const { error } = await supabase
      .from("playbooks")
      .insert({ title: title.trim(), category, summary: summary.trim() || null });
    if (error) return toast.error(error.message);
    setTitle("");
    setSummary("");
    toast.success("Playbook created.");
    onSaved();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>New playbook</CardTitle>
        <CardDescription>Turn a recurring situation into a repeatable process.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <Label>Title</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Hot water heater failure" />
        </div>
        <div className="space-y-2">
          <Label>Category</Label>
          <select
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label>Summary</Label>
          <Textarea rows={2} value={summary} onChange={(e) => setSummary(e.target.value)} />
        </div>
        <Button onClick={save}>Create playbook</Button>
      </CardContent>
    </Card>
  );
}
