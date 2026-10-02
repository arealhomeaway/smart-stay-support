import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Star } from "lucide-react";
import { getGuestSurvey, submitGuestSurvey } from "@/lib/guest-feedback.functions";
import { ISSUE_CATEGORIES, RATED_QUESTIONS, type SurveyAnswers } from "@/lib/guest-feedback";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BrandLogo } from "@/components/BrandLogo";
import { usDate as formatDate } from "@/lib/dates";

export const Route = createFileRoute("/guest-feedback/$token")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Guest survey — A Real Home Away" },
      { name: "description", content: "A short private survey about your recent stay with A Real Home Away." },
      { property: "og:title", content: "Guest survey — A Real Home Away" },
      { property: "og:description", content: "Tell A Real Home Away how your stay went." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SurveyPage,
});

type Draft = { [K in keyof SurveyAnswers]?: SurveyAnswers[K] | undefined };

function Stars({ value, onChange, label }: { value?: number | undefined; onChange: (n: number) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} star${n === 1 ? "" : "s"}`}
          onClick={() => onChange(n)}
          className="rounded p-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
        >
          <Star className={`h-7 w-7 ${value && n <= value ? "fill-primary text-primary" : "text-muted-foreground"}`} />
        </button>
      ))}
    </div>
  );
}

function Choice<T extends string>({ value, options, onChange, label }: { value?: T | undefined; options: { v: T; l: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => (
        <Button key={o.v} type="button" size="sm" variant={value === o.v ? "default" : "outline"} role="radio" aria-checked={value === o.v} onClick={() => onChange(o.v)}>
          {o.l}
        </Button>
      ))}
    </div>
  );
}

function Q({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">{label}</Label>
      {children}
    </div>
  );
}

function SurveyPage() {
  const { token } = Route.useParams();
  const fetchSurvey = useServerFn(getGuestSurvey);
  const submit = useServerFn(submitGuestSurvey);
  const q = useQuery({ queryKey: ["guest-survey", token], queryFn: () => fetchSurvey({ data: { token } }) });
  const [d, setD] = useState<Draft>({ had_issues: undefined, follow_up_ok: undefined });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const set = (patch: Draft) => setD((x) => ({ ...x, ...patch }));

  const shell = (children: React.ReactNode) => (
    <main className="min-h-screen bg-muted/30 px-4 py-10">
      <div className="mx-auto max-w-xl space-y-6">
        <div className="flex justify-center"><BrandLogo /></div>
        {children}
      </div>
    </main>
  );

  if (q.isLoading) return shell(<p className="text-center text-muted-foreground">Loading your survey…</p>);
  if (!q.data?.ok)
    return shell(
      <Card>
        <CardHeader>
          <CardTitle>This survey link has expired</CardTitle>
          <CardDescription>Surveys stay open for 14 days after checkout.</CardDescription>
        </CardHeader>
        <CardContent>
          <Link to="/guest-feedback" className="text-sm text-primary underline">Find my stay</Link>
        </CardContent>
      </Card>,
    );
  const s = q.data;

  if (done || s.completed)
    return shell(
      <Card>
        <CardHeader>
          <CardTitle>Thank you for your feedback.</CardTitle>
          <CardDescription>Our team reads every response. We're glad you stayed at {s.homeName}.</CardDescription>
        </CardHeader>
      </Card>,
    );

  const onSubmit = async () => {
    setErr(null);
    if (!d.overall) return setErr("Please choose an overall rating.");
    if (!d.stay_again) return setErr("Please tell us how likely you are to stay again.");
    if (d.had_issues === undefined) return setErr("Please tell us whether anything went wrong.");
    setBusy(true);
    try {
      const res = await submit({ data: { token, answers: { ...d, follow_up_ok: d.follow_up_ok === true } } });
      if (res.ok) setDone(true);
      else setErr(res.message);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong.");
    }
    setBusy(false);
  };

  return shell(
    <Card>
      <CardHeader>
        <CardTitle>{s.firstName ? `Hi ${s.firstName}, how was your stay?` : "How was your stay?"}</CardTitle>
        <CardDescription>
          {s.homeName}
          {s.place ? ` · ${s.place}` : ""}
          {s.arrival ? ` · ${formatDate(s.arrival)} – ${formatDate(s.departure)}` : ` · checked out ${formatDate(s.departure)}`}
          <br />
          Private feedback for our team. It takes about two minutes.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Q label="Overall, how would you rate your stay?">
          <Stars label="Overall rating" value={d.overall} onChange={(n) => set({ overall: n })} />
        </Q>
        <Q label="How likely are you to stay with A Real Home Away again?">
          <Choice
            label="Likely to stay again"
            value={d.stay_again ? String(d.stay_again) : undefined}
            onChange={(v) => set({ stay_again: Number(v) })}
            options={[
              { v: "1", l: "Very unlikely" },
              { v: "2", l: "Unlikely" },
              { v: "3", l: "Not sure" },
              { v: "4", l: "Likely" },
              { v: "5", l: "Very likely" },
            ]}
          />
        </Q>
        {RATED_QUESTIONS.map((rq) => (
          <Q key={rq.key} label={rq.label}>
            <Stars label={rq.label} value={d[rq.key]} onChange={(n) => set({ [rq.key]: n } as Draft)} />
          </Q>
        ))}
        <Q label="Did anything go wrong during your stay?">
          <Choice
            label="Were there issues"
            value={d.had_issues === undefined ? undefined : d.had_issues ? "yes" : "no"}
            onChange={(v) => set({ had_issues: v === "yes" })}
            options={[{ v: "no", l: "No" }, { v: "yes", l: "Yes" }]}
          />
        </Q>
        {d.had_issues && (
          <div className="space-y-6 rounded-md border border-border p-4">
            <Q label="How serious was it?">
              <Choice
                label="Severity"
                value={d.severity}
                onChange={(v) => set({ severity: v })}
                options={[{ v: "minor", l: "Minor" }, { v: "moderate", l: "Moderate" }, { v: "major", l: "Major" }]}
              />
            </Q>
            <Q label="What was it about? Pick any that apply.">
              <div className="flex flex-wrap gap-2">
                {ISSUE_CATEGORIES.map((c) => {
                  const on = d.issue_categories?.includes(c) ?? false;
                  return (
                    <Button
                      key={c}
                      type="button"
                      size="sm"
                      variant={on ? "default" : "outline"}
                      aria-pressed={on}
                      onClick={() =>
                        set({ issue_categories: on ? d.issue_categories!.filter((x) => x !== c) : [...(d.issue_categories ?? []), c] })
                      }
                    >
                      {c}
                    </Button>
                  );
                })}
              </div>
            </Q>
            <Q label="Tell us what happened">
              <Textarea aria-label="Tell us what happened" value={d.issue_description ?? ""} onChange={(e) => set({ issue_description: e.target.value })} maxLength={4000} />
            </Q>
            <Q label="Did you let us know during your stay?">
              <Choice
                label="Reported during stay"
                value={d.reported_during_stay}
                onChange={(v) => set({ reported_during_stay: v })}
                options={[{ v: "yes", l: "Yes" }, { v: "no", l: "No" }]}
              />
            </Q>
            {d.reported_during_stay === "yes" && (
              <Q label="Did we resolve it to your satisfaction?">
                <Choice
                  label="Resolved satisfactorily"
                  value={d.resolved_satisfactorily}
                  onChange={(v) => set({ resolved_satisfactorily: v })}
                  options={[{ v: "yes", l: "Yes" }, { v: "partly", l: "Partly" }, { v: "no", l: "No" }]}
                />
              </Q>
            )}
          </div>
        )}
        <Q label="Is there anything we could have done before checkout to make your stay better?">
          <Textarea aria-label="What could we have done before checkout" value={d.improve_before_checkout ?? ""} onChange={(e) => set({ improve_before_checkout: e.target.value })} maxLength={4000} />
        </Q>
        <Q label="Anything else you'd like to share?">
          <Textarea aria-label="Anything else" value={d.comments ?? ""} onChange={(e) => set({ comments: e.target.value })} maxLength={4000} />
        </Q>
        <Q label="May our team contact you about your feedback?">
          <Choice
            label="Permission to follow up"
            value={d.follow_up_ok === undefined ? undefined : d.follow_up_ok ? "yes" : "no"}
            onChange={(v) => set({ follow_up_ok: v === "yes" })}
            options={[{ v: "yes", l: "Yes" }, { v: "no", l: "No" }]}
          />
        </Q>
        {err && <p role="alert" className="text-sm text-destructive">{err}</p>}
        <Button className="w-full" onClick={onSubmit} disabled={busy}>
          {busy ? "Sending…" : "Send my feedback"}
        </Button>
      </CardContent>
    </Card>,
  );
}
