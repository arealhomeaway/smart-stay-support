import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BrandLogo } from "@/components/BrandLogo";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Choose a new password — Resolve" },
      {
        name: "description",
        content: "Set a new password for your A Real Home Away Resolve account.",
      },
      { property: "og:title", content: "Choose a new password — Resolve" },
      {
        property: "og:description",
        content: "Complete your Resolve password reset and get back to work.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // A recovery link hands us a session (via the URL hash or an exchanged
    // code). No session here means the link was already used or has expired.
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) {
        setReady(true);
        setInvalid(false);
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
      else setInvalid(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      toast.error("Those passwords don't match.");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Password updated. Signing you in…");
      router.navigate({ to: "/auth" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update your password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-secondary px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <div className="rounded-xl border border-border bg-white px-6 py-8 text-center">
          <BrandLogo className="mx-auto h-24 sm:h-28" />
          <p className="mt-4 text-xs uppercase tracking-[0.22em] text-muted-foreground">
            ARHA Resolve
          </p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Choose a new password</CardTitle>
            <CardDescription>
              {invalid && !ready
                ? "This reset link is no longer valid. Reset links expire after a short window and can only be used once."
                : "Pick a password you don't use anywhere else."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {invalid && !ready ? (
              <Button className="w-full" onClick={() => router.navigate({ to: "/auth" })}>
                Request a new reset link
              </Button>
            ) : (
              <form onSubmit={submit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="new-password">New password</Label>
                  <Input
                    id="new-password"
                    type="password"
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm new password</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    minLength={8}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading || !ready}>
                  {loading ? "Updating…" : "Update password"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
