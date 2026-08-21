import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { KeyRound } from "lucide-react";
import { toast } from "sonner";
import { redeemTeamInvite } from "@/lib/team-invites.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/join")({
  head: () => ({
    meta: [
      { title: "Redeem your invite code — Resolve Operations" },
      {
        name: "description",
        content:
          "Enter the single-use invite code from your ARHA admin to unlock your coordinator, supervisor or vendor access in Resolve.",
      },
      { property: "og:title", content: "Redeem your invite code — Resolve Operations" },
      {
        property: "og:description",
        content: "One code sets your access in Resolve — no manual setup needed.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: JoinPage,
  errorComponent: () => <p className="text-muted-foreground">This page could not be loaded.</p>,
});

function JoinPage() {
  const [code, setCode] = useState("");
  const navigate = useNavigate();
  const redeem = useServerFn(redeemTeamInvite);

  const link = useMutation({
    mutationFn: () => redeem({ data: { code } }),
    onSuccess: (res) => {
      toast.success("Your access is set. Welcome to Resolve.");
      void navigate({ to: res.role === "vendor" ? "/vendor" : "/dashboard" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card className="mx-auto max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="size-5 text-primary" /> Redeem your invite code
        </CardTitle>
        <CardDescription>
          Enter the single-use code your ARHA admin sent you. It sets your access immediately.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="ABCD-2345"
          className="text-center text-lg tracking-[0.3em]"
        />
        <Button className="w-full" disabled={code.length < 4 || link.isPending} onClick={() => link.mutate()}>
          {link.isPending ? "Checking…" : "Redeem code"}
        </Button>
      </CardContent>
    </Card>
  );
}
