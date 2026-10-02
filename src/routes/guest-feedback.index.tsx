import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { startGuestSurvey } from "@/lib/guest-feedback.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BrandLogo } from "@/components/BrandLogo";

export const Route = createFileRoute("/guest-feedback/")({
  validateSearch: (s: Record<string, unknown>): { r?: string } =>
    typeof s["r"] === "string" && s["r"].trim() ? { r: s["r"].trim().slice(0, 60) } : {},
  head: () => ({
    meta: [
      { title: "How was your stay? — A Real Home Away" },
      { name: "description", content: "Tell A Real Home Away about your recent stay. It takes about two minutes." },
      { property: "og:title", content: "How was your stay? — A Real Home Away" },
      { property: "og:description", content: "A short private survey about your recent stay with A Real Home Away." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: FindStay,
});

function FindStay() {
  const { r } = Route.useSearch();
  const navigate = useNavigate();
  const start = useServerFn(startGuestSurvey);
  const [lastName, setLastName] = useState("");
  const [checkout, setCheckout] = useState("");
  const [busy, setBusy] = useState(!!r);
  const [message, setMessage] = useState<string | null>(null);
  const tried = useRef(false);

  const go = async (input: { code?: string; lastName?: string; checkout?: string }) => {
    setBusy(true);
    setMessage(null);
    try {
      const res = await start({ data: input });
      if (res.ok) {
        navigate({ to: "/guest-feedback/$token", params: { token: res.token }, replace: true });
        return;
      }
      setMessage(res.message);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Something went wrong.");
    }
    setBusy(false);
  };

  useEffect(() => {
    if (r && !tried.current) {
      tried.current = true;
      void go({ code: r });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [r]);

  return (
    <main className="min-h-screen bg-muted/30 px-4 py-10">
      <div className="mx-auto max-w-md space-y-6">
        <div className="flex justify-center"><BrandLogo /></div>
        <Card>
          <CardHeader>
            <CardTitle>How was your stay?</CardTitle>
            <CardDescription>
              Your answers go straight to our team and are never posted publicly. First, let us find your stay.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                void go({ lastName, checkout });
              }}
            >
              <div className="space-y-1.5">
                <Label htmlFor="ln">Last name on the reservation</Label>
                <Input id="ln" autoComplete="family-name" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="co">Checkout date</Label>
                <Input id="co" type="date" value={checkout} onChange={(e) => setCheckout(e.target.value)} required />
              </div>
              {message && <p role="alert" className="text-sm text-destructive">{message}</p>}
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? "Finding your stay…" : "Start the survey"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
