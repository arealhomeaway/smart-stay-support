/**
 * Frontline Vendor Directory. Find the right vendor without touching the
 * database table. Also used inside a Ticket to choose who should handle it.
 */
import { canRevealEmergency, emergencyVisibleByDefault } from "@/lib/emergency-vendor";
import { canTakeWork, inTransitionalReview, qualificationHold, transitionalDaysLeft } from "@/components/vendors/useVendorWorkspace";
import { ComplianceBadge } from "@/components/vendors/ComplianceBadge";
import { Link } from "@tanstack/react-router";
import { useMemo, useState, type ReactNode } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Chip, EmptyState, LoadingRows } from "@/components/ui/page";
import { StatusBadge, type StatusTone } from "@/components/ui/status";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { VENDOR_STATUS_LABELS, type VendorStatus } from "@/lib/vendors";
import {
  DISPATCH_METHOD_LABELS,
  PREFERENCE_LABELS,
  type DispatchMethod,
  type Preference,
} from "@/lib/vendor-gold";
import { useVendorWorkspace, type VendorRecord } from "./useVendorWorkspace";

export const STATUS_TONE: Record<string, StatusTone> = {
  candidate: "context",
  pilot: "progress",
  approved: "resolved",
  gold: "brand",
  corrective_action: "escalated",
  suspended: "waiting",
};

const ALL = "__all";

export function VendorDirectory({
  initialMarket,
  initialCategory,
  onSelect,
  selectedId,
  noEligible,
  ticketPriority,
  canOverrideEmergency = false,
}: {
  /** Picker mode on a Ticket: controls Emergency Only visibility (P1 shown; P2 when needed; P3 Supervisor only). */
  ticketPriority?: string | null;
  canOverrideEmergency?: boolean;
  initialMarket?: string | null;
  initialCategory?: string | null;
  onSelect?: (vendor: VendorRecord) => void;
  selectedId?: string | null;
  /** Picker mode: shown when no vendor in the current results can take work (never a dead end). */
  noEligible?: (ctx: { market: string | null; category: string | null }) => ReactNode;
}) {
  const ws = useVendorWorkspace();
  const [q, setQ] = useState("");
  const [market, setMarket] = useState(initialMarket ?? ALL);
  const [category, setCategory] = useState(initialCategory ?? ALL);
  const [pref, setPref] = useState(ALL);
  const [status, setStatus] = useState(ALL);
  const [active, setActive] = useState("active");
  const [dispatch, setDispatch] = useState(ALL);
  const [showEmergency, setShowEmergency] = useState(false);

  const results = useMemo(() => {
    if (!ws.data) return [];
    const needle = q.trim().toLowerCase();
    return ws.data.vendors
      .map((v) => {
        const cov = ws.data.coverage.filter(
          (c) =>
            c.org_id === v.id &&
            (market === ALL || c.market === market) &&
            (category === ALL || c.service_category === category) &&
            (pref === ALL || c.preference === pref),
        );
        return { v, cov };
      })
      .filter(({ v, cov }) => {
        if (needle && !`${v.display_name} ${v.legal_name ?? ""} ${v.primary_contact_name ?? ""}`.toLowerCase().includes(needle))
          return false;
        const coverageFiltered = market !== ALL || category !== ALL || pref !== ALL;
        const legacyMatch =
          (market === ALL || v.markets.includes(market)) &&
          (category === ALL || v.service_categories.includes(category)) &&
          pref === ALL;
        if (coverageFiltered && cov.length === 0 && !legacyMatch) return false;
        if (status !== ALL && v.status !== status) return false;
        if (active === "active" && !v.is_active) return false;
        if (active === "inactive" && v.is_active) return false;
        if (dispatch !== ALL && v.dispatch_method !== dispatch) return false;
        return true;
      })
      .sort((a, b) => {
        const rank = (x: typeof a) =>
          (x.cov.some((c) => c.preference === "primary") ? 0 : x.cov.some((c) => c.preference === "backup") ? 1 : 2) +
          (x.v.status === "gold" ? -0.5 : 0);
        return rank(a) - rank(b) || a.v.display_name.localeCompare(b.v.display_name);
      });
  }, [ws.data, q, market, category, pref, status, active, dispatch]);

  if (ws.isLoading) return <LoadingRows rows={4} />;
  if (ws.error) return <EmptyState title="Could not load vendors" hint="Refresh the page to try again." />;
  const data = ws.data!;
  const picker = !!onSelect && ticketPriority !== undefined;
  const routineCount = results.filter(({ v }) => !v.emergency_only && canTakeWork(v, data.gateStatus, data.compliance)).length;
  const emergencyShown = !picker || showEmergency || emergencyVisibleByDefault(ticketPriority, routineCount);
  const emergencyHidden = picker && !emergencyShown ? results.filter(({ v }) => v.emergency_only).length : 0;
  const shownResults = emergencyShown ? results : results.filter(({ v }) => !v.emergency_only);
  const eligibleCount = shownResults.filter(({ v }) => canTakeWork(v, data.gateStatus, data.compliance)).length;
  const fallback =
    onSelect && noEligible && eligibleCount === 0
      ? noEligible({ market: market === ALL ? null : market, category: category === ALL ? null : category })
      : null;

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search vendor or company"
          className="pl-9"
          aria-label="Search vendors"
        />
      </div>
      {/* On a Ticket only market and trade matter; eligibility is already applied. */}
      <div className={onSelect ? "grid grid-cols-2 gap-2" : "grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6"}>
        <Filter label="Market" value={market} onChange={setMarket} options={data.markets.map((m) => [m, m])} />
        <Filter
          label="Service category"
          value={category}
          onChange={setCategory}
          options={data.categories.map((c) => [c.label, c.label])}
        />
        {!onSelect && (
          <>
            <Filter label="Preference" value={pref} onChange={setPref} options={Object.entries(PREFERENCE_LABELS)} />
            <Filter label="Gold Standard" value={status} onChange={setStatus} options={Object.entries(VENDOR_STATUS_LABELS)} />
            <Filter
              label="Active"
              value={active}
              onChange={setActive}
              options={[
                ["active", "Active"],
                ["inactive", "Inactive"],
              ]}
            />
            <Filter label="Dispatch" value={dispatch} onChange={setDispatch} options={Object.entries(DISPATCH_METHOD_LABELS)} />
          </>
        )}
      </div>
      {onSelect && category === ALL && (
        <p className="text-xs text-muted-foreground">Pick the trade this issue needs to narrow the list.</p>
      )}

      {fallback}
      {emergencyHidden > 0 && canRevealEmergency(ticketPriority, canOverrideEmergency) && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-border p-2 text-sm">
          <span className="text-muted-foreground">
            {emergencyHidden} Emergency Only vendor{emergencyHidden === 1 ? "" : "s"} hidden for a {String(ticketPriority).toUpperCase()} Ticket.
            {ticketPriority === "p2" ? " Use only when no routine vendor is available, after hours, or with Supervisor approval." : " A Supervisor override is required."}
          </span>
          <Button size="sm" variant="outline" onClick={() => setShowEmergency(true)}>Show Emergency Only vendors</Button>
        </div>
      )}
      {shownResults.length === 0 ? (
        <EmptyState
          title="No vendors match"
          hint={data.vendors.length === 0 ? "No vendors are in Resolve yet." : "Loosen a filter to see more."}
        />
      ) : (
        <ul className="space-y-2">
          {shownResults.map(({ v, cov }) => {
            const shown = cov.length ? cov : [];
            const topPref = shown.find((c) => c.preference === "primary")
              ? "primary"
              : shown.find((c) => c.preference === "backup")
                ? "backup"
                : null;
            const cats = [...new Set(shown.map((c) => c.service_category))];
            const mkts = [...new Set(shown.map((c) => c.market))];
            const catLine = (cats.length ? cats : v.service_categories).slice(0, 3).join(", ") || "No category yet";
            const mktLine = (mkts.length ? mkts : v.markets).join(", ") || "No market yet";
            return (
              <li
                key={v.id}
                className={`surface-row flex flex-wrap items-center gap-3 py-3 pl-4 pr-3 ${selectedId === v.id ? "ring-2 ring-primary" : ""}`}
              >
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{v.display_name}</p>
                  <p className="text-sm text-muted-foreground">
                    {catLine} | {mktLine}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <StatusBadge tone={STATUS_TONE[v.status] ?? "context"}>
                      {VENDOR_STATUS_LABELS[v.status as VendorStatus] ?? v.status}
                    </StatusBadge>
                    {v.emergency_only && <StatusBadge tone="escalated">Emergency Only</StatusBadge>}
                    {inTransitionalReview(v) && (
                      <>
                        <StatusBadge tone="waiting">Transitional Review</StatusBadge>
                        <Chip>Gold Standard verification incomplete · {transitionalDaysLeft(v)} days left</Chip>
                      </>
                    )}
                    {topPref && <Chip>{PREFERENCE_LABELS[topPref as Preference]}</Chip>}
                    <Chip>Dispatch: {DISPATCH_METHOD_LABELS[v.dispatch_method as DispatchMethod]}</Chip>
                    <ComplianceBadge state={ws.data!.compliance.get(v.id)?.state} />
                    {!v.is_active && <Chip>Inactive</Chip>}
                    {qualificationHold(v, ws.data!.gateStatus) && <Chip>On hold — a qualification check expired</Chip>}
                  </div>
                </div>
                <div className="flex gap-2">
                  {onSelect && (
                    <Button size="sm" onClick={() => onSelect(v)} disabled={!canTakeWork(v, ws.data!.gateStatus, ws.data!.compliance)}
                      title={canTakeWork(v, ws.data!.gateStatus, ws.data!.compliance) ? undefined : "Not available for new work (inactive, not yet qualified, on hold or a credential expired)"}>
                      {selectedId === v.id ? "Selected" : "Choose"}
                    </Button>
                  )}
                  <Button size="sm" variant="outline" asChild>
                    <Link to="/vendors/$vendorId" params={{ vendorId: v.id }}>
                      View Vendor
                    </Link>
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Filter({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger aria-label={label} className="h-9">
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        {label !== "Active" && <SelectItem value={ALL}>Any {label.toLowerCase()}</SelectItem>}
        {options.map(([v, l]) => (
          <SelectItem key={v} value={v}>
            {l}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
