import { createFileRoute, redirect, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { KeyRound, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { redeemTeamInvite } from "@/lib/team-invites.functions";
import { entryPathFor, portalsFor } from "@/lib/portals";
import type { AppRole } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { BrandLogo } from "@/components/BrandLogo";

/**
 * Neutral landing for a signed-in person who has no authorised role or portal
 * membership yet. It reveals nothing about internal workspaces, grants nothing
 * automatically, and offers only the two legitimate ways forward: redeem an
 * invitation, or sign out.
 */
export const Route = createFileRoute("/awaiting-access")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
  },
  head: () => ({
    meta: [
      { title: "Awaiting access — Resolve" },
      {
        name: "description",
        content:
          "Your Resolve account is signed in but not yet authorised. Redeem an invitation code or ask your ARHA administrator for access.",
      },
      { property: "og:title", content: "Awaiting access — Resolve" },
      {
        property: "og:description",
        content: "Signed in, not yet authorised. Redeem an invitation to continue.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AwaitingAccess,
});

function AwaitingAccess() {
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [email, setEmail] = useState<string | null>(null);
  const redeem = useServerFn(redeemTeamInvite);

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);

  // Someone who gains access in another tab should not be stranded here.
  useEffect(() => {
    void (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", auth.user.id);
      const roles = (data ?? []).map((r) => r.role as AppRole);
      if (portalsFor(roles).length > 0) void navigate({ to: entryPathFor(roles) });
    })();
  }, [navigate]);

  const link = useMutation({
    mutationFn: () => redeem({ data: { code } }),
    onSuccess: (res) => {
      toast.success(
        res.pendingSeatAssignment
          ? "Your account access is set. An admin will finish setting up your access."
          : "Your access is set. Welcome to Resolve.",
        { duration: res.pendingSeatAssignment ? 15000 : 4000 },
      );
      void navigate({ to: res.role === "vendor" ? "/vendor" : "/dashboard" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="flex min-h-dvh items-center justify-center bg-secondary px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <div className="rounded-xl border border-border bg-white px-6 py-8 text-center">
          <BrandLogo className="mx-auto h-20 sm:h-24" />
          <p className="mt-4 text-xs uppercase tracking-[0.22em] text-muted-foreground">
            ARHA Resolve
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="size-5 text-primary" /> Awaiting access
            </CardTitle>
            <CardDescription>
              You are signed in{email ? ` as ${email}` : ""}, but your account has not been given
              access yet. An ARHA administrator issues access by invitation.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <p className="flex items-center gap-2 text-sm font-medium">
                <KeyRound className="size-4 text-primary" /> Have an invitation code?
              </p>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="ABCD-2345"
                className="text-center text-lg tracking-[0.3em]"
                aria-label="Invitation code"
              />
              <Button
                className="w-full"
                disabled={code.trim().length < 4 || link.isPending}
                onClick={() => link.mutate()}
              >
                {link.isPending ? "Checking…" : "Redeem code"}
              </Button>
            </div>

            <p className="text-sm text-muted-foreground">
              No code? Contact your ARHA administrator and ask them to invite this email address.
            </p>

            <Button
              variant="outline"
              className="w-full"
              onClick={async () => {
                await supabase.auth.signOut();
                void navigate({ to: "/auth" });
              }}
            >
              Sign out
            </Button>
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
