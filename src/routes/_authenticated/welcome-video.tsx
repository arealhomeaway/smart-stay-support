import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { PageHeader, LoadingPage } from "@/components/ui/page";
import { welcomeVideoUrl } from "@/lib/owner-welcome.functions";

export const Route = createFileRoute("/_authenticated/welcome-video")({
  head: () => ({
    meta: [
      { title: "Welcome video · Resolve" },
      { name: "description", content: "A short welcome video for Active Owner homeowners." },
      { property: "og:title", content: "Welcome video · Resolve" },
      { property: "og:description", content: "A short welcome video for Active Owner homeowners." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: WelcomeVideo,
});

function WelcomeVideo() {
  const get = useServerFn(welcomeVideoUrl);
  const q = useQuery({ queryKey: ["welcome-video"], queryFn: () => get() });
  if (q.isLoading) return <LoadingPage />;
  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <PageHeader title="Welcome to the Active Owner program" />
      {q.data?.url ? (
        /\.(mp4|mov|m4v|webm)(\?|$)/i.test(q.data.url) || q.data.url.includes("owner-welcome-media") ? (
          <video src={q.data.url} controls className="w-full rounded-lg border border-border" />
        ) : (
          <a className="text-primary underline" href={q.data.url} target="_blank" rel="noreferrer">Watch the welcome video</a>
        )
      ) : (
        <p className="text-muted-foreground">There is no welcome video right now.</p>
      )}
      <Link to="/owner" className="text-sm text-primary underline">Go to your portal</Link>
    </div>
  );
}
