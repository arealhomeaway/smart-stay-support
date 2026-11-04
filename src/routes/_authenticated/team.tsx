import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/ui/page";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SupervisorOnly } from "@/components/SupervisorOnly";
import { ScheduleTab } from "@/components/team/ScheduleTab";
import { UsersTab } from "@/components/team/UsersTab";
import { useRole } from "@/hooks/useRole";

export const Route = createFileRoute("/_authenticated/team")({
  head: () => ({
    meta: [
      { title: "Team & coverage | Resolve Operations" },
      { name: "description", content: "Who is working, who is on call, and who is out." },
      { property: "og:title", content: "Team & coverage | Resolve Operations" },
      { property: "og:description", content: "Who is working, who is on call, and who is out." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <SupervisorOnly>
      <TeamPage />
    </SupervisorOnly>
  ),
  errorComponent: () => <p className="text-muted-foreground">The team schedule could not be loaded.</p>,
});

function TeamPage() {
  const { isAdmin } = useRole();
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Operations" title="Team & coverage" description="Who is working, who is on call, and who is out." />
      <Tabs defaultValue="schedule" className="space-y-4">
        <TabsList>
          <TabsTrigger value="schedule">Schedule</TabsTrigger>
          {isAdmin && <TabsTrigger value="users">Users</TabsTrigger>}
        </TabsList>
        <TabsContent value="schedule" className="space-y-4">
          <ScheduleTab />
        </TabsContent>
        {isAdmin && (
          <TabsContent value="users" className="space-y-4">
            <UsersTab />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
