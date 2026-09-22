import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usDateTime } from "@/lib/dates";
import { assignablePeople } from "@/lib/assignable-people";

export type NoteRow = {
  id: string;
  property_id: string;
  task_id: string | null;
  body: string;
  mentions: string[] | null;
  author_id: string | null;
  created_at: string;
};

type Person = { id: string; full_name: string | null; email: string | null };

/** Internal onboarding notes with @mentions. Never visible to owners or vendors. */
export function OnboardingNotes({
  notes,
  people,
  disabled,
  onAdd,
}: {
  notes: NoteRow[];
  people: Person[];
  disabled: boolean;
  onAdd: (body: string, mentions: string[]) => void;
}) {
  const [body, setBody] = useState("");
  const [mention, setMention] = useState("none");
  const nameOf = (id: string | null) =>
    people.find((p) => p.id === id)?.full_name ||
    people.find((p) => p.id === id)?.email ||
    "Teammate";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Internal notes</CardTitle>
        <CardDescription>
          Onboarding staff and supervisors only. Homeowners and vendors never see these.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Textarea
          rows={3}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="What changed, what is missing, what happens next."
          disabled={disabled}
        />
        <div className="flex flex-wrap items-center gap-2">
          <Select value={mention} onValueChange={setMention} disabled={disabled}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Mention someone" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No mention</SelectItem>
              {assignablePeople(people).map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  @{p.full_name || p.email || "Teammate"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            disabled={disabled || body.trim().length === 0}
            onClick={() => {
              onAdd(body.trim(), mention === "none" ? [] : [mention]);
              setBody("");
              setMention("none");
            }}
          >
            Add note
          </Button>
        </div>

        <div className="space-y-2 pt-2">
          {notes.length === 0 && (
            <p className="text-sm text-muted-foreground">No notes yet for this home.</p>
          )}
          {notes.map((n) => (
            <div key={n.id} className="rounded-md border p-3 text-sm">
              <p className="whitespace-pre-wrap">{n.body}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {nameOf(n.author_id)} · {usDateTime(n.created_at)}
              </p>
              {(n.mentions ?? []).length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {(n.mentions ?? []).map((m) => (
                    <Badge key={m} variant="outline" className="text-xs">
                      @{nameOf(m)}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
