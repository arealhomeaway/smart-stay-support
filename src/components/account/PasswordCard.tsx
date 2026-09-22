/**
 * Anyone signed in can change their own password here. The current password is
 * always required: a signed-in change is not a recovery flow.
 */
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SectionCard } from "@/components/ui/page";
import { supabase } from "@/integrations/supabase/client";

export function PasswordCard({ email }: { email: string | null }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);

  async function change(event: React.FormEvent) {
    event.preventDefault();
    if (next.length < 8) {
      toast.error("Choose a password with at least 8 characters.");
      return;
    }
    if (next !== confirm) {
      toast.error("Those passwords don't match.");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: next,
        // Lovable Cloud requires the current password for a signed-in change.
        current_password: current,
      } as { password: string; current_password: string });
      if (error) throw new Error(error.message);
      setCurrent("");
      setNext("");
      setConfirm("");
      toast.success("Your password is updated.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Your password could not be changed.");
    } finally {
      setSaving(false);
    }
  }

  async function emailLink() {
    if (!email) {
      toast.error("Your account has no email address on file.");
      return;
    }
    setSending(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw new Error(error.message);
      toast.success("Check your email for the reset link.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "That reset link could not be sent.");
    } finally {
      setSending(false);
    }
  }

  return (
    <SectionCard
      title="Password"
      description="Change your password here, or send yourself a reset link if you have forgotten it."
    >
      <form className="max-w-md space-y-4" onSubmit={change}>
        <div className="space-y-2">
          <Label htmlFor="current-password">Current password</Label>
          <Input
            id="current-password"
            type="password"
            autoComplete="current-password"
            value={current}
            onChange={(event) => setCurrent(event.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="new-password">New password</Label>
          <Input
            id="new-password"
            type="password"
            autoComplete="new-password"
            value={next}
            onChange={(event) => setNext(event.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm-password">Confirm new password</Label>
          <Input
            id="confirm-password"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            required
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Update password"}
          </Button>
          <Button type="button" variant="outline" onClick={emailLink} disabled={sending}>
            {sending ? "Sending…" : "Email me a reset link"}
          </Button>
        </div>
      </form>
    </SectionCard>
  );
}
