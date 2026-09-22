/**
 * My account.
 *
 * The one place a person manages how they appear on work and what reaches
 * their inbox. Everything here is their own record — no one else's.
 */
import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Bell, Camera, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader, SectionCard, LoadingPage } from "@/components/ui/page";
import { PersonAvatar } from "@/components/PersonAvatar";
import { supabase } from "@/integrations/supabase/client";
import { getMyAccount, saveMyProfile, saveMyNotificationPreferences } from "@/lib/account.functions";
import {
  DEFAULT_PREFERENCES,
  NOTIFICATION_CATEGORIES,
  type NotificationPreferences,
} from "@/lib/notification-preferences";

export const Route = createFileRoute("/_authenticated/account")({
  component: AccountPage,
  head: () => ({
    meta: [
      { title: "My account · Resolve" },
      {
        name: "description",
        content: "Your Resolve profile photo, contact details and notification settings.",
      },
      { property: "og:title", content: "My account · Resolve" },
      {
        property: "og:description",
        content: "Your Resolve profile photo, contact details and notification settings.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function AccountPage() {
  const load = useServerFn(getMyAccount);
  const saveProfile = useServerFn(saveMyProfile);
  const savePrefs = useServerFn(saveMyNotificationPreferences);
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const account = useQuery({ queryKey: ["my-account"], queryFn: () => load() });

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [signature, setSignature] = useState("");
  const [avatarPath, setAvatarPath] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [prefs, setPrefs] = useState<NotificationPreferences>(DEFAULT_PREFERENCES);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const data = account.data;
    if (!data) return;
    setFullName(data.fullName ?? "");
    setPhone(data.phone ?? "");
    setJobTitle(data.jobTitle ?? "");
    setSignature(data.signature ?? "");
    setAvatarPath(data.avatarPath);
    setPhotoUrl(data.photoUrl);
    setPrefs(data.preferences);
  }, [account.data]);

  const profileMutation = useMutation({
    mutationFn: (input: {
      fullName: string;
      phone: string;
      jobTitle: string;
      signature: string;
      avatarPath: string | null;
    }) => saveProfile({ data: input }),
    onSuccess: (saved) => {
      setPhotoUrl(saved.photoUrl);
      setAvatarPath(saved.avatarPath);
      void queryClient.invalidateQueries({ queryKey: ["my-account"] });
      void queryClient.invalidateQueries({ queryKey: ["people-directory"] });
      toast.success("Your details are saved.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const prefsMutation = useMutation({
    mutationFn: (next: NotificationPreferences) => savePrefs({ data: next }),
    onSuccess: () => toast.success("Notification settings saved."),
    onError: (error: Error) => toast.error(error.message),
  });

  async function uploadPhoto(file: File) {
    if (!account.data) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Please choose a photo under 5 MB.");
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${account.data.id}/photo-${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (error) throw new Error(error.message);
      setAvatarPath(path);
      profileMutation.mutate({ fullName, phone, jobTitle, signature, avatarPath: path });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "That photo could not be uploaded.");
    } finally {
      setUploading(false);
    }
  }

  if (account.isLoading) return <LoadingPage tiles={2} />;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="My account"
        title={fullName || "My account"}
        description="Your photo, your details and what reaches your inbox."
      />

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-6">
          <SectionCard
            title="Profile photo"
            description="Your photo appears wherever you are working — assigned tickets, activity updates and team lists."
          >
            <div className="flex flex-wrap items-center gap-5">
              <PersonAvatar
                name={fullName}
                email={account.data?.email}
                photoUrl={photoUrl}
                size="xl"
              />
              <div className="flex flex-wrap items-center gap-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    if (file) void uploadPhoto(file);
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  disabled={uploading}
                  onClick={() => fileRef.current?.click()}
                >
                  {uploading ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Camera className="size-4" aria-hidden="true" />
                  )}
                  {photoUrl ? "Change photo" : "Upload a photo"}
                </Button>
                {avatarPath ? (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setAvatarPath(null);
                      setPhotoUrl(null);
                      profileMutation.mutate({
                        fullName,
                        phone,
                        jobTitle,
                        signature,
                        avatarPath: null,
                      });
                    }}
                  >
                    <Trash2 className="size-4" aria-hidden="true" /> Remove
                  </Button>
                ) : null}
                <p className="w-full text-xs text-muted-foreground">
                  A square photo under 5 MB works best.
                </p>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="My details" description="How teammates reach you and see your name.">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="account-name">Full name</Label>
                <Input
                  id="account-name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="account-title">Role title</Label>
                <Input
                  id="account-title"
                  value={jobTitle}
                  placeholder="Property Coordinator"
                  onChange={(e) => setJobTitle(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="account-phone">Phone</Label>
                <Input
                  id="account-phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="account-email">Work email</Label>
                <Input id="account-email" value={account.data?.email ?? ""} disabled />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor="account-signature">Email signature</Label>
                <Textarea
                  id="account-signature"
                  rows={4}
                  value={signature}
                  placeholder={"Emily Jimenez\nA Real Home Away"}
                  onChange={(e) => setSignature(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Added to the bottom of messages you send from Resolve.
                </p>
              </div>
            </div>
            <Separator className="my-4" />
            <Button
              onClick={() =>
                profileMutation.mutate({ fullName, phone, jobTitle, signature, avatarPath })
              }
              disabled={profileMutation.isPending}
            >
              {profileMutation.isPending ? "Saving…" : "Save my details"}
            </Button>
          </SectionCard>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-6">
          <SectionCard
            title="Notification preferences"
            description="Choose what shows in your Resolve alerts and what is emailed to you. Work is always recorded either way."
          >
            <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
              <div className="flex items-start gap-3">
                <Bell className="mt-0.5 size-4 text-muted-foreground" aria-hidden="true" />
                <div>
                  <p className="text-sm font-medium">Email me about my work</p>
                  <p className="text-xs text-muted-foreground">
                    Turn this off to keep everything inside Resolve.
                  </p>
                </div>
              </div>
              <Switch
                checked={prefs.emailEnabled}
                aria-label="Email me about my work"
                onCheckedChange={(checked) => setPrefs({ ...prefs, emailEnabled: checked })}
              />
            </div>

            <div className="mt-4 overflow-hidden rounded-lg border">
              <div className="grid grid-cols-[1fr_5rem_5rem] items-center gap-2 border-b bg-muted/40 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <span>What happens</span>
                <span className="text-center">In Resolve</span>
                <span className="text-center">Email</span>
              </div>
              {NOTIFICATION_CATEGORIES.map((category) => (
                <div
                  key={category.key}
                  className="grid grid-cols-[1fr_5rem_5rem] items-center gap-2 border-b px-3 py-3 last:border-b-0"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{category.label}</p>
                    <p className="text-xs text-muted-foreground">{category.description}</p>
                  </div>
                  <div className="flex justify-center">
                    <Switch
                      checked={prefs.inApp[category.key]}
                      aria-label={`${category.label} in Resolve`}
                      onCheckedChange={(checked) =>
                        setPrefs({
                          ...prefs,
                          inApp: { ...prefs.inApp, [category.key]: checked },
                        })
                      }
                    />
                  </div>
                  <div className="flex justify-center">
                    <Switch
                      checked={prefs.email[category.key]}
                      disabled={!prefs.emailEnabled}
                      aria-label={`${category.label} by email`}
                      onCheckedChange={(checked) =>
                        setPrefs({
                          ...prefs,
                          email: { ...prefs.email, [category.key]: checked },
                        })
                      }
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4">
              <Button onClick={() => prefsMutation.mutate(prefs)} disabled={prefsMutation.isPending}>
                {prefsMutation.isPending ? "Saving…" : "Save notification settings"}
              </Button>
            </div>
          </SectionCard>
        </TabsContent>

        <TabsContent value="security" className="space-y-6">
          <PasswordCard email={account.data?.email ?? null} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
