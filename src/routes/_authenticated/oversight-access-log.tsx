import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Search } from "lucide-react";
import { EmptyState, LoadingPage, PageHeader, SectionCard } from "@/components/ui/page";
import { CapabilityGate } from "@/components/CapabilityGate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { oversightAccessLog } from "@/lib/owner-oversight.functions";
import { usDateTime } from "@/lib/dates";

export const Route = createFileRoute("/_authenticated/oversight-access-log")({
  head: () => ({
    meta: [
      { title: "Homeowner data access log — Resolve Operations" },
      {
        name: "description",
        content:
          "A restricted record of who opened program-wide homeowner data, in what role, and when.",
      },
      { property: "og:title", content: "Homeowner data access log — Resolve Operations" },
      {
        property: "og:description",
        content: "Who read homeowner-wide data, in what role, and when.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <CapabilityGate capability="owner_oversight" title="This record is restricted">
      <AccessLogPage />
    </CapabilityGate>
  ),
});

const ACTION_LABEL: Record<string, string> = {
  oversight_viewed: "Opened program oversight",
  homeowner_directory_viewed: "Opened the homeowners directory",
  oversight_alerts_configured: "Changed alert settings",
  oversight_access_log_viewed: "Opened this access log",
};

function AccessLogPage() {
  const load = useServerFn(oversightAccessLog);
  const [actor, setActor] = useState("");
  const [role, setRole] = useState("all");
  const [target, setTarget] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const query = useQuery({
    queryKey: ["oversight-access-log", actor, role, target, from, to],
    queryFn: () =>
      load({
        data: {
          actor: actor || undefined,
          role: role === "all" ? undefined : role,
          target: target === "all" ? undefined : target,
          from: from ? new Date(`${from}T00:00:00`).toISOString() : undefined,
          to: to ? new Date(`${to}T23:59:59`).toISOString() : undefined,
        },
      }),
  });

  const rows = query.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Active Owner"
        title="Homeowner data access log"
        description="Every time someone opens program-wide homeowner data it is recorded here with the role they held and the moment they did it. The record cannot be edited or removed."
        actions={
          <Button asChild variant="outline">
            <Link to="/owner-oversight">Back to oversight</Link>
          </Button>
        }
      />

      <SectionCard title="Search the record" description="Narrow by person, role, area or date.">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <div className="space-y-1.5">
            <Label htmlFor="log-actor">Person</Label>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="log-actor"
                className="pl-8"
                value={actor}
                onChange={(e) => setActor(e.target.value)}
                placeholder="Name or email"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="log-role">Role</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger id="log-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any role</SelectItem>
                <SelectItem value="platform_owner">Platform owner</SelectItem>
                <SelectItem value="director">Director</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="log-target">Area</Label>
            <Select value={target} onValueChange={setTarget}>
              <SelectTrigger id="log-target">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any area</SelectItem>
                <SelectItem value="owner_program_oversight">Program oversight</SelectItem>
                <SelectItem value="homeowner_directory">Homeowners directory</SelectItem>
                <SelectItem value="oversight_access_log">This access log</SelectItem>
                <SelectItem value="app_setting">Alert settings</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="log-from">From</Label>
            <Input
              id="log-from"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="log-to">To</Label>
            <Input id="log-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>
      </SectionCard>

      {query.isLoading ? (
        <LoadingPage tiles={2} />
      ) : rows.length === 0 ? (
        <EmptyState
          title="Nothing matches this search."
          hint="Try widening the dates or clearing the role and area."
        />
      ) : (
        <SectionCard title={`${rows.length} entries`} description="Newest first.">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Person</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>What they opened</TableHead>
                <TableHead>Records</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="whitespace-nowrap">{usDateTime(row.at)}</TableCell>
                  <TableCell>{row.actor}</TableCell>
                  <TableCell className="capitalize">{row.role.replace(/_/g, " ")}</TableCell>
                  <TableCell>{ACTION_LABEL[row.action] ?? row.action}</TableCell>
                  <TableCell className="text-muted-foreground">{row.targetLabel ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </TableSection>
        </SectionCard>
      )}
    </div>
  );
}
