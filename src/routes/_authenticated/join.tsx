import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { KeyRound } from "lucide-react";
import { toast } from "sonner";
import { redeemTeamInvite } from "@/lib/team-invites.functions";
import { Button } from "@/components/ui/button";
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
      toast.success(
        res.pendingSeatAssignment
          ? "Your account access is set. A platform administrator must still assign your leadership seat."
          : "Your access is set. Welcome to Resolve.",
        { duration: res.pendingSeatAssignment ? 15000 : 4000 },
      );
      void navigate({ to: res.role === "vendor" ? "/vendor" : "/dashboard" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mx-auto max-w-md">
      <div className="surface overflow-hidden">
        <div className="border-b border-warm-deep/60 bg-warm px-6 py-6 text-center">
          <div className="mx-auto mb-3 flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary">
            <KeyRound className="size-5" />
          </div>
          <h1 className="text-[1.375rem] font-semibold tracking-tight">Redeem your invite code</h1>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            Enter the single-use code your ARHA admin sent you. It sets your access right away.
          </p>
        </div>
        <div className="space-y-3 px-6 py-6">
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="ABCD-2345"
            className="text-center text-lg tracking-[0.3em]"
          />
          <Button
            className="w-full"
            disabled={code.length < 4 || link.isPending}
            onClick={() => link.mutate()}
          >
            {link.isPending ? "Checking…" : "Redeem code"}
          </Button>
        </div>
      </div>
    </div>
  );
}
