import { Fragment, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { STATUS_TONE, type CommandCenter, type Kpi } from "@/lib/command-center";
import { buildCompanyHealth, STATUS_SCORE, type DepartmentHealth } from "@/lib/health";

const STATUS_WORD: Record<string, string> = {
  green: "On standard",
  yellow: "Watch",
  red: "Off standard",
  unknown: "Not measured",
};

function contribution(kpi: Kpi): number | null {
  if (kpi.unavailable || kpi.status === "unknown") return null;
  return STATUS_SCORE[kpi.status];
}

export function CompanyHealthPanel({ data }: { data: CommandCenter }) {
  const health = buildCompanyHealth(data);
  const [open, setOpen] = useState(false);

  return (
    <section className="space-y-4" aria-labelledby="company-health-heading">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <CardTitle id="company-health-heading" className="font-display text-xl">
                Overall company health
              </CardTitle>
              <CardDescription>
                Last calculated {new Date(health.generatedAt).toLocaleString()} ·{" "}
                {health.windowDays}-day window
              </CardDescription>
            </div>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  How this is calculated
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>How the health score is calculated</DialogTitle>
                  <DialogDescription>
                    Every contributing measure, its department, its weight and its source. No metric
                    is scored unless it could be computed from live records.
                  </DialogDescription>
                </DialogHeader>
                <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
                  <li>
                    Each KPI is scored against its own configured thresholds: on standard{" "}
                    {STATUS_SCORE.green}, watch {STATUS_SCORE.yellow}, off standard{" "}
                    {STATUS_SCORE.red}.
                  </li>
                  <li>A department score is the average of the KPIs that could be computed.</li>
                  <li>
                    Company health is the average of the department scores. Weights are equal until
                    a Platform Owner approves a weighting, which is why the score reads{" "}
                    <strong>Provisional</strong>.
                  </li>
                  <li>Missing data is excluded and reported, never counted as healthy.</li>
                </ol>
                <ContributionTable departments={health.departments} />
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-6">
            <div>
              <p className="font-display text-5xl font-semibold tabular-nums">
                {health.score ?? "—"}
                <span className="ml-1 text-lg font-normal text-muted-foreground">/ 100</span>
              </p>
              <p className="mt-1 flex flex-wrap items-center gap-2 text-sm">
                <Badge variant="outline" className={STATUS_TONE[health.status]}>
                  {STATUS_WORD[health.status]}
                </Badge>
                {health.provisional && <Badge variant="outline">Provisional weighting</Badge>}
              </p>
            </div>
            <p className="max-w-md text-sm text-muted-foreground">{health.reading}</p>
            <div className="min-w-[12rem] space-y-1">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Data coverage</p>
              <Progress value={Math.round(health.coverage * 100)} aria-label="Data coverage" />
              <p className="text-xs text-muted-foreground">
                {health.scoredCount} of {health.totalCount} measures scored
                {health.missingCount > 0 ? ` · ${health.missingCount} missing a source` : ""}
              </p>
            </div>
          </div>

          {health.criticalBreaches.length > 0 && (
            <div className="flex items-start gap-3 rounded-md border border-destructive/30 bg-destructive/5 p-3">
              <TriangleAlert
                className="mt-0.5 size-4 shrink-0 text-destructive"
                aria-hidden="true"
              />
              <div className="text-sm">
                <p className="font-medium text-destructive">
                  Critical threshold breached ({health.criticalBreaches.length})
                </p>
                <p className="text-muted-foreground">
                  {health.criticalBreaches
                    .slice(0, 3)
                    .map((k) => k.label)
                    .join(" · ")}
                  {health.criticalBreaches.length > 3
                    ? ` and ${health.criticalBreaches.length - 3} more`
                    : ""}
                  . Averaging can keep the headline score high — these do not wait.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div>
        <h2 className="mb-2 font-display text-lg font-semibold">Department health</h2>
        <Accordion type="multiple" className="rounded-md border bg-card">
          {health.departments.map((dept) => (
            <AccordionItem key={dept.key} value={dept.key} className="px-4 last:border-b-0">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex flex-1 flex-wrap items-center gap-x-4 gap-y-1 pr-3 text-left">
                  <span className="min-w-[12rem] font-medium">{dept.label}</span>
                  <span className="tabular-nums text-sm text-muted-foreground">
                    {dept.score ?? "—"} / 100
                  </span>
                  <Badge variant="outline" className={STATUS_TONE[dept.status]}>
                    {STATUS_WORD[dept.status]}
                  </Badge>
                  {dept.attentionCount > 0 && (
                    <span className="text-xs text-muted-foreground">
                      {dept.attentionCount} needing attention
                    </span>
                  )}
                  {dept.topRisk && (
                    <span className="text-xs text-muted-foreground">
                      Biggest risk: {dept.topRisk.label}
                    </span>
                  )}
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <p className="mb-3 text-sm text-muted-foreground">{dept.blurb}</p>
                <p className="mb-3 text-xs text-muted-foreground">
                  Department owner: not yet configured · Weight {Math.round(dept.weight * 100)}%
                  (equal split) · Coverage {Math.round(dept.coverage * 100)}% · Updated{" "}
                  {new Date(health.generatedAt).toLocaleString()}
                </p>
                <DepartmentKpiTable dept={dept} />
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}

function DepartmentKpiTable({ dept }: { dept: DepartmentHealth }) {
  const rows = [...dept.scored, ...dept.missing];
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead scope="col">Measure</TableHead>
          <TableHead scope="col">Result</TableHead>
          <TableHead scope="col">Target</TableHead>
          <TableHead scope="col">Trend</TableHead>
          <TableHead scope="col">Status</TableHead>
          <TableHead scope="col">Records</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((kpi) => (
          <TableRow key={kpi.key}>
            <TableCell className="font-medium">
              {kpi.label}
              {kpi.note && <p className="text-xs font-normal text-muted-foreground">{kpi.note}</p>}
              {kpi.unavailable && (
                <p className="text-xs font-normal text-muted-foreground">{kpi.unavailable}</p>
              )}
            </TableCell>
            <TableCell className="tabular-nums">
              {kpi.unavailable ? "Not measured" : kpi.display}
            </TableCell>
            <TableCell className="text-muted-foreground">
              {kpi.target ?? "Target not configured"}
            </TableCell>
            <TableCell className="text-muted-foreground">
              {kpi.trend === "up"
                ? "Improving"
                : kpi.trend === "down"
                  ? "Declining"
                  : kpi.trend
                    ? "Flat"
                    : "—"}
            </TableCell>
            <TableCell>
              <Badge variant="outline" className={STATUS_TONE[kpi.status]}>
                {STATUS_WORD[kpi.status]}
              </Badge>
            </TableCell>
            <TableCell>
              {kpi.drill ? (
                <Link
                  to={kpi.drill.to}
                  className="inline-flex items-center gap-1 text-sm underline"
                >
                  {kpi.drill.label}
                  <ArrowRight className="size-3" aria-hidden="true" />
                </Link>
              ) : (
                <span className="text-sm text-muted-foreground">—</span>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function ContributionTable({ departments }: { departments: DepartmentHealth[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead scope="col">Department / measure</TableHead>
          <TableHead scope="col">Score</TableHead>
          <TableHead scope="col">Target</TableHead>
          <TableHead scope="col">Source</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {departments.map((dept) => (
          <Fragment key={dept.key}>
            <TableRow className="bg-muted/50">
              <TableCell className="font-medium">{dept.label}</TableCell>
              <TableCell className="tabular-nums">{dept.score ?? "—"}</TableCell>
              <TableCell className="text-muted-foreground">
                Weight {Math.round(dept.weight * 100)}%
              </TableCell>
              <TableCell className="text-muted-foreground">Resolve records</TableCell>
            </TableRow>
            {[...dept.scored, ...dept.missing].map((kpi) => (
              <TableRow key={`${dept.key}-${kpi.key}`}>
                <TableCell className="pl-8">{kpi.label}</TableCell>
                <TableCell className="tabular-nums">{contribution(kpi) ?? "Not scored"}</TableCell>
                <TableCell className="text-muted-foreground">
                  {kpi.target ?? "Target not configured"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {kpi.unavailable ? "Source missing" : (kpi.denominator ?? "Resolve records")}
                </TableCell>
              </TableRow>
            ))}
          </Fragment>
        ))}
      </TableBody>
    </Table>
  );
}
