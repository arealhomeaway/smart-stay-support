import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Search, Users } from "lucide-react";
import { EmptyState, LoadingPage, PageHeader, SectionCard, StatTile } from "@/components/ui/page";
import { CapabilityGate } from "@/components/CapabilityGate";
import { StatusBadge } from "@/components/ui/status";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { homeownerDirectory } from "@/lib/homeowners.functions";
import {
  ENROLLMENT_LABEL,
  filterHomeowners,
  homeownerCounts,
  type HomeownerEnrollment,
  type HomeownerRow,
} from "@/lib/homeowners";

export const Route = createFileRoute("/_authenticated/homeowners")({
  head: () => ({
    meta: [
      { title: "Homeowners directory — Resolve Operations" },
      {
        name: "description",
        content:
          "Search every homeowner: contact details, the homes they own, whether they can sign in, and where they stand in the Active Owner program.",
      },
      { property: "og:title", content: "Homeowners directory — Resolve Operations" },
      {
        property: "og:description",
        content: "One searchable list of every homeowner and the homes they own.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <CapabilityGate capability="homeowner_directory" title="Homeowner directory is restricted">
      <HomeownersPage />
    </CapabilityGate>
  ),
});

function HomeownersPage() {
  const load = useServerFn(homeownerDirectory);
  const [search, setSearch] = useState("");
  const [enrollment, setEnrollment] = useState<HomeownerEnrollment | "all">("all");
  const [login, setLogin] = useState<"all" | "has_login" | "no_login">("all");

  const directory = useQuery({ queryKey: ["homeowner-directory"], queryFn: () => load() });
  const rows = (directory.data?.rows ?? []) as HomeownerRow[];
  const counts = useMemo(() => homeownerCounts(rows), [rows]);
  const visible = useMemo(
    () => filterHomeowners(rows, { search, enrollment, login }),
    [rows, search, enrollment, login],
  );

  if (directory.isLoading) return <LoadingPage tiles={4} />;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Homeowners"
        title="Homeowners directory"
        description="Everyone who owns a home we manage, the homes they own, whether they can sign in to Resolve, and where they stand in the Active Owner program."
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Homeowners" value={counts.total} />
        <StatTile label="In the Active Owner program" value={counts.enrolled} tone="progress" />
        <StatTile label="Completed the program" value={counts.completed} tone="positive" />
        <StatTile label="Have a Resolve login" value={counts.withLogin} />
      </div>

      <SectionCard title="Directory" description="Search by name, email, phone or home.">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Find a homeowner or home"
              className="pl-8"
              aria-label="Find a homeowner or home"
            />
          </div>
          <Select
            value={enrollment}
            onValueChange={(v) => setEnrollment(v as HomeownerEnrollment | "all")}
          >
            <SelectTrigger className="w-52" aria-label="Filter by program status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any program status</SelectItem>
              <SelectItem value="enrolled">In the program</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="not_enrolled">Not enrolled</SelectItem>
            </SelectContent>
          </Select>
          <Select value={login} onValueChange={(v) => setLogin(v as typeof login)}>
            <SelectTrigger className="w-44" aria-label="Filter by login">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any login status</SelectItem>
              <SelectItem value="has_login">Has a login</SelectItem>
              <SelectItem value="no_login">No login yet</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {visible.length === 0 ? (
          <EmptyState
            title="No homeowner matches this search."
            hint="Try a different name, email or home."
            icon={<Users className="size-8" />}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-2 py-2">Homeowner</th>
                  <th className="px-2 py-2">Contact</th>
                  <th className="px-2 py-2">Homes</th>
                  <th className="px-2 py-2">Login</th>
                  <th className="px-2 py-2">Active Owner</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((row) => (
                  <tr key={row.id} className="border-b border-border/60 align-top">
                    <td className="px-2 py-3">
                      <p className="font-medium">{row.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {row.ownerType === "primary" ? "Owner of record" : "Additional contact"}
                      </p>
                    </td>
                    <td className="px-2 py-3">
                      <p>{row.email ?? "No email"}</p>
                      <p className="text-xs text-muted-foreground">{row.phone ?? "No phone"}</p>
                    </td>
                    <td className="px-2 py-3">
                      {row.properties.length === 0 ? (
                        <span className="text-muted-foreground">No home linked</span>
                      ) : (
                        <div className="flex flex-col gap-1">
                          {row.properties.map((p) => (
                            <Link
                              key={p.id}
                              to="/property/$propertyId"
                              params={{ propertyId: p.id }}
                              className="text-primary hover:underline"
                            >
                              {p.name}
                            </Link>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-2 py-3">
                      <StatusBadge tone={row.hasLogin ? "resolved" : "closed"}>
                        {row.hasLogin ? "Can sign in" : "No login"}
                      </StatusBadge>
                    </td>
                    <td className="px-2 py-3">
                      <StatusBadge
                        tone={
                          row.enrollment === "enrolled"
                            ? "progress"
                            : row.enrollment === "completed"
                              ? "resolved"
                              : "closed"
                        }
                      >
                        {ENROLLMENT_LABEL[row.enrollment]}
                      </StatusBadge>
                      {row.enrollment === "enrolled" && row.daysLeft !== null && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {row.daysLeft} days remaining
                        </p>
                      )}
                      {row.programId && (
                        <Link
                          to="/owner-programs"
                          className="mt-1 block text-xs text-primary hover:underline"
                        >
                          Open program
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
