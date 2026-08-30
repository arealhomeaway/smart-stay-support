import { createFileRoute, useRouter, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { type AppRole } from "@/lib/permissions";
import { entryPathFor, isKnownPortalRoute, portalByRoute, portalsFor } from "@/lib/portals";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BrandLogo } from "@/components/BrandLogo";


export const Route = createFileRoute("/auth")({
  ssr: false,
  /** `next` carries the portal the visitor picked on the overview page. */
  validateSearch: (search: Record<string, unknown>): { next?: string } => {
    const next = typeof search['next'] === "string" ? (search['next'] as string) : undefined;
    return isKnownPortalRoute(next) ? { next } : {};
  },
  head: () => ({
    meta: [
      { title: "Sign in — Resolve" },
      {
        name: "description",
        content:
          "One secure sign-in for every A Real Home Away portal: operations, vendors, onboarding, homeowners and oversight.",
      },
      { property: "og:title", content: "Sign in — Resolve" },
      {
        property: "og:description",
        content: "Secure access to the ARHA portals your role is authorised for.",
      },
    ],
  }),
  component: AuthPage,
});

/**
 * Resolve the destination after sign-in: honour the portal the person asked
 * for when their roles allow it, otherwise send them somewhere they can
 * actually use and say why.
 */
async function destination(next?: string) {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { to: "/hub" };
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", auth.user.id);
  const roles = (data ?? []).map((r) => r.role as AppRole);
  const mine = portalsFor(roles);

  // No authorised portal at all: neutral awaiting-access page, never the shell.
  if (mine.length === 0) return { to: "/awaiting-access" };

  if (next && isKnownPortalRoute(next)) {
    if (mine.some((p) => p.route === next)) return { to: next };
    const wanted = portalByRoute(next);
    return {
      to: "/hub",
      denied: wanted?.name ?? "that portal",
    };
  }
  return { to: entryPathFor(roles) };
}

/** Survives the round trip to Google, which cannot carry our search params. */
const NEXT_KEY = "resolve:next";

function AuthPage() {
  const router = useRouter();
  const { next } = Route.useSearch();
  const requested = next ? portalByRoute(next) : undefined;
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);

  async function go() {
    let intended = next;
    if (!intended) {
      try {
        intended = window.sessionStorage.getItem(NEXT_KEY) ?? undefined;
      } catch {
        intended = undefined;
      }
    }
    try {
      window.sessionStorage.removeItem(NEXT_KEY);
    } catch {
      /* nothing to clean up */
    }
    const result = await destination(intended);
    if (result.denied) {
      toast.error(
        `Your account isn't authorised for ${result.denied}. Here are the portals you can open.`,
      );
    }
    router.navigate({ to: result.to });
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) void go();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);


  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/dashboard`,
            data: { full_name: fullName },
          },
        });
        if (error) throw error;
        toast.success("Account created. You can sign in now.");
        setMode("signin");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        await go();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function signInWithGoogle() {
    setLoading(true);
    if (next) {
      try {
        window.sessionStorage.setItem(NEXT_KEY, next);
      } catch {
        /* the hub is a safe fallback */
      }
    }
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: `${window.location.origin}/auth`,
    });
    if (result.error) {
      toast.error("Google sign-in failed. Try email instead.");
      setLoading(false);
      return;
    }
    if (result.redirected) return;
    await go();
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
        <Card className="w-full">
          <CardHeader>
            <CardTitle className="text-2xl">
              {mode === "signin" ? "Team sign in" : "Create your team account"}
            </CardTitle>
            {requested && (
              <p className="text-sm font-medium text-primary">
                Signing in to {requested.name}
              </p>
            )}
            <CardDescription>
              One account for every ARHA portal. Sign in and Resolve takes you to the workspaces you are authorised for.
            </CardDescription>
          </CardHeader>

        <CardContent className="space-y-4">
          <Button variant="outline" className="w-full" onClick={signInWithGoogle} disabled={loading}>
            Continue with Google
          </Button>
          <div className="flex items-center gap-3 text-xs uppercase tracking-widest text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            or
            <span className="h-px flex-1 bg-border" />
          </div>
          <form onSubmit={submit} className="space-y-4">
            {mode === "signup" && (
              <div className="space-y-2">
                <Label htmlFor="fullName">Full name</Label>
                <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Work email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
            </Button>
          </form>
          <p className="text-center text-sm text-muted-foreground">
            {mode === "signin" ? "New teammate?" : "Already have an account?"}{" "}
            <button
              type="button"
              className="font-medium text-primary underline-offset-4 hover:underline"
              onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            >
              {mode === "signin" ? "Create an account" : "Sign in"}
            </button>
          </p>
          <p className="text-center text-xs text-muted-foreground">
            <Link to="/" className="hover:underline">
              Back to overview
            </Link>
          </p>
        </CardContent>
        </Card>
      </div>
    </div>

  );
}
