import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/ui/page";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RequireCapability } from "@/components/RequireCapability";
import { ScheduleTab } from "@/components/team/ScheduleTab";
import { UsersTab } from "@/components/team/UsersTab";
import { TeamInvitePanel } from "@/components/TeamInvitePanel";
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
  // Every staff account can see the Schedule. Changing it is checked by the
  // schedule itself (Operations leadership), the Users tab by role below.
  component: () => (
    <RequireCapability capability="team_schedule_view" title="Team & coverage">
      <TeamPage />
    </RequireCapability>
  ),
  errorComponent: () => <p className="text-muted-foreground">The team schedule could not be loaded.</p>,
});

function TeamPage() {
  const { isAdmin, can, readOnly } = useRole();
  // Admin manages everyone. The Operations Supervisor and the Director of
  // Operations add Operations users (Coordinator and Supervisor) only.
  const opsInvite = !isAdmin && !readOnly && can("ops_user_invite");
  const showUsers = isAdmin || opsInvite;
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Operations" title="Team & coverage" description="Who is working, who is on call, and who is out." />
      <Tabs defaultValue="schedule" className="space-y-4">
        <TabsList>
          <TabsTrigger value="schedule">Schedule</TabsTrigger>
          {showUsers && <TabsTrigger value="users">Users</TabsTrigger>}
        </TabsList>
        <TabsContent value="schedule" className="space-y-4">
          <ScheduleTab />
        </TabsContent>
        {isAdmin && (
          <TabsContent value="users" className="space-y-4">
            <UsersTab />
          </TabsContent>
        )}
        {opsInvite && (
          <TabsContent value="users" className="space-y-4">
            <TeamInvitePanel allowedRoles={["tech", "manager"]} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
