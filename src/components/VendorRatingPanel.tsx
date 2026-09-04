import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Star } from "lucide-react";
import { toast } from "sonner";
import { getJobRating, rateJob } from "@/lib/scorecard.functions";
import { jobPoints, overallScore } from "@/lib/scorecard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

type Props = { ticketId: string; priority: string | null };

const SCALES = [
  {
    key: "thoroughness",
    label: "Thoroughness",
    help: "Finished the whole job — no holes left open, no follow-up needed.",
  },
  {
    key: "communication",
    label: "Communication",
    help: "Kept the coordinator and guest informed without being chased.",
  },
  {
    key: "timeliness",
    label: "Timeliness",
    help: "Responded and arrived inside the window we promised the guest.",
  },
] as const;

/** Staff-side scoring of a finished vendor job. Feeds the vendor's private scorecard. */
export function VendorRatingPanel({ ticketId, priority }: Props) {
  const qc = useQueryClient();
  const loadFn = useServerFn(getJobRating);
  const saveFn = useServerFn(rateJob);

  const existing = useQuery({
    queryKey: ["job-rating", ticketId],
    queryFn: () => loadFn({ data: { ticketId } }),
  });

  const [scores, setScores] = useState({ thoroughness: 4, communication: 4, timeliness: 4 });
  const [photosComplete, setPhotosComplete] = useState(true);
  const [onTime, setOnTime] = useState(true);
  const [reopened, setReopened] = useState(false);
  const [note, setNote] = useState("");

  const rating = existing.data?.rating;
  useEffect(() => {
    if (!rating) return;
    setScores({
      thoroughness: rating.thoroughness,
      communication: rating.communication,
      timeliness: rating.timeliness,
    });
    setPhotosComplete(rating.photos_complete);
    setOnTime(rating.on_time);
    setReopened(rating.reopened);
    setNote(rating.note ?? "");
  }, [rating]);

  const preview = {
    overall: overallScore(scores),
    points: jobPoints({ ...scores, photosComplete, onTime, reopened, priority }),
  };

  const save = useMutation({
    mutationFn: () =>
      saveFn({
        data: { ticketId, ...scores, photosComplete, onTime, reopened, note },
      }),
    onSuccess: () => {
      toast.success("Scored — it's on the vendor's private scorecard.");
      void qc.invalidateQueries({ queryKey: ["job-rating", ticketId] });
      void qc.invalidateQueries({ queryKey: ["vendor-scoreboard"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save the score"),
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Star className="size-4" /> Score this vendor job
          {rating && <Badge variant="outline">Scored</Badge>}
        </CardTitle>
        <CardDescription>
          Scores are private to the vendor — they see their own points and an anonymous ranking,
          never anyone else's. Thoroughness carries the most weight.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {SCALES.map((scale) => (
          <div key={scale.key} className="space-y-1.5">
            <div className="flex items-baseline justify-between gap-2">
              <Label className="text-sm">{scale.label}</Label>
              <span className="text-xs text-muted-foreground">{scale.help}</span>
            </div>
            <div className="flex gap-1.5">
              {[1, 2, 3, 4, 5].map((n) => (
                <Button
                  key={n}
                  type="button"
                  size="sm"
                  variant={scores[scale.key] === n ? "default" : "outline"}
                  onClick={() => setScores((s) => ({ ...s, [scale.key]: n }))}
                  className="w-10"
                >
                  {n}
                </Button>
              ))}
            </div>
          </div>
        ))}

        <div className="grid gap-2 sm:grid-cols-3">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={photosComplete}
              onCheckedChange={(v) => setPhotosComplete(v === true)}
            />
            Photos complete
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={onTime} onCheckedChange={(v) => setOnTime(v === true)} />
            On time
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={reopened} onCheckedChange={(v) => setReopened(v === true)} />
            Had to come back
          </label>
        </div>

        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          placeholder="What they did well, or what to coach next time — e.g. sealed and painted without being asked."
        />

        <div className="flex flex-wrap items-center gap-3">
          <Button disabled={save.isPending} onClick={() => save.mutate()}>
            {rating ? "Update score" : "Save score"}
          </Button>
          <span className="text-sm text-muted-foreground">
            {preview.overall.toFixed(1)}/5 · {preview.points} pts
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
