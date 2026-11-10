# Build 7: every file changed, with before and after

Compared with the code before Build 7. "Before" lines start with -, "after" lines with +. New files are listed first.

## New files

- docs/pending/wording/01_standard_plan_role_wording.sql
- docs/pending/wording/README.md
- docs/pending/wording/SHA256SUMS
- docs/pending/wording/undo/01_undo_standard_plan_role_wording.sql
- src/lib/__tests__/build7-wording-phone.test.ts
- src/lib/help-position.ts
- src/lib/ticket-availability.ts

## Existing files changed

### src/components/ActAsBanner.tsx (1 lines changed)
```diff
-          {live ? " and affect their real program — this is not a sandbox." : "."}
+          {live ? " and affect their real program. This is not a sandbox." : "."}
```

### src/components/AppShell.tsx (22 lines changed)
```diff
+  useSidebar,
+      <CloseMenuOnPageChange />
-                          className="h-10 rounded-lg font-medium data-[active=true]:bg-sidebar-primary data-[active=true]:font-semibold data-[active=true]:text-sidebar-primary-foreground data-[active=true]:shadow-sm data-[active=true]:[&>s
+                          className="h-11 rounded-lg font-medium data-[active=true]:bg-sidebar-primary data-[active=true]:font-semibold data-[active=true]:text-sidebar-primary-foreground data-[active=true]:shadow-sm data-[active=true]:[&>s
-              <SidebarTrigger className="min-h-11 min-w-11 md:min-h-9 md:min-w-9" />
+              <SidebarTrigger className="min-h-11 min-w-11" />
-                        className="min-h-11 md:min-h-9"
+                        className="min-h-11"
-                        className="min-h-11 md:min-h-9"
+                        className="min-h-11"
-                      className="min-h-11 min-w-11 md:min-h-9 md:min-w-9"
+                      className="min-h-11 min-w-11"
-                  <TooltipContent>Sign out — {identityLabel}</TooltipContent>
+                  <TooltipContent>Sign out: {identityLabel}</TooltipContent>
-          className="min-h-11 min-w-11 md:min-h-9 md:min-w-9"
+          className="min-h-11 min-w-11"
+
+/** On a phone the left menu closes once a page is chosen, so it never stays over the page (register H6). */
+function CloseMenuOnPageChange() {
+  const { isMobile, openMobile, setOpenMobile } = useSidebar();
+  const href = useRouterState({ select: (s) => s.location.href });
+  const [lastHref, setLastHref] = useState(href);
+  useEffect(() => {
+    if (href === lastHref) return;
+    setLastHref(href);
+    if (isMobile && openMobile) setOpenMobile(false);
+  }, [href, lastHref, isMobile, openMobile, setOpenMobile]);
+  return null;
+}
```

### src/components/AssignmentExceptionQueue.tsx (1 lines changed)
```diff
-          <p className="text-muted-foreground">Nothing waiting — every open ticket has an owner.</p>
+          <p className="text-muted-foreground">Nothing waiting: every open ticket has an owner.</p>
```

### src/components/AttachmentsPanel.tsx (1 lines changed)
```diff
-                    {formatBytes(f.size_bytes ?? 0)} · {f.uploaded_by_name ?? "—"} ·{" "}
+                    {formatBytes(f.size_bytes ?? 0)} · {f.uploaded_by_name ?? "Not set"} ·{" "}
```

### src/components/AvailabilityMap.tsx (1 lines changed)
```diff
-        map: map.current, position: { lat: result.lat, lng: result.lng }, title: `${result.name} — ${result.status}`,
+        map: map.current, position: { lat: result.lat, lng: result.lng }, title: `${result.name} · ${result.status}`,
```

### src/components/BreezewayConnectionPanel.tsx (9 lines changed)
```diff
-              <td className="py-1 pr-3 text-foreground">{t.name ?? "—"}</td>
-              <td className="py-1 pr-3">{t.status ?? t.stage ?? "—"}</td>
+              <td className="py-1 pr-3 text-foreground">{t.name ?? "Not set"}</td>
+              <td className="py-1 pr-3">{t.status ?? t.stage ?? "Not set"}</td>
-                      .map((a) => `${a.name ?? "Unnamed"} (${a.status ?? "—"})`)
+                      .map((a) => `${a.name ?? "Unnamed"} (${a.status ?? "Not set"})`)
-            {r.resolveName && r.breezewayName ? ` → ${r.resolveName}` : ""} — {r.note}
+            {r.resolveName && r.breezewayName ? ` to ${r.resolveName}` : ""} · {r.note}
-          Breezeway account — Resolve restricts itself to reads. No webhook is registered and
+          Breezeway account. Resolve restricts itself to reads. No webhook is registered and
-            <dd>{s?.connectedCompany ?? "—"}</dd>
+            <dd>{s?.connectedCompany ?? "Not set"}</dd>
-                <strong>Pilot preview — {preview.resolveName ?? PILOT.label}</strong>
+                <strong>Pilot preview: {preview.resolveName ?? PILOT.label}</strong>
-                    {preview.breezewayName ?? "—"} · {preview.breezewayId} (
-                    {preview.breezewayStatus ?? "—"})
+                    {preview.breezewayName ?? "Not set"} · {preview.breezewayId} (
+                    {preview.breezewayStatus ?? "Not set"})
```

### src/components/BreezewayOutboundReviewPanel.tsx (2 lines changed)
```diff
-          retried automatically — check Breezeway, then record what you found.
+          retried automatically. Check Breezeway, then record what you found.
-                No task exists — close it
+                No task exists: close it
```

### src/components/BreezewaySyncReviewPanel.tsx (5 lines changed)
```diff
-          : "Nothing new — every difference is already on the board.",
+          : "Nothing new: every difference is already on the board.",
-                      {e.receivedAt ? usDateTime(e.receivedAt) : "—"}
+                      {e.receivedAt ? usDateTime(e.receivedAt) : "Not set"}
-                    Resolve: {d.resolveValue ?? "—"} · Breezeway: {d.externalValue ?? "—"}
+                    Resolve: {d.resolveValue ?? "Not set"} · Breezeway: {d.externalValue ?? "Not set"}
-                      <p>{c.resolveValue ?? "—"}</p>
+                      <p>{c.resolveValue ?? "Not set"}</p>
-                      <p>{c.externalValue ?? "—"}</p>
+                      <p>{c.externalValue ?? "Not set"}</p>
```

### src/components/BreezewayTaskPanel.tsx (6 lines changed)
```diff
-    return "Nobody is assigned in Breezeway yet — chase an assignment.";
+    return "Nobody is assigned in Breezeway yet. Chase an assignment.";
-              ? "Optional — sends this ticket's Work Order to Breezeway for field-team scheduling."
+              ? "Optional: sends this ticket's Work Order to Breezeway for field-team scheduling."
-        subtitle="Optional — sends this ticket's Work Order externally for field scheduling. You keep the ticket either way."
+        subtitle="Optional: sends this ticket's Work Order externally for field scheduling. You keep the ticket either way."
-        description="This uses the Work Order already open on this ticket, or opens one if none exists yet, and sends it to Breezeway for field-team scheduling — it can't be recalled once sent."
+        description="This uses the Work Order already open on this ticket, or opens one if none exists yet, and sends it to Breezeway for field-team scheduling. It can't be recalled once sent."
-          <dd className="font-medium">{title || "—"}</dd>
+          <dd className="font-medium">{title || "Not set"}</dd>
-              : "Not assigned yet — sent unassigned"}
+              : "Not assigned yet: sent unassigned"}
```

### src/components/BreezewayWebhookPanel.tsx (13 lines changed)
```diff
-  ignored_other_property: "Ignored — other property",
-  ignored_other_company: "Ignored — other company",
-  duplicate: "Ignored — duplicate update",
-  stale: "Ignored — older update",
-  invalid: "Ignored — unusable payload",
+  ignored_other_property: "Ignored: other property",
+  ignored_other_company: "Ignored: other company",
+  duplicate: "Ignored: duplicate update",
+  stale: "Ignored: older update",
+  invalid: "Ignored: unusable payload",
-  verify_failed: "Dropped — Breezeway Work Order lookup failed",
+  verify_failed: "Dropped: Breezeway Work Order lookup failed",
-  persist_failed: "Not recorded — database write failed",
+  persist_failed: "Not recorded: database write failed",
-              are verified and retained; everything else is counted and discarded. Preview only — no
+              are verified and retained; everything else is counted and discarded. Preview only: no
-              limit). Preview only — a recovered event still goes through the same scope and
+              limit). Preview only: a recovered event still goes through the same scope and
-              Wrong secret refused ({reach.wrongSecretStatus ?? "—"})
+              Wrong secret refused ({reach.wrongSecretStatus ?? "Not set"})
-                {c.name} → {OUTCOME_LABELS[c.actual] ?? c.actual}
+                {c.name}: {OUTCOME_LABELS[c.actual] ?? c.actual}
-            {registration.ok ? "✅ " : "⚠️ "}
+            {registration.ok ? "Done: " : "Needs attention: "}
-                        `${s.webhookType ?? "task"} → ${s.host ?? "unknown host"}${s.mine ? " (ours)" : ""}`,
+                        `${s.webhookType ?? "task"} to ${s.host ?? "unknown host"}${s.mine ? " (ours)" : ""}`,
```

### src/components/BreezewayWorkOrderPanel.tsx (2 lines changed)
```diff
-            Breezeway has no photo delete — check the image before you send it.
+            Breezeway has no photo delete. Check the image before you send it.
-            Current Breezeway work at this home. Resolve stays the source of truth — closing here
+            Current Breezeway work at this home. Resolve stays the source of truth. Closing here
```

### src/components/CleaningRegionsPanel.tsx (1 lines changed)
```diff
-          Every inspection is opened for the manager who covers that market — automatically, as each
+          Every inspection is opened for the manager who covers that market, automatically, as each
```

### src/components/CompanyHealthPanel.tsx (6 lines changed)
```diff
-                {health.score ?? "—"}
+                {health.score ?? "-"}
-                  . Averaging can keep the headline score high — these do not wait.
+                  . Averaging can keep the headline score high. These do not wait.
-                    {dept.score ?? "—"} / 100
+                    {dept.score ?? "-"} / 100
-                    : "—"}
+                    : "Not set"}
-                <span className="text-sm text-muted-foreground">—</span>
+                <span className="text-sm text-muted-foreground">-</span>
-              <TableCell className="tabular-nums">{dept.score ?? "—"}</TableCell>
+              <TableCell className="tabular-nums">{dept.score ?? "-"}</TableCell>
```

### src/components/CoverageSchedulePanel.tsx (15 lines changed)
```diff
-          <span className={`chip ${BLOCK_FILL["team_a"]}`}>Team A — Guest Experience</span>
-          <span className={`chip ${BLOCK_FILL["team_b"]}`}>Team B — Property Operations</span>
+          <span className={`chip ${BLOCK_FILL["team_a"]}`}>Team A: Guest Experience</span>
+          <span className={`chip ${BLOCK_FILL["team_b"]}`}>Team B: Property Operations</span>
-                          {clock(s.start_minute)}–{clock(s.end_minute)}
+                          {clock(s.start_minute)} to {clock(s.end_minute)}
-                          Triage {clock(t.start_minute)}–{clock(t.end_minute)}
+                          Triage {clock(t.start_minute)} to {clock(t.end_minute)}
-                On-call, every night {clock(nightStart)}–{clock(nightEnd)} Central.
+                On-call, every night {clock(nightStart)} to {clock(nightEnd)} Central.
-                      Marked unavailable{role.unavailable_note ? ` — ${role.unavailable_note}` : ""}
+                      Marked unavailable{role.unavailable_note ? ` · ${role.unavailable_note}` : ""}
-                      No schedule — available by exception
+                      No schedule: available by exception
-                        {clock(s.start_minute)}–{clock(s.end_minute)}
+                        {clock(s.start_minute)} to {clock(s.end_minute)}
-                          {usDateTime(o.starts_at)} → {usDateTime(o.ends_at)}
+                          {usDateTime(o.starts_at)} to {usDateTime(o.ends_at)}
-                              toast.success("Override removed — the normal schedule is back.");
+                              toast.success("Override removed: the normal schedule is back.");
-              "Override saved — it beats the recurring schedule while it lasts.",
+              "Override saved: it beats the recurring schedule while it lasts.",
-                {DAYS[w.weekday]} {clock(w.start_minute)}–{clock(w.end_minute)}
+                {DAYS[w.weekday]} {clock(w.start_minute)} to {clock(w.end_minute)}
-              → {label(w.role_code)}
+              to {label(w.role_code)}
-          priority is still judged on impact, so overnight is never automatically P1.
+          priority is still judged on impact, so overnight is never automatically Right now.
-                      {r.starts_on} → {r.ends_on}
+                      {r.starts_on} to {r.ends_on}
```

### src/components/DocumentCompletionPanel.tsx (1 lines changed)
```diff
-      toast.success("Retired — still readable, out of the way.");
+      toast.success("Retired: still readable, out of the way.");
```

### src/components/EmailComposer.tsx (8 lines changed)
```diff
-        <DialogTitle>Email — {ctx.data?.heading ?? CONTEXT_LABELS[context]}</DialogTitle>
+        <DialogTitle>Email: {ctx.data?.heading ?? CONTEXT_LABELS[context]}</DialogTitle>
-                {usDateTime(recovered.savedAt)} — {recovered.subject.trim() || "no subject yet"}.
+                {usDateTime(recovered.savedAt)} · {recovered.subject.trim() || "no subject yet"}.
-                <SelectItem value={CUSTOM}>Someone else — type an address…</SelectItem>
+                <SelectItem value={CUSTOM}>Someone else: type an address…</SelectItem>
-                  : "This record has no contact on file yet — type an address above."}
+                  : "This record has no contact on file yet. Type an address above."}
-                This record could not fill in: {missing.join(", ").replace(/_/g, " ")} — please
+                This record could not fill in: {missing.join(", ").replace(/_/g, " ")}. Please
-              placeholder="Write the message. Edit anything the template filled in — every word is yours to change."
+              placeholder="Write the message. Edit anything the template filled in. Every word is yours to change."
-                {files.map((f) => f.name).join(", ")} —{" "}
+                {files.map((f) => f.name).join(", ")} · {" "}
-              Preview — exactly as it will arrive
+              Preview: exactly as it will arrive
```

### src/components/EscalationPanel.tsx (3 lines changed)
```diff
-                    {t.hint ? ` — ${t.hint}` : ""}
+                    {t.hint ? ` · ${t.hint}` : ""}
-                    {u.label} — {u.hint}
+                    {u.label} · {u.hint}
-              {o.label} — {o.hint}
+              {o.label} · {o.hint}
```

### src/components/EvidenceQualityCard.tsx (2 lines changed)
```diff
-  return n === null ? "—" : `${Math.round(n * 100)}%`;
+  return n === null ? "-" : `${Math.round(n * 100)}%`;
-                <p className="text-xl font-semibold">{data.medianAttemptsToPass ?? "—"}</p>
+                <p className="text-xl font-semibold">{data.medianAttemptsToPass ?? "Not set"}</p>
```

### src/components/EvidenceQualityGate.tsx (1 lines changed)
```diff
-      else if (res.status === "rejected") toast.error("Photo not accepted — see what to change.");
+      else if (res.status === "rejected") toast.error("Photo not accepted: see what to change.");
```

### src/components/FullBackupPanel.tsx (3 lines changed)
```diff
-            <Button size="sm" variant="outline" className="min-h-11 md:min-h-9" disabled={verify.isPending || run.isPending} onClick={() => verify.mutate(last.id)}>
+            <Button size="sm" variant="outline" className="min-h-11" disabled={verify.isPending || run.isPending} onClick={() => verify.mutate(last.id)}>
-          <Button size="sm" className="min-h-11 md:min-h-9" disabled={!q.data?.ready || run.isPending} onClick={() => run.mutate()}>
+          <Button size="sm" className="min-h-11" disabled={!q.data?.ready || run.isPending} onClick={() => run.mutate()}>
-          <Button variant="ghost" size="sm" className="min-h-11 md:min-h-9 px-0" onClick={() => setShowCounts((s) => !s)}>
+          <Button variant="ghost" size="sm" className="min-h-11 px-0" onClick={() => setShowCounts((s) => !s)}>
```

### src/components/GlobalSearch.tsx (1 lines changed)
```diff
-        className="w-full justify-start gap-2 text-muted-foreground sm:w-64"
+        className="min-h-11 w-full justify-start gap-2 text-muted-foreground sm:w-64"
```

### src/components/GuestContextPanel.tsx (8 lines changed)
```diff
-  if (!arrival || !departure) return "—";
-  return `${usDate(arrival)} → ${usDate(departure)}`;
+  if (!arrival || !departure) return "Not set";
+  return `${usDate(arrival)} to ${usDate(departure)}`;
-          Live from OwnerRez. Read-only — nothing here is saved or sent back.
+          Live from OwnerRez. Read-only: nothing here is saved or sent back.
-          <p className="text-muted-foreground">Guest contact unavailable—verify in OwnerRez.</p>
+          <p className="text-muted-foreground">Guest contact unavailable: verify in OwnerRez.</p>
-            <Row label="Name" value={result.guest_name ?? "—"} />
-            <Row label="Phone" value={result.phone ?? "—"} />
+            <Row label="Name" value={result.guest_name ?? "Not set"} />
+            <Row label="Phone" value={result.phone ?? "Not set"} />
-            <Row label="Reservation" value={result.reservation_id ?? "—"} />
-            <Row label="Channel" value={result.booking_channel ?? "—"} />
+            <Row label="Reservation" value={result.reservation_id ?? "Not set"} />
+            <Row label="Channel" value={result.booking_channel ?? "Not set"} />
```

### src/components/GuidanceCard.tsx (1 lines changed)
```diff
-                        <span className="text-muted-foreground"> — {flag.why}</span>
+                        <span className="text-muted-foreground"> · {flag.why}</span>
```

### src/components/GuidedActionCard.tsx (1 lines changed)
```diff
-  successMessage = "Step recorded — here's what's next.",
+  successMessage = "Step recorded: here's what's next.",
```

### src/components/HandoffPanel.tsx (10 lines changed)
```diff
+  priorityMeta,
-        )}. Not complete until accepted — you remain accountable.`,
+        )}. Not complete until accepted. You remain accountable.`,
-    await log("Reassignment accepted — ownership of the next action transferred.", "handoff_accepted");
+    await log("Reassignment accepted: ownership of the next action transferred.", "handoff_accepted");
-      `Reassignment rejected: ${rejectReason.trim()} — returned to the original owner.`,
+      `Reassignment rejected: ${rejectReason.trim()}. Returned to the original owner.`,
-    (roles ?? []).find((r) => r.code === code)?.name ?? code ?? "—";
+    (roles ?? []).find((r) => r.code === code)?.name ?? code ?? "Not set";
-          Tagging someone is not a reassignment. It is not complete until the receiver accepts it — until
+          Tagging someone is not a reassignment. It is not complete until the receiver accepts it, until
-                {h.priority.toUpperCase()}
+                {priorityMeta(h.priority).short}
-                <ShieldAlert className="size-3.5" /> Unaccepted P1 reassignment — the Operations
+                <ShieldAlert className="size-3.5" /> Unaccepted Right now reassignment. The Operations
-                    You requested this — waiting for {roleName(h.to_role_code)} to accept it.
+                    You requested this: waiting for {roleName(h.to_role_code)} to accept it.
-                        {t.label} — {t.hint}
+                        {t.label} · {t.hint}
```

### src/components/HelpFeedback.tsx (32 lines changed)
```diff
-import { useState } from "react";
+import { useEffect, useState } from "react";
+import { helpSideFor } from "@/lib/help-position";
+function useHelpSide(): "left" | "right" | null {
+  const [side, setSide] = useState<"left" | "right" | null>(null);
+  useEffect(() => {
+    const check = () => {
+      const open = [...document.querySelectorAll('[role="dialog"][data-state="open"]')]
+        .filter((el) => !el.closest("[data-help-dialog]"))
+        .map((el) => el.getBoundingClientRect())
+        .filter((r) => r.width > 0 && r.height > 0);
+      setSide(helpSideFor(open, window.innerWidth));
+    };
+    check();
+    const mo = new MutationObserver(check);
+    mo.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["data-state"] });
+    window.addEventListener("resize", check);
+    return () => {
+      mo.disconnect();
+      window.removeEventListener("resize", check);
+    };
+  }, []);
+  return side;
+}
+
+  const helpSide = useHelpSide();
-                  className="fixed bottom-4 right-4 z-40 size-11 rounded-full shadow-md print:hidden"
+                  data-help-feedback=""
+                  data-help-side={helpSide ?? "right"}
+                  className={`pointer-events-auto fixed bottom-4 size-11 rounded-full shadow-md print:hidden ${
+                    helpSide === "left" ? "left-4 z-[60]" : helpSide === "right" ? "right-4 z-[60]" : "right-4 z-40"
+                  }`}
-          <DropdownMenuContent side="top" align="end" className="mb-2 w-56">
+          <DropdownMenuContent side="top" align={helpSide === "left" ? "start" : "end"} className="z-[70] mb-2 w-56" data-help-feedback="">
-        <DialogContent className="sm:max-w-lg">
+        <DialogContent className="z-[70] sm:max-w-lg" data-help-dialog="">
```

### src/components/JobMap.tsx (1 lines changed)
```diff
-        title: clustered ? `${group.length} properties, ${count} active issues` : `${pin.name} — ${count} active`,
+        title: clustered ? `${group.length} properties, ${count} active issues` : `${pin.name} · ${count} active`,
```

### src/components/LaunchStateGate.tsx (1 lines changed)
```diff
-        Nothing has been removed. An administrator can enable this from Integrations → Feature flags
+        Nothing has been removed. An administrator can enable this from Integrations, then Feature flags
```

### src/components/MatterOwnershipPanel.tsx (2 lines changed)
```diff
-      toast.success("Escalated — a supervisor will see this in the queue.");
+      toast.success("Escalated: a supervisor will see this in the queue.");
-            Archived {usDateTime(ticket.archived_at)} — {ticket.archive_reason}
+            Archived {usDateTime(ticket.archived_at)} · {ticket.archive_reason}
```

### src/components/NotificationBell.tsx (2 lines changed)
```diff
-          <Button size="icon" variant="ghost" className="relative min-h-11 min-w-11 md:min-h-9 md:min-w-9" aria-label={label}>
+          <Button size="icon" variant="ghost" className="relative min-h-11 min-w-11" aria-label={label}>
-            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={markAll}>
+            <Button size="sm" variant="ghost" className="min-h-11 text-xs" onClick={markAll}>
```

### src/components/OnCallNowCard.tsx (2 lines changed)
```diff
-          Ticket — a question fully answered on the call does not. Overnight does not mean P1;
-          classify P1/P2/P3 on the actual impact.
+          Ticket. A question fully answered on the call does not. Overnight does not mean Right now;
+          choose Right now, Today or Routine on the actual impact.
```

### src/components/OnboardingTour.tsx (3 lines changed)
```diff
-    body: "A 60-second tour of how a guest issue becomes a tracked ticket — with the safety checks built in so nothing gets removed and left as a hole in the wall.",
+    body: "A 60-second tour of how a guest issue becomes a tracked ticket, with the safety checks built in so nothing gets removed and left as a hole in the wall.",
-    body: "The working queue. Priority (P1–P3) and the response clock decide what you touch next — the property decides which pod owns it.",
+    body: "The working queue. Urgency (Right now, Today, Routine) and the response clock decide what you touch next. The property decides which pod owns it.",
-    body: "This is where the water-heater incident gets prevented. Each work type carries required steps — check every smoke and CO alarm, replace any device removed on the same visit — and the ticket cannot close until they are done.",
+    body: "This is where the water-heater incident gets prevented. Each work type carries required steps. Check every smoke and CO alarm, replace any device removed on the same visit, and the ticket cannot close until they are done.",
```

### src/components/OvernightHandoffPanel.tsx (1 lines changed)
```diff
-  if (t.handoff_status === "pending") out.push("Handed into Operations — not accepted");
+  if (t.handoff_status === "pending") out.push("Handed into Operations: not accepted");
```

### src/components/OwnerApprovalPanel.tsx (2 lines changed)
```diff
-          ? "Decision recorded — thank you."
+          ? "Decision recorded: thank you."
-                  Preview only — decisions can only be recorded by the homeowner.
+                  Preview only: decisions can only be recorded by the homeowner.
```

### src/components/OwnerBadges.tsx (1 lines changed)
```diff
-                title={`${def.requirement}${got ? ` — earned ${usDate(got.awarded_at)}` : ""}`}
+                title={`${def.requirement}${got ? `· earned ${usDate(got.awarded_at)}` : ""}`}
```

### src/components/OwnerConversation.tsx (1 lines changed)
```diff
-            <p className="text-xs text-muted-foreground">Replies are visible to the homeowner. Internal notes stay on the Task. Resolving closes this conversation only — complete the internal Task on its own.</p>
+            <p className="text-xs text-muted-foreground">Replies are visible to the homeowner. Internal notes stay on the Task. Resolving closes this conversation only. Complete the internal Task on its own.</p>
```

### src/components/OwnerFilesPanel.tsx (1 lines changed)
```diff
-            Each file can be up to {formatBytes(MAX_FILE_BYTES)} — longer videos need to be trimmed or
+            Each file can be up to {formatBytes(MAX_FILE_BYTES)}. Longer videos need to be trimmed or
```

### src/components/OwnerLinkPanel.tsx (1 lines changed)
```diff
-            ? "Matched an existing owner record — no duplicate was created."
+            ? "Matched an existing owner record. No duplicate was created."
```

### src/components/OwnerParticipationOffer.tsx (1 lines changed)
```diff
-                      {ACTION_TYPE_META[t].label} — {ACTION_TYPE_META[t].hint}
+                      {ACTION_TYPE_META[t].label} · {ACTION_TYPE_META[t].hint}
```

### src/components/OwnerProgramActivation.tsx (3 lines changed)
```diff
-              {property.name} —{" "}
+              {property.name} · {" "}
-                : "closing not confirmed yet — counts once confirmed"}
+                : "closing not confirmed yet. Counts once confirmed"}
-              Every activity dated in the calendar year of a confirmed closing counts once — including
+              Every activity dated in the calendar year of a confirmed closing counts once, including
```

### src/components/ParticipationReportPanel.tsx (1 lines changed)
```diff
-          ? "Your program year has closed. Download your complete record whenever you need it — no request to ARHA required."
+          ? "Your program year has closed. Download your complete record whenever you need it. No request to ARHA required."
```

### src/components/PortalSwitcher.tsx (2 lines changed)
```diff
-            className="min-h-11 md:min-h-9"
+            className="min-h-11"
-          <strong className="mr-1">Demo</strong>— you are working in the demo environment. Real
+          <strong className="mr-1">Demo</strong>. You are working in the demo environment. Real
```

### src/components/PropertyContactPanel.tsx (6 lines changed)
```diff
-  if (!arrival || !departure) return "—";
-  return `${usDate(arrival)} → ${usDate(departure)}`;
+  if (!arrival || !departure) return "Not set";
+  return `${usDate(arrival)} to ${usDate(departure)}`;
-          owner directory. Read-only — nothing here is saved or sent.
+          owner directory. Read-only: nothing here is saved or sent.
-              More than one reservation matches right now — verify the guest directly in OwnerRez
+              More than one reservation matches right now. Verify the guest directly in OwnerRez
-              Guest contact unavailable — verify in OwnerRez. ({guest.message})
+              Guest contact unavailable: verify in OwnerRez. ({guest.message})
-              <Row label="Reservation" value={guest.reservation_id ?? "—"} />
+              <Row label="Reservation" value={guest.reservation_id ?? "Not set"} />
```

### src/components/PropertyCredentialsPanel.tsx (1 lines changed)
```diff
-  const prefix = r.freshness === "overdue" ? "Verified over a year ago —" : "Verified";
+  const prefix = r.freshness === "overdue" ? "Verified over a year ago:" : "Verified";
```

### src/components/PropertyDetailSections.tsx (1 lines changed)
```diff
-          placeholder="Find in this property — wifi, trash day, gate, water shutoff, air filter, HOA, warranty…"
+          placeholder="Find in this property. Wifi, trash day, gate, water shutoff, air filter, HOA, warranty…"
```

### src/components/PropertyDocumentLibrary.tsx (1 lines changed)
```diff
-                    {l.legacy && <Badge variant="outline">Legacy — not canonical</Badge>}
+                    {l.legacy && <Badge variant="outline">Legacy: not canonical</Badge>}
```

### src/components/PropertyPhoto.tsx (1 lines changed)
```diff
-        alt={label ? `${label} — ARHA property photo` : "ARHA property photo"}
+        alt={label ? `${label} · ARHA property photo` : "ARHA property photo"}
```

### src/components/ReservationContextPanel.tsx (7 lines changed)
```diff
-    .join(" → ");
+    .join(" to ");
-          OwnerRez stays the system of record — change the booking there.
+          OwnerRez stays the system of record. Change the booking there.
-        <Row label="Guest" value={ticket.reservation_guest_name ?? "—"} />
-        <Row label="Stay" value={stay || "—"} />
-        <Row label="Channel" value={ticket.reservation_channel ?? "—"} />
-        <Row label="Confirmation" value={ticket.reservation_confirmation ?? "—"} />
+        <Row label="Guest" value={ticket.reservation_guest_name ?? "Not set"} />
+        <Row label="Stay" value={stay || "Not set"} />
+        <Row label="Channel" value={ticket.reservation_channel ?? "Not set"} />
+        <Row label="Confirmation" value={ticket.reservation_confirmation ?? "Not set"} />
-          value={ticket.reservation_guest_count ? String(ticket.reservation_guest_count) : "—"}
+          value={ticket.reservation_guest_count ? String(ticket.reservation_guest_count) : "-"}
```

### src/components/SchedulePanel.tsx (1 lines changed)
```diff
-                    {r.currentDue ?? "no date"} →{" "}
+                    {r.currentDue ?? "no date"} to{" "}
```

### src/components/SharePointConnectionPanel.tsx (8 lines changed)
```diff
-          <PlugZap className="size-4" /> SharePoint — ARHA Resolve site
+          <PlugZap className="size-4" /> SharePoint: ARHA Resolve site
-                    <td className="p-2 font-mono">{p.status ?? "—"}</td>
+                    <td className="p-2 font-mono">{p.status ?? "Not set"}</td>
-            Verify the request first — sign-in stays disabled until the generated request matches
+            Verify the request first. Sign-in stays disabled until the generated request matches
-            <dd className="font-mono break-all">{inspection.clientId ?? "—"}</dd>
+            <dd className="font-mono break-all">{inspection.clientId ?? "Not set"}</dd>
-              {inspection.tenant ?? "—"}{" "}
+              {inspection.tenant ?? "Not set"}{" "}
-            <dd className="font-mono break-all">{inspection.redirectUri ?? "—"}</dd>
+            <dd className="font-mono break-all">{inspection.redirectUri ?? "Not set"}</dd>
-            <dd className="font-mono break-all">{inspection.scopes.join(" ") || "—"}</dd>
+            <dd className="font-mono break-all">{inspection.scopes.join(" ") || "None"}</dd>
-                <Badge variant="destructive">Does not match — do not sign in</Badge>
+                <Badge variant="destructive">Does not match: do not sign in</Badge>
```

### src/components/SpecialHandlingNotice.tsx (2 lines changed)
```diff
-            {r.vendor_name ? <span className="font-medium"> — {r.vendor_name}</span> : null}
+            {r.vendor_name ? <span className="font-medium"> · {r.vendor_name}</span> : null}
-              <span className="font-medium"> — ${Number(r.threshold_amount).toLocaleString()}</span>
+              <span className="font-medium">· ${Number(r.threshold_amount).toLocaleString()}</span>
```

### src/components/SupervisorAttentionBand.tsx (1 lines changed)
```diff
-        <Link to="/oversight" className="text-sm font-medium text-primary hover:underline">
+        <Link to="/oversight" className="inline-flex min-h-11 items-center text-sm font-medium text-primary hover:underline">
```

### src/components/TeamAccessPanel.tsx (1 lines changed)
```diff
-  ASSIGNABLE_ROLES.map((r) => [r, `${ROLE_LABELS[r]} — ${ROLE_BLURBS[r]}`]),
+  ASSIGNABLE_ROLES.map((r) => [r, `${ROLE_LABELS[r]} · ${ROLE_BLURBS[r]}`]),
```

### src/components/TeamInvitePanel.tsx (9 lines changed)
```diff
-  admin: "Admin — everything, including roles and settings",
-  manager: "Supervisor — oversight, analytics and handoff review",
-  onboarding: "Onboarding staff — pre-handoff work and readiness",
-  tech: "Staff — their own assigned work",
-  vendor: "Vendor — only their dispatched Work Orders",
-  owner: "Homeowner — their own enrolled home",
+  admin: "Admin: everything, including roles and settings",
+  manager: "Supervisor: oversight, analytics and handoff review",
+  onboarding: "Onboarding staff: pre-handoff work and readiness",
+  tech: "Staff: their own assigned work",
+  vendor: "Vendor: only their dispatched Work Orders",
+  owner: "Homeowner: their own enrolled home",
-        toast.success(`Code ${res.code} emailed to them — a copy is on your clipboard too.`);
+        toast.success(`Code ${res.code} emailed to them. A copy is on your clipboard too.`);
-        toast.success(`Code ${res.code} created — invite message copied, paste it to them.`);
+        toast.success(`Code ${res.code} created: invite message copied, paste it to them.`);
-                      toast.success("Invite message copied — paste it to them.");
+                      toast.success("Invite message copied: paste it to them.");
```

### src/components/ThemeToggle.tsx (1 lines changed)
```diff
-      className="min-h-11 min-w-11 md:min-h-9 md:min-w-9"
+      className="min-h-11 min-w-11"
```

### src/components/TicketPriorityPanel.tsx (2 lines changed)
```diff
-          <p className="text-sm font-medium">Priority — {priorityMeta(priority).short}</p>
+          <p className="text-sm font-medium">Priority: {priorityMeta(priority).short}</p>
-                ? `Calculated as ${calculated.toUpperCase()} and changed by a supervisor.`
+                ? `Calculated as ${priorityMeta(calculated).short} and changed by a supervisor.`
```

### src/components/VendorDispatchPanel.tsx (4 lines changed)
```diff
-  dispatched: "Sent — waiting on the vendor",
+  dispatched: "Sent: waiting on the vendor",
-          required steps — no separate text thread to chase.
+          required steps. No separate text thread to chase.
-                Best fit first — distance, scorecard and current load
+                Best fit first: distance, scorecard and current load
-              placeholder="What you need done, what good looks like, and anything not to do — e.g. do not leave the wall open, seal and paint before you leave."
+              placeholder="What you need done, what good looks like, and anything not to do, e.g. do not leave the wall open, seal and paint before you leave."
```

### src/components/VendorDocumentsPanel.tsx (3 lines changed)
```diff
-              placeholder="Title — e.g. Pelican Pools 2026 service agreement"
+              placeholder="Title: e.g. Pelican Pools 2026 service agreement"
-              and never the image — no licence scans, no ID numbers.
+              and never the image. No licence scans, no ID numbers.
-                  That ID is already expired — ask for current identification before recording the
+                  That ID is already expired. Ask for current identification before recording the
```

### src/components/VendorImportPanel.tsx (4 lines changed)
```diff
-            One vendor per line: name, role, email, phone, departments, groups — tab or comma
+            One vendor per line: name, role, email, phone, departments, groups. Tab or comma
-            and read by column name — Breezeway brings across departments, groups and export notes;
+            and read by column name. Breezeway brings across departments, groups and export notes;
-                toast.success("File loaded — review the row count, then stage it.");
+                toast.success("File loaded: review the row count, then stage it.");
-                      <p>Recorded, still unverified — {r.profile.claims.join("; ")}.</p>
+                      <p>Recorded, still unverified: {r.profile.claims.join("; ")}.</p>
```

### src/components/VendorOrgSheet.tsx (2 lines changed)
```diff
-                {VENDOR_STATUS_LABELS[org.status as VendorStatus]} —{" "}
+                {VENDOR_STATUS_LABELS[org.status as VendorStatus]} · {" "}
-                          ? `${e.from_status} → ${e.to_status}`
+                          ? `${e.from_status} to ${e.to_status}`
```

### src/components/VendorRatingPanel.tsx (4 lines changed)
```diff
-    help: "Finished the whole job — no holes left open, no follow-up needed.",
+    help: "Finished the whole job. No holes left open, no follow-up needed.",
-      toast.success("Scored — it's on the vendor's private scorecard.");
+      toast.success("Scored: it's on the vendor's private scorecard.");
-          Scores are private to the vendor — they see their own points and an anonymous ranking,
+          Scores are private to the vendor. They see their own points and an anonymous ranking,
-          placeholder="What they did well, or what to coach next time — e.g. sealed and painted without being asked."
+          placeholder="What they did well, or what to coach next time, e.g. sealed and painted without being asked."
```

### src/components/VendorScoreboardPanel.tsx (2 lines changed)
```diff
-          Internal view. Vendors only ever see their own points and an anonymous percentile — no
+          Internal view. Vendors only ever see their own points and an anonymous percentile. No
-                {v.averageOverall !== null ? `${v.averageOverall.toFixed(1)}/5` : "—"} avg
+                {v.averageOverall !== null ? `${v.averageOverall.toFixed(1)}/5` : "-"} avg
```

### src/components/VendorTerritoryPanel.tsx (4 lines changed)
```diff
-        `${res.added} ZIP${res.added === 1 ? "" : "s"} added — ${res.homes} home${res.homes === 1 ? "" : "s"} covered.` +
+        `${res.added} ZIP${res.added === 1 ? "" : "s"} added: ${res.homes} home${res.homes === 1 ? "" : "s"} covered.` +
-                    {territoryLabel ? ` — ${territoryLabel}` : ""}
+                    {territoryLabel ? ` · ${territoryLabel}` : ""}
-              placeholder="Territory name (optional) — e.g. OKC metro north"
+              placeholder="Territory name (optional): e.g. OKC metro north"
-              placeholder="Paste ZIP codes — 73003, 73012 73013… commas, spaces or one per line all work."
+              placeholder="Paste ZIP codes: 73003, 73012 73013… commas, spaces or one per line all work."
```

### src/components/VisitCheckInCard.tsx (3 lines changed)
```diff
-      if (!fix) toast.warning("Couldn't read your location — checking you in without it.");
+      if (!fix) toast.warning("Couldn't read your location. Checking you in without it.");
-          ? "Checked in at the home — thank you."
+          ? "Checked in at the home. Thank you."
-            <LogIn className="size-4" /> I'm on site — check in
+            <LogIn className="size-4" /> I'm on site. Check in
```

### src/components/VisitLogPanel.tsx (1 lines changed)
```diff
-                    ? ` → ${usTime(v.checked_out_at)} · ${formatOnSite(v.minutes_on_site)} on site`
+                    ? ` to ${usTime(v.checked_out_at)} · ${formatOnSite(v.minutes_on_site)} on site`
```

### src/components/WelcomeDialog.tsx (1 lines changed)
```diff
-          Skip for now — I'll find it under Help
+          Skip for now: I'll find it under Help
```

### src/components/approvals/ApprovalDetail.tsx (3 lines changed)
```diff
-          <PeekRow label="Home" value={q.data?.propertyName ?? "—"} />
+          <PeekRow label="Home" value={q.data?.propertyName ?? "Not set"} />
-          <PeekRow label="Requested by" value={q.data?.requestedBy ?? "—"} />
+          <PeekRow label="Requested by" value={q.data?.requestedBy ?? "Not set"} />
-                ? `Open ticket #${q.data.ticket.ref} — ${q.data.ticket.title}`
+                ? `Open ticket #${q.data.ticket.ref} · ${q.data.ticket.title}`
```

### src/components/claims/ClaimDrawer.tsx (5 lines changed)
```diff
-        placeholder="—"
+        placeholder="Not set"
-              ? ` · stay ${formatDate(claim.stay_arrival)}–${formatDate(claim.stay_departure)}`
+              ? ` · stay ${formatDate(claim.stay_arrival)} to ${formatDate(claim.stay_departure)}`
-                  From the platform notice — Resolve never guesses it.
+                  From the platform notice: Resolve never guesses it.
-                  placeholder="Why — in their words where possible"
+                  placeholder="Why: in their words where possible"
-                placeholder="Add a note — what you said, who you spoke to, what they promised"
+                placeholder="Add a note: what you said, who you spoke to, what they promised"
```

### src/components/claims/ClaimWorkflowPanel.tsx (9 lines changed)
```diff
-          No files yet — upload the screenshot or email on the ticket or home first.
+          No files yet: upload the screenshot or email on the ticket or home first.
-          Guest {claim.guest_name ?? "—"} · the deposit payer is recorded separately, never assumed.
+          Guest {claim.guest_name ?? "Not set"} · the deposit payer is recorded separately, never assumed.
-          Resolve never releases deposits, charges guests or issues refunds — record those as a pending Finance decision.
+          Resolve never releases deposits, charges guests or issues refunds. Record those as a pending Finance decision.
-          Approval only stops the recovery effort. It never assigns the cost to the owner or ARHA — Finance records the treatment.
+          Approval only stops the recovery effort. It never assigns the cost to the owner or ARHA. Finance records the treatment.
-                {w.status === "approved" ? "Waiver approved — Finance treatment pending" : w.status}
+                {w.status === "approved" ? "Waiver approved: Finance treatment pending" : w.status}
-              {w.reason} — {displayName(people.find((p) => p.id === w.requested_by))}
+              {w.reason} · {displayName(people.find((p) => p.id === w.requested_by))}
-              <p className="mt-1 font-medium text-destructive">Routing exception — {w.routing_note}</p>
+              <p className="mt-1 font-medium text-destructive">Routing exception: {w.routing_note}</p>
-            {claim.finance_treatment} — {claim.finance_treatment_note} · {formatDate(claim.finance_treated_at)}
+            {claim.finance_treatment} · {claim.finance_treatment_note} · {formatDate(claim.finance_treated_at)}
-            {treatmentPending ? "Pending — Finance has not recorded how the unrecovered amount is treated." : "Nothing unrecovered."}
+            {treatmentPending ? "Pending: Finance has not recorded how the unrecovered amount is treated." : "Nothing unrecovered."}
```

### src/components/claims/TicketClaimPanel.tsx (3 lines changed)
```diff
-        body: `Claim opened from ticket — recovering from ${RECOVERY_SOURCE[type]}`,
+        body: `Claim opened from ticket. Recovering from ${RECOVERY_SOURCE[type]}`,
-                Category: {categoryLabel(normalizeCategory(ticket.category) ?? "claims")} — carried
+                Category: {categoryLabel(normalizeCategory(ticket.category) ?? "claims")}. Carried
-                Only if the platform states one — Resolve never invents a deadline.
+                Only if the platform states one. Resolve never invents a deadline.
```

### src/components/cleaner-hours/Safeguard.tsx (3 lines changed)
```diff
-        {ev.inversion ? <span className="text-xs font-medium text-danger">Hours inversion — Attributed Cleaner Time is at or above owner hours</span> : null}
+        {ev.inversion ? <span className="text-xs font-medium text-danger">Hours inversion: Attributed Cleaner Time is at or above owner hours</span> : null}
-        <div><dt className="text-xs text-muted-foreground">Owner participation buffer</dt><dd className="font-medium">{ev.owner_zero ? "—" : hours(ev.buffer_hours)}</dd></div>
+        <div><dt className="text-xs text-muted-foreground">Owner participation buffer</dt><dd className="font-medium">{ev.owner_zero ? "-" : hours(ev.buffer_hours)}</dd></div>
-          <DialogTitle>{kind === "emergency" ? "Emergency override — one clean only" : "Leadership override — one clean only"}</DialogTitle>
+          <DialogTitle>{kind === "emergency" ? "Emergency override: one clean only" : "Leadership override: one clean only"}</DialogTitle>
```

### src/components/databases/DatabaseParts.tsx (1 lines changed)
```diff
-      ← Back to Databases
+      Back to Databases
```

### src/components/departure/DepartureMatchingPanel.tsx (8 lines changed)
```diff
-          {run.isPending ? "Checking…" : "Preview matching — last 30 days (no changes)"}
+          {run.isPending ? "Checking…" : "Preview matching: last 30 days (no changes)"}
-              <p className="font-medium">{formatPropertyLabel(m.properties).primary} · {m.breezeway_work_orders?.name} · {m.breezeway_work_orders?.scheduled_date ? usDate(m.breezeway_work_orders.scheduled_date) : "—"}</p>
+              <p className="font-medium">{formatPropertyLabel(m.properties).primary} · {m.breezeway_work_orders?.name} · {m.breezeway_work_orders?.scheduled_date ? usDate(m.breezeway_work_orders.scheduled_date) : "Not set"}</p>
-                    Link {c.guest ?? "guest"} · {c.arrival ? usDate(c.arrival) : "?"}–{c.departure ? usDate(c.departure) : "?"}
+                    Link {c.guest ?? "guest"} · {c.arrival ? usDate(c.arrival) : "?"} to {c.departure ? usDate(c.departure) : "?"}
-          <p className="text-muted-foreground">Dry run {usDate(r.window.from)}–{usDate(r.window.to)}. Nothing was saved and no Departure Reviews or Tickets were created.</p>
+          <p className="text-muted-foreground">Dry run {usDate(r.window.from)} to {usDate(r.window.to)}. Nothing was saved and no Departure Reviews or Tickets were created.</p>
-              {r.labels.map((l) => <li key={l.name}>{l.departure ? <Badge>Departure</Badge> : <Badge variant="outline">Other</Badge>} {l.name} — {l.total} ({l.done} finished)</li>)}
+              {r.labels.map((l) => <li key={l.name}>{l.departure ? <Badge>Departure</Badge> : <Badge variant="outline">Other</Badge>} {l.name} · {l.total} ({l.done} finished)</li>)}
-                    <td>{x.clean_date ? usDate(x.clean_date) : "—"}</td>
-                    <td>{x.guest ?? "—"}{x.code ? ` · ${x.code}` : ""}</td>
-                    <td>{x.checkout_date ? usDate(x.checkout_date) : "—"}</td>
+                    <td>{x.clean_date ? usDate(x.clean_date) : "Not set"}</td>
+                    <td>{x.guest ?? "-"}{x.code ? ` · ${x.code}` : ""}</td>
+                    <td>{x.checkout_date ? usDate(x.checkout_date) : "Not set"}</td>
```

### src/components/departure/DepartureReviewPanel.tsx (12 lines changed)
```diff
-        <h3 className="font-semibold">Step {n} — {title}</h3>
+        <h3 className="font-semibold">Step {n} · {title}</h3>
-  iso ? new Date(iso).toLocaleString("en-US", { timeZone: "America/Chicago", dateStyle: "medium", timeStyle: "short" }) : "—";
+  iso ? new Date(iso).toLocaleString("en-US", { timeZone: "America/Chicago", dateStyle: "medium", timeStyle: "short" }) : "Not set";
-      title: `Departure damage — ${cats.join(", ")}`,
+      title: `Departure damage: ${cats.join(", ")}`,
-          <dt className="text-muted-foreground">Reservation guest</dt><dd>{r.guest_name ?? "—"}</dd>
-          <dt className="text-muted-foreground">Stay</dt><dd>{r.stay_arrival ? usDate(r.stay_arrival) : "—"} – {r.stay_departure ? usDate(r.stay_departure) : "—"}</dd>
-          <dt className="text-muted-foreground">Reservation</dt><dd>{r.reservation_code ?? r.ownerrez_booking_id ?? "—"}{orUrl && <> · <a className="underline" href={orUrl} target="_blank" rel="noreferrer">Open in OwnerRez</a></>}</dd>
-          <dt className="text-muted-foreground">Booking source</dt><dd>{r.booking_source ? PLATFORM_LABEL[platform] : "—"}</dd>
+          <dt className="text-muted-foreground">Reservation guest</dt><dd>{r.guest_name ?? "Not set"}</dd>
+          <dt className="text-muted-foreground">Stay</dt><dd>{r.stay_arrival ? usDate(r.stay_arrival) : "Not set"} to {r.stay_departure ? usDate(r.stay_departure) : "Not set"}</dd>
+          <dt className="text-muted-foreground">Reservation</dt><dd>{r.reservation_code ?? r.ownerrez_booking_id ?? "Not set"}{orUrl && <> · <a className="underline" href={orUrl} target="_blank" rel="noreferrer">Open in OwnerRez</a></>}</d
+          <dt className="text-muted-foreground">Booking source</dt><dd>{r.booking_source ? PLATFORM_LABEL[platform] : "Not set"}</dd>
-          <dt className="text-muted-foreground">Claimed by</dt><dd>{r.claimed_by ? (r.claimed_by === userId ? "You" : "A Team B teammate") : "Unclaimed — anyone on Team B can take it"}</dd>
+          <dt className="text-muted-foreground">Claimed by</dt><dd>{r.claimed_by ? (r.claimed_by === userId ? "You" : "A Team B teammate") : "Unclaimed: anyone on Team B can take it"}</dd>
-                <p className="text-xs text-muted-foreground">Add photos/evidence in Notes &amp; files below — they travel with the Claim.</p>
+                <p className="text-xs text-muted-foreground">Add photos/evidence in Notes &amp; files below: they travel with the Claim.</p>
-              <p className="text-sm"><Badge>Guest already reviewed</Badge> An external review for this reservation has arrived — no review request needed.</p>
+              <p className="text-sm"><Badge>Guest already reviewed</Badge> An external review for this reservation has arrived. No review request needed.</p>
-              <p className="text-sm text-muted-foreground">{r.booking_source ? `${PLATFORM_LABEL[platform]} bookings` : "This booking source"} don’t support host reviews — nothing to do.</p>
+              <p className="text-sm text-muted-foreground">{r.booking_source ? `${PLATFORM_LABEL[platform]} bookings` : "This booking source"} don’t support host reviews. Nothing to do.</p>
-            {q.data.docs.length > 0 && <ul className="text-sm">{q.data.docs.map((d) => <li key={d.id}>📎 {d.filename}</li>)}</ul>}
+            {q.data.docs.length > 0 && <ul className="text-sm">{q.data.docs.map((d) => <li key={d.id}>File: {d.filename}</li>)}</ul>}
```

### src/components/departure/DepartureReviewQueue.tsx (2 lines changed)
```diff
-              <span className="text-muted-foreground"> · {r.guest_name ?? "Guest"} · departed {r.stay_departure ? usDate(r.stay_departure) : "—"}</span>
+              <span className="text-muted-foreground"> · {r.guest_name ?? "Guest"} · departed {r.stay_departure ? usDate(r.stay_departure) : "Not set"}</span>
-            <span>{r.guest_name ?? "Guest"} · {r.stay_arrival ? usDate(r.stay_arrival) : "—"}–{r.stay_departure ? usDate(r.stay_departure) : "—"}{r.reservation_code ? ` · ${r.reservation_code}` : ""}</span>
+            <span>{r.guest_name ?? "Guest"} · {r.stay_arrival ? usDate(r.stay_arrival) : "Not set"} to {r.stay_departure ? usDate(r.stay_departure) : "Not set"}{r.reservation_code ? ` · ${r.reservation_code}` : ""}</span>
```

### src/components/feedback/FeedbackShared.tsx (2 lines changed)
```diff
-  return f.stay_start ? `${formatDate(f.stay_start)} – ${formatDate(f.stay_end)}` : `Checked out ${formatDate(f.stay_end)}`;
+  return f.stay_start ? `${formatDate(f.stay_start)} to ${formatDate(f.stay_end)}` : `Checked out ${formatDate(f.stay_end)}`;
-      {row("OK to contact them", a.follow_up_ok ? "Yes" : <Badge variant="outline">No — do not contact</Badge>)}
+      {row("OK to contact them", a.follow_up_ok ? "Yes" : <Badge variant="outline">No: do not contact</Badge>)}
```

### src/components/feedback/GuestFeedbackFollowUpPanel.tsx (1 lines changed)
```diff
-            <Label>1–2. Contact the prior guest, then record the outcome</Label>
+            <Label>1 to 2. Contact the prior guest, then record the outcome</Label>
```

### src/components/feedback/PropertyFeedbackTab.tsx (16 lines changed)
```diff
-                      <dd>{open.reservation_guest_name ? `Reservation guest: ${open.reservation_guest_name}` : "—"}</dd>
+                      <dd>{open.reservation_guest_name ? `Reservation guest: ${open.reservation_guest_name}` : "Not set"}</dd>
-                      <dd>{open.reservation_confirmation ?? open.ownerrez_booking_id ?? "—"}</dd>
+                      <dd>{open.reservation_confirmation ?? open.ownerrez_booking_id ?? "Not set"}</dd>
-                      <dd>{open.booking_platform ?? "—"}</dd>
+                      <dd>{open.booking_platform ?? "Not set"}</dd>
-                <p className="text-sm text-muted-foreground">{open.rating === 5 ? "No follow-up work — 5-star feedback is kept for history only." : "No follow-up Ticket — this review is kept for history only."}</p>
+                <p className="text-sm text-muted-foreground">{open.rating === 5 ? "No follow-up work: 5-star feedback is kept for history only." : "No follow-up Ticket: this review is kept for history only."}</p>
-  no_follow_up: "New review — no follow-up",
-  follow_up: "New review — follow-up Ticket will be created",
-  duplicate: "Already imported — skipped",
-  unmatched_property: "No matching home — skipped",
+  no_follow_up: "New review: no follow-up",
+  follow_up: "New review: follow-up Ticket will be created",
+  duplicate: "Already imported: skipped",
+  unmatched_property: "No matching home: skipped",
-          <span>{start ?? "Not set — every imported review is history only"}</span>
+          <span>{start ?? "Not set: every imported review is history only"}</span>
-                toast.success(`${r.imported} imported, ${r.ticketsCreated} follow-up created${r.historical ? " (historical — before the follow-up start date)" : ""}`);
+                toast.success(`${r.imported} imported, ${r.ticketsCreated} follow-up created${r.historical ? " (historical: before the follow-up start date)" : ""}`);
-                Add {stars}★ test review
+                Add {stars} star test review
-            <p className="font-medium">Preview only — nothing saved, no Tickets created. {result.available} reviews from the last 60 days.</p>
+            <p className="font-medium">Preview only: nothing saved, no Tickets created. {result.available} reviews from the last 60 days.</p>
-                      <td className="py-1">{r.date ? r.date.slice(0, 10) : "—"}</td>
-                      <td>{r.property_name ?? "—"}</td>
-                      <td>{r.rating ?? "—"}</td>
-                      <td>{r.platform ?? "—"}</td>
+                      <td className="py-1">{r.date ? r.date.slice(0, 10) : "Not set"}</td>
+                      <td>{r.property_name ?? "Not set"}</td>
+                      <td>{r.rating ?? "Not set"}</td>
+                      <td>{r.platform ?? "Not set"}</td>
```

### src/components/finance/ExpenseList.tsx (5 lines changed)
```diff
-      {reservationBlocks(e.reservation_link_state, e.ownerrez_booking_id) && <Badge variant="destructive">Reservation required — unresolved</Badge>}
+      {reservationBlocks(e.reservation_link_state, e.ownerrez_booking_id) && <Badge variant="destructive">Reservation required: unresolved</Badge>}
-      {e.is_estimate && <Badge variant="outline">Estimate — not an invoice</Badge>}
-      {e.duplicate_flag === "suspected" && <Badge variant="destructive">Possible duplicate — review</Badge>}
-      {purchaseNeedsLeadership({ expense_type: e.expense_type, purchase_auth_status: e.purchase_auth_status ?? null, leadership_decision: e.leadership_decision ?? null }) && <Badge variant="destructive">Purchase authorization — leadership 
+      {e.is_estimate && <Badge variant="outline">Estimate: not an invoice</Badge>}
+      {e.duplicate_flag === "suspected" && <Badge variant="destructive">Possible duplicate: review</Badge>}
+      {purchaseNeedsLeadership({ expense_type: e.expense_type, purchase_auth_status: e.purchase_auth_status ?? null, leadership_decision: e.leadership_decision ?? null }) && <Badge variant="destructive">Purchase authorization: leadership d
-                Expense date {e.expense_date ? usDate(e.expense_date) : "—"} · Received {usDate(e.received_on)} · Responsibility {RESPONSIBILITY_LABEL[e.cost_responsibility]}
+                Expense date {e.expense_date ? usDate(e.expense_date) : "Not set"} · Received {usDate(e.received_on)} · Responsibility {RESPONSIBILITY_LABEL[e.cost_responsibility]}
```

### src/components/finance/ExpenseSheet.tsx (11 lines changed)
```diff
-  const name = (id: string | null | undefined) => (id ? (data.people.get(id) ?? "Team member") : "—");
+  const name = (id: string | null | undefined) => (id ? (data.people.get(id) ?? "Team member") : "Not set");
-          <p className="font-medium">Archived — read only</p>
+          <p className="font-medium">Archived: read only</p>
-            <div><Label>Outcome of this visit</Label><Textarea rows={2} placeholder="e.g. Diagnosed — repair still pending" value={txt("visit_outcome")} onChange={(x) => set("visit_outcome", x.target.value)} /></div>
+            <div><Label>Outcome of this visit</Label><Textarea rows={2} placeholder="e.g. Diagnosed: repair still pending" value={txt("visit_outcome")} onChange={(x) => set("visit_outcome", x.target.value)} /></div>
-            <Label htmlFor="expense-change-reason">Reason for change (required — this expense was Finance reviewed)</Label>
+            <Label htmlFor="expense-change-reason">Reason for change (required. This expense was Finance reviewed)</Label>
-          <p className="text-xs text-muted-foreground">Recorded only — Resolve sends nothing from here.</p>
+          <p className="text-xs text-muted-foreground">Recorded only: Resolve sends nothing from here.</p>
-    .map((k) => (k in b ? `${k}: ${JSON.stringify(b[k])} → ${JSON.stringify(a[k])}` : `${k}: ${JSON.stringify(a[k])}`))
+    .map((k) => (k in b ? `${k}: ${JSON.stringify(b[k])} to ${JSON.stringify(a[k])}` : `${k}: ${JSON.stringify(a[k])}`))
-        <p className="text-muted-foreground">Unmatched — no linked Ticket, Work Order, Claim or Property Activity yet.</p>
+        <p className="text-muted-foreground">Unmatched: no linked Ticket, Work Order, Claim or Property Activity yet.</p>
-      <p className="text-xs text-muted-foreground">QuickBooks reference: {e.qb_reference_manual || "none"} — {QB_REFERENCE_NOTE}</p>
+      <p className="text-xs text-muted-foreground">QuickBooks reference: {e.qb_reference_manual || "none"} · {QB_REFERENCE_NOTE}</p>
-                Allocated {money(split.reduce((s, l) => s + (l.amount || 0), 0))} of {money(e.amount)} {splitOk ? "— reconciles" : "— must equal the expense total"}
+                Allocated {money(split.reduce((s, l) => s + (l.amount || 0), 0))} of {money(e.amount)} {splitOk ? "· reconciles" : "· must equal the expense total"}
-          {reservationBlocks(e.reservation_link_state, e.ownerrez_booking_id) && <p className="text-xs text-destructive">A reservation is required but not yet established — resolve it before Finance review.</p>}
+          {reservationBlocks(e.reservation_link_state, e.ownerrez_booking_id) && <p className="text-xs text-destructive">A reservation is required but not yet established. Resolve it before Finance review.</p>}
-            <p><strong>Decision:</strong> {e.leadership_decision} — {name(e.leadership_decided_by)}, {e.leadership_decided_at ? new Date(e.leadership_decided_at).toLocaleString("en-US", { timeZone: "America/Chicago" }) : ""}</p>
+            <p><strong>Decision:</strong> {e.leadership_decision} · {name(e.leadership_decided_by)}, {e.leadership_decided_at ? new Date(e.leadership_decided_at).toLocaleString("en-US", { timeZone: "America/Chicago" }) : ""}</p>
```

### src/components/finance/StatementReadiness.tsx (8 lines changed)
```diff
-        Finance decides the statement period. This tracks expense review only — not reservation revenue, management fees, taxes, payouts or the full owner statement — and posts nothing to OwnerRez or QuickBooks.
+        Finance decides the statement period. This tracks expense review only, not reservation revenue, management fees, taxes, payouts or the full owner statement, and posts nothing to OwnerRez or QuickBooks.
-                <p key={d.id}>Expense deferred to {monthLabel(d.defer_to_period!)} on {fmt(d.decided_at)} — counted only in the later period.</p>
+                <p key={d.id}>Expense deferred to {monthLabel(d.defer_to_period!)} on {fmt(d.decided_at)}. Counted only in the later period.</p>
-    onSuccess: () => { toast.success("Disposition recorded — not posted to OwnerRez"); onDone(); },
+    onSuccess: () => { toast.success("Disposition recorded: not posted to OwnerRez"); onDone(); },
-        {raw.finance_treatment_note ? ` — ${raw.finance_treatment_note}` : ""} · Owner notified {raw.owner_notified_at ? fmt(raw.owner_notified_at) : "not recorded"}
+        {raw.finance_treatment_note ? ` · ${raw.finance_treatment_note}` : ""} · Owner notified {raw.owner_notified_at ? fmt(raw.owner_notified_at) : "not recorded"}
-        {raw.qb_reference_manual ? ` · QuickBooks ref ${raw.qb_reference_manual} (manual — ${QB_REFERENCE_NOTE})` : ""}
+        {raw.qb_reference_manual ? ` · QuickBooks ref ${raw.qb_reference_manual} (manual: ${QB_REFERENCE_NOTE})` : ""}
-        <p key={c.id} className="text-xs">Open claim: <Link to="/claims" className="underline">{c.title ?? "Claim"}</Link> — may affect treatment; does not block a documented expense.</p>
+        <p key={c.id} className="text-xs">Open claim: <Link to="/claims" className="underline">{c.title ?? "Claim"}</Link>. May affect treatment; does not block a documented expense.</p>
-            <p className="text-xs text-destructive sm:col-span-2" role="status">Include is unavailable: documentation is incomplete — missing {docMissing.join(", ")}. Hold it until Operations supplies the missing facts.</p>
+            <p className="text-xs text-destructive sm:col-span-2" role="status">Include is unavailable. Documentation is incomplete, missing {docMissing.join(", ")}. Hold it until Operations supplies the missing facts.</p>
-          <Input aria-label="Source reference" placeholder="Source records reviewed (manual reference — not verified by Resolve)" value={src} onChange={(e) => setSrc(e.target.value)} />
+          <Input aria-label="Source reference" placeholder="Source records reviewed (manual reference, not verified by Resolve)" value={src} onChange={(e) => setSrc(e.target.value)} />
```

### src/components/finance/UnsettledClaims.tsx (1 lines changed)
```diff
-                  {c.stage === "closed" ? <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs">Closed — not settled</span> : null}
+                  {c.stage === "closed" ? <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs">Closed: not settled</span> : null}
```

### src/components/leads/LeadDrawer.tsx (16 lines changed)
```diff
-      toast.success(decision === "accepted" ? "Booked — this lead is now Booked on that home." : "Offer marked declined.");
+      toast.success(decision === "accepted" ? "Booked: this lead is now Booked on that home." : "Offer marked declined.");
-              : `Contact logged — stage moved to ${STAGE_LABELS[proposed]}.`,
+              : `Contact logged: stage moved to ${STAGE_LABELS[proposed]}.`,
-          outcome: `Closed as lost — ${LOSS_REASON_LABELS[reason]}`,
+          outcome: `Closed as lost: ${LOSS_REASON_LABELS[reason]}`,
-            {leadRegion(lead) !== "—" ? <Chip>{leadRegion(lead)}</Chip> : null}
+            {leadRegion(lead) !== "Not set" ? <Chip>{leadRegion(lead)}</Chip> : null}
-                : "No follow-up clock — this opportunity is closed."}
+                : "No follow-up clock: this opportunity is closed."}
-                  ["Organization / source", lead.company ?? "—"],
+                  ["Organization / source", lead.company ?? "Not set"],
-                  ["Phone", lead.phone ?? "—"],
-                  ["Email", lead.email ?? "—"],
+                  ["Phone", lead.phone ?? "Not set"],
+                  ["Email", lead.email ?? "Not set"],
-                  ["Next follow-up", leadFollowUpDate(lead) ?? (derived.due ? formatDate(derived.due.toISOString()) : "—")],
+                  ["Next follow-up", leadFollowUpDate(lead) ?? (derived.due ? formatDate(derived.due.toISOString()) : "-")],
-                v || "—",
+                v || "Not set",
-                placeholder="Outcome — e.g. first outreach sent, left voicemail"
+                placeholder="Outcome: e.g. first outreach sent, left voicemail"
-                              Accepted — book this home
+                              Accepted: book this home
-                  {a.outcome ? ` — ${a.outcome}` : ""}
-                  {a.to_stage ? ` → ${STAGE_LABELS[a.to_stage as LeadStage]}` : ""}
+                  {a.outcome ? ` · ${a.outcome}` : ""}
+                  {a.to_stage ? ` to ${STAGE_LABELS[a.to_stage as LeadStage]}` : ""}
-                      reason — Resolve will not close a legitimate opportunity for you.
+                      reason. Resolve will not close a legitimate opportunity for you.
-                          { onSuccess: () => toast.success("Kept open — follow-up clock reset.") },
+                          { onSuccess: () => toast.success("Kept open: follow-up clock reset.") },
```

### src/components/nav/NavContext.tsx (2 lines changed)
```diff
-        "inline-flex min-h-11 items-center gap-1.5 rounded-md pr-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground md:min-h-9",
+        "inline-flex min-h-11 items-center gap-1.5 rounded-md pr-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground",
-      <Button size="sm" variant="ghost" disabled aria-label={`${label} — none`}>
+      <Button size="sm" variant="ghost" disabled aria-label={`${label} · none`}>
```

### src/components/onboarding/AssessmentFindingsPanel.tsx (1 lines changed)
```diff
-          ? "That finding is already recorded — its correction task stays as it is."
+          ? "That finding is already recorded. Its correction task stays as it is."
```

### src/components/onboarding/AssessmentsFormsPanel.tsx (2 lines changed)
```diff
-          Each form lives on its workflow Task. Opening one shows that Task — its files and history.
+          Each form lives on its workflow Task. Opening one shows that Task. Its files and history.
-                    No link to the external form is stored in Resolve — files attached to the Task show inside it.
+                    No link to the external form is stored in Resolve. Files attached to the Task show inside it.
```

### src/components/onboarding/BudgetPanel.tsx (2 lines changed)
```diff
-                  ? "—"
+                  ? "Not set"
-                  {h.field}: {h.old_value ?? "—"} → {h.new_value ?? "—"}
+                  {h.field}: {h.old_value ?? "Not set"} to {h.new_value ?? "Not set"}
```

### src/components/onboarding/DeliveryReconciliationPanel.tsx (1 lines changed)
```diff
-                          : "Verified not delivered — allow retry"}
+                          : "Verified not delivered: allow retry"}
```

### src/components/onboarding/ExternalRecordsPanel.tsx (1 lines changed)
```diff
-            exact database IDs are verified — Resolve never writes back to a source system.
+            exact database IDs are verified. Resolve never writes back to a source system.
```

### src/components/onboarding/FinancialPanel.tsx (3 lines changed)
```diff
-  n == null ? "—" : `$${Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
+  n == null ? "-" : `$${Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
-                    Emergency — mitigate now under a documented exception
+                    Emergency: mitigate now under a documented exception
-                    {AUTHORITY_TIER_LABELS[tier]} — {money(amount)}
+                    {AUTHORITY_TIER_LABELS[tier]} · {money(amount)}
```

### src/components/onboarding/HandoffGatePanel.tsx (4 lines changed)
```diff
-        <CardTitle className="text-base">Handoff gate — {propertyName}</CardTitle>
+        <CardTitle className="text-base">Handoff gate: {propertyName}</CardTitle>
-            ? " Carryover work was accepted — it belongs to Operations from handoff onward, assigned by the Director of Operations."
+            ? " Carryover work was accepted. It belongs to Operations from handoff onward, assigned by the Director of Operations."
-                {h.note ? ` — ${h.note}` : ""}
+                {h.note ? ` · ${h.note}` : ""}
-            placeholder="Authorised exception — only if a required readiness item is being waived"
+            placeholder="Authorised exception: only if a required readiness item is being waived"
```

### src/components/onboarding/OnboardingAccountsPanel.tsx (2 lines changed)
```diff
-        r.setupEmail === "failed" ? "Account created. The set-password email could not be sent — they can use Forgot password." :
+        r.setupEmail === "failed" ? "Account created. The set-password email could not be sent. They can use Forgot password." :
-          `Sign-in turned off. ${r.openTasks} open Task(s) and ${r.projectAssignments} Project Team spot(s) still name them — reassign them on each home.`,
+          `Sign-in turned off. ${r.openTasks} open Task(s) and ${r.projectAssignments} Project Team spot(s) still name them. Reassign them on each home.`,
```

### src/components/onboarding/OperationsContextPanel.tsx (1 lines changed)
```diff
-                {t.title} → ticket {String(t.linked_ticket_id).slice(0, 8)}
+                {t.title}: ticket {String(t.linked_ticket_id).slice(0, 8)}
```

### src/components/onboarding/OwnerCollaboration.tsx (5 lines changed)
```diff
-  if (o.status === "draft") return "Draft — not visible to the homeowner";
+  if (o.status === "draft") return "Draft: not visible to the homeowner";
-        <div><dt>Sent</dt><dd className="text-foreground">{when(o.sent_at) ?? (o.status === "draft" ? "Not sent" : "—")}</dd></div>
+        <div><dt>Sent</dt><dd className="text-foreground">{when(o.sent_at) ?? (o.status === "draft" ? "Not sent" : "Not set")}</dd></div>
-            ? "Owner approval on this Task: approved — the Task can proceed."
+            ? "Owner approval on this Task: approved. The Task can proceed."
-              <p className="text-xs text-muted-foreground">Or add a link — for large videos kept in your approved file-sharing location. Resolve links to it; it never copies it.</p>
+              <p className="text-xs text-muted-foreground">Or add a link, for large videos kept in your approved file-sharing location. Resolve links to it; it never copies it.</p>
-      <p className="text-xs text-muted-foreground">What you ask the homeowner to review, provide or decide. This Task&apos;s status stays yours — the homeowner&apos;s response never blocks it.</p>
+      <p className="text-xs text-muted-foreground">What you ask the homeowner to review, provide or decide. This Task&apos;s status stays yours. The homeowner&apos;s response never blocks it.</p>
```

### src/components/onboarding/OwnerCompletionsReview.tsx (4 lines changed)
```diff
-            {" · "}{r.owner_name} completed {r.completed_at ? usDate(r.completed_at) : "—"}
+            {" · "}{r.owner_name} completed {r.completed_at ? usDate(r.completed_at) : "Not set"}
-            Responsible: {r.assignment_exception ? <span className="text-destructive">No Primary PM — Onboarding Director to assign</span> : r.responsible_name ?? "—"}
+            Responsible: {r.assignment_exception ? <span className="text-destructive">No Primary PM: Onboarding Director to assign</span> : r.responsible_name ?? "Not set"}
-            <Label htmlFor={`note-${r.work_item_id}`}>Internal note (staff only — never shown to the owner)</Label>
+            <Label htmlFor={`note-${r.work_item_id}`}>Internal note (staff only, never shown to the owner)</Label>
-            <Label htmlFor={`fb-${r.work_item_id}`}>Feedback to the owner (optional — the owner will see this)</Label>
+            <Label htmlFor={`fb-${r.work_item_id}`}>Feedback to the owner (optional. The owner will see this)</Label>
```

### src/components/onboarding/OwnerViewPreview.tsx (2 lines changed)
```diff
-              <p className="eyebrow">Draft — proposed for sharing</p>
+              <p className="eyebrow">Draft: proposed for sharing</p>
-              <p className="eyebrow">Internal only — never shown</p>
+              <p className="eyebrow">Internal only: never shown</p>
```

### src/components/onboarding/ProjectHistory.tsx (5 lines changed)
```diff
-          (e.prior_value || e.new_value ? `${e.prior_value ?? "—"} → ${e.new_value ?? "—"}` : null),
+          (e.prior_value || e.new_value ? `${e.prior_value ?? "Not set"} to ${e.new_value ?? "Not set"}` : null),
-        summary: `Owner approval requested — ${a.title}`,
+        summary: `Owner approval requested: ${a.title}`,
-          summary: `Homeowner ${a.status === "approved" ? "approved" : "requested changes"} — ${a.title}`,
+          summary: `Homeowner ${a.status === "approved" ? "approved" : "requested changes"} · ${a.title}`,
-        summary: `Handoff review — ${r.decision.replace(/_/g, " ")}`,
+        summary: `Handoff review: ${r.decision.replace(/_/g, " ")}`,
-          Every lifecycle event on this project, newest first. History is a record — it cannot be
+          Every lifecycle event on this project, newest first. History is a record. It cannot be
```

### src/components/onboarding/ProjectScopePanel.tsx (8 lines changed)
```diff
-            <Fact label="Branch" value={project.branch ?? "—"} />
-            <Fact label="Closing" value={project.planned_closing_on ?? "—"} />
-            <Fact label="Possession" value={project.possession_on ?? "—"} />
-            <Fact label="Target handoff" value={project.target_handoff_on ?? "—"} />
+            <Fact label="Branch" value={project.branch ?? "Not set"} />
+            <Fact label="Closing" value={project.planned_closing_on ?? "Not set"} />
+            <Fact label="Possession" value={project.possession_on ?? "Not set"} />
+            <Fact label="Target handoff" value={project.target_handoff_on ?? "Not set"} />
-                  <span className="numeric">{e.created_at.slice(0, 10)}</span> — {e.summary}
+                  <span className="numeric">{e.created_at.slice(0, 10)}</span> · {e.summary}
-                      {e.prior_value ?? "—"} → {e.new_value ?? "—"}
+                      {e.prior_value ?? "Not set"} to {e.new_value ?? "Not set"}
-            {editing ? "Edit project scope" : `Start onboarding — ${propertyName}`}
+            {editing ? "Edit project scope" : `Start onboarding: ${propertyName}`}
-                ? "Choosing a plan adds any of its steps this home is missing. \u201cNew and existing\u201d also refreshes the steps already here — wording, tags, rules and dates — leaving finished work and dates you set by hand alone."
+                ? "Choosing a plan adds any of its steps this home is missing. \u201cNew and existing\u201d also refreshes the steps already here. Wording, tags, rules and dates. Leaving finished work and dates you set by hand alone."
```

### src/components/onboarding/ProjectTeamPanel.tsx (2 lines changed)
```diff
-          External companies working on this home. For reference only — they aren't Resolve users and don't receive Tasks or notifications.
+          External companies working on this home. For reference only: they aren't Resolve users and don't receive Tasks or notifications.
-            placeholder={canEdit ? "Type the provider or team, e.g. name — company" : "Not set"}
+            placeholder={canEdit ? "Type the provider or team, e.g. name: company" : "Not set"}
```

### src/components/onboarding/PropertyFactsPanel.tsx (1 lines changed)
```diff
-                      ? `${data.assets.find((asset) => asset.id === f.asset_id)?.name ?? "Equipment"} — `
+                      ? `${data.assets.find((asset) => asset.id === f.asset_id)?.name ?? "Equipment"} · `
```

### src/components/onboarding/SendToHomeownerDialog.tsx (5 lines changed)
```diff
-          ? "Sent — the homeowner received a Resolve email."
+          ? "Sent: the homeowner received a Resolve email."
-            ? "Sent — your instructions are in the homeowner's portal and they can respond."
-            : "Sent — it is in the homeowner's portal, but your instructions still need publishing.",
+            ? "Sent: your instructions are in the homeowner's portal and they can respond."
+            : "Sent: it is in the homeowner's portal, but your instructions still need publishing.",
-              A request is already waiting with the homeowner. Sending again records a fresh request
-              — the earlier one stays in history.
+              A request is already waiting with the homeowner. Sending again records a fresh request. The earlier one stays in history.
-              placeholder="Write it the way you would say it — what you would like them to look at, and what you need back."
+              placeholder="Write it the way you would say it. What you would like them to look at, and what you need back."
```

### src/components/onboarding/StageProgressPanel.tsx (1 lines changed)
```diff
-                      {t.blocker?.trim() ? ` — ${t.blocker.trim()}` : ""}
+                      {t.blocker?.trim() ? ` · ${t.blocker.trim()}` : ""}
```

### src/components/onboarding/TaskDrawer.tsx (11 lines changed)
```diff
-          ? `Step recorded — next: ${nextTask.title}`
+          ? `Step recorded. Next: ${nextTask.title}`
-              This step is tagged Active Owner — the homeowner does it. Sending puts it in their
+              This step is tagged Active Owner. The homeowner does it. Sending puts it in their
-            value={task.due_on ?? "—"}
+            value={task.due_on ?? "Not set"}
-                  {" "}
-                  — {d.status === "complete" ? "complete" : "not complete"}
+                  {" "} · {d.status === "complete" ? "complete" : "not complete"}
-                {s.status === "complete" ? "✓" : "·"} {s.title}
+                {s.status === "complete" ? "Done: " : ""}{s.title}
-            placeholder="What proves this is done — photo location, document name, meter reading, confirmation number."
+            placeholder="What proves this is done. Photo location, document name, meter reading, confirmation number."
-            Record the observation here, in Resolve — not in a separate form. It stays on this step
+            Record the observation here, in Resolve, not in a separate form. It stays on this step
-                      ? "Request sent — waiting on the homeowner"
+                      ? "Request sent: waiting on the homeowner"
-                    ? "Recorded on the canonical approval record — Active Owner portal or Resolve-generated email."
+                    ? "Recorded on the canonical approval record. Active Owner portal or Resolve-generated email."
-                placeholder="Version being reviewed — e.g. Mood boards v2"
+                placeholder="Version being reviewed: e.g. Mood boards v2"
-                Resolve-generated email — they never need Resolve access to answer. Either way it is
+                Resolve-generated email. They never need Resolve access to answer. Either way it is
```

### src/components/onboarding/TaskOwnerDependency.tsx (1 lines changed)
```diff
-        <span className="text-muted-foreground"> — {meta.blurb}</span>
+        <span className="text-muted-foreground"> · {meta.blurb}</span>
```

### src/components/onboarding/TemplateCsvImport.tsx (2 lines changed)
```diff
-                <li><b>Owner Opportunity = Yes</b> needs an Owner-facing title (what/why/how optional). It is saved as template text only — nothing is sent.</li>
-                <li><b>Ignored:</b> Plan, Assigned person, Status, Due date — completion and home-specific assignments never carry over.</li>
+                <li><b>Owner Opportunity = Yes</b> needs an Owner-facing title (what/why/how optional). It is saved as template text only. Nothing is sent.</li>
+                <li><b>Ignored:</b> Plan, Assigned person, Status, Due date. Completion and home-specific assignments never carry over.</li>
```

### src/components/onboarding/TemplatePanel.tsx (2 lines changed)
```diff
-                <Badge variant="outline">No access date recorded — dates left blank</Badge>
+                <Badge variant="outline">No access date recorded. Dates left blank</Badge>
-                    <span className="shrink-0 text-xs text-muted-foreground">{t.dueOn ?? "—"}</span>
+                    <span className="shrink-0 text-xs text-muted-foreground">{t.dueOn ?? "Not set"}</span>
```

### src/components/onboarding/TemplateV2Settings.tsx (5 lines changed)
```diff
-          <div className="space-y-1"><Label htmlFor="desc">Description <span className="font-normal text-muted-foreground">— what the step is and why it matters</span></Label><Textarea id="desc" rows={3} className="resize-y" value={descrip
-          <div className="space-y-1"><Label htmlFor="det">Instructions <span className="font-normal text-muted-foreground">— how to do it</span></Label><Textarea id="det" rows={6} className="resize-y" value={detail} onChange={(e) => setDet
-          <div className="space-y-1"><Label htmlFor="done">Done when <span className="font-normal text-muted-foreground">— what finished looks like (guidance, not an approval step)</span></Label><Textarea id="done" rows={2} className="resi
+          <div className="space-y-1"><Label htmlFor="desc">Description <span className="font-normal text-muted-foreground">· what the step is and why it matters</span></Label><Textarea id="desc" rows={3} className="resize-y" value={descrip
+          <div className="space-y-1"><Label htmlFor="det">Instructions <span className="font-normal text-muted-foreground">· how to do it</span></Label><Textarea id="det" rows={6} className="resize-y" value={detail} onChange={(e) => setDet
+          <div className="space-y-1"><Label htmlFor="done">Done when <span className="font-normal text-muted-foreground">· what finished looks like (guidance, not an approval step)</span></Label><Textarea id="done" rows={2} className="resi
-              {describeRule(offsetNum === null ? null : anchor, offsetNum, unit)}. Use a negative number for "before". Business days are Monday–Friday; no holidays are skipped. Leave days empty for no rule. A missing anchor date leaves the
+              {describeRule(offsetNum === null ? null : anchor, offsetNum, unit)}. Use a negative number for "before". Business days are Monday to Friday; no holidays are skipped. Leave days empty for no rule. A missing anchor date leaves 
-            <p className="text-xs text-muted-foreground">Files uploaded on these steps appear on this step for the same home. Nothing is copied. Internal only — homeowners and vendors never see them.</p>
+            <p className="text-xs text-muted-foreground">Files uploaded on these steps appear on this step for the same home. Nothing is copied. Internal only: homeowners and vendors never see them.</p>
```

### src/components/onboarding/VendorCoveragePanel.tsx (1 lines changed)
```diff
-            {data.zip ? ` (ZIP ${data.zip})` : ""} — cleared vendors first, with pricing tier and a
+            {data.zip ? ` (ZIP ${data.zip})` : ""}. Cleared vendors first, with pricing tier and a
```

### src/components/onboarding/WelcomeEmailEditor.tsx (4 lines changed)
```diff
-  queued: "Waiting to send", sending: "Sending", sent: "Sent", failed: "Not delivered", held_demo: "Demo — never sent",
+  queued: "Waiting to send", sending: "Sending", sent: "Sent", failed: "Not delivered", held_demo: "Demo: never sent",
-            {template.review === "approved" ? `Approved · version ${template.version}` : `Draft — awaiting review · version ${template.version}`}
+            {template.review === "approved" ? `Approved · version ${template.version}` : `Draft: awaiting review · version ${template.version}`}
-            {video ? (video.kind === "link" ? `Link: ${video.url}` : `Uploaded: ${video.name} (only signed-in homeowners can watch)`) : "No video — the email leaves the video line out."}
+            {video ? (video.kind === "link" ? `Link: ${video.url}` : `Uploaded: ${video.name} (only signed-in homeowners can watch)`) : "No video: the email leaves the video line out."}
-                {r.status === "sending" ? " · sending or result uncertain — do not resend" : ""}
+                {r.status === "sending" ? " · sending or result uncertain. Do not resend" : ""}
```

### src/components/onboarding/WorkflowTable.tsx (1 lines changed)
```diff
-          <span className="text-muted-foreground">—</span>
+          <span className="text-muted-foreground">-</span>
```

### src/components/onboarding/WorkstreamBoard.tsx (2 lines changed)
```diff
-      <Meter percent={group.percent} label={`${group.label} — ${group.percent}% complete`} />
+      <Meter percent={group.percent} label={`${group.label} · ${group.percent}% complete`} />
-            : "Nothing is unblocked right now — each open step is waiting on a date, an approval or another step."
+            : "Nothing is unblocked right now, each open step is waiting on a date, an approval or another step."
```

### src/components/owner/AfterDayNinety.tsx (1 lines changed)
```diff
-          {primaryContact.role} —{" "}
+          {primaryContact.role} · {" "}
```

### src/components/owner/ArhaContacts.tsx (1 lines changed)
```diff
-                    {s.name ? s.seat : "Assigned shortly — use an escalation contact meanwhile"}
+                    {s.name ? s.seat : "Assigned shortly: use an escalation contact meanwhile"}
```

### src/components/owner/LibraryVideoSection.tsx (1 lines changed)
```diff
-      {pct !== null ? <div className="space-y-1"><Progress value={pct} aria-label="Upload progress" /><p className="text-xs text-muted-foreground">Uploading… {pct}% — keep this window open.</p></div> : null}
+      {pct !== null ? <div className="space-y-1"><Progress value={pct} aria-label="Upload progress" /><p className="text-xs text-muted-foreground">Uploading… {pct}%: keep this window open.</p></div> : null}
```

### src/components/owner/MilestonePacing.tsx (1 lines changed)
```diff
-          : "Based on hours the homeowner entered. Pacing guide only — no tax conclusion is implied."}
+          : "Based on hours the homeowner entered. Pacing guide only: no tax conclusion is implied."}
```

### src/components/owner/OnboardingActions.tsx (3 lines changed)
```diff
-          Preview only — decisions can only be recorded by the homeowner.
+          Preview only: decisions can only be recorded by the homeowner.
-          ? "Approved — thank you. Your project manager has been notified."
+          ? "Approved: thank you. Your project manager has been notified."
-                Add it to your participation record now. Enter the time you actually spent — we
+                Add it to your participation record now. Enter the time you actually spent. We
```

### src/components/owner/OversightAlertsPanel.tsx (2 lines changed)
```diff
-                    View only — leadership changes these settings.
+                    View only: leadership changes these settings.
-                  {alert.ownerName} — {alert.title}
+                  {alert.ownerName} · {alert.title}
```

### src/components/owner/OwnerNotificationBell.tsx (2 lines changed)
```diff
-          aria-label={unread.length ? `${unread.length} unread updates` : "Updates — nothing new"}
-          className="relative min-h-11 min-w-11 md:min-h-9 md:min-w-9"
+          aria-label={unread.length ? `${unread.length} unread updates` : "Updates: nothing new"}
+          className="relative min-h-11 min-w-11"
```

### src/components/owner/OwnerOpportunities.tsx (2 lines changed)
```diff
-            <Link2 className="size-3.5" /> {r.label}{r.note ? <span className="text-muted-foreground"> — {r.note}</span> : null}
+            <Link2 className="size-3.5" /> {r.label}{r.note ? <span className="text-muted-foreground"> · {r.note}</span> : null}
-            {item.suggestedMinutes ? <div><dt className="font-medium">Suggested time</dt><dd className="text-muted-foreground">{minutesLabel(item.suggestedMinutes)} — log the time you actually spend.</dd></div> : null}
+            {item.suggestedMinutes ? <div><dt className="font-medium">Suggested time</dt><dd className="text-muted-foreground">{minutesLabel(item.suggestedMinutes)}. Log the time you actually spend.</dd></div> : null}
```

### src/components/owner/OwnerQueueCards.tsx (1 lines changed)
```diff
-            {data.loading ? "–" : data.counts[q.key]}
+            {data.loading ? "-" : data.counts[q.key]}
```

### src/components/owner/OwnerTaskDialog.tsx (2 lines changed)
```diff
-          ? "Approved — thank you. Your project manager has been notified."
+          ? "Approved: thank you. Your project manager has been notified."
-                  Enter the minutes you actually spent — we never fill that in for you.
+                  Enter the minutes you actually spent. We never fill that in for you.
```

### src/components/property/ActiveOwnerPanel.tsx (1 lines changed)
```diff
-  draft: "Draft — not started",
+  draft: "Draft: not started",
```

### src/components/property/CompletedOnboardingRecords.tsx (6 lines changed)
```diff
-            Finished Tasks, assessments and files from onboarding. Read-only — changes stay with
+            Finished Tasks, assessments and files from onboarding. Read-only: changes stay with
-                    {usDateTime(h.at)} — {h.summary}
+                    {usDateTime(h.at)} · {h.summary}
-          <dd>{task.completedAt ? usDateTime(task.completedAt) : "—"}</dd>
+          <dd>{task.completedAt ? usDateTime(task.completedAt) : "Not set"}</dd>
-          <dd>{task.completedBy ?? "—"}</dd>
+          <dd>{task.completedBy ?? "Not set"}</dd>
-          <dd>{task.assignedTo ?? "—"}</dd>
+          <dd>{task.assignedTo ?? "Not set"}</dd>
-          <dd className="capitalize">{label(task.stage) || "—"}</dd>
+          <dd className="capitalize">{label(task.stage) || "Not set"}</dd>
```

### src/components/recovery/LogRecoveryDialog.tsx (4 lines changed)
```diff
-          ? `Refund or credit logged from the refunds & credits queue — proposed remedy: ${RECOVERY_ACTION_LABELS[chosen]}`
+          ? `Refund or credit logged from the refunds & credits queue. Proposed remedy: ${RECOVERY_ACTION_LABELS[chosen]}`
-            Start from the ticket where the situation is being handled — the home, guest and stay
+            Start from the ticket where the situation is being handled. The home, guest and stay
-                    {row.guest_name ? ` — ${row.guest_name}` : ""}
+                    {row.guest_name ? ` · ${row.guest_name}` : ""}
-              {policyBoundaryLabel(withinPolicy)} · {POLICY_VERSION}
+              {policyBoundaryLabel(withinPolicy)}
```

### src/components/recovery/RecoveryDrawer.tsx (5 lines changed)
```diff
+import { priorityMeta } from "@/lib/tickets";
-            <Chip>{recovery.priority.toUpperCase()}</Chip>
+            <Chip>{priorityMeta(recovery.priority).short}</Chip>
-                Escalation is guidance and approval — you remain the owner until a handoff is
+                Escalation is guidance and approval. You remain the owner until a handoff is
-              <p className="mt-1 text-muted-foreground">{POLICY_VERSION}</p>
-                      body: `Approval requested — ${verdict.label}`,
+                      body: `Approval requested: ${verdict.label}`,
-                Handoff requested and not yet accepted — you are still responsible for this
+                Handoff requested and not yet accepted. You are still responsible for this
```

### src/components/recovery/RecoveryList.tsx (2 lines changed)
```diff
+import { priorityMeta } from "@/lib/tickets";
-            <Chip>{recovery.priority.toUpperCase()}</Chip>
+            <Chip>{priorityMeta(recovery.priority).short}</Chip>
```

### src/components/recovery/TicketRecoveryPanel.tsx (2 lines changed)
```diff
-          ? `Refund or credit opened from ticket — proposed remedy: ${RECOVERY_ACTION_LABELS[chosen]}`
+          ? `Refund or credit opened from ticket. Proposed remedy: ${RECOVERY_ACTION_LABELS[chosen]}`
-                {policyBoundaryLabel(withinPolicy)} · {POLICY_VERSION}
+                {policyBoundaryLabel(withinPolicy)}
```

### src/components/routines/RoutineDrawer.tsx (1 lines changed)
```diff
-                  You have not ticked everything — that is fine, but say why in the note.
+                  You have not ticked everything. That is fine, but say why in the note.
```

### src/components/tickets/GuidedTicketPanel.tsx (7 lines changed)
```diff
-        history: hasOpenWorkOrder ? `${history} Added to the open Work Order as a candidate — it must accept before it replaces the current vendor.` : history },
+        history: hasOpenWorkOrder ? `${history} Added to the open Work Order as a candidate. It must accept before it replaces the current vendor.` : history },
-      await log("note", `Troubleshooting — "${prompt}": ${outcome === "fixed" ? "fixed it" : outcome === "not_fixed" ? "not fixed" : "skipped"}.`);
+      await log("note", `Troubleshooting: "${prompt}". Result: ${outcome === "fixed" ? "fixed it" : outcome === "not_fixed" ? "not fixed" : "skipped"}.`);
-      history: "Still not fixed after troubleshooting — sending someone to the property.",
+      history: "Still not fixed after troubleshooting. Sending someone to the property.",
-                The vendor is recorded on the Work Order. Nothing is sent to them automatically — contact them as you do today.
+                The vendor is recorded on the Work Order. Nothing is sent to them automatically. Contact them as you do today.
-                    <Button size="sm" variant="outline" disabled={answer.isPending} onClick={() => answer.mutate({ stepId: nextStep.id, outcome: "not_fixed", prompt: nextStep.prompt })}>Not fixed — next step</Button>
+                    <Button size="sm" variant="outline" disabled={answer.isPending} onClick={() => answer.mutate({ stepId: nextStep.id, outcome: "not_fixed", prompt: nextStep.prompt })}>Not fixed: next step</Button>
-                  {ts?.guide ? "Still not fixed — send someone" : "Send someone"}
+                  {ts?.guide ? "Still not fixed: send someone" : "Send someone"}
-                      ? `Emergency Only vendor chosen on a P1 Ticket: ${v.display_name}.`
+                      ? `Emergency Only vendor chosen on a Right now Ticket: ${v.display_name}.`
```

### src/components/tickets/NoEligibleVendor.tsx (2 lines changed)
```diff
-              Vendor request — {r.service_category} in {r.market}: <strong>{SOURCING_STATE_LABELS[r.state] ?? r.state}</strong>
-              {r.state === "ready" && " — a vendor is ready. Choose them above."}
+              Vendor request: {r.service_category} in {r.market}: <strong>{SOURCING_STATE_LABELS[r.state] ?? r.state}</strong>
+              {r.state === "ready" && "· a vendor is ready. Choose them above."}
```

### src/components/tickets/OccupancyGuestPanel.tsx (13 lines changed)
```diff
-          ? "More than one reservation matches right now — verify in OwnerRez."
+          ? "More than one reservation matches right now. Verify in OwnerRez."
-            ? "OwnerRez could not be read just now — verify there."
+            ? "OwnerRez could not be read just now. Verify there."
-                      A current reservation exists, but its contact details are unavailable —
-                      check OwnerRez.
+                      A current reservation exists, but its contact details are unavailable. Check OwnerRez.
-                        ? `${usDate(guest.arrival)} → ${usDate(guest.departure)}`
-                        : "—"
+                        ? `${usDate(guest.arrival)} to ${usDate(guest.departure)}`
+                        : "Not set"
-                  <Row label="Reservation" value={guest.reservation_id ?? "—"} />
+                  <Row label="Reservation" value={guest.reservation_id ?? "Not set"} />
-              <Row label="Issue guest" value={ticket.reservation_guest_name ?? "—"} />
+              <Row label="Issue guest" value={ticket.reservation_guest_name ?? "Not set"} />
-                    ? `${usDate(ticket.reservation_arrival)} → ${usDate(ticket.reservation_departure)}`
-                    : "—"
+                    ? `${usDate(ticket.reservation_arrival)} to ${usDate(ticket.reservation_departure)}`
+                    : "Not set"
-                value={ticket.reservation_confirmation ?? ticket.ownerrez_booking_id ?? "—"}
+                value={ticket.reservation_confirmation ?? ticket.ownerrez_booking_id ?? "Not set"}
-              <Row label="Source" value={ticket.reservation_channel ?? "—"} />
+              <Row label="Source" value={ticket.reservation_channel ?? "Not set"} />
-                  placeholder={`Not confirmed — suggested: ${ACTIVE_STAY_IMPACT.find((o) => o.value === suggestedImpact)?.label}`}
+                  placeholder={`Not confirmed. Suggested: ${ACTIVE_STAY_IMPACT.find((o) => o.value === suggestedImpact)?.label}`}
-                  placeholder={`Not confirmed — ${GUEST_COMM.find((o) => o.value === eff.comm)?.label}`}
+                  placeholder={`Not confirmed: ${GUEST_COMM.find((o) => o.value === eff.comm)?.label}`}
```

### src/components/ui/dialog.tsx (16 lines changed)
```diff
+/** Tapping Help and feedback while a window is open keeps the window open (register H6). */
+function keepOpenForHelp(e: Event) {
+  const target = e.target as Element | null;
+  if (target?.closest?.("[data-help-feedback]")) e.preventDefault();
+}
+
->(({ className, children, ...props }, ref) => (
+>(({ className, children, onPointerDownOutside, onInteractOutside, ...props }, ref) => (
+      onPointerDownOutside={(e) => {
+        keepOpenForHelp(e);
+        onPointerDownOutside?.(e);
+      }}
+      onInteractOutside={(e) => {
+        keepOpenForHelp(e);
+        onInteractOutside?.(e);
+      }}
-      <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background cursor-pointer transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:po
+      <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm after:absolute after:-inset-3.5 after:content-[''] opacity-70 ring-offset-background cursor-pointer transition-opacity hover:opacity-100 focus:outline-none focus:rin
```

### src/components/ui/page.tsx (2 lines changed)
```diff
-          {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
+          {actions ? <div className="flex max-w-full shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
-              "rounded-md px-3 py-1.5 text-sm transition-colors",
+              "min-h-11 rounded-md px-3 py-1.5 text-sm transition-colors",
```

### src/components/ui/sheet.tsx (21 lines changed)
```diff
+/** Tapping Help and feedback while a drawer is open keeps the drawer open (register H6). */
+export function keepOpenForHelp(e: Event) {
+  const target = e.target as Element | null;
+  if (target?.closest?.("[data-help-feedback]")) e.preventDefault();
+}
+
->(({ side = "right", className, children, ...props }, ref) => (
+>(({ side = "right", className, children, onPointerDownOutside, onInteractOutside, ...props }, ref) => (
-    <SheetPrimitive.Content ref={ref} className={cn(sheetVariants({ side }), className)} {...props}>
-      <SheetPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background cursor-pointer transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:poi
+    <SheetPrimitive.Content
+      ref={ref}
+      className={cn(sheetVariants({ side }), className)}
+      {...props}
+      onPointerDownOutside={(e) => {
+        keepOpenForHelp(e);
+        onPointerDownOutside?.(e);
+      }}
+      onInteractOutside={(e) => {
+        keepOpenForHelp(e);
+        onInteractOutside?.(e);
+      }}
+    >
+      <SheetPrimitive.Close className="absolute right-4 top-4 rounded-sm after:absolute after:-inset-3.5 after:content-[''] opacity-70 ring-offset-background cursor-pointer transition-opacity hover:opacity-100 focus:outline-none focus:ring
```

### src/components/vendors/GateRow.tsx (1 lines changed)
```diff
-  if (passing && expiresOn && expiresOn < today) problems.push("That date has already passed — an expired record can't pass.");
+  if (passing && expiresOn && expiresOn < today) problems.push("That date has already passed. An expired record can't pass.");
```

### src/components/vendors/VendorDatabase.tsx (4 lines changed)
```diff
-    toast.success(data === "archived" ? "Column archived — its history is kept." : "Column removed");
+    toast.success(data === "archived" ? "Column archived: its history is kept." : "Column removed");
-                      {view.sort?.key === c.key ? (view.sort.dir === "asc" ? " ↑" : " ↓") : ""}
+                      {view.sort?.key === c.key ? (view.sort.dir === "asc" ? <ArrowUp className="ml-1 inline h-3 w-3" aria-label="Sorted up" /> : <ArrowDown className="ml-1 inline h-3 w-3" aria-label="Sorted down" />) : null}
-                            display(val, c) || <span className="text-muted-foreground">—</span>
+                            display(val, c) || <span className="text-muted-foreground">-</span>
-            Double-click a cell to edit. Locked columns are system fields used by dispatch and integrations —
-            they can't be renamed or removed{isLead ? "" : ", and only Admin or the Director of Operations can change their values"}.
+            Double-click a cell to edit. Locked columns are system fields used by dispatch and integrations. They can't be renamed or removed{isLead ? "" : ", and only Admin or the Director of Operations can change their values"}.
```

### src/components/vendors/VendorDirectory.tsx (3 lines changed)
```diff
+import { priorityMeta } from "@/lib/tickets";
-            {emergencyHidden} Emergency Only vendor{emergencyHidden === 1 ? "" : "s"} hidden for a {String(ticketPriority).toUpperCase()} Ticket.
+            {emergencyHidden} Emergency Only vendor{emergencyHidden === 1 ? "" : "s"} hidden for a {priorityMeta(String(ticketPriority)).short} Ticket.
-                    {qualificationHold(v, ws.data!.gateStatus) && <Chip>On hold — a qualification check expired</Chip>}
+                    {qualificationHold(v, ws.data!.gateStatus) && <Chip>On hold: a qualification check expired</Chip>}
```

### src/components/vendors/VendorGoldStandard.tsx (5 lines changed)
```diff
-                    <StatusBadge tone={g?.blockingClear ? "resolved" : "waiting"}>{g ? `${g.passed}/${g.total}` : "—"}</StatusBadge>
+                    <StatusBadge tone={g?.blockingClear ? "resolved" : "waiting"}>{g ? `${g.passed}/${g.total}` : "-"}</StatusBadge>
-                  <td className="p-2 numeric">{v.performance_score ?? "—"}</td>
+                  <td className="p-2 numeric">{v.performance_score ?? "-"}</td>
-                  <td className="p-2">{v.last_review_on ? usDate(v.last_review_on) : "—"}</td>
-                  <td className="p-2">{v.next_review_on ? usDate(v.next_review_on) : "—"}</td>
+                  <td className="p-2">{v.last_review_on ? usDate(v.last_review_on) : "Not set"}</td>
+                  <td className="p-2">{v.next_review_on ? usDate(v.next_review_on) : "Not set"}</td>
-                    {v.open_corrective_action ? `${v.open_corrective_action}${v.corrective_action_due ? ` · due ${usDate(v.corrective_action_due)}` : ""}` : "—"}
+                    {v.open_corrective_action ? `${v.open_corrective_action}${v.corrective_action_due ? ` · due ${usDate(v.corrective_action_due)}` : ""}` : "-"}
```

### src/components/vendors/VendorMarketCoverage.tsx (2 lines changed)
```diff
-              <li key={r.id}>{r.service_category} in {r.market} — {SOURCING_STATE_LABELS[r.state] ?? r.state}</li>
+              <li key={r.id}>{r.service_category} in {r.market} · {SOURCING_STATE_LABELS[r.state] ?? r.state}</li>
-  if (!list.length) return <span className="text-muted-foreground">—</span>;
+  if (!list.length) return <span className="text-muted-foreground">-</span>;
```

### src/components/vendors/VendorNeedsReview.tsx (3 lines changed)
```diff
-      if (v.migration_status === "imported_needs_review") issues.push("Imported — verify");
+      if (v.migration_status === "imported_needs_review") issues.push("Imported: verify");
-                      <StatusBadge tone="escalated">Window ended — leadership review</StatusBadge>
+                      <StatusBadge tone="escalated">Window ended: leadership review</StatusBadge>
-                    Breezeway: {r.breezeway_match_state === "email" ? `exact email (ID ${r.breezeway_match_person_id})` : r.breezeway_match_state === "unique_name" ? `name only — confirm (ID ${r.breezeway_match_person_id})` : "ambiguous — 
+                    Breezeway: {r.breezeway_match_state === "email" ? `exact email (ID ${r.breezeway_match_person_id})` : r.breezeway_match_state === "unique_name" ? `name only: confirm (ID ${r.breezeway_match_person_id})` : "ambiguous: ma
```

### src/components/work-entry/InsuranceRiskCard.tsx (1 lines changed)
```diff
-        description="Open Maintenance flagged for a possible insured loss. Visibility only — nothing is sent to insurers or owners."
+        description="Open Maintenance flagged for a possible insured loss. Visibility only: nothing is sent to insurers or owners."
```

### src/components/work-entry/PropertyWorkHistory.tsx (1 lines changed)
```diff
-          title: `${labelOf(ACTIVITY_CATEGORIES, a.category)} — ${a.what_happened}`,
+          title: `${labelOf(ACTIVITY_CATEGORIES, a.category)} · ${a.what_happened}`,
```

### src/components/workorders/TicketWorkOrderPanel.tsx (4 lines changed)
```diff
-        body: `${PHASE_LABELS[phase]} opened from the ticket — ${draftVerdict.label}`,
+        body: `${PHASE_LABELS[phase]} opened from the ticket: ${draftVerdict.label}`,
-          "This ticket already has an open Work Order — close it before opening another.",
+          "This ticket already has an open Work Order. Close it before opening another.",
-                  Warranty may apply{wo.warranty_contact ? ` — ${wo.warranty_contact}` : ""}.
+                  Warranty may apply{wo.warranty_contact ? ` · ${wo.warranty_contact}` : ""}.
-                  Warranty may apply — {draftHint.reason}
+                  Warranty may apply: {draftHint.reason}
```

### src/components/workorders/VendorSourcingPanel.tsx (5 lines changed)
```diff
-                    <li key={t.id}>{usDate(t.attempted_at)} · {CONTACT_CHANNEL_LABELS[t.channel as ContactChannel]} · {CONTACT_RESPONSE_LABELS[t.response as ContactResponse]}{t.note ? ` — ${t.note}` : ""}</li>
+                    <li key={t.id}>{usDate(t.attempted_at)} · {CONTACT_CHANNEL_LABELS[t.channel as ContactChannel]} · {CONTACT_RESPONSE_LABELS[t.response as ContactResponse]}{t.note ? ` · ${t.note}` : ""}</li>
-            {wo.authorized_at && <p className="text-xs text-muted-foreground">Approved for: {wo.authorized_scope ?? "—"} · up to ${wo.authorized_amount ?? "—"}</p>}
+            {wo.authorized_at && <p className="text-xs text-muted-foreground">Approved for: {wo.authorized_scope ?? "Not set"} · up to ${wo.authorized_amount ?? "Not set"}</p>}
-                onClick={() => run.mutate(async () => { await reconcile({ data: { workOrderId, outcome: "not_created", note: recon.note!.trim() } }); setRecon({}); })}>No task exists — allow a new attempt</Button>
+                onClick={() => run.mutate(async () => { await reconcile({ data: { workOrderId, outcome: "not_created", note: recon.note!.trim() } }); setRecon({}); })}>No task exists: allow a new attempt</Button>
-                  toast.success("Invoice expense started below — add the amount and upload the invoice.");
+                  toast.success("Invoice expense started below. Add the amount and upload the invoice.");
-                    title: `Follow up: ${VISIT_OUTCOME_LABELS[visit.outcome!]} — ${wo.title ?? "Work Order"}`,
+                    title: `Follow up: ${VISIT_OUTCOME_LABELS[visit.outcome!]} · ${wo.title ?? "Work Order"}`,
```

### src/components/workorders/WorkOrderDrawer.tsx (9 lines changed)
```diff
+import { priorityMeta } from "@/lib/tickets";
-          <Chip>{workOrder.priority.toUpperCase()}</Chip>
+          <Chip>{priorityMeta(workOrder.priority).short}</Chip>
-            {workOrder.closure_note ? ` — ${workOrder.closure_note}` : ""}
+            {workOrder.closure_note ? ` · ${workOrder.closure_note}` : ""}
-            Stays yours until it's resolved or handed off — asking for advice doesn't change that.
+            Stays yours until it's resolved or handed off. Asking for advice doesn't change that.
-                    placeholder="Emailed the homeowner on 12 Aug — $275 disposal replacement going ahead."
+                    placeholder="Emailed the homeowner on 12 Aug. $275 disposal replacement going ahead."
-                {workOrder.warranty_contact ? ` — ${workOrder.warranty_contact}` : ""}.
+                {workOrder.warranty_contact ? ` · ${workOrder.warranty_contact}` : ""}.
-                      body: `Alternate vendor chosen — ${
+                      body: `Alternate vendor chosen: ${
-              {" — start a guest refund or credit or a claim from there so the stay context comes with it."}
+              {"· start a guest refund or credit or a claim from there so the stay context comes with it."}
-      {done ? `${label} ✓` : label}
+      {done ? `${label}: done` : label}
```

### src/lib/__tests__/breezeway-webhook-recovery.test.ts (1 lines changed)
```diff
-    expect(String(row?.["reason"])).toContain("exceeded retry limit");
+    expect(String(row?.["reason"])).toContain("Exceeded retry limit");
```

### src/lib/__tests__/coverage.test.ts (1 lines changed)
```diff
-    expect(windowLabel(CFG)).toBe("10 p.m.–8 a.m. Central");
+    expect(windowLabel(CFG)).toBe("10 p.m. to 8 a.m. Central");
```

### src/lib/__tests__/direct-bookings-fix.test.ts (6 lines changed)
```diff
-        "Cleaning fee - $350",
-        "Application fee - $89 (one adult required)",
-        "Pet fee - $250/dog ($750 total)",
-        "Refundable deposit - $1,000",
+        "Cleaning fee: $350",
+        "Application fee: $89 (one adult required)",
+        "Pet fee: $250/dog ($750 total)",
+        "Refundable deposit: $1,000",
-    expect(feeLines({ ...fees, dogs: 1 })).toEqual(["Cleaning fee - $350", "Application fee - $89 (one adult required)", "Pet fee - $250/dog", "Refundable deposit - $1,000"]);
-    expect(feeLines({ cleaningFee: 350, applicationFee: 0, petFeePerDog: 250, dogs: 0, deposit: 0 })).toEqual(["Cleaning fee - $350"]);
+    expect(feeLines({ ...fees, dogs: 1 })).toEqual(["Cleaning fee: $350", "Application fee: $89 (one adult required)", "Pet fee: $250/dog", "Refundable deposit: $1,000"]);
+    expect(feeLines({ cleaningFee: 350, applicationFee: 0, petFeePerDog: 250, dogs: 0, deposit: 0 })).toEqual(["Cleaning fee: $350"]);
```

### src/lib/__tests__/handoff-accept.test.ts (1 lines changed)
```diff
-    if (!result.ok) expect(result.message).toContain("someone else");
+    if (!result.ok) expect(result.message).toContain("Someone else");
```

### src/lib/__tests__/home-rest.test.ts (1 lines changed)
```diff
-    expect(calls[2]!.body).toEqual({ work_order_id: "wo1", author_id: "sup", event_type: "supervisor_approved", body: "Supervisor approved — Within the ladder", is_demo: false });
+    expect(calls[2]!.body).toEqual({ work_order_id: "wo1", author_id: "sup", event_type: "supervisor_approved", body: "Supervisor approved · Within the ladder", is_demo: false });
```

### src/lib/__tests__/notion-open-counts-my-work.test.ts (1 lines changed)
```diff
-    expect(urgencyLabel(mine)).toBe("P1");
+    expect(urgencyLabel(mine)).toBe("Right now");
```

### src/lib/__tests__/onboarding-stage-progress.test.ts (1 lines changed)
```diff
-    expect(s.currentStage).toBe("Stage 5 — Fieldwork, Setup & Mid-Project Review");
+    expect(s.currentStage).toBe("Stage 5: Fieldwork, Setup & Mid-Project Review");
```

### src/lib/__tests__/owner-automatic-opportunity.test.ts (1 lines changed)
```diff
-  expect(view.recommendation).toContain("Review — No approval required");
+  expect(view.recommendation).toContain("Review: No approval required");
```

### src/lib/__tests__/owner-calendar-dates.test.ts (4 lines changed)
```diff
-    expect(usDate(null)).toBe("—");
+    expect(usDate(null)).toBe("Not set");
-    expect(usCalendarDate(null)).toBe("—");
-    expect(usCalendarDate("2026-9-17")).toBe("—");
-    expect(usCalendarDate("2026-09-17T00:30:00Z")).toBe("—");
+    expect(usCalendarDate(null)).toBe("Not set");
+    expect(usCalendarDate("2026-9-17")).toBe("Not set");
+    expect(usCalendarDate("2026-09-17T00:30:00Z")).toBe("Not set");
```

### src/lib/__tests__/owner-participation-consumers.test.ts (1 lines changed)
```diff
-  expect(csv).toContain(`# Shared participation total — 2026 (each activity once),${HOURS}`);
+  expect(csv).toContain(`# Shared participation total: 2026 (each activity once),${HOURS}`);
```

### src/lib/__tests__/owner-review-presentation.test.ts (2 lines changed)
```diff
-    "Reviewed — No approval required",
+    "Reviewed: No approval required",
-    "Review — Authority unconfirmed",
+    "Review: Authority unconfirmed",
```

### src/lib/__tests__/owner-ticket-authority.test.ts (1 lines changed)
```diff
-  expect(request.label).toBe("Review — No approval required");
+  expect(request.label).toBe("Review: No approval required");
```

### src/lib/__tests__/owner-ticket-projection.test.ts (1 lines changed)
```diff
-  expect(result[0]!.request.label).toBe("Review — No approval required");
+  expect(result[0]!.request.label).toBe("Review: No approval required");
```

### src/lib/__tests__/quiet-import-clocks.test.ts (1 lines changed)
```diff
-    expect(urgencyLabel({ id: "t1", ...untouched })).toBe("P1");
+    expect(urgencyLabel({ id: "t1", ...untouched })).toBe("Right now");
```

### src/lib/__tests__/record-work-one-flow.test.ts (2 lines changed)
```diff
-    expect(urgencyWords(u.priority)).toBe("Today (P2)");
+    expect(urgencyWords(u.priority)).toBe("Today");
-    expect(urgencyWords(u.priority)).toBe("Right now (P1)");
+    expect(urgencyWords(u.priority)).toBe("Right now");
```

### src/lib/__tests__/screen-words.test.ts (72 lines changed)
```diff
+ *
+ * Punctuation and urgency rules (Build 7, register H3 and H4), read from the same text:
+ * - longDash: a long dash (\u2014) anywhere. shortDash: an en dash (\u2013) anywhere.
+ * - hyphenDash: a hyphen with a space on both sides between words ("a - b"). A hyphen
+ *   alone ("-") still marks an empty value where space is tight; joined words like
+ *   "follow-up" or "2-3" are ordinary words.
+ * - symbol: emoji, arrows, check marks and stars used as words. The middle dot and the
+ *   ellipsis are allowed separators.
+ * - urgencyCode: P1, P2, P3 or P4. Screens say Right now, Today and Routine; the codes
+ *   stay only as lower case values (p1, p2, p3) in code and the database.
+ * - Text that code compares or searches with (=== "\u2014", .replace("\u2014", ...),
+ *   .includes, .split, .startsWith) is logic, not screen text, and is skipped.
+const PUNCTUATION: Record<string, RegExp> = {
+  longDash: /\u2014/,
+  shortDash: /\u2013/,
+  hyphenDash: /\S\s+-\s+\S|^\s*-\s+\S|\S\s+-\s*$/,
+  symbol: /[\p{Extended_Pictographic}\u2190-\u21FF\u2713\u2714\u2716\u2605\u2606]/u,
+  urgencyCode: /\bP[1-4]\b/,
+};
+Object.assign(WORDS, PUNCTUATION);
-  "src/lib/onboarding-template.ts": { James: 2, Josh: 3, Kati: 4, Micah: 3, sample: 3 },
+  // Its punctuation is frozen with it (Build 7): the plan's own approval covers rewording.
+  "src/lib/onboarding-template.ts": {
+    James: 2, Josh: 3, Kati: 4, Micah: 3, longDash: 10, shortDash: 5, hyphenDash: 36, symbol: 7,
+  },
-  "src/lib/recovery-policy.ts": { threshold: 1 },
+  "src/lib/recovery-policy.ts": { threshold: 1, longDash: 1 },
+  // The previous repair policy version stamp, saved on older Work Orders and matched by
+  // policyForVersion; renaming it would lose which policy they were decided under.
+  "src/lib/maintenance-policy.ts": { longDash: 1 },
+  // The first approved homeowner report sentences, kept as the record of the original wording.
+  // Reports print the saved wording, which already removes this dash; changing it needs approval.
+  "src/lib/report-v2.ts": { longDash: 1 },
+  // A saved reason prefix on skipped onboarding work. Screens read it back and show "Not needed:",
+  // so the saved form stays the same for old and new rows.
+  "src/lib/onboarding.server.ts": { longDash: 1 },
+  // Instructions sent to the AI models (Coach and evidence review). They are never shown on
+  // a screen; the model is told to answer in Right now, Today and Routine.
+  "src/lib/coach.server.ts": { longDash: 7, shortDash: 1, hyphenDash: 10, symbol: 1, urgencyCode: 2 },
+  "src/lib/coach-field-notes.ts": { longDash: 1, shortDash: 1, hyphenDash: 1 },
+  "src/lib/evidence.server.ts": { longDash: 1 },
+  // The Outlook category name. It must match the category that already exists in the
+  // shared mailbox, so it cannot be reworded here.
+  "src/lib/mail-categories.ts": { hyphenDash: 1 },
+  // The OpenStreetMap credit line. The map's licence requires the copyright sign.
+  "src/lib/search-map.ts": { symbol: 1 },
+  "src/components/direct-bookings/SearchMap.tsx": { symbol: 1 },
+const MATCH_CALLS = new Set(["replace", "replaceAll", "includes", "split", "startsWith", "endsWith", "indexOf"]);
+/** Text code compares or searches with, not text a person sees. */
+function isMatcher(node: ts.Node): boolean {
+  const p = node.parent;
+  if (ts.isBinaryExpression(p)) {
+    const k = p.operatorToken.kind;
+    return (
+      k === ts.SyntaxKind.EqualsEqualsEqualsToken ||
+      k === ts.SyntaxKind.ExclamationEqualsEqualsToken ||
+      k === ts.SyntaxKind.EqualsEqualsToken ||
+      k === ts.SyntaxKind.ExclamationEqualsToken
+    );
+  }
+  if (ts.isCallExpression(p) && p.arguments[0] === node && ts.isPropertyAccessExpression(p.expression)) {
+    return MATCH_CALLS.has(p.expression.name.text);
+  }
+  return false;
+}
+
-        if (!skip) text = node.text;
+        if (!skip && !isMatcher(node)) text = node.text;
+      "Waiting \u2014 owner",
+      "9\u201310 AM",
+      "Owner - reply",
+      "Done \u2705",
+      "Open \u2192",
+      "Unresolved P1",
-    for (const ok of ["Proposed amount", "Typical close", "Team and shift", "seatHolder", "median_ack"]) {
+    for (const ok of ["Proposed amount", "Typical close", "Team and shift", "seatHolder", "median_ack", "Right now", "follow-up", "2-3 homes", "-", "Home \u00b7 Team", "Loading\u2026", "p1"]) {
```

### src/lib/__tests__/top-bar-record-routine.test.ts (1 lines changed)
```diff
-    expect(routineButton).toContain('className="min-h-11 md:min-h-9"');
+    expect(routineButton).toContain('className="min-h-11"');
```

### src/lib/__tests__/urgency-names.test.ts (5 lines changed)
```diff
-    expect(PRIORITIES.map((p) => [p.value, p.name, p.label])).toEqual([
-      ["p1", "Right now", "Right now (P1)"],
-      ["p2", "Today", "Today (P2)"],
-      ["p3", "Routine", "Routine (P3)"],
+    // Build 7 (register H4): the screen words carry no code, label and short alike.
+    expect(PRIORITIES.map((p) => [p.value, p.name, p.label, p.short])).toEqual([
+      ["p1", "Right now", "Right now", "Right now"],
+      ["p2", "Today", "Today", "Today"],
+      ["p3", "Routine", "Routine", "Routine"],
```

### src/lib/__tests__/work-orders.test.ts (2 lines changed)
```diff
-      title: "Owner approval — property repair",
+      title: "Owner approval: property repair",
-    expect(commitmentStatus({ missed_commitments: 1 }, NOW).action).toContain("follow up");
+    expect(commitmentStatus({ missed_commitments: 1 }, NOW).action).toContain("Follow up");
```

### src/lib/act-as.server.ts (1 lines changed)
```diff
-    reason: "Staff test mode — acting as this homeowner.",
+    reason: "Staff test mode: acting as this homeowner.",
```

### src/lib/act-as.ts (1 lines changed)
```diff
-  if (!staff) throw new Error("Your session expired — sign in again.");
+  if (!staff) throw new Error("Your session expired: sign in again.");
```

### src/lib/attachments.ts (1 lines changed)
```diff
-  if (input.size <= 0) return { ok: false, message: "That file is empty — nothing to upload." };
+  if (input.size <= 0) return { ok: false, message: "That file is empty. Nothing to upload." };
```

### src/lib/availability-finder.ts (1 lines changed)
```diff
-    return `${r.name} — ${r.address}${r.bookingUrl ? `\n${r.bookingUrl}` : ""}${price ? `\n${price}` : ""}\n${externalAvailabilityText(r)}`;
+    return `${r.name} · ${r.address}${r.bookingUrl ? `\n${r.bookingUrl}` : ""}${price ? `\n${price}` : ""}\n${externalAvailabilityText(r)}`;
```

### src/lib/breezeway-mapping.ts (1 lines changed)
```diff
-  ambiguous: "Ambiguous — needs a decision",
+  ambiguous: "Ambiguous: needs a decision",
```

### src/lib/breezeway-outbound.server.ts (2 lines changed)
```diff
-        "The earlier attempt is unresolved — Resolve cannot tell whether Breezeway created it. An admin must check Breezeway before it is sent again.",
+        "The earlier attempt is unresolved. Resolve cannot tell whether Breezeway created it. An admin must check Breezeway before it is sent again.",
-          "The Breezeway task was created but Resolve could not record it. It is flagged for admin review — do not send it again.",
+          "The Breezeway task was created but Resolve could not record it. It is flagged for admin review. Do not send it again.",
```

### src/lib/breezeway-outbound.ts (3 lines changed)
```diff
-  error: "Failed — not created",
-  needs_review: "Uncertain — needs review",
-  abandoned: "Reviewed — nothing was created",
+  error: "Failed: not created",
+  needs_review: "Uncertain: needs review",
+  abandoned: "Reviewed: nothing was created",
```

### src/lib/breezeway-webhook-recovery.server.ts (1 lines changed)
```diff
-          : `${finalized.reason} — exceeded retry limit after ${nextRetryCount} attempts, needs manual review`,
+          : `${finalized.reason}. Exceeded retry limit after ${nextRetryCount} attempts, needs manual review`,
```

### src/lib/claims.ts (5 lines changed)
```diff
-      return "Closed — no action";
+      return "Closed: no action";
-        ? `Respond to the request — ${firstMissing.label ?? firstMissing.slot_key} still needed`
+        ? `Respond to the request: ${firstMissing.label ?? firstMissing.slot_key} still needed`
-  if (n === null) return "—";
+  if (n === null) return "Not set";
-  if (!iso) return "—";
+  if (!iso) return "Not set";
-  if (Number.isNaN(d.getTime())) return "—";
+  if (Number.isNaN(d.getTime())) return "-";
```

### src/lib/cleaner-hours.ts (16 lines changed)
```diff
-  single_individual_assignee: "Single cleaner — full elapsed Task time",
-  multi_assignee_full_elapsed: "Multiple cleaners — full elapsed Task time to each",
+  single_individual_assignee: "Single cleaner: full elapsed Task time",
+  multi_assignee_full_elapsed: "Multiple cleaners: full elapsed Task time to each",
-  company_only_needs_review: "Company account only — needs review",
-  invalid_duration_needs_review: "No usable elapsed time — needs review",
-  company_account_not_counted: "Company account alongside named cleaners — not counted",
-  provisional_duration: "Provisional standard duration — needs review",
-  provisional_cap: "Provisional cap (standard + 2 h) — needs review",
+  company_only_needs_review: "Company account only: needs review",
+  invalid_duration_needs_review: "No usable elapsed time. Needs review",
+  company_account_not_counted: "Company account alongside named cleaners, not counted",
+  provisional_duration: "Provisional standard duration: needs review",
+  provisional_cap: "Provisional cap (standard + 2 h). Needs review",
-  company_identity_needed: "Company login — identify the individual cleaner(s)",
-  override_request: "Override requested — leadership review required",
+  company_identity_needed: "Company login: identify the individual cleaner(s)",
+  override_request: "Override requested: leadership review required",
-  unknown: "Unknown — needs research",
+  unknown: "Unknown: needs research",
-  { value: "emergency_guest_arrival_imminent", label: "Emergency — guest arrival imminent" },
-  { value: "emergency_no_qualified_alternative", label: "Emergency — no qualified alternative reachable" },
-  { value: "emergency_health_safety", label: "Emergency — health or safety" },
-  { value: "emergency_property_damage", label: "Emergency — property damage response" },
+  { value: "emergency_guest_arrival_imminent", label: "Emergency: guest arrival imminent" },
+  { value: "emergency_no_qualified_alternative", label: "Emergency: no qualified alternative reachable" },
+  { value: "emergency_health_safety", label: "Emergency: health or safety" },
+  { value: "emergency_property_damage", label: "Emergency: property damage response" },
-  if (h == null || h === "") return "—";
+  if (h == null || h === "") return "-";
-  return Number.isFinite(n) ? `${n.toFixed(1)} h` : "—";
+  return Number.isFinite(n) ? `${n.toFixed(1)} h` : "-";
```

### src/lib/command-center.server.ts (3 lines changed)
```diff
-  if (value == null) return "—";
+  if (value == null) return "Not set";
-        target: "P1 ≤ 3 min",
+        target: "Right now: 3 min or less",
-        note: "A handoff is not complete until it is accepted — the original owner stays responsible.",
+        note: "A handoff is not complete until it is accepted. The original owner stays responsible.",
```

### src/lib/coverage-model.ts (5 lines changed)
```diff
-  ge_day: "Guest Experience & Reservations Coordinator — Day/Weekend",
-  ge_evening: "Guest Experience & Reservations Coordinator — Evening",
-  ge_parttime: "Guest Experience & Reservations Coordinator — Part-time",
-  po_day: "Property Operations Coordinator — Weekday Day",
-  po_evening: "Property Operations Coordinator — Evening/Weekend",
+  ge_day: "Guest Experience & Reservations Coordinator: Day/Weekend",
+  ge_evening: "Guest Experience & Reservations Coordinator: Evening",
+  ge_parttime: "Guest Experience & Reservations Coordinator: Part-time",
+  po_day: "Property Operations Coordinator: Weekday Day",
+  po_evening: "Property Operations Coordinator: Evening/Weekend",
```

### src/lib/coverage.ts (1 lines changed)
```diff
-  return `${clockLabel(cfg.after_hours_start_minute)}–${clockLabel(cfg.after_hours_end_minute)} Central`;
+  return `${clockLabel(cfg.after_hours_start_minute)} to ${clockLabel(cfg.after_hours_end_minute)} Central`;
```

### src/lib/dates.ts (5 lines changed)
```diff
-export function usDate(value: string | number | Date | null | undefined, fallback = "—"): string {
+export function usDate(value: string | number | Date | null | undefined, fallback = "Not set"): string {
-export function usCalendarDate(value: string | null | undefined, fallback = "—"): string {
+export function usCalendarDate(value: string | null | undefined, fallback = "Not set"): string {
-export function usTime(value: string | number | Date | null | undefined, fallback = "—"): string {
+export function usTime(value: string | number | Date | null | undefined, fallback = "Not set"): string {
-  fallback = "—",
+  fallback = "Not set",
-  fallback = "—",
+  fallback = "Not set",
```

### src/lib/deadline-alerts.ts (9 lines changed)
```diff
-  return ticket.ref ? `${ticket.ref} — ${ticket.title ?? "Ticket"}` : (ticket.title ?? "Ticket");
+  return ticket.ref ? `${ticket.ref} · ${ticket.title ?? "Ticket"}` : (ticket.title ?? "Ticket");
-          title: `${clock.name} time has run out — ${ticketName(ticket)}`,
+          title: `${clock.name} time has run out: ${ticketName(ticket)}`,
-          title: `${clock.name} due in ${minutes} minute${minutes === 1 ? "" : "s"} — ${ticketName(ticket)}`,
+          title: `${clock.name} due in ${minutes} minute${minutes === 1 ? "" : "s"} · ${ticketName(ticket)}`,
-        title: `No word back from ${vendor} — ${job}`,
+        title: `No word back from ${vendor} · ${job}`,
-        title: `${vendor} missed the arrival time — ${job}`,
+        title: `${vendor} missed the arrival time: ${job}`,
-    const name = claim.ref ? `${claim.ref} — ${claim.title ?? "Claim"}` : (claim.title ?? "Claim");
+    const name = claim.ref ? `${claim.ref} · ${claim.title ?? "Claim"}` : (claim.title ?? "Claim");
-        title: `Claim filing deadline has passed — ${name}`,
+        title: `Claim filing deadline has passed: ${name}`,
-            ? `Claim deadline is today — ${name}`
-            : `Claim deadline in ${days} day${days === 1 ? "" : "s"} — ${name}`,
+            ? `Claim deadline is today: ${name}`
+            : `Claim deadline in ${days} day${days === 1 ? "" : "s"} · ${name}`,
```

### src/lib/departure-matching.functions.ts (1 lines changed)
```diff
-    await writeAudit({ actorId: context.userId, action: "departure_clean.manual_link", entityType: "departure_clean_match", entityId: m.id, entityLabel: `Task ${m.breezeway_task_id} → reservation ${data.bookingId}` });
+    await writeAudit({ actorId: context.userId, action: "departure_clean.manual_link", entityType: "departure_clean_match", entityId: m.id, entityLabel: `Task ${m.breezeway_task_id} to reservation ${data.bookingId}` });
```

### src/lib/departure-review.ts (4 lines changed)
```diff
-          ? `Not requested — ${r.outreach_reason ?? ""}`
+          ? `Not requested: ${r.outreach_reason ?? ""}`
-              : "—";
+              : "Not set";
-    ? (HOST_REVIEW_OPTIONS.find((o) => o.id === r.host_review)?.label ?? "—")
+    ? (HOST_REVIEW_OPTIONS.find((o) => o.id === r.host_review)?.label ?? "Not set")
-    damage: r.damage_screen === "no" ? "None" : ctx.hasClaim ? "Claim linked" : "Flagged — no claim",
+    damage: r.damage_screen === "no" ? "None" : ctx.hasClaim ? "Claim linked" : "Flagged: no claim",
```

### src/lib/direct-bookings.ts (5 lines changed)
```diff
-  if (paid(fees.cleaningFee)) lines.push(`Cleaning fee - ${money(fees.cleaningFee)}`);
-  if (paid(fees.applicationFee)) lines.push(`Application fee - ${money(fees.applicationFee)} (one adult required)`);
+  if (paid(fees.cleaningFee)) lines.push(`Cleaning fee: ${money(fees.cleaningFee)}`);
+  if (paid(fees.applicationFee)) lines.push(`Application fee: ${money(fees.applicationFee)} (one adult required)`);
-    lines.push(`Pet fee - ${money(fees.petFeePerDog)}/dog${fees.dogs > 1 ? ` (${money(fees.petFeePerDog * fees.dogs)} total)` : ""}`);
-  if (paid(fees.deposit)) lines.push(`Refundable deposit - ${money(fees.deposit)}`);
+    lines.push(`Pet fee: ${money(fees.petFeePerDog)}/dog${fees.dogs > 1 ? ` (${money(fees.petFeePerDog * fees.dogs)} total)` : ""}`);
+  if (paid(fees.deposit)) lines.push(`Refundable deposit: ${money(fees.deposit)}`);
-  back: "← Back to Direct Bookings",
+  back: "Back to Direct Bookings",
```

### src/lib/document-completion.server.ts (1 lines changed)
```diff
-    throw new Error("That document is in use — only leftovers from earlier tools can be retired.");
+    throw new Error("That document is in use. Only leftovers from earlier tools can be retired.");
```

### src/lib/document-completion.ts (1 lines changed)
```diff
-  if (isAbandonedUpload(doc)) return "An upload that never finished — no file behind it.";
+  if (isAbandonedUpload(doc)) return "An upload that never finished. No file behind it.";
```

### src/lib/email-composer.functions.ts (1 lines changed)
```diff
-      if (bytes > 4_000_000) throw new Error("Attachments are too large — keep them under 3 MB.");
+      if (bytes > 4_000_000) throw new Error("Attachments are too large. Keep them under 3 MB.");
```

### src/lib/email-composer.server.ts (4 lines changed)
```diff
-      label: `Homeowner — ${c["owner_name"] ?? c["owner_email"]}`,
+      label: `Homeowner: ${c["owner_name"] ?? c["owner_email"]}`,
-      label: `Vendor — ${c["full_name"] ?? c["email"]}`,
+      label: `Vendor: ${c["full_name"] ?? c["email"]}`,
-          label: `Guest — ${ticket["guest_name"] ?? ticket["guest_contact"]}`,
+          label: `Guest: ${ticket["guest_name"] ?? ticket["guest_contact"]}`,
-    heading: ticket["ref"] ? `${ticket["ref"]} — ${ticket["title"] ?? ""}`.trim() : "Ticket",
+    heading: ticket["ref"] ? `${ticket["ref"]} · ${ticket["title"] ?? ""}`.trim() : "Ticket",
```

### src/lib/email-safety.server.ts (4 lines changed)
```diff
-  if (input.isDemo) return "Demo record — external delivery blocked.";
+  if (input.isDemo) return "Demo record: external delivery blocked.";
-    return "Demo/test address — external delivery blocked.";
+    return "Demo/test address: external delivery blocked.";
-    if (error || data !== true) return "Email safety verification refused or unavailable — external delivery blocked.";
+    if (error || data !== true) return "Email safety verification refused or unavailable. External delivery blocked.";
-    return "Email safety verification unavailable — external delivery blocked.";
+    return "Email safety verification unavailable. External delivery blocked.";
```

### src/lib/email.functions.ts (1 lines changed)
```diff
-        "Resending this message — the first attempt did not go through. Open Resolve for the full details.",
+        "Resending this message: the first attempt did not go through. Open Resolve for the full details.",
```

### src/lib/email.server.ts (2 lines changed)
```diff
-    "— A Real Home Away",
+    "· A Real Home Away",
-      `Ignoring requested reply-to ${input.replyTo.trim()} — replies are pinned to ${SHARED_MAILBOX}.`,
+      `Ignoring requested reply-to ${input.replyTo.trim()}. Replies are pinned to ${SHARED_MAILBOX}.`,
```

### src/lib/emergency-vendor.ts (1 lines changed)
```diff
-  p1: "P1 Ticket",
+  p1: "Right now Ticket",
```

### src/lib/escalation.functions.ts (4 lines changed)
```diff
-      throw new Error("Escalate to your Supervisor first — they take it to the Director.");
+      throw new Error("Escalate to your Supervisor first. They take it to the Director.");
-      body: `Escalated to the ${data.escalated_to_role === "director" ? "Director of Operations" : "Operations Supervisor"} — ${data.reason}. Ownership is unchanged.`,
+      body: `Escalated to the ${data.escalated_to_role === "director" ? "Director of Operations" : "Operations Supervisor"} · ${data.reason}. Ownership is unchanged.`,
-          "This was escalated to the Director — only the Director can decide it now.",
+          "This was escalated to the Director. Only the Director can decide it now.",
-        body: `Escalation answered — ${data.outcome_note} ${ownershipNote}`,
+        body: `Escalation answered: ${data.outcome_note} ${ownershipNote}`,
```

### src/lib/evidence.server.ts (3 lines changed)
```diff
-          ? `Evidence exception accepted — ${previous.data.label}.`
-          : `Evidence requirement satisfied — ${previous.data.label}.`,
+          ? `Evidence exception accepted: ${previous.data.label}.`
+          : `Evidence requirement satisfied: ${previous.data.label}.`,
-    return { ok: false as const, message: "That photo already passed — no exception is needed." };
+    return { ok: false as const, message: "That photo already passed. No exception is needed." };
```

### src/lib/evidence.ts (1 lines changed)
```diff
-    "The repair itself is in frame and visibly finished — no exposed wiring, open holes, loose parts or tools left in place.",
+    "The repair itself is in frame and visibly finished. No exposed wiring, open holes, loose parts or tools left in place.",
```

### src/lib/expenses.ts (4 lines changed)
```diff
-  reopened: "Reopened — needs re-review",
+  reopened: "Reopened: needs re-review",
-export const QB_REFERENCE_NOTE = "Entered by hand — not synchronized with or verified in QuickBooks.";
+export const QB_REFERENCE_NOTE = "Entered by hand: not synchronized with or verified in QuickBooks.";
-  n == null ? "—" : n.toLocaleString("en-US", { style: "currency", currency: "USD" });
+  n == null ? "Not set" : n.toLocaleString("en-US", { style: "currency", currency: "USD" });
-    ? "Purchase authorization is missing or uncertain — route to leadership for a decision before allocating to the owner."
+    ? "Purchase authorization is missing or uncertain. Route to leadership for a decision before allocating to the owner."
```

### src/lib/final-review.functions.ts (2 lines changed)
```diff
-        body: `Changes needed on this ticket — ${data.note}`,
+        body: `Changes needed on this ticket: ${data.note}`,
-      body: data.note ? `Reviewed and closed — ${data.note}` : "Reviewed and closed.",
+      body: data.note ? `Reviewed and closed: ${data.note}` : "Reviewed and closed.",
```

### src/lib/final-review.ts (3 lines changed)
```diff
-  if (facts.priority === "p1") reasons.push("P1 — highest priority work is always reviewed.");
+  if (facts.priority === "p1") reasons.push("Right now: the most urgent work is always reviewed.");
-    reasons.push("P2 with a guest in the home.");
+    reasons.push("Today, with a guest in the home.");
-    return "Straightforward work — this closes on its own once its evidence and communication requirements are met.";
+    return "Straightforward work: this closes on its own once its evidence and communication requirements are met.";
```

### src/lib/guest-feedback.server.ts (1 lines changed)
```diff
-      title: `Guest feedback follow-up — ${fb.rating}★ ${kind}`,
+      title: `Guest feedback follow-up: ${fb.rating} star ${kind}`,
```

### src/lib/guest-feedback.ts (1 lines changed)
```diff
-  return [a.issue_description, a.comments, a.improve_before_checkout].filter(Boolean).join(" — ").slice(0, 2000);
+  return [a.issue_description, a.comments, a.improve_before_checkout].filter(Boolean).join(" · ").slice(0, 2000);
```

### src/lib/guest-impact.ts (2 lines changed)
```diff
-        ? "Guest in home — current reservation found, but contact details are unavailable"
+        ? "Guest in home: current reservation found, but contact details are unavailable"
-  informed: "Guest informed — no update due right now",
+  informed: "Guest informed: no update due right now",
```

### src/lib/guest-recovery.ts (12 lines changed)
```diff
-  instruction: "What the vendor found and when — attach the Work Order where one exists.",
+  instruction: "What the vendor found and when. Attach the Work Order where one exists.",
-export const OUTSIDE_POLICY_BADGE = "Outside Standard Airbnb Policy — Director Review Required";
+export const OUTSIDE_POLICY_BADGE = "Outside Standard Airbnb Policy: Director Review Required";
-  if (recovery.stage === "closed") return "Closed — nothing outstanding.";
+  if (recovery.stage === "closed") return "Closed: nothing outstanding.";
-    return "Guest update is due now — send the next update before anything else.";
+    return "Guest update is due now. Send the next update before anything else.";
-    return "Returned for information — add what the approver asked for and resubmit.";
+    return "Returned for information: add what the approver asked for and resubmit.";
-    return "Approved — deliver the decision to the guest by phone, then confirm it in writing.";
+    return "Approved: deliver the decision to the guest by phone, then confirm it in writing.";
-    return "Impact is confirmed. Decide the remedy — a temporary fix first where one exists.";
+    return "Impact is confirmed. Decide the remedy: a temporary fix first where one exists.";
-    return "Confirm whether this fits normal Airbnb refund/discount policy — it decides who approves.";
+    return "Confirm whether this fits normal Airbnb refund/discount policy. It decides who approves.";
-    return "Guest checks out within a day — deliver the decision before they leave.";
+    return "Guest checks out within a day. Deliver the decision before they leave.";
-  return "Within your authority — deliver the decision to the guest, then record what was sent.";
+  return "Within your authority: deliver the decision to the guest, then record what was sent.";
-    out.push("A handoff is still waiting to be accepted — you remain responsible until it is.");
+    out.push("A handoff is still waiting to be accepted. You remain responsible until it is.");
-  approved_action_needed: "Approved — action needed",
+  approved_action_needed: "Approved: action needed",
```

### src/lib/guided-action.ts (2 lines changed)
```diff
-      return `${field.label} — a little more detail, please.`;
+      return `${field.label}. A little more detail, please.`;
-        return `${field.label} has to be in the future — that's when it comes back to you.`;
+        return `${field.label} has to be in the future. That's when it comes back to you.`;
```

### src/lib/handoff-accept.ts (1 lines changed)
```diff
-    return { ok: false, message: "You requested this handoff — someone else has to accept it." };
+    return { ok: false, message: "You requested this handoff. Someone else has to accept it." };
```

### src/lib/handoff-gate-authority.ts (1 lines changed)
```diff
-        "You submitted this handoff. The project manager cannot approve their own handoff — it goes to the Director of Onboarding first.",
+        "You submitted this handoff. The project manager cannot approve their own handoff. It goes to the Director of Onboarding first.",
```

### src/lib/help-feedback.functions.ts (3 lines changed)
```diff
-    const roles = (roleRows ?? []).map((r) => r.role).join(", ") || "—";
+    const roles = (roleRows ?? []).map((r) => r.role).join(", ") || "None";
-        ["Property", propertyLabel ?? "—"],
+        ["Property", propertyLabel ?? "Not set"],
-      const subject = `Resolve Help Ticket #${row.ticket_number} — ${kindLabel} — ${data.pageTitle}`.slice(0, 280);
+      const subject = `Resolve Help Ticket #${row.ticket_number} · ${kindLabel} · ${data.pageTitle}`.slice(0, 280);
```

### src/lib/help-ticket-response.functions.ts (3 lines changed)
```diff
-        ? `Resolve Help Ticket #${t.ticket_number} — Reply from ARHA${statusChanged ? ` (${newStatus})` : ""}`
+        ? `Resolve Help Ticket #${t.ticket_number} · Reply from ARHA${statusChanged ? ` (${newStatus})` : ""}`
-          ? `Resolve Help Ticket #${t.ticket_number} — Reopened (${newStatus})`
-          : `Resolve Help Ticket #${t.ticket_number} — Status updated to ${newStatus}`;
+          ? `Resolve Help Ticket #${t.ticket_number} · Reopened (${newStatus})`
+          : `Resolve Help Ticket #${t.ticket_number} · Status updated to ${newStatus}`;
```

### src/lib/home-profile.ts (1 lines changed)
```diff
-      { key: "yale_live", label: "Yale Integration - Live and Connected in Breezeway", src: js("access", "yale_integration_live", "boolean"), judged: true },
+      { key: "yale_live", label: "Yale Integration: Live and Connected in Breezeway", src: js("access", "yale_integration_live", "boolean"), judged: true },
```

### src/lib/home-work.ts (2 lines changed)
```diff
-import { OPEN_STATUSES, STATUSES, isClosed, slaState } from "@/lib/tickets";
+import { OPEN_STATUSES, STATUSES, isClosed, slaState, priorityMeta } from "@/lib/tickets";
-  const p = (t.priority ?? "p3").toUpperCase();
+  const p = priorityMeta(t.priority ?? "p3").short;
```

### src/lib/inquiry-sources.ts (1 lines changed)
```diff
-      flags.push(`Discount recorded as ${source.discountPercent}% — a negative discount has no stated basis, so it is not applied.`);
+      flags.push(`Discount recorded as ${source.discountPercent}%: a negative discount has no stated basis, so it is not applied.`);
```

### src/lib/intake.server.ts (1 lines changed)
```diff
-          propertyId ? "" : " No home was recognised — link the property to complete the record."
+          propertyId ? "" : " No home was recognised. Link the property to complete the record."
```

### src/lib/lead-offers.ts (4 lines changed)
```diff
-  if (!lead.desired_move_in) return "—";
+  if (!lead.desired_move_in) return "Not set";
-  return `${from} → ${end.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
+  return `${from} to ${end.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
-  return parts.length ? parts.join(" · ") : "—";
+  return parts.length ? parts.join(" · ") : "None";
-  return (lead as LeadRow & { search_region?: string | null }).search_region ?? lead.market ?? "—";
+  return (lead as LeadRow & { search_region?: string | null }).search_region ?? lead.market ?? "Not set";
```

### src/lib/leads.ts (7 lines changed)
```diff
-      return "Booking confirmed — nothing further";
+      return "Booking confirmed: nothing further";
-      return "Closed — no action";
+      return "Closed: no action";
-        return `Follow up now — ${followUpNumber(lead.stage)} sent, response overdue`;
+        return `Follow up now: ${followUpNumber(lead.stage)} sent, response overdue`;
-          ? "Still open by decision — check back with the prospect"
+          ? "Still open by decision. Check back with the prospect"
-  if (!value || Number.isNaN(n) || n === 0) return "—";
+  if (!value || Number.isNaN(n) || n === 0) return "-";
-  if (!iso) return "—";
+  if (!iso) return "Not set";
-  if (Number.isNaN(d.getTime())) return "—";
+  if (Number.isNaN(d.getTime())) return "-";
```

### src/lib/mailbox.server.ts (3 lines changed)
```diff
-        ? "No checkpoint set yet — the first live run will start from that moment."
+        ? "No checkpoint set yet. The first live run will start from that moment."
-      note: [`Reply on the same Outlook thread — ${subject}`, `From ${from}`, body.slice(0, 3000)]
+      note: [`Reply on the same Outlook thread: ${subject}`, `From ${from}`, body.slice(0, 3000)]
-    body: [`Reply on the same Outlook thread — ${subject}`, `From ${from}`, body]
+    body: [`Reply on the same Outlook thread: ${subject}`, `From ${from}`, body]
```

### src/lib/maintenance-policy.ts (7 lines changed)
```diff
-  if (amount == null || Number.isNaN(Number(amount))) return "—";
+  if (amount == null || Number.isNaN(Number(amount))) return "-";
-  proceed: "Proceed — no approval needed",
+  proceed: "Proceed: no approval needed",
-      return `Emergency: mitigate now and record the exception — reason, scope, amount, who decided and evidence. Anything beyond stopping the immediate problem still follows the normal ladder.`;
+      return `Emergency: mitigate now and record the exception. Reason, scope, amount, who decided and evidence. Anything beyond stopping the immediate problem still follows the normal ladder.`;
-    `Under ${sup} — proceed, record the cost.`,
-    `${sup} to ${own} — supervisor approves, homeowner is told afterwards.`,
-    `Above ${own} — homeowner approves before work starts.`,
-    `Emergency — mitigate now under a documented exception: reason, scope, amount, who decided, evidence.`,
+    `Under ${sup}. Proceed, record the cost.`,
+    `${sup} to ${own}. Supervisor approves, homeowner is told afterwards.`,
+    `Above ${own}. Homeowner approves before work starts.`,
+    `Emergency: mitigate now under a documented exception: reason, scope, amount, who decided, evidence.`,
```

### src/lib/notion-import.functions.ts (2 lines changed)
```diff
+import { priorityMeta } from "@/lib/tickets";
-            priority: t.priority.toUpperCase(),
+            priority: priorityMeta(t.priority).short,
```

### src/lib/onboarding-account-scope.ts (2 lines changed)
```diff
-    return { inScope: false, reason: `Also holds ${outsideRoles.join(", ")} access — an administrator manages this account.` };
+    return { inScope: false, reason: `Also holds ${outsideRoles.join(", ")} access: an administrator manages this account.` };
-    return { inScope: false, reason: "Belongs to a team outside Onboarding — an administrator manages this account." };
+    return { inScope: false, reason: "Belongs to a team outside Onboarding. An administrator manages this account." };
```

### src/lib/onboarding-budget.server.ts (2 lines changed)
```diff
-    `committed ${line.committed_amount ?? "—"}`,
-    `actual ${line.actual_amount ?? "—"}`,
+    `committed ${line.committed_amount ?? "-"}`,
+    `actual ${line.actual_amount ?? "-"}`,
```

### src/lib/onboarding-budget.ts (1 lines changed)
```diff
-  if (value == null || !Number.isFinite(Number(value))) return "—";
+  if (value == null || !Number.isFinite(Number(value))) return "-";
```

### src/lib/onboarding-dates.ts (1 lines changed)
```diff
-  if (source === "manual") return "Set by hand — it no longer follows the access date.";
+  if (source === "manual") return "Set by hand: it no longer follows the access date.";
```

### src/lib/onboarding-finance.server.ts (8 lines changed)
```diff
-      "This request can proceed under its recorded authority — record the invoice when it arrives.",
+      "This request can proceed under its recorded authority. Record the invoice when it arrives.",
-        title: `Approve ${money(request.estimate_amount)} — ${request.title}`,
+        title: `Approve ${money(request.estimate_amount)} · ${request.title}`,
-        subject: `Approval needed — ${input.subject} at ${home}${reference ? ` [${reference}]` : ""}`,
+        subject: `Approval needed: ${input.subject} at ${home}${reference ? ` [${reference}]` : ""}`,
-        "The invoice is above what was approved — record why before it goes to accounting.",
+        "The invoice is above what was approved. Record why before it goes to accounting.",
-      "No accounting recipient is configured yet — an administrator can set one in Integrations.",
+      "No accounting recipient is configured yet. An administrator can set one in Integrations.",
-    `Onboarding cost — ${property.data?.name ?? "property"}`,
+    `Onboarding cost: ${property.data?.name ?? "property"}`,
-        subject: `Onboarding cost — ${request.title}`,
+        subject: `Onboarding cost: ${request.title}`,
-    entityLabel: `${input.utilityType} — ${input.provider}`,
+    entityLabel: `${input.utilityType} · ${input.provider}`,
```

### src/lib/onboarding-finance.ts (4 lines changed)
```diff
-      return "No approval needed — add the invoice when it arrives.";
+      return "No approval needed: add the invoice when it arrives.";
-      return "Declined — close it out or revise the estimate.";
+      return "Declined: close it out or revise the estimate.";
-    ? `Resolve has "${row.current_value}" — the field says "${row.proposed_value}".`
-    : `Nothing recorded yet — the field says "${row.proposed_value}".`;
+    ? `Resolve has "${row.current_value}": the field says "${row.proposed_value}".`
+    : `Nothing recorded yet: the field says "${row.proposed_value}".`;
```

### src/lib/onboarding-lifecycle.ts (5 lines changed)
```diff
-    v.reason === "Blocked — Waiting on Owner" ||
-    v.reason === "Blocked — Homeowner requested changes"
+    v.reason === "Blocked: Waiting on Owner" ||
+    v.reason === "Blocked: Homeowner requested changes"
-  if (v.reason === "Blocked — Missing Evidence") return "evidence";
-  if (v.reason === "Blocked — Internal Review") return "review";
+  if (v.reason === "Blocked: Missing Evidence") return "evidence";
+  if (v.reason === "Blocked: Internal Review") return "review";
-      what: v.reason ? `${v.task.title} — ${v.reason.replace(/^Blocked — /, "")}` : v.task.title,
+      what: v.reason ? `${v.task.title} · ${v.reason.replace(/^Blocked: /, "")}` : v.task.title,
```

### src/lib/onboarding-master-sequence.ts (10 lines changed)
```diff
-  { value: "intake_identity", number: 1, label: "Stage 1 — Intake & Identity", steps: [1, 2] },
+  { value: "intake_identity", number: 1, label: "Stage 1: Intake & Identity", steps: [1, 2] },
-    label: "Stage 2 — Documents & Assessment",
+    label: "Stage 2: Documents & Assessment",
-    label: "Stage 3 — Scope, Utilities & Compliance",
+    label: "Stage 3: Scope, Utilities & Compliance",
-    label: "Stage 4 — Design, Approvals & Procurement",
+    label: "Stage 4: Design, Approvals & Procurement",
-    label: "Stage 5 — Fieldwork, Setup & Mid-Project Review",
+    label: "Stage 5: Fieldwork, Setup & Mid-Project Review",
-    label: "Stage 6 — Listing Setup & Final Clean",
+    label: "Stage 6: Listing Setup & Final Clean",
-    label: "Stage 7 — Handoff Readiness & Operational Acceptance",
+    label: "Stage 7: Handoff Readiness & Operational Acceptance",
-    label: "Stage 8 — Financial Closeout & Launch Stabilization",
+    label: "Stage 8: Financial Closeout & Launch Stabilization",
-    who: "Assigned PM — submits to the Director of Onboarding; the PM cannot approve their own handoff",
+    who: "Assigned PM: submits to the Director of Onboarding; the PM cannot approve their own handoff",
-  "The PM cannot approve their own handoff. Step 19 submits to the Director of Onboarding, step 20 is the Director of Onboarding's review, step 21 is the Director of Operations' review, steps 22–23 are Operations acceptance and Live activa
+  "The PM cannot approve their own handoff. Step 19 submits to the Director of Onboarding, step 20 is the Director of Onboarding's review, step 21 is the Director of Operations' review, steps 22 to 23 are Operations acceptance and Live act
```

### src/lib/onboarding-qa-fixtures.ts (2 lines changed)
```diff
-    name: `QA — ${furnishing === "full_furnishing" ? "Full Furnishing" : "No Furnishings"}`,
+    name: `QA: ${furnishing === "full_furnishing" ? "Full Furnishing" : "No Furnishings"}`,
-      evidence_note: completed ? "QA evidence checked — local fixture only" : null,
+      evidence_note: completed ? "QA evidence checked: local fixture only" : null,
```

### src/lib/onboarding-schedule.server.ts (5 lines changed)
```diff
-      skipped.push({ taskId: t.id, title: t.title, reason: "Already completed — preserved" });
+      skipped.push({ taskId: t.id, title: t.title, reason: "Already completed: preserved" });
-      skipped.push({ taskId: t.id, title: t.title, reason: "Date was set manually — preserved" });
+      skipped.push({ taskId: t.id, title: t.title, reason: "Date was set manually. Preserved" });
-        ? "Proposed date is in the past — confirm before applying"
+        ? "Proposed date is in the past. Confirm before applying"
-          ? "Task is blocked — confirm the new date is still workable"
+          ? "Task is blocked: confirm the new date is still workable"
-    throw new Error("Record the access (possession) date first — the plan paces itself from it.");
+    throw new Error("Record the access (possession) date first. The plan paces itself from it.");
```

### src/lib/onboarding-stage-progress.ts (1 lines changed)
```diff
-      steps: `Steps ${stage.steps[0]}–${stage.steps[1]}`,
+      steps: `Steps ${stage.steps[0]} to ${stage.steps[1]}`,
```

### src/lib/onboarding-state.ts (5 lines changed)
```diff
-      reasons.set(stage, "The onboarding plan is locked — this home is with Operations.");
+      reasons.set(stage, "The onboarding plan is locked. This home is with Operations.");
-      reason: "The onboarding plan is locked — this home is with Operations.",
+      reason: "The onboarding plan is locked. This home is with Operations.",
-      reason: "Sent to the homeowner — waiting on their recorded decision.",
+      reason: "Sent to the homeowner. Waiting on their recorded decision.",
-    return { state: "waiting", reason: `Blocked — ${task.blocker!.trim()}`, canComplete: false };
+    return { state: "waiting", reason: `Blocked: ${task.blocker!.trim()}`, canComplete: false };
-      reason: "Reopened after completion — a correction is required.",
+      reason: "Reopened after completion: a correction is required.",
```

### src/lib/onboarding-task-action.ts (4 lines changed)
```diff
-            { value: "cleared", label: "It's sorted — carry on with the step" },
-            { value: "still_blocked", label: "Still blocked — keep it flagged" },
+            { value: "cleared", label: "It's sorted: carry on with the step" },
+            { value: "still_blocked", label: "Still blocked: keep it flagged" },
-      then: "Then record their answer — sending alone doesn't finish the step.",
+      then: "Then record their answer. Sending alone doesn't finish the step.",
-    because: "Nothing is holding it — everything this step needs is on file.",
+    because: "Nothing is holding it. Everything this step needs is on file.",
```

### src/lib/onboarding-template-catalog.ts (1 lines changed)
```diff
-      "The standard ARHA onboarding plan. Edit it here — homes started from it get your version.",
+      "The standard ARHA onboarding plan. Edit it here: homes started from it get your version.",
```

### src/lib/onboarding-template.ts (3 lines changed)
```diff
-      "Instructions:\n Send the owner the mood boards for all rooms within the home.\n Utilize the sample email below and remember the following:\n Pls ensure that you copy the PDF of the mood boards. \n CC the Project Manager on the corre
+      "Instructions:\n Send the owner the mood boards for all rooms within the home.\n Utilize the example email below and remember the following:\n Pls ensure that you copy the PDF of the mood boards. \n CC the Project Manager on the corr
-      "Instructions:\n Following close, send the owner a congratulatory email that contains rough timelines for the home setup process. You will use the project plan dates for this, so be sure the plan has been updated and tasks spread acr
+      "Instructions:\n Following close, send the owner a congratulatory email that contains rough timelines for the home setup process. You will use the project plan dates for this, so be sure the plan has been updated and tasks spread acr
-      'Instructions:\n After the final walkthrough has been completed, and marketing photos have been uploaded, notify the owner that their home is now ready for booking and provide them with the link to their photos on our website.\n BE S
+      'Instructions:\n After the final walkthrough has been completed, and marketing photos have been uploaded, notify the owner that their home is now ready for booking and provide them with the link to their photos on our website.\n BE S
```

### src/lib/onboarding-workflow.ts (9 lines changed)
```diff
-    reason = `Blocked — ${task.blocker!.trim()}`;
+    reason = `Blocked: ${task.blocker!.trim()}`;
-    reason = "Blocked — Waiting on Owner";
+    reason = "Blocked: Waiting on Owner";
-    reason = "Blocked — Homeowner requested changes";
+    reason = "Blocked: Homeowner requested changes";
-    reason = evidenceMissing ? "Blocked — Missing Evidence" : "Blocked — Internal Review";
+    reason = evidenceMissing ? "Blocked: Missing Evidence" : "Blocked: Internal Review";
-        ? "Required evidence is not recorded yet — this task cannot be marked complete."
+        ? "Required evidence is not recorded yet. This task cannot be marked complete."
-    lines.push("Release conditions are met — every prerequisite task is complete.");
+    lines.push("Release conditions are met. Every prerequisite task is complete.");
-        : "Evidence is required before completion — none recorded yet.",
+        : "Evidence is required before completion. None recorded yet.",
-  if (task.due_on_overridden) return "Set manually — protected from recalculation.";
+  if (task.due_on_overridden) return "Set manually: protected from recalculation.";
-  if (role) return `Unassigned — ${role}`;
+  if (role) return `Unassigned: ${role}`;
```

### src/lib/onboarding.ts (15 lines changed)
```diff
-  { value: "post_contract", label: "Post contract — pre-inspection" },
-  { value: "phase1_inspection", label: "Phase 1 — Inspection / repair estimates" },
-  { value: "phase2_estimates", label: "Phase 2 — Estimates & installation purchases" },
-  { value: "phase3_work_orders", label: "Phase 3 — Plan / schedule Work Orders" },
-  { value: "phase4_purchasing", label: "Phase 4 — Purchasing / finalize Work Orders" },
-  { value: "phase5_monitor", label: "Phase 5 — Monitor repairs / setup / staging" },
-  { value: "phase6_handoff", label: "Phase 6 — Cost analysis / photos / handoff" },
+  { value: "post_contract", label: "Post contract: pre-inspection" },
+  { value: "phase1_inspection", label: "Phase 1: Inspection / repair estimates" },
+  { value: "phase2_estimates", label: "Phase 2: Estimates & installation purchases" },
+  { value: "phase3_work_orders", label: "Phase 3: Plan / schedule Work Orders" },
+  { value: "phase4_purchasing", label: "Phase 4: Purchasing / finalize Work Orders" },
+  { value: "phase5_monitor", label: "Phase 5: Monitor repairs / setup / staging" },
+  { value: "phase6_handoff", label: "Phase 6: Cost analysis / photos / handoff" },
-  { value: "intake_identity", label: "Stage 1 — Intake & Identity" },
-  { value: "documents_assessment", label: "Stage 2 — Documents & Assessment" },
-  { value: "scope_utilities_compliance", label: "Stage 3 — Scope, Utilities & Compliance" },
-  { value: "design_approvals_procurement", label: "Stage 4 — Design, Approvals & Procurement" },
-  { value: "fieldwork_setup_review", label: "Stage 5 — Fieldwork, Setup & Mid-Project Review" },
-  { value: "listing_final_clean", label: "Stage 6 — Listing Setup & Final Clean" },
-  { value: "handoff_acceptance", label: "Stage 7 — Handoff Readiness & Operational Acceptance" },
-  { value: "closeout_stabilization", label: "Stage 8 — Financial Closeout & Launch Stabilization" },
+  { value: "intake_identity", label: "Stage 1: Intake & Identity" },
+  { value: "documents_assessment", label: "Stage 2: Documents & Assessment" },
+  { value: "scope_utilities_compliance", label: "Stage 3: Scope, Utilities & Compliance" },
+  { value: "design_approvals_procurement", label: "Stage 4: Design, Approvals & Procurement" },
+  { value: "fieldwork_setup_review", label: "Stage 5: Fieldwork, Setup & Mid-Project Review" },
+  { value: "listing_final_clean", label: "Stage 6: Listing Setup & Final Clean" },
+  { value: "handoff_acceptance", label: "Stage 7: Handoff Readiness & Operational Acceptance" },
+  { value: "closeout_stabilization", label: "Stage 8: Financial Closeout & Launch Stabilization" },
```

### src/lib/ops-analytics.server.ts (3 lines changed)
```diff
+import { priorityMeta } from "@/lib/tickets";
-        (k) => k.toUpperCase(),
+        (k) => priorityMeta(k).short,
-        (k) => k.toUpperCase(),
+        (k) => priorityMeta(k).short,
```

### src/lib/oversight-export.ts (1 lines changed)
```diff
-      r.openTasks > 0 ? `  —  ${r.openTasks} waiting on the owner` : ""
+      r.openTasks > 0 ? ` · ${r.openTasks} waiting on the owner` : ""
```

### src/lib/owner-deadline.ts (2 lines changed)
```diff
-  "Deadlines are administered in Central Time. A response is needed — silence is not approval.";
+  "Deadlines are administered in Central Time. A response is needed. Silence is not approval.";
-export function centralDeadline(value: string | null | undefined, fallback = "—"): string {
+export function centralDeadline(value: string | null | undefined, fallback = "Not set"): string {
```

### src/lib/owner-dependency.ts (1 lines changed)
```diff
-  if (dep === "feedback") return "Owner feedback requested — work continues";
+  if (dep === "feedback") return "Owner feedback requested: work continues";
```

### src/lib/owner-directory.functions.ts (1 lines changed)
```diff
-        return { ok: false, message: `Owner directory not refreshed — ${message}` };
+        return { ok: false, message: `Owner directory not refreshed: ${message}` };
```

### src/lib/owner-notify.server.ts (2 lines changed)
```diff
-  const fullSubject = parts.join(" — ");
+  const fullSubject = parts.join(" · ");
-          delivery_error: "Demo notification — external delivery blocked.",
+          delivery_error: "Demo notification: external delivery blocked.",
```

### src/lib/owner-onboarding.server.ts (1 lines changed)
```diff
-      blockedReason: "Preview only — decisions are disabled in the staff walk-through.",
+      blockedReason: "Preview only: decisions are disabled in the staff walk-through.",
```

### src/lib/owner-opportunity.ts (3 lines changed)
```diff
-    blurb: "Not open yet — we will let you know when it is.",
+    blurb: "Not open yet: we will let you know when it is.",
-export const LEGACY_ENTRY_LABEL = "Legacy entry — original opportunity link unavailable";
+export const LEGACY_ENTRY_LABEL = "Legacy entry: original opportunity link unavailable";
-  return "This Opportunity is too general for the homeowner to act on. List the specific items needed, one per line (for example “Parking information — missing”, “HOA contact — missing”, or the exact documents requested).";
+  return "This Opportunity is too general for the homeowner to act on. List the specific items needed, one per line (for example “Parking information. Missing”, “HOA contact. Missing”, or the exact documents requested).";
```

### src/lib/owner-participation-prompts.ts (2 lines changed)
```diff
-  "These are optional opportunities to take part in running your home — nobody is waiting on them. Log only the time you actually spend. ARHA does not provide tax advice and does not promise any outcome from your participation.";
+  "These are optional opportunities to take part in running your home. Nobody is waiting on them. Log only the time you actually spend. ARHA does not provide tax advice and does not promise any outcome from your participation.";
-      "Consider what would make your home stand out season by season — patio setup, games, holiday touches, cold-weather comforts.",
+      "Consider what would make your home stand out season by season. Patio setup, games, holiday touches, cold-weather comforts.",
```

### src/lib/owner-progress-alerts.server.ts (3 lines changed)
```diff
-      body: `Congratulations — you have reported ${hours} hours across your program. Thank you for the time and care you have put in. Please keep recording any remaining activities as you complete them.`,
+      body: `Congratulations: you have reported ${hours} hours across your program. Thank you for the time and care you have put in. Please keep recording any remaining activities as you complete them.`,
-        ? `You have ${hours} hours logged — right on pace for your program, which runs through ${s.endsOn ?? "December 31"}. Thank you for keeping your entries up to date.`
+        ? `You have ${hours} hours logged: right on pace for your program, which runs through ${s.endsOn ?? "December 31"}. Thank you for keeping your entries up to date.`
-      body: `Your next pace milestone is ${next.hours} hours. You have reported ${hours} so far — a good moment to log anything you have completed recently.`,
+      body: `Your next pace milestone is ${next.hours} hours. You have reported ${hours} so far: a good moment to log anything you have completed recently.`,
```

### src/lib/owner-report.server.ts (9 lines changed)
```diff
-        .join(" — "),
+        .join(" · "),
-      summary: `${r.title} — ${r.owner_decision ?? r.outcome ?? "responded"}`,
+      summary: `${r.title} · ${r.owner_decision ?? r.outcome ?? "responded"}`,
-      [receipt.response, reviewedOwnerUpdateText(receipt.ownerUpdate)].filter(Boolean).join(" — "),
+      [receipt.response, reviewedOwnerUpdateText(receipt.ownerUpdate)].filter(Boolean).join(" · "),
-    ...report.yearTotals.map((y) => `# Shared participation total — ${y.year} (each activity once),${y.hours}`),
+    ...report.yearTotals.map((y) => `# Shared participation total: ${y.year} (each activity once),${y.hours}`),
-      ? "Hours & Participation Report — Year-end"
-      : "Hours & Participation Report — Progress",
+      ? "Hours & Participation Report: Year-end"
+      : "Hours & Participation Report: Progress",
-    text(`• ${prop.name}${prop.address ? ` — ${prop.address}` : ""}`, { size: 9.5 });
+    text(`• ${prop.name}${prop.address ? ` · ${prop.address}` : ""}`, { size: 9.5 });
-    text(e.shared ? `${e.properties.length} shared` : fit(e.properties[0] ?? "—", 78), {
+    text(e.shared ? `${e.properties.length} shared` : fit(e.properties[0] ?? "-", 78), {
-      text("—", { size: 8, x: cols[4] });
+      text("Not set", { size: 8, x: cols[4] });
```

### src/lib/owner-response.server.ts (1 lines changed)
```diff
-      "Record what the homeowner said and where its evidence is retained (3–2000 characters).",
+      "Record what the homeowner said and where its evidence is retained (3 to 2000 characters).",
```

### src/lib/owner-review-presentation.ts (3 lines changed)
```diff
-          ? "Reviewed — No approval required"
-          : "Review — No approval required",
+          ? "Reviewed: No approval required"
+          : "Review: No approval required",
-    return { attention: false, label: "Review — Authority unconfirmed" };
+    return { attention: false, label: "Review: Authority unconfirmed" };
```

### src/lib/owner-ticket-authority.ts (3 lines changed)
```diff
-    return { ...authority, why: `${authority.why} Reviewed owner request — ${explicitWhy}` };
+    return { ...authority, why: `${authority.why} Reviewed owner request: ${explicitWhy}` };
-      label: "Review — Authority not yet confirmed",
+      label: "Review: Authority not yet confirmed",
-    label: "Review — No approval required",
+    label: "Review: No approval required",
```

### src/lib/owner-welcome.server.ts (1 lines changed)
```diff
-        status: "failed", error_message: "Test address — never emailed.", subject: msg.subject, body: msg.body,
+        status: "failed", error_message: "Test address: never emailed.", subject: msg.subject, body: msg.body,
```

### src/lib/plan-csv-import.ts (1 lines changed)
```diff
-    if (rule === "invalid") errors.push({ row, message: `Due rule must look like "3 business day(s) before planned closing" — anchors: project created, planned closing, actual access, target handoff (found "${get(r, "Due rule")}").` });
+    if (rule === "invalid") errors.push({ row, message: `Due rule must look like "3 business day(s) before planned closing". Anchors: project created, planned closing, actual access, target handoff (found "${get(r, "Due rule")}").` });
```

### src/lib/playbook-match.ts (2 lines changed)
```diff
+import { priorityMeta } from "@/lib/tickets";
-    reasons.push(`priority ${ctx.priority.toUpperCase()}`);
+    reasons.push(`urgency ${priorityMeta(ctx.priority).short}`);
```

### src/lib/property-details.ts (3 lines changed)
```diff
-      ["systems", "water_shutoff_indoor", "Water shutoff — indoor"],
-      ["systems", "water_shutoff_outdoor", "Water shutoff — outdoor"],
+      ["systems", "water_shutoff_indoor", "Water shutoff: indoor"],
+      ["systems", "water_shutoff_outdoor", "Water shutoff: outdoor"],
-      fieldsFrom(`${keyPath}.${k}`, `${label} — ${humanizeKey(k)}`, v, obj),
+      fieldsFrom(`${keyPath}.${k}`, `${label} · ${humanizeKey(k)}`, v, obj),
```

### src/lib/property-enrichment-run.server.ts (1 lines changed)
```diff
-    return { ok: false, message: `Nothing was changed — ${message}` };
+    return { ok: false, message: `Nothing was changed: ${message}` };
```

### src/lib/property-enrichment.server.ts (1 lines changed)
```diff
-        detail: "Not linked to an OwnerRez listing — enrichment skipped (never matched on name).",
+        detail: "Not linked to an OwnerRez listing. Enrichment skipped (never matched on name).",
```

### src/lib/property-facts.ts (1 lines changed)
```diff
-  return `Pets welcome${limit}${species.length ? ` — ${species.join(", ")}` : ""}`;
+  return `Pets welcome${limit}${species.length ? ` · ${species.join(", ")}` : ""}`;
```

### src/lib/property-forms.ts (2 lines changed)
```diff
-  breezeway: "External — Breezeway inspection",
-  smartsheet: "External — Smartsheet form",
+  breezeway: "External: Breezeway inspection",
+  smartsheet: "External: Smartsheet form",
```

### src/lib/property-hub.server.ts (2 lines changed)
```diff
-            ? `${p.check_in_time ?? "—"} / ${p.check_out_time ?? "—"}`
+            ? `${p.check_in_time ?? "-"} / ${p.check_out_time ?? "-"}`
-        text: `${p1} open P1 ticket${p1 === 1 ? "" : "s"} on this home.`,
+        text: `${p1} open Right now ticket${p1 === 1 ? "" : "s"} on this home.`,
```

### src/lib/quarterly.server.ts (1 lines changed)
```diff
-      title: `Quarterly property review — ${formatPropertyLabel(property).primary}`,
+      title: `Quarterly property review: ${formatPropertyLabel(property).primary}`,
```

### src/lib/queue-bulk.functions.ts (1 lines changed)
```diff
-              ).toUpperCase()} in a queue update — ${plan.reason}`
+              ).toUpperCase()} in a queue update: ${plan.reason}`
```

### src/lib/record-work.ts (2 lines changed)
```diff
-/** Right now (P1), Today (P2), Routine (P3). */
+/** Right now, Today, Routine (the codes p1, p2, p3 stay internal). */
-  return `${URGENCY_NAMES[key]} (${key.toUpperCase()})`;
+  return URGENCY_NAMES[key];
```

### src/lib/recovery-policy.ts (10 lines changed)
```diff
-  p1_unaccepted: `Supervisor escalation required — a P1 has not been accepted within ${RECOVERY_POLICY.p1UnacceptedMinutes} minutes.`,
-  p2_no_plan: `Supervisor escalation required — a P2 has no credible action plan after ${RECOVERY_POLICY.p2NoPlanMinutes} minutes.`,
-  guest_asked_supervisor: "Supervisor escalation required — the guest has asked for a supervisor.",
+  p1_unaccepted: `Supervisor escalation required: a Right now ticket has not been accepted within ${RECOVERY_POLICY.p1UnacceptedMinutes} minutes.`,
+  p2_no_plan: `Supervisor escalation required: a Today ticket has no credible action plan after ${RECOVERY_POLICY.p2NoPlanMinutes} minutes.`,
+  guest_asked_supervisor: "Supervisor escalation required: the guest has asked for a supervisor.",
-  vendor_missed_commitments: `Supervisor escalation required — the vendor has missed ${RECOVERY_POLICY.vendorMissedCommitments} commitments.`,
+  vendor_missed_commitments: `Supervisor escalation required: the vendor has missed ${RECOVERY_POLICY.vendorMissedCommitments} commitments.`,
-    "Supervisor escalation required — an active-stay issue has been materially unresolved for over 2 hours.",
-  no_sop: "Supervisor escalation required — no clear SOP applies to this situation.",
+    "Supervisor escalation required: an active-stay issue has been materially unresolved for over 2 hours.",
+  no_sop: "Supervisor escalation required: no clear SOP applies to this situation.",
-    "Supervisor escalation required — guest, vendor and team information conflict.",
+    "Supervisor escalation required: guest, vendor and team information conflict.",
-    "Supervisor escalation required — the guest conversation has become significantly hostile.",
+    "Supervisor escalation required: the guest conversation has become significantly hostile.",
-    "Supervisor escalation required — required closure evidence is missing.",
-  reopened_issue: "Supervisor escalation required — a previously resolved issue has reopened.",
+    "Supervisor escalation required: required closure evidence is missing.",
+  reopened_issue: "Supervisor escalation required: a previously resolved issue has reopened.",
```

### src/lib/sharepoint-connection.server.ts (1 lines changed)
```diff
-      "A SharePoint connection is already stored for this administrator, but its saved key could not be read on the server. Nothing was changed and no replacement connection was created — revoke the stored connection before authorizing aga
+      "A SharePoint connection is already stored for this administrator, but its saved key could not be read on the server. Nothing was changed and no replacement connection was created. Revoke the stored connection before authorizing agai
```

### src/lib/situations.ts (1 lines changed)
```diff
-    hint: "Lockbox, smart lock, gate or garage — nobody is stranded.",
+    hint: "Lockbox, smart lock, gate or garage. Nobody is stranded.",
```

### src/lib/special-handling.ts (3 lines changed)
```diff
-  scheduling: "Timing constraints — quiet hours, days, notice periods.",
+  scheduling: "Timing constraints: quiet hours, days, notice periods.",
-    const who = r.vendor_name ? ` — ${r.vendor_name}` : "";
+    const who = r.vendor_name ? ` · ${r.vendor_name}` : "";
-      r.threshold_amount != null ? ` — $${Number(r.threshold_amount).toLocaleString()}` : "";
+      r.threshold_amount != null ? `· $${Number(r.threshold_amount).toLocaleString()}` : "";
```

### src/lib/staff-notify.server.ts (2 lines changed)
```diff
-          email_error: "Demo notification — external delivery blocked.",
+          email_error: "Demo notification: external delivery blocked.",
-      subject: row.priority === "urgent" ? `Action needed — ${row.title}` : row.title,
+      subject: row.priority === "urgent" ? `Action needed: ${row.title}` : row.title,
```

### src/lib/statement-readiness.ts (2 lines changed)
```diff
-  needs_rereview: "Needs re-review — changed after sign-off",
+  needs_rereview: "Needs re-review: changed after sign-off",
-  if (e.is_estimate) out.push("Estimate only — the actual invoice has not been recorded.");
+  if (e.is_estimate) out.push("Estimate only: the actual invoice has not been recorded.");
```

### src/lib/str-report.ts (3 lines changed)
```diff
-export const DRAFT_LABEL = "DRAFT — PROGRAM STILL ACTIVE";
+export const DRAFT_LABEL = "DRAFT: PROGRAM STILL ACTIVE";
-    `# A Real Home Away — STR Property Participation & Work Activity Report`,
+    `# A Real Home Away. STR Property Participation & Work Activity Report`,
-        ? "Under review — not in finalized totals"
+        ? "Under review: not in finalized totals"
```

### src/lib/sync-review.ts (1 lines changed)
```diff
-      meaning: "Resolve does not know what happened to this update — review it by hand.",
+      meaning: "Resolve does not know what happened to this update. Review it by hand.",
```

### src/lib/taxonomy.ts (5 lines changed)
```diff
-    hint: "Smoke, carbon monoxide, alarms, security — anything that protects people.",
+    hint: "Smoke, carbon monoxide, alarms, security. Anything that protects people.",
-    hint: "Codes, keys, locks, gates, garages — getting into the home.",
+    hint: "Codes, keys, locks, gates, garages. Getting into the home.",
-    hint: "Nothing above fits — say what it is in the description.",
+    hint: "Nothing above fits: say what it is in the description.",
-  "ticket.priority": "P1 urgent and unsafe, P2 same day, P3 planned. Supervisors set this.",
+  "ticket.priority": "Right now: urgent or unsafe. Today: same day. Routine: planned. Supervisors set this.",
-  "workOrder.category": "Set from the trade — shown so tickets and Work Orders read the same.",
+  "workOrder.category": "Set from the trade. Shown so tickets and Work Orders read the same.",
```

### src/lib/team-invites.server.ts (2 lines changed)
```diff
-    subject: "Your invite to Resolve — A Real Home Away",
+    subject: "Your invite to Resolve: A Real Home Away",
-    throw new Error("That code has no email address on it — copy the message instead.");
+    throw new Error("That code has no email address on it. Copy the message instead.");
```

### src/lib/ticket-checklist-seed.ts (1 lines changed)
```diff
-        question: "Double booking (P1). Which stay keeps the home?",
+        question: "Double booking (Right now). Which stay keeps the home?",
```

### src/lib/ticket-current-action.functions.ts (8 lines changed)
```diff
-        message: "This ticket has already moved on — refresh to see the current step.",
+        message: "This ticket has already moved on. Refresh to see the current step.",
-        ? `Acknowledged — ${v["note"].trim()}`
-        : "Acknowledged — we have this ticket.";
+        ? `Acknowledged: ${v["note"].trim()}`
+        : "Acknowledged: we have this ticket.";
-      body = `Work started — ${v["first_step"]?.trim() ?? ""}`;
+      body = `Work started: ${v["first_step"]?.trim() ?? ""}`;
-        body = `No longer waiting — ${update}`;
+        body = `No longer waiting: ${update}`;
-        body = `Still waiting on ${waitingWho(ticket.waiting_on)} — ${update}`;
+        body = `Still waiting on ${waitingWho(ticket.waiting_on)} · ${update}`;
-      body = `${ticket.vendor_name ?? "Vendor"} check-in${done ? " — reported complete" : ""}: ${v["update"]?.trim() ?? ""}`;
+      body = `${ticket.vendor_name ?? "Vendor"} check-in${done ? "· reported complete" : ""}: ${v["update"]?.trim() ?? ""}`;
-      body = `Guest updated — ${v["update"]?.trim() ?? ""}`;
+      body = `Guest updated: ${v["update"]?.trim() ?? ""}`;
```

### src/lib/ticket-current-action.ts (4 lines changed)
```diff
-            { value: "resume", label: "It's unblocked — pick the work back up" },
-            { value: "still_waiting", label: "Still waiting — park it again" },
+            { value: "resume", label: "It's unblocked: pick the work back up" },
+            { value: "still_waiting", label: "Still waiting: park it again" },
-          help: "One line is enough — it becomes the first entry in the ticket's history.",
+          help: "One line is enough. It becomes the first entry in the ticket's history.",
-      then: "Then Resolve shows the next real step — waiting, vendor, or the next update time.",
+      then: "Then Resolve shows the next real step. Waiting, vendor, or the next update time.",
```

### src/lib/ticket-guidance.ts (3 lines changed)
```diff
-    help: "Nothing more to do — record what fixed it and close.",
+    help: "Nothing more to do. Record what fixed it and close.",
-      title: remaining === 0 ? "Ready to Close" : `Ready to Close — ${remaining} item${remaining === 1 ? "" : "s"} remaining`,
+      title: remaining === 0 ? "Ready to Close" : `Ready to Close: ${remaining} item${remaining === 1 ? "" : "s"} remaining`,
-      title: `Ready to Close — ${remaining} item${remaining === 1 ? "" : "s"} remaining`,
+      title: `Ready to Close: ${remaining} item${remaining === 1 ? "" : "s"} remaining`,
```

### src/lib/ticket-lifecycle.server.ts (3 lines changed)
```diff
-      ? `Status changed to ${ticketStatusLabel(input.status)} under a named exception — ${LIFECYCLE_EXCEPTIONS[usedException]}: ${input.exceptionReason}`
+      ? `Status changed to ${ticketStatusLabel(input.status)} under a named exception: ${LIFECYCLE_EXCEPTIONS[usedException]}: ${input.exceptionReason}`
-      reason: `${LIFECYCLE_EXCEPTIONS[usedException]} — ${input.exceptionReason}`,
+      reason: `${LIFECYCLE_EXCEPTIONS[usedException]} · ${input.exceptionReason}`,
-        body: "Closed automatically — no review is required for this ticket.",
+        body: "Closed automatically: no review is required for this ticket.",
```

### src/lib/ticket-lifecycle.ts (3 lines changed)
```diff
-          "Create the repair / Work Order first — dispatch records where the work went.",
+          "Create the repair / Work Order first. Dispatch records where the work went.",
-          "This work type needs a photo or file attached — a description on its own is not evidence.",
+          "This work type needs a photo or file attached. A description on its own is not evidence.",
-          "Resolve the ticket first — closing comes after the work is finished.",
+          "Resolve the ticket first. Closing comes after the work is finished.",
```

### src/lib/ticket-next-action.ts (1 lines changed)
```diff
-      because: "This follows up a past stay — nobody currently in the home is involved.",
+      because: "This follows up a past stay. Nobody currently in the home is involved.",
```

### src/lib/ticket-priority.functions.ts (2 lines changed)
```diff
+import { priorityMeta } from "@/lib/tickets";
-      body: `Priority changed from ${previous.toUpperCase()} to ${data.priority.toUpperCase()} — ${data.reason}`,
+      body: `Urgency changed from ${priorityMeta(previous).short} to ${priorityMeta(data.priority).short} · ${data.reason}`,
```

### src/lib/tickets.ts (13 lines changed)
```diff
-    label: `${URGENCY_NAMES.p1} (P1)`,
-    short: "P1",
+    label: URGENCY_NAMES.p1,
+    short: URGENCY_NAMES.p1,
-    label: `${URGENCY_NAMES.p2} (P2)`,
-    short: "P2",
+    label: URGENCY_NAMES.p2,
+    short: URGENCY_NAMES.p2,
-    label: `${URGENCY_NAMES.p3} (P3)`,
-    short: "P3",
+    label: URGENCY_NAMES.p3,
+    short: URGENCY_NAMES.p3,
-    who: "Backup role notified — acknowledgment standard missed",
+    who: "Backup role notified: acknowledgment standard missed",
-    who: "Operations Supervisor notified — action has not started",
+    who: "Operations Supervisor notified: action has not started",
-    hint: "They become the Current Assignee — only once they accept.",
+    hint: "They become the Current Assignee. Only once they accept.",
-  { value: "guest_updated", label: "Guest updated — next update owed" },
+  { value: "guest_updated", label: "Guest updated: next update owed" },
-  return list.find((i) => i.value === value)?.label ?? value ?? "—";
+  return list.find((i) => i.value === value)?.label ?? value ?? "None";
-  if (!value) return "—";
+  if (!value) return "Not set";
-      body: "Acknowledged — this ticket is being worked.",
+      body: "Acknowledged: this ticket is being worked.",
```

### src/lib/vendor-documents.ts (1 lines changed)
```diff
-    blurb: "Carries a tax ID. Supervisors only — never staff, never other vendors.",
+    blurb: "Carries a tax ID. Supervisors only: never staff, never other vendors.",
```

### src/lib/vendor-import.server.ts (2 lines changed)
```diff
-      "Personal or missing email — no defensible link to a company. Unmatched legacy representative.",
+      "Personal or missing email. No defensible link to a company. Unmatched legacy representative.",
-        ? `Recorded in the legacy directory (unverified) — ${profile.claims.join("; ")}.`
+        ? `Recorded in the legacy directory (unverified): ${profile.claims.join("; ")}.`
```

### src/lib/vendor-migration.server.ts (2 lines changed)
```diff
-  if (multi || found.size > 1) return { state: "ambiguous", personId: null, note: "More than one Breezeway person has this name — confirm manually." };
+  if (multi || found.size > 1) return { state: "ambiguous", personId: null, note: "More than one Breezeway person has this name. Confirm manually." };
-    return { state: "unique_name", personId: only.breezeway_person_id, note: "Unique exact-name match — confirm before linking." };
+    return { state: "unique_name", personId: only.breezeway_person_id, note: "Unique exact-name match: confirm before linking." };
```

### src/lib/vendor-sourcing.functions.ts (2 lines changed)
```diff
-      return { status: wo.breezeway_handoff_status, ref: wo.breezeway_task_ref, message: "Already handed off — no second task created." };
+      return { status: wo.breezeway_handoff_status, ref: wo.breezeway_task_ref, message: "Already handed off: no second task created." };
-    const { error } = await sb.from("work_orders").update({ breezeway_handoff_status: "failed", breezeway_handoff_error: `Reconciled — no task in Breezeway: ${data.note}` }).eq("id", wo.id);
+    const { error } = await sb.from("work_orders").update({ breezeway_handoff_status: "failed", breezeway_handoff_error: `Reconciled: no task in Breezeway: ${data.note}` }).eq("id", wo.id);
```

### src/lib/vendor-sourcing.ts (10 lines changed)
```diff
-  interested: "Interested — not yet accepted", declined: "Declined",
+  interested: "Interested: not yet accepted", declined: "Declined",
-      ? "Approval was for a different vendor — request approval for the replacement vendor"
-      : "Approval no longer covers this scope or amount — request again"
+      ? "Approval was for a different vendor. Request approval for the replacement vendor"
+      : "Approval no longer covers this scope or amount. Request again"
-  if (input.handoffStatus === "uncertain") reasons.push("The last attempt is uncertain — reconcile it with Breezeway before another create.");
+  if (input.handoffStatus === "uncertain") reasons.push("The last attempt is uncertain. Reconcile it with Breezeway before another create.");
-  not_sent: "Not sent", sent: "Sent to Breezeway", simulated: "Demo handoff (simulated — nothing sent)",
-  failed: "Handoff not created — safe to retry", uncertain: "Handoff uncertain — reconcile with Breezeway before retrying",
+  not_sent: "Not sent", sent: "Sent to Breezeway", simulated: "Demo handoff (simulated: nothing sent)",
+  failed: "Handoff not created: safe to retry", uncertain: "Handoff uncertain: reconcile with Breezeway before retrying",
-      message: deps.status === "uncertain" ? "The last attempt is uncertain. Reconcile it with Breezeway before another create." : "Already handed off — no second task created." };
+      message: deps.status === "uncertain" ? "The last attempt is uncertain. Reconcile it with Breezeway before another create." : "Already handed off: no second task created." };
-  await deps.save({ breezeway_handoff_status: "uncertain", breezeway_request_key: requestKey, breezeway_handoff_error: "Handoff in progress — if this stays, check Breezeway before retrying." });
+  await deps.save({ breezeway_handoff_status: "uncertain", breezeway_request_key: requestKey, breezeway_handoff_error: "Handoff in progress: if this stays, check Breezeway before retrying." });
-    breezeway_handoff_error: status === "sent" ? null : (res?.message ?? "Breezeway did not respond. The task may exist — reconcile before retrying."),
+    breezeway_handoff_error: status === "sent" ? null : (res?.message ?? "Breezeway did not respond. The task may exist. Reconcile before retrying."),
-  return { status, ref, created: true, message: status === "sent" ? "Sent to Breezeway." : status === "failed" ? (res?.message ?? "Not created.") : "Uncertain — reconcile with Breezeway before another create." };
+  return { status, ref, created: true, message: status === "sent" ? "Sent to Breezeway." : status === "failed" ? (res?.message ?? "Not created.") : "Uncertain: reconcile with Breezeway before another create." };
```

### src/lib/vendors.server.ts (5 lines changed)
```diff
-    throw new Error("Write a short reason for the status change — it goes on the record.");
+    throw new Error("Write a short reason for the status change. It goes on the record.");
-        `Not approvable yet — still open: ${readiness.blockersFailing.map((l) => l.label).join(", ")}.`,
+        `Not approvable yet: still open: ${readiness.blockersFailing.map((l) => l.label).join(", ")}.`,
-      "Identity documents are verified and discarded — Resolve does not keep a copy.",
+      "Identity documents are verified and discarded. Resolve does not keep a copy.",
-  const note = `${input.subject} — ${input.method}. Document viewed and not retained.`;
+  const note = `${input.subject} · ${input.method}. Document viewed and not retained.`;
-    title: `Identity verified — ${input.subject}`,
+    title: `Identity verified: ${input.subject}`,
```

### src/lib/vendors.ts (3 lines changed)
```diff
-  expired: "Expired — not passing",
+  expired: "Expired: not passing",
-      headline: `${rating.toFixed(1)} stars — below the 4.0 bar`,
+      headline: `${rating.toFixed(1)} stars: below the 4.0 bar`,
-  return `${orgName} — ${code}`;
+  return `${orgName} · ${code}`;
```

### src/lib/visits.server.ts (2 lines changed)
```diff
-  if (open) throw new Error("You're already checked in on this job — check out when you leave.");
+  if (open) throw new Error("You're already checked in on this job. Check out when you leave.");
-        ? `Vendor checked in — phone location was ${distance} m from the home, so arrival is unconfirmed.`
+        ? `Vendor checked in: phone location was ${distance} m from the home, so arrival is unconfirmed.`
```

### src/lib/visits.ts (2 lines changed)
```diff
-  if (distance <= ON_SITE_RADIUS_M) return `${distance} m from the pin — weak GPS signal`;
+  if (distance <= ON_SITE_RADIUS_M) return `${distance} m from the pin. Weak GPS signal`;
-  if (minutes == null) return "—";
+  if (minutes == null) return "-";
```

### src/lib/work-entry.ts (2 lines changed)
```diff
-  return list.find((x) => x.value === v)?.label ?? v ?? "—";
+  return list.find((x) => x.value === v)?.label ?? v ?? "None";
-  if (ticket.insurance_risk === "unsure") reasons.push("Insurance-related status unsure — confirm");
+  if (ticket.insurance_risk === "unsure") reasons.push("Insurance-related status unsure: confirm");
```

### src/lib/work-order-supervisor-decision.ts (1 lines changed)
```diff
-    body: `Supervisor ${outcome} — ${note}`,
+    body: `Supervisor ${outcome} · ${note}`,
```

### src/lib/work-orders.ts (25 lines changed)
```diff
-      reason: `Mitigation may proceed without prior approval to ${clause}. Record the exception — reason, scope, amount, who decided and evidence. The permanent repair is evaluated separately.`,
+      reason: `Mitigation may proceed without prior approval to ${clause}. Record the exception: reason, scope, amount, who decided and evidence. The permanent repair is evaluated separately.`,
-      label: v3 ? "Proceed, no approval needed" : "Proceed — no approval needed",
+      label: v3 ? "Proceed, no approval needed" : "Proceed: no approval needed",
-    reason: `Consider a second quote — ${signals.map((s) => SECOND_QUOTE_LABELS[s].toLowerCase()).join("; ")}.`,
+    reason: `Consider a second quote: ${signals.map((s) => SECOND_QUOTE_LABELS[s].toLowerCase()).join("; ")}.`,
-    action = "Vendor missed a commitment — follow up before it becomes a second miss.";
+    action = "Vendor missed a commitment. Follow up before it becomes a second miss.";
-    action = `No vendor acknowledgment within ${MAINTENANCE_POLICY.vendorAcknowledgeMinutes[priority]} minutes — move to the backup vendor.`;
+    action = `No vendor acknowledgment within ${MAINTENANCE_POLICY.vendorAcknowledgeMinutes[priority]} minutes: move to the backup vendor.`;
-    action = "Vendor missed the ETA — get a new arrival time or dispatch a backup.";
+    action = "Vendor missed the ETA. Get a new arrival time or dispatch a backup.";
-  if (wo.closed_at) return "Closed — nothing outstanding.";
+  if (wo.closed_at) return "Closed: nothing outstanding.";
-    return "Warranty may apply — contact the warranty provider before committing to a paid repair.";
+    return "Warranty may apply: contact the warranty provider before committing to a paid repair.";
-    return "Mitigation is done — scope the permanent repair and evaluate approval on its own amount.";
+    return "Mitigation is done: scope the permanent repair and evaluate approval on its own amount.";
-      return "Owner asked for more information — send the detail they need.";
+      return "Owner asked for more information. Send the detail they need.";
-      return "Owner declined — record the alternative or close with the reason.";
+      return "Owner declined: record the alternative or close with the reason.";
-      return "Supervisor declined — record the alternative before going further.";
+      return "Supervisor declined: record the alternative before going further.";
-    return "Approved — send the homeowner the FYI that this work is going ahead.";
+    return "Approved: send the homeowner the FYI that this work is going ahead.";
-    return "Chase the quote — nothing can be authorised without an amount.";
+    return "Chase the quote: nothing can be authorised without an amount.";
-    blockers.push("Record the emergency exception — reason, scope, amount and evidence.");
+    blockers.push("Record the emergency exception. Reason, scope, amount and evidence.");
-    blockers.push("Permanent repair is still outstanding — create the follow-up before closing.");
+    blockers.push("Permanent repair is still outstanding. Create the follow-up before closing.");
-    title: `Supervisor approval — ${wo.title ?? "maintenance repair"}`,
+    title: `Supervisor approval: ${wo.title ?? "maintenance repair"}`,
-    throw new Error("Explain the repair and proposed work for the owner in 20–4,000 characters.");
+    throw new Error("Explain the repair and proposed work for the owner in 20 to 4,000 characters.");
-  return { title: "Owner approval — property repair", detail };
+  return { title: "Owner approval: property repair", detail };
-    title: `Owner approval — ${wo.title ?? "maintenance repair"}`,
+    title: `Owner approval: ${wo.title ?? "maintenance repair"}`,
-    return "Owner declined the permanent repair — a guest is in the home and the impact is unresolved. Decide the alternative: temporary mitigation, guest refund or credit, or leadership follow-up.";
+    return "Owner declined the permanent repair. A guest is in the home and the impact is unresolved. Decide the alternative: temporary mitigation, guest refund or credit, or leadership follow-up.";
-    return "Owner declined the permanent repair — the home still has an open defect. Record the alternative solution or escalate to leadership.";
+    return "Owner declined the permanent repair. The home still has an open defect. Record the alternative solution or escalate to leadership.";
-  return "Owner declined — record what happens instead before this Work Order is closed.";
+  return "Owner declined: record what happens instead before this Work Order is closed.";
-      instruction: "The amount actually paid — this is the final cost of record.",
+      instruction: "The amount actually paid. This is the final cost of record.",
-      instruction: "What the warranty provider said — coverage, appointment or refusal.",
+      instruction: "What the warranty provider said. Coverage, appointment or refusal.",
```

### src/qa/onboarding-preview.tsx (2 lines changed)
```diff
-          QA — Full Furnishing
+          QA: Full Furnishing
-          QA — No Furnishings
+          QA: No Furnishings
```

### src/routes/__root.tsx (2 lines changed)
```diff
-      { title: "ARHA Resolve — Operations Hub" },
+      { title: "ARHA Resolve: Operations Hub" },
-      { property: "og:title", content: "ARHA Resolve — Operations Hub" },
+      { property: "og:title", content: "ARHA Resolve: Operations Hub" },
```

### src/routes/_authenticated/account.tsx (1 lines changed)
```diff
-            description="Your photo appears wherever you are working — assigned tickets, activity updates and team lists."
+            description="Your photo appears wherever you are working. Assigned tickets, activity updates and team lists."
```

### src/routes/_authenticated/active-owner-followup.tsx (2 lines changed)
```diff
-      { title: "Active Owner follow-up — Resolve" },
+      { title: "Active Owner follow-up: Resolve" },
-      { property: "og:title", content: "Active Owner follow-up — Resolve" },
+      { property: "og:title", content: "Active Owner follow-up: Resolve" },
```

### src/routes/_authenticated/analytics.tsx (15 lines changed)
```diff
-      { title: "Analytics & KPIs — Resolve Operations" },
+      { title: "Analytics & KPIs: Resolve Operations" },
-      { property: "og:title", content: "Analytics & KPIs — Resolve Operations" },
+      { property: "og:title", content: "Analytics & KPIs: Resolve Operations" },
-  if (mins === null || Number.isNaN(mins)) return "—";
+  if (mins === null || Number.isNaN(mins)) return "-";
-  return v === null ? "—" : `${v}%`;
+  return v === null ? "-" : `${v}%`;
-      label: "Response SLA — guest impacting",
+      label: "Response SLA: guest impacting",
-      hint: `${s.avoidableReopens.length} we could have prevented — the real quality signal`,
+      hint: `${s.avoidableReopens.length} we could have prevented. The real quality signal`,
-    { label: "1–3 days", max: 3 },
-    { label: "4–7 days", max: 7 },
+    { label: "1 to 3 days", max: 3 },
+    { label: "4 to 7 days", max: 7 },
-      sub: `${b.count} tickets${b.p1 ? ` · ${b.p1} P1` : ""}${b.reopens ? ` · ${b.reopens} reopened` : ""}`,
+      sub: `${b.count} tickets${b.p1 ? ` · ${b.p1} Right now` : ""}${b.reopens ? ` · ${b.reopens} reopened` : ""}`,
-              {health.score === null ? "—" : health.score}
+              {health.score === null ? "-" : health.score}
-              Repeat failures — same home, same problem
+              Repeat failures: same home, same problem
-                  No home repeated the same problem in this window — that's a good sign.
+                  No home repeated the same problem in this window. That's a good sign.
-                      {r.p1 > 0 && <Badge variant="destructive">{r.p1} P1</Badge>}
+                      {r.p1 > 0 && <Badge variant="destructive">{r.p1} Right now</Badge>}
-              Reopens by category — the fastest read on where our closure standard isn't holding.
+              Reopens by category: the fastest read on where our closure standard isn't holding.
-          hint="Ranked by weight, not raw count — a P1 and a reopen count for more than a routine request"
+          hint="Ranked by weight, not raw count. A Right now ticket and a reopen count for more than a routine request"
```

### src/routes/_authenticated/audit.tsx (3 lines changed)
```diff
-      { title: "Audit history — Resolve" },
+      { title: "Audit history: Resolve" },
-      { property: "og:title", content: "Audit history — Resolve" },
+      { property: "og:title", content: "Audit history: Resolve" },
-                    {e.entity_label ? ` — ${e.entity_label}` : ""}
+                    {e.entity_label ? ` · ${e.entity_label}` : ""}
```

### src/routes/_authenticated/availability-finder.tsx (4 lines changed)
```diff
-                <p className="text-sm">{current.result.bedrooms ?? "—"} beds · {current.result.bathrooms ?? "—"} baths · sleeps {current.result.maxGuests ?? "—"}</p>
+                <p className="text-sm">{current.result.bedrooms ?? "Not set"} beds · {current.result.bathrooms ?? "Not set"} baths · sleeps {current.result.maxGuests ?? "Not set"}</p>
-                <p className="text-sm">{row.bedrooms ?? "—"} beds · {row.bathrooms ?? "—"} baths · {row.maxGuests ?? "—"} guests</p>
+                <p className="text-sm">{row.bedrooms ?? "Not set"} beds · {row.bathrooms ?? "Not set"} baths · {row.maxGuests ?? "Not set"} guests</p>
-                      <li>Internal only — referral cost {formatMoney(row.sourceQuote.referralCost, row.sourceQuote.currency)} ({row.sourceQuote.referralBasis}); we keep {formatMoney(row.sourceQuote.netAfterReferral ?? 0, row.sourceQuote.cu
+                      <li>Internal only: referral cost {formatMoney(row.sourceQuote.referralCost, row.sourceQuote.currency)} ({row.sourceQuote.referralBasis}); we keep {formatMoney(row.sourceQuote.netAfterReferral ?? 0, row.sourceQuote.cur
-            <p className={`mt-3 font-semibold ${row.status === "conditional" ? "text-amber-700 dark:text-amber-400" : row.status === "available" ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground"}`}>{row.status === "condi
+            <p className={`mt-3 font-semibold ${row.status === "conditional" ? "text-amber-700 dark:text-amber-400" : row.status === "available" ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground"}`}>{row.status === "condi
```

### src/routes/_authenticated/claims.closed.tsx (3 lines changed)
```diff
-      { title: "Closed claims — Resolve" },
+      { title: "Closed claims: Resolve" },
-      { property: "og:title", content: "Closed claims — Resolve" },
+      { property: "og:title", content: "Closed claims: Resolve" },
-        description="Every closed claim and its full history. Closed does not mean settled — unsettled claims stay in Finance's outstanding work."
+        description="Every closed claim and its full history. Closed does not mean settled. Unsettled claims stay in Finance's outstanding work."
```

### src/routes/_authenticated/claims.index.tsx (1 lines changed)
```diff
-  ready_to_submit: "Evidence and cost are in — send it.",
+  ready_to_submit: "Evidence and cost are in. Send it.",
```

### src/routes/_authenticated/claims.tsx (2 lines changed)
```diff
-      { title: "Damage claims and recovery — Resolve" },
+      { title: "Damage claims and recovery: Resolve" },
-      { property: "og:title", content: "Damage claims and recovery — Resolve" },
+      { property: "og:title", content: "Damage claims and recovery: Resolve" },
```

### src/routes/_authenticated/cleaner-hours.tsx (24 lines changed)
```diff
-      { title: "STR cleaner time — Resolve" },
+      { title: "STR cleaner time: Resolve" },
-      { property: "og:title", content: "STR cleaner time — Resolve" },
+      { property: "og:title", content: "STR cleaner time: Resolve" },
-            Each cleaner on a Breezeway clean is attributed the full elapsed Task time — a conservative exposure figure, not hours worked.
+            Each cleaner on a Breezeway clean is attributed the full elapsed Task time. A conservative exposure figure, not hours worked.
-        <StatTile label="Open Attention Queue items" value={openItems.data ?? "—"} tone={(openItems.data ?? 0) > 0 ? "attention" : "neutral"} />
+        <StatTile label="Open Attention Queue items" value={openItems.data ?? "Not set"} tone={(openItems.data ?? 0) > 0 ? "attention" : "neutral"} />
-                  <td className="py-2 pr-3 font-medium">{r.property_name}<div className="text-xs text-muted-foreground">Home {r.breezeway_home_id ?? "—"} · {r.mapping_state ?? "—"}</div></td>
+                  <td className="py-2 pr-3 font-medium">{r.property_name}<div className="text-xs text-muted-foreground">Home {r.breezeway_home_id ?? "Not set"} · {r.mapping_state ?? "Not set"}</div></td>
-                      <td className="pr-3">{r.breezeway_task_id}<div className="text-xs text-muted-foreground">{r.completion_date ? usDate(r.completion_date) : "—"}{r.before_tracking_start ? " · BEFORE START" : ""}</div></td>
-                      <td className="pr-3">{r.worker_name ?? "Unlinked"}<div className="text-xs text-muted-foreground">Person {r.breezeway_person_id ?? "—"} · {r.worker_classification ?? "unclassified"}</div></td>
-                      <td className="pr-3">Elapsed {r.raw_elapsed_minutes ?? "—"} min<div className="text-xs text-muted-foreground">Attributed {r.attributed_minutes ?? "—"} min · {r.attribution_method ?? "—"}{r.review_state ? ` · ${r.revie
+                      <td className="pr-3">{r.breezeway_task_id}<div className="text-xs text-muted-foreground">{r.completion_date ? usDate(r.completion_date) : "Not set"}{r.before_tracking_start ? " · BEFORE START" : ""}</div></td>
+                      <td className="pr-3">{r.worker_name ?? "Unlinked"}<div className="text-xs text-muted-foreground">Person {r.breezeway_person_id ?? "Not set"} · {r.worker_classification ?? "unclassified"}</div></td>
+                      <td className="pr-3">Elapsed {r.raw_elapsed_minutes ?? "-"} min<div className="text-xs text-muted-foreground">Attributed {r.attributed_minutes ?? "-"} min · {r.attribution_method ?? "-"}{r.review_state ? ` · ${r.revie
-                      <td className="pr-3">{r.safeguard?.owner_hours ?? "—"}</td>
-                      <td className="pr-3">{r.safeguard?.state ? <StateBadge state={r.safeguard.state} /> : "—"}</td>
+                      <td className="pr-3">{r.safeguard?.owner_hours ?? "-"}</td>
+                      <td className="pr-3">{r.safeguard?.state ? <StateBadge state={r.safeguard.state} /> : "Not set"}</td>
-              <td>{c.owner_zero ? "—" : hours(c.buffer_hours)}{c.inversion ? <span className="ml-1 text-xs text-danger">inversion</span> : null}</td>
+              <td>{c.owner_zero ? "-" : hours(c.buffer_hours)}{c.inversion ? <span className="ml-1 text-xs text-danger">inversion</span> : null}</td>
-                {OVERRIDE_CATEGORY_LABEL[o.reason_category] ?? o.reason_category}: “{o.justification}” — {o.approved_by_name}, {new Date(o.created_at).toLocaleString()}
+                {OVERRIDE_CATEGORY_LABEL[o.reason_category] ?? o.reason_category}: “{o.justification}”: {o.approved_by_name}, {new Date(o.created_at).toLocaleString()}
-                At approval: {STATE_LABEL[o.state_at_approval]} · {hours(o.current_hours)} + {hours(o.projected_clean_hours)} = {hours(o.projected_total_hours)} · owner {hours(o.owner_hours)} · buffer {o.buffer_hours == null ? "—" : hours(
+                At approval: {STATE_LABEL[o.state_at_approval]} · {hours(o.current_hours)} + {hours(o.projected_clean_hours)} = {hours(o.projected_total_hours)} · owner {hours(o.owner_hours)} · buffer {o.buffer_hours == null ? "Not set" : 
-                Active owner: {p.owner_name ?? "—"} · Owner hours {hours(p.owner_hours)} · {p.needs_review_entries ? `${p.needs_review_entries} entries need review (lower confidence)` : "Data confidence: reviewed"}
+                Active owner: {p.owner_name ?? "Not set"} · Owner hours {hours(p.owner_hours)} · {p.needs_review_entries ? `${p.needs_review_entries} entries need review (lower confidence)` : "Data confidence: reviewed"}
-                    <td>{e.breezeway_person_name ?? "—"}{e.breezeway_person_id ? <div className="text-xs text-muted-foreground">#{e.breezeway_person_id}</div> : null}</td>
-                    <td>{e.breezeway_task_id ? formatElapsed(e.raw_elapsed_seconds) : "—"}</td>
+                    <td>{e.breezeway_person_name ?? "Not set"}{e.breezeway_person_id ? <div className="text-xs text-muted-foreground">#{e.breezeway_person_id}</div> : null}</td>
+                    <td>{e.breezeway_task_id ? formatElapsed(e.raw_elapsed_seconds) : "-"}</td>
-                      {e.reason ? <div className="text-xs text-muted-foreground">“{e.reason}” — {e.author_name}</div> : null}
+                      {e.reason ? <div className="text-xs text-muted-foreground">“{e.reason}”: {e.author_name}</div> : null}
-                      <div className="text-xs text-muted-foreground">Source revision {e.source_revision ? new Date(e.source_revision).toLocaleString() : "—"} · synced {new Date(e.synced_at).toLocaleString()}</div>
+                      <div className="text-xs text-muted-foreground">Source revision {e.source_revision ? new Date(e.source_revision).toLocaleString() : "Not set"} · synced {new Date(e.synced_at).toLocaleString()}</div>
-        <option key={w.id} value={w.id}>{w.display_name}{w.account_type === "company" ? " (company)" : ""}{w.active ? "" : " — inactive"}</option>
+        <option key={w.id} value={w.id}>{w.display_name}{w.account_type === "company" ? " (company)" : ""}{w.active ? "" : "· inactive"}</option>
-        <label className="text-sm font-medium">Actual individual cleaner (optional — use when a company account was recorded)</label>
+        <label className="text-sm font-medium">Actual individual cleaner (optional. Use when a company account was recorded)</label>
-                {i.resolution_note ? <div className="text-xs text-muted-foreground">{i.status}: {i.resolution_note} {i.resolved_by_name ? `— ${i.resolved_by_name}` : "(automatic)"}</div> : null}
+                {i.resolution_note ? <div className="text-xs text-muted-foreground">{i.status}: {i.resolution_note} {i.resolved_by_name ? ` · ${i.resolved_by_name}` : "(automatic)"}</div> : null}
-                <td className="py-1.5">{a.last_seen_name ?? "—"}</td>
+                <td className="py-1.5">{a.last_seen_name ?? "Not set"}</td>
-                <td>{a.worker_id ? workerName.get(a.worker_id) ?? "—" : "—"}</td>
+                <td>{a.worker_id ? workerName.get(a.worker_id) ?? "Not set" : "Not set"}</td>
-              <li key={r.id}>{usDate(r.window_to)} — {r.status} · {r.cursor}/{r.home_queue.length} homes · {r.tasks_seen} cleans checked{r.errors.length ? ` · ${r.errors.length} errors` : ""}</li>
+              <li key={r.id}>{usDate(r.window_to)} · {r.status} · {r.cursor}/{r.home_queue.length} homes · {r.tasks_seen} cleans checked{r.errors.length ? ` · ${r.errors.length} errors` : ""}</li>
```

### src/routes/_authenticated/coach.tsx (4 lines changed)
```diff
-      { title: "Ask the Coach — Resolve Operations" },
+      { title: "Ask the Coach: Resolve Operations" },
-      { property: "og:title", content: "Ask the Coach — Resolve Operations" },
+      { property: "og:title", content: "Ask the Coach: Resolve Operations" },
-          body: `Opened from Coach at ${g.priority.toUpperCase()}. ${g.priority_reason}`,
+          body: `Opened from Coach at ${priorityMeta(g.priority).short}. ${g.priority_reason}`,
-          priority, gives you the checklist, and writes the brief for whoever you dispatch — before
+          priority, gives you the checklist, and writes the brief for whoever you dispatch. Before
```

### src/routes/_authenticated/command-center.tsx (6 lines changed)
```diff
-      { title: "Executive Command Center — Resolve" },
+      { title: "Executive Command Center: Resolve" },
-      { property: "og:title", content: "Executive Command Center — Resolve" },
+      { property: "og:title", content: "Executive Command Center: Resolve" },
-        description="Exceptions first. Every figure is calculated from live Resolve records — nothing is estimated. Where a source doesn't exist yet, the metric says so and names what's missing."
+        description="Exceptions first. Every figure is calculated from live Resolve records. Nothing is estimated. Where a source doesn't exist yet, the metric says so and names what's missing."
-                { value: "p1", label: "P1" },
-                { value: "p2", label: "P2" },
-                { value: "p3", label: "P3" },
+                { value: "p1", label: "Right now" },
+                { value: "p2", label: "Today" },
+                { value: "p3", label: "Routine" },
```

### src/routes/_authenticated/dashboard.tsx (5 lines changed)
```diff
-  { value: "p1", label: "P1" },
-  { value: "p2", label: "P2" },
-  { value: "p3", label: "P3" },
+  { value: "p1", label: "Right now" },
+  { value: "p2", label: "Today" },
+  { value: "p3", label: "Routine" },
-            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
+            className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-primary hover:underline"
-          className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
+          className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-primary hover:underline"
```

### src/routes/_authenticated/demo.tsx (3 lines changed)
```diff
-      { title: "Demo — Resolve" },
+      { title: "Demo: Resolve" },
-      { property: "og:title", content: "Demo — Resolve" },
+      { property: "og:title", content: "Demo: Resolve" },
-        change here is demo material — real homes, homeowners, guests and vendors are untouched, and
+        change here is demo material. Real homes, homeowners, guests and vendors are untouched, and
```

### src/routes/_authenticated/direct-bookings.settings.tsx (1 lines changed)
```diff
-      <div><Button variant="outline" className="min-h-11 border-primary px-4 font-semibold text-primary" asChild><Link to="/direct-bookings">← Back to Direct Bookings</Link></Button></div>
+      <div><Button variant="outline" className="min-h-11 border-primary px-4 font-semibold text-primary" asChild><Link to="/direct-bookings">Back to Direct Bookings</Link></Button></div>
```

### src/routes/_authenticated/finance.tsx (3 lines changed)
```diff
-      { title: "Finance — Resolve" },
+      { title: "Finance: Resolve" },
-      { property: "og:title", content: "Finance — Resolve" },
+      { property: "og:title", content: "Finance: Resolve" },
-                <p className="font-medium">{p.period} — {money(p.total)} <span className="text-xs text-muted-foreground">(proposed period; not reconciled)</span></p>
+                <p className="font-medium">{p.period} · {money(p.total)} <span className="text-xs text-muted-foreground">(proposed period; not reconciled)</span></p>
```

### src/routes/_authenticated/help-tickets.tsx (6 lines changed)
```diff
-            : "Saved. The email could not be delivered — see the activity thread.",
+            : "Saved. The email could not be delivered. See the activity thread.",
-    ["Submitter email", recipient?.email ?? t.submitter_email ?? "—"],
+    ["Submitter email", recipient?.email ?? t.submitter_email ?? "Not set"],
-                  : {label(e.from_status ?? "")} → {label(e.to_status ?? "")}
+                  : {label(e.from_status ?? "")} to {label(e.to_status ?? "")}
-            {reopening && <span className="text-xs text-muted-foreground">Reopening — add an optional reason below.</span>}
+            {reopening && <span className="text-xs text-muted-foreground">Reopening: add an optional reason below.</span>}
-                : "Internal note — only leadership sees this."
+                : "Internal note: only leadership sees this."
-              ? `One email will go to ${recipient?.email ?? "the submitter"}${mode === "note" && message.trim() ? " (status only — the note stays internal)" : ""}.`
+              ? `One email will go to ${recipient?.email ?? "the submitter"}${mode === "note" && message.trim() ? " (status only: the note stays internal)" : ""}.`
```

### src/routes/_authenticated/homeowners.tsx (2 lines changed)
```diff
-      { title: "Homeowners directory — Resolve Operations" },
+      { title: "Homeowners directory: Resolve Operations" },
-      { property: "og:title", content: "Homeowners directory — Resolve Operations" },
+      { property: "og:title", content: "Homeowners directory: Resolve Operations" },
```

### src/routes/_authenticated/hub.tsx (3 lines changed)
```diff
-      { title: "Your portals — Resolve" },
+      { title: "Your portals: Resolve" },
-      { property: "og:title", content: "Your portals — Resolve" },
+      { property: "og:title", content: "Your portals: Resolve" },
-      attention.urgent ? ` · ${attention.urgent} at P1` : ""
+      attention.urgent ? ` · ${attention.urgent} Right now` : ""
```

### src/routes/_authenticated/inquiry-sources.tsx (5 lines changed)
```diff
-  return value === null ? <span className="text-muted-foreground">—</span> : formatMoney(value);
+  return value === null ? <span className="text-muted-foreground">-</span> : formatMoney(value);
-            <td className="p-3">{source.sourceType ?? "—"}</td>
-            <td className="p-3">{source.discountPercent === null ? "—" : `${source.discountPercent}%`}</td>
-            <td className="p-3">{source.referralPercent === null && source.referralFee === null ? "—" : [
+            <td className="p-3">{source.sourceType ?? "Not set"}</td>
+            <td className="p-3">{source.discountPercent === null ? "-" : `${source.discountPercent}%`}</td>
+            <td className="p-3">{source.referralPercent === null && source.referralFee === null ? "-" : [
-            <td className="p-3">{source.utilitiesIncluded === null ? "—" : source.utilitiesIncluded ? "Yes" : "No"}</td>
+            <td className="p-3">{source.utilitiesIncluded === null ? "Not set" : source.utilitiesIncluded ? "Yes" : "No"}</td>
```

### src/routes/_authenticated/integrations.tsx (3 lines changed)
```diff
+import { priorityMeta } from "@/lib/tickets";
-          directly — use the message intake below to pull its notifications and guest or owner
+          directly. Use the message intake below to pull its notifications and guest or owner
-                <StatusBadge tone="closed">{t.priority?.toUpperCase()}</StatusBadge>
+                <StatusBadge tone="closed">{t.priority ? priorityMeta(t.priority).short : ""}</StatusBadge>
```

### src/routes/_authenticated/integrations_.notion-import.tsx (3 lines changed)
```diff
-        {tile("P1 (Urgent)", d.priority.p1)}
-        {tile("P2 (High)", d.priority.p2)}
-        {tile("P3 (Medium, Low or blank)", d.priority.p3)}
+        {tile("Right now (Notion Urgent)", d.priority.p1)}
+        {tile("Today (Notion High)", d.priority.p2)}
+        {tile("Routine (Notion Medium, Low or blank)", d.priority.p3)}
```

### src/routes/_authenticated/join.tsx (3 lines changed)
```diff
-      { title: "Redeem your invite code — Resolve Operations" },
+      { title: "Redeem your invite code: Resolve Operations" },
-      { property: "og:title", content: "Redeem your invite code — Resolve Operations" },
+      { property: "og:title", content: "Redeem your invite code: Resolve Operations" },
-        content: "One code sets your access in Resolve — no manual setup needed.",
+        content: "One code sets your access in Resolve. No manual setup needed.",
```

### src/routes/_authenticated/leads.manager.tsx (2 lines changed)
```diff
-  return v === null ? "—" : `${Math.round(v * 100)}%`;
+  return v === null ? "-" : `${Math.round(v * 100)}%`;
-                  ? "—"
+                  ? "Not set"
```

### src/routes/_authenticated/leads.new.tsx (3 lines changed)
```diff
-      toast.success("Lead captured — it is in your queue.");
+      toast.success("Lead captured: it is in your queue.");
-        description="Optional — Resolve will prompt for anything missing when it matters."
+        description="Optional: Resolve will prompt for anything missing when it matters."
-            Save now and keep the caller moving — stay dates, budget and requirements can be added
+            Save now and keep the caller moving. Stay dates, budget and requirements can be added
```

### src/routes/_authenticated/leads.tsx (2 lines changed)
```diff
-      { title: "Tenant leads — Resolve" },
+      { title: "Tenant leads: Resolve" },
-      { property: "og:title", content: "Tenant leads — Resolve" },
+      { property: "og:title", content: "Tenant leads: Resolve" },
```

### src/routes/_authenticated/onboarding.$propertyId.tsx (3 lines changed)
```diff
-      { title: "Property onboarding workflow — Resolve" },
+      { title: "Property onboarding workflow: Resolve" },
-      { property: "og:title", content: "Property onboarding workflow — Resolve" },
+      { property: "og:title", content: "Property onboarding workflow: Resolve" },
-              : `Required checks pass. The ${carryoverCount} remaining item(s) must be accepted as carryover work with an owner, a due date and a reason — carryover moves to Operations and no longer belongs to Onboarding.`}
+              : `Required checks pass. The ${carryoverCount} remaining item(s) must be accepted as carryover work with an owner, a due date and a reason. Carryover moves to Operations and no longer belongs to Onboarding.`}
```

### src/routes/_authenticated/onboarding.index.tsx (2 lines changed)
```diff
-      { title: "Onboarding Home — Resolve" },
+      { title: "Onboarding Home: Resolve" },
-      { property: "og:title", content: "Onboarding Home — Resolve" },
+      { property: "og:title", content: "Onboarding Home: Resolve" },
```

### src/routes/_authenticated/onboarding.my-work.tsx (2 lines changed)
```diff
-      { title: "My Tasks — Resolve" },
+      { title: "My Tasks: Resolve" },
-      { property: "og:title", content: "My Tasks — Resolve" },
+      { property: "og:title", content: "My Tasks: Resolve" },
```

### src/routes/_authenticated/onboarding.owner-completions.tsx (2 lines changed)
```diff
-      { title: "Owner completions to review — Resolve" },
+      { title: "Owner completions to review: Resolve" },
-      { property: "og:title", content: "Owner completions to review — Resolve" },
+      { property: "og:title", content: "Owner completions to review: Resolve" },
```

### src/routes/_authenticated/onboarding.team.tsx (3 lines changed)
```diff
-      { title: "Onboarding team — Resolve" },
+      { title: "Onboarding team: Resolve" },
-      { property: "og:title", content: "Onboarding team — Resolve" },
+      { property: "og:title", content: "Onboarding team: Resolve" },
-          placeholder="Unfilled — choose the Director"
+          placeholder="Unfilled: choose the Director"
```

### src/routes/_authenticated/onboarding.templates.tsx (2 lines changed)
```diff
-      { title: "Onboarding templates — Resolve" },
+      { title: "Onboarding templates: Resolve" },
-      { property: "og:title", content: "Onboarding templates — Resolve" },
+      { property: "og:title", content: "Onboarding templates: Resolve" },
```

### src/routes/_authenticated/onboarding.tsx (2 lines changed)
```diff
-      { title: "Onboarding workspace — Resolve" },
+      { title: "Onboarding workspace: Resolve" },
-      { property: "og:title", content: "Onboarding workspace — Resolve" },
+      { property: "og:title", content: "Onboarding workspace: Resolve" },
```

### src/routes/_authenticated/ops-analytics.tsx (6 lines changed)
```diff
-      { title: "Operations performance — Resolve" },
+      { title: "Operations performance: Resolve" },
-      { property: "og:title", content: "Operations performance — Resolve" },
+      { property: "og:title", content: "Operations performance: Resolve" },
-  if (mins === null) return "—";
+  if (mins === null) return "-";
-              value={data?.sla.responseRate == null ? "—" : `${data.sla.responseRate}%`}
+              value={data?.sla.responseRate == null ? "-" : `${data.sla.responseRate}%`}
-                      <span className="text-muted-foreground">—</span>
+                      <span className="text-muted-foreground">-</span>
-              hint="Drawn from the immutable activity log — a record of contribution and current load, not a ranking"
+              hint="Drawn from the immutable activity log. A record of contribution and current load, not a ranking"
```

### src/routes/_authenticated/oversight-access-log.tsx (3 lines changed)
```diff
-      { title: "Homeowner data access log — Resolve Operations" },
+      { title: "Homeowner data access log: Resolve Operations" },
-      { property: "og:title", content: "Homeowner data access log — Resolve Operations" },
+      { property: "og:title", content: "Homeowner data access log: Resolve Operations" },
-                  <TableCell className="text-muted-foreground">{row.targetLabel ?? "—"}</TableCell>
+                  <TableCell className="text-muted-foreground">{row.targetLabel ?? "Not set"}</TableCell>
```

### src/routes/_authenticated/oversight.tsx (11 lines changed)
```diff
-      { title: "Operations oversight — Resolve" },
+      { title: "Operations oversight: Resolve" },
-      { property: "og:title", content: "Operations oversight — Resolve" },
+      { property: "og:title", content: "Operations oversight: Resolve" },
-        content: "Exceptions first — what needs a supervisor right now.",
+        content: "Exceptions first: what needs a supervisor right now.",
-      title: "P1 not acknowledged",
+      title: "Right now not acknowledged",
-      title: "Past SLA — acknowledged but not started",
+      title: "Past SLA: acknowledged but not started",
-      description: "Ownership has not transferred — the original owner is still accountable.",
+      description: "Ownership has not transferred. The original owner is still accountable.",
-      title: "P1 / P2 aging",
+      title: "Right now and Today aging",
-        const key = pick(t) || "—";
+        const key = pick(t) || "Not set";
-                A request for a call, not a handoff — the raiser still owns the work until you take
+                A request for a call, not a handoff. The raiser still owns the work until you take
-        {rows.length === 0 && <li className="text-muted-foreground">—</li>}
+        {rows.length === 0 && <li className="text-muted-foreground">-</li>}
-        {title} — all clear
+        {title} · all clear
```

### src/routes/_authenticated/owner-analytics.tsx (3 lines changed)
```diff
-      { title: "Owner Participation — Resolve" },
+      { title: "Owner Participation: Resolve" },
-      { property: "og:title", content: "Owner Participation — Resolve" },
+      { property: "og:title", content: "Owner Participation: Resolve" },
-                            {r.hoursPerWeekNeeded ?? "—"}
+                            {r.hoursPerWeekNeeded ?? "-"}
```

### src/routes/_authenticated/owner-handoff-plan.tsx (2 lines changed)
```diff
-      { title: "After handoff plan — Resolve" },
+      { title: "After handoff plan: Resolve" },
-      { property: "og:title", content: "After handoff plan — Resolve" },
+      { property: "og:title", content: "After handoff plan: Resolve" },
```

### src/routes/_authenticated/owner-library.tsx (3 lines changed)
```diff
-      { title: "Optional Opportunity Library — Resolve" },
+      { title: "Optional Opportunity Library: Resolve" },
-      { property: "og:title", content: "Optional Opportunity Library — Resolve" },
+      { property: "og:title", content: "Optional Opportunity Library: Resolve" },
-        <div className="flex items-center gap-2"><Switch id="t-active" checked={d.active} onCheckedChange={(v) => set("active", v)} /><Label htmlFor="t-active">Active — homeowners can see and start it</Label></div>
+        <div className="flex items-center gap-2"><Switch id="t-active" checked={d.active} onCheckedChange={(v) => set("active", v)} /><Label htmlFor="t-active">Active: homeowners can see and start it</Label></div>
```

### src/routes/_authenticated/owner-oversight.tsx (3 lines changed)
```diff
-      { title: "Active Owner oversight — Resolve Operations" },
+      { title: "Active Owner oversight: Resolve Operations" },
-      { property: "og:title", content: "Active Owner oversight — Resolve Operations" },
+      { property: "og:title", content: "Active Owner oversight: Resolve Operations" },
-                        Enrolled {row.startedOn ? usDate(row.startedOn) : "—"}
+                        Enrolled {row.startedOn ? usDate(row.startedOn) : "Not set"}
```

### src/routes/_authenticated/owner-programs.tsx (12 lines changed)
```diff
-      { title: "Active Owner — Resolve" },
+      { title: "Active Owner: Resolve" },
-      { property: "og:title", content: "Active Owner — Resolve" },
+      { property: "og:title", content: "Active Owner: Resolve" },
-        content: "One owner, one program window (closing date → December 31), one combined participation record.",
+        content: "One owner, one program window (closing date to December 31), one combined participation record.",
-        To enroll a home, open it and choose Active Owner — setup links the homeowner and queues
+        To enroll a home, open it and choose Active Owner. Setup links the homeowner and queues
-        `ACTING AS LIVE OWNER — ${row.ownerName || "this homeowner"}\n\nChanges made here affect the homeowner's real program. This is not a sandbox. Responses, uploads and hours are real and may notify staff or the homeowner.\n\nContinue?
+        `ACTING AS LIVE OWNER: ${row.ownerName || "this homeowner"}\n\nChanges made here affect the homeowner's real program. This is not a sandbox. Responses, uploads and hours are real and may notify staff or the homeowner.\n\nContinue?`
-              ? "No participation opportunities available — needs staff setup"
+              ? "No participation opportunities available. Needs staff setup"
-          Every home shares the one program window (closing date → December 31) and the one combined hour goal. Properties are
+          Every home shares the one program window (closing date to December 31) and the one combined hour goal. Properties are
-          a reason — the original is never overwritten.
+          a reason. The original is never overwritten.
-                {usDate(h.created_at)} — {h.summary}
+                {usDate(h.created_at)} · {h.summary}
-      <span className={ok ? "text-emerald-600" : "text-muted-foreground"}>{ok ? "✓" : "○"}</span>
+      <span className={ok ? "text-emerald-600" : "text-muted-foreground"}>{ok ? "Done" : "Not yet"}</span>
-      description="The standard activity set every program is seeded from. Planning hours are an internal staffing estimate — they are never shown to a homeowner, so reported participation stays genuinely self-reported."
+      description="The standard activity set every program is seeded from. Planning hours are an internal staffing estimate. They are never shown to a homeowner, so reported participation stays genuinely self-reported."
-                      Internal plan {t.planning_hours_low}–{t.planning_hours_high} hrs · respond
+                      Internal plan {t.planning_hours_low} to {t.planning_hours_high} hrs · respond
```

### src/routes/_authenticated/owner.tsx (8 lines changed)
```diff
-      { title: "Your home — Resolve" },
+      { title: "Your home: Resolve" },
-        content: "Your participation, your homes, and what needs your attention — in one place.",
+        content: "Your participation, your homes, and what needs your attention, in one place.",
-      { property: "og:title", content: "Your home — Resolve Active Owner" },
+      { property: "og:title", content: "Your home: Resolve Active Owner" },
-          label: [`Logged ${Math.round((e.minutes / 60) * 100) / 100} hours — ${e.activity}`, loggedByLabel(attribution, e.owner_user_id)].filter(Boolean).join(" · "),
+          label: [`Logged ${Math.round((e.minutes / 60) * 100) / 100} hours: ${e.activity}`, loggedByLabel(attribution, e.owner_user_id)].filter(Boolean).join(" · "),
-        <StatusBadge tone="review">Preview only — staff view, read-only</StatusBadge>
+        <StatusBadge tone="review">Preview only: staff view, read-only</StatusBadge>
-                  <li>Progress toward more than 100 hours — not a tax qualification result.</li>
+                  <li>Progress toward more than 100 hours, not a tax qualification result.</li>
-  return text ? text.charAt(0).toUpperCase() + text.slice(1) : "—";
+  return text ? text.charAt(0).toUpperCase() + text.slice(1) : "Not set";
-      toast.success("Thanks — your response was recorded.");
+      toast.success("Thanks: your response was recorded.");
```

### src/routes/_authenticated/playbooks.tsx (4 lines changed)
```diff
-              : "No matching rule — this will never surface in context."
+              : "No matching rule: this will never surface in context."
-                    {f.why ? ` — ${f.why}` : ""}
+                    {f.why ? ` · ${f.why}` : ""}
-          No authored judgment yet — this carries steps only, so it will not show as guidance.
+          No authored judgment yet. This carries steps only, so it will not show as guidance.
-                {STATUS_LABELS[(h.from_status as PlaybookStatus) ?? "draft"]} →{" "}
+                {STATUS_LABELS[(h.from_status as PlaybookStatus) ?? "draft"]} to{" "}
```

### src/routes/_authenticated/quarterly.tsx (2 lines changed)
```diff
-      { title: "Quarterly reviews — Resolve Operations" },
+      { title: "Quarterly reviews: Resolve Operations" },
-      { property: "og:title", content: "Quarterly reviews — Resolve Operations" },
+      { property: "og:title", content: "Quarterly reviews: Resolve Operations" },
```

### src/routes/_authenticated/recovery.index.tsx (1 lines changed)
```diff
-  POLICY_VERSION,
-  approved_action_needed: "Approved — deliver it and record what was issued.",
+  approved_action_needed: "Approved: deliver it and record what was issued.",
-      <p className="text-xs text-muted-foreground">{POLICY_VERSION}</p>
```

### src/routes/_authenticated/recovery.manager.tsx (2 lines changed)
```diff
-  POLICY_VERSION,
-          description="More than one guest refund or credit on the same home — usually a property problem, not a guest problem."
+          description="More than one guest refund or credit on the same home, usually a property problem, not a guest problem."
-                {propertyNames.data?.get(r.property_id) ?? "Property"} — {r.count} refunds & credits
+                {propertyNames.data?.get(r.property_id) ?? "Property"} · {r.count} refunds & credits
-      <p className="text-xs text-muted-foreground">{POLICY_VERSION}</p>
```

### src/routes/_authenticated/recovery.tsx (2 lines changed)
```diff
-      { title: "Guest refunds & credits — Resolve" },
+      { title: "Guest refunds & credits: Resolve" },
-      { property: "og:title", content: "Guest refunds & credits — Resolve" },
+      { property: "og:title", content: "Guest refunds & credits: Resolve" },
```

### src/routes/_authenticated/routines.tsx (2 lines changed)
```diff
-      { title: "Routine work — Resolve Operations" },
+      { title: "Routine work: Resolve Operations" },
-      { property: "og:title", content: "Routine work — Resolve Operations" },
+      { property: "og:title", content: "Routine work: Resolve Operations" },
```

### src/routes/_authenticated/str-dispatch-check.tsx (5 lines changed)
```diff
-      { title: "Cleaner hours check — Resolve" },
+      { title: "Cleaner hours check: Resolve" },
-      { property: "og:title", content: "Cleaner hours check — Resolve" },
+      { property: "og:title", content: "Cleaner hours check: Resolve" },
-        description="Run this before assigning a cleaner to a clean at an enrolled STR home. It shows the cleaner's Attributed Cleaner Time against the safeguard limits. It is an operational safeguard only — not a tax determination."
+        description="Run this before assigning a cleaner to a clean at an enrolled STR home. It shows the cleaner's Attributed Cleaner Time against the safeguard limits. It is an operational safeguard only, not a tax determination."
-                <option value="">{tasks.length ? "Choose an upcoming clean…" : "No upcoming cleans found — enter below"}</option>
+                <option value="">{tasks.length ? "Choose an upcoming clean…" : "No upcoming cleans found. Enter below"}</option>
-          <p className="text-sm font-medium">Standard dispatch is locked{canOverride ? "." : " — a leadership review is required."}</p>
+          <p className="text-sm font-medium">Standard dispatch is locked{canOverride ? "." : "· a leadership review is required."}</p>
```

### src/routes/_authenticated/str-participation-report.tsx (6 lines changed)
```diff
-      { title: "STR Participation & Work Activity Report — Resolve" },
+      { title: "STR Participation & Work Activity Report: Resolve" },
-      { property: "og:title", content: "STR Participation & Work Activity Report — Resolve" },
+      { property: "og:title", content: "STR Participation & Work Activity Report: Resolve" },
-      <SectionCard title="Filters" description="Defaults to the Active Owner program period with all supported activity. A broader range is for internal review only — owner reports always use the finalized program period.">
+      <SectionCard title="Filters" description="Defaults to the Active Owner program period with all supported activity. A broader range is for internal review only. Owner reports always use the finalized program period.">
-          banner={r.draft ? DRAFT_LABEL : outsideProgram ? "INTERNAL REVIEW RANGE — not an owner-facing final report" : "Internal preview of a completed program — owners see only released versions below"}
+          banner={r.draft ? DRAFT_LABEL : outsideProgram ? "INTERNAL REVIEW RANGE: not an owner-facing final report" : "Internal preview of a completed program. Owners see only released versions below"}
-        {internal ? <p className={ok ? "text-xs text-muted-foreground" : "text-xs font-semibold text-destructive"}>{ok ? "Summary totals reconcile exactly to the appendix records." : "Summary does not reconcile to the appendix — do not rel
+        {internal ? <p className={ok ? "text-xs text-muted-foreground" : "text-xs font-semibold text-destructive"}>{ok ? "Summary totals reconcile exactly to the appendix records." : "Summary does not reconcile to the appendix. Do not rele
-                    <td>{x.minutes == null ? "—" : `${hrs(x.minutes)?.toFixed(2)} h`}</td>
+                    <td>{x.minutes == null ? "-" : `${hrs(x.minutes)?.toFixed(2)} h`}</td>
```

### src/routes/_authenticated/supervisor-check.tsx (2 lines changed)
```diff
-      { title: "Supervisor check — Resolve" },
+      { title: "Supervisor check: Resolve" },
-      { property: "og:title", content: "Supervisor check — Resolve" },
+      { property: "og:title", content: "Supervisor check: Resolve" },
```

### src/routes/_authenticated/team-queue.tsx (8 lines changed)
```diff
+  priorityMeta,
-                        <StatusBadge tone={ticketTone(job.status)}>{job.priority.toUpperCase()}</StatusBadge></div>
+                        <StatusBadge tone={ticketTone(job.status)}>{priorityMeta(job.priority).short}</StatusBadge></div>
-                <strong>Work Order · {ticket.title}</strong><p className="text-xs text-muted-foreground">{formatPropertyLabel(ticket.properties).primary} · {effectiveOperationsPriority(ticket).toUpperCase()}</p>
+                <strong>Work Order · {ticket.title}</strong><p className="text-xs text-muted-foreground">{formatPropertyLabel(ticket.properties).primary} · {priorityMeta(effectiveOperationsPriority(ticket)).short}</p>
-                <strong>#{ticket.ref} {ticket.title}</strong><p className="text-xs text-muted-foreground">{formatPropertyLabel(ticket.properties).primary} · {effectiveOperationsPriority(ticket).toUpperCase()}</p>
+                <strong>#{ticket.ref} {ticket.title}</strong><p className="text-xs text-muted-foreground">{formatPropertyLabel(ticket.properties).primary} · {priorityMeta(effectiveOperationsPriority(ticket)).short}</p>
-                      <span className="font-semibold">WO · {effectiveOperationsPriority(item).toUpperCase()}</span> {item.title}
+                      <span className="font-semibold">WO · {priorityMeta(effectiveOperationsPriority(item)).short}</span> {item.title}
-                      <span className="font-semibold">#{item.ref} · {effectiveOperationsPriority(item).toUpperCase()}</span> {item.title}
+                      <span className="font-semibold">#{item.ref} · {priorityMeta(effectiveOperationsPriority(item)).short}</span> {item.title}
-                    <strong>Work Order · {ticket.title}</strong><p className="text-xs text-muted-foreground">{formatPropertyLabel(ticket.properties).primary} · {effectiveOperationsPriority(ticket).toUpperCase()}</p>
+                    <strong>Work Order · {ticket.title}</strong><p className="text-xs text-muted-foreground">{formatPropertyLabel(ticket.properties).primary} · {priorityMeta(effectiveOperationsPriority(ticket)).short}</p>
-                    <strong>#{ticket.ref} {ticket.title}</strong><p className="text-xs text-muted-foreground">{formatPropertyLabel(ticket.properties).primary} · {effectiveOperationsPriority(ticket).toUpperCase()}</p>
+                    <strong>#{ticket.ref} {ticket.title}</strong><p className="text-xs text-muted-foreground">{formatPropertyLabel(ticket.properties).primary} · {priorityMeta(effectiveOperationsPriority(ticket)).short}</p>
```

### src/routes/_authenticated/ticket-checklists.tsx (2 lines changed)
```diff
+import { priorityMeta } from "@/lib/tickets";
-            {draft.priority && <p className="text-sm text-muted-foreground">Starting priority: {draft.priority.activeGuest.toUpperCase()} with a guest in the home or arriving within 48 hours, otherwise {draft.priority.otherwise.toUpperCase
+            {draft.priority && <p className="text-sm text-muted-foreground">Starting urgency: {priorityMeta(draft.priority.activeGuest).short} with a guest in the home or arriving within 48 hours, otherwise {priorityMeta(draft.priority.oth
```

### src/routes/_authenticated/tickets.$ticketId.tsx (76 lines changed)
```diff
+import { TICKET_UNAVAILABLE, ticketAvailability } from "@/lib/ticket-availability";
-      { title: "Ticket detail — Resolve Operations" },
+      { title: "Ticket detail: Resolve Operations" },
-      { property: "og:title", content: "Ticket detail — Resolve Operations" },
+      { property: "og:title", content: "Ticket detail: Resolve Operations" },
-  notFoundComponent: () => <p className="text-muted-foreground">Ticket not found.</p>,
+  notFoundComponent: () => <p className="text-muted-foreground">{TICKET_UNAVAILABLE}</p>,
-  const { data, isLoading } = useQuery({
+  const { data, isLoading, isError } = useQuery({
+  // A link to a ticket that is not there under this lens: is it under the other lens
+  // (demo versus real), or removed? Removed shows a plain message, never an error.
+  const notHere = !isLoading && (isError || Boolean(data && !data.ticket));
+  const { data: otherLens, isLoading: otherLensLoading } = useQuery({
+    queryKey: ["ticket-other-lens", ticketId, demoMode],
+    enabled: notHere && !isError,
+    queryFn: async () => {
+      const r = await supabase.from("tickets").select("id, is_demo").eq("id", ticketId).maybeSingle();
+      return Boolean(r.data && Boolean(r.data.is_demo) !== demoMode);
+    },
+  });
+  const availability = ticketAvailability({
+    found: Boolean(data?.ticket) && !isError,
+    foundInOtherLens: otherLens === true,
+    archived: Boolean((data?.ticket as { archived_at?: string | null } | null | undefined)?.archived_at),
+    canRestore: canRestoreTicket(role),
+  });
+    // A removed ticket shows its plain message instead (no toast, no redirect).
+    if (!data.ticket && (otherLensLoading || otherLens !== true)) return;
-        ? "That ticket isn't a demo record — it isn't available here."
+        ? "That ticket isn't a demo record. It isn't available here."
-  }, [onClose, demoReady, isLoading, data, demoMode, demoMismatch, navigate]);
+  }, [onClose, demoReady, isLoading, data, demoMode, demoMismatch, navigate, otherLens, otherLensLoading]);
+
+  if (availability === "unavailable" && !(notHere && !isError && otherLensLoading))
+    return (
+      <div className="mx-auto max-w-md space-y-4 rounded-lg border border-border p-8 text-center" data-testid="ticket-unavailable">
+        <p className="font-display text-lg font-semibold">{TICKET_UNAVAILABLE}</p>
+        {onClose ? (
+          <Button type="button" variant="outline" className="min-h-11" onClick={onClose}>
+            Close
+          </Button>
+        ) : (
+          <Button asChild variant="outline" className="min-h-11">
+            <Link to="/tickets">Back to tickets</Link>
+          </Button>
+        )}
+      </div>
+    );
-    text: [ticket.title, ticket.description].filter(Boolean).join(" — "),
+    text: [ticket.title, ticket.description].filter(Boolean).join(" · "),
-              ? `Upload the photo or file this work needs${qualifyingFiles > 0 ? "" : " — nothing is attached yet"}.`
+              ? `Upload the photo or file this work needs${qualifyingFiles > 0 ? "" : "· nothing is attached yet"}.`
-      toast.error("The review time has to be in the future — that is when this comes back to you.");
+      toast.error("The review time has to be in the future. That is when this comes back to you.");
-      `Waiting on ${labelFor(WAITING_ON, waitOn)}: ${waitReason.trim()} — review ${usDateTime(waitReview)}`,
+      `Waiting on ${labelFor(WAITING_ON, waitOn)}: ${waitReason.trim()} · review ${usDateTime(waitReview)}`,
-    await log("waiting", "No longer waiting — back in progress.", "waiting_cleared");
+    await log("waiting", "No longer waiting: back in progress.", "waiting_cleared");
-      toast.error("Add a resolution summary — what was wrong and what was done.");
+      toast.error("Add a resolution summary. What was wrong and what was done.");
-          ? "Attach the photo or file this work requires — a description is not enough."
+          ? "Attach the photo or file this work requires. A description is not enough."
-        ? `Resolved as ${labelFor(OUTCOME_TYPES, outcome)} — closure review is next. ${summary}`
-        : `Resolved and closed as ${labelFor(OUTCOME_TYPES, outcome)} — no review required. ${summary}`,
+        ? `Resolved as ${labelFor(OUTCOME_TYPES, outcome)}. Closure review is next. ${summary}`
+        : `Resolved and closed as ${labelFor(OUTCOME_TYPES, outcome)}. No review required. ${summary}`,
-        ? "Resolved — it moves to closure review before it is closed."
-        : "Closed — no review is required for this ticket.",
+        ? "Resolved: it moves to closure review before it is closed."
+        : "Closed: no review is required for this ticket.",
-    await log("reopened", "Reopened — the issue was not fully resolved.", "reopened");
+    await log("reopened", "Reopened: the issue was not fully resolved.", "reopened");
-    toast.success("Recorded — the guest confirmed it.");
+    toast.success("Recorded: the guest confirmed it.");
-      "Guest says the repair did not fix the issue — reopened for a new Work Order.",
+      "Guest says the repair did not fix the issue. Reopened for a new Work Order.",
-    toast.success("Reopened — open a new Work Order when ready.");
+    toast.success("Reopened: open a new Work Order when ready.");
-  const resolveActionLabel = willNeedFinalReview ? "Resolve — send for review" : "Close ticket";
+  const resolveActionLabel = willNeedFinalReview ? "Resolve: send for review" : "Close ticket";
-      ? "Resolved — waiting on closure review."
+      ? "Resolved: waiting on closure review."
-        ? "Field team has it — watch for completion, then verify."
+        ? "Field team has it. Watch for completion, then verify."
-          ? "Repair reported complete — confirm with the guest."
+          ? "Repair reported complete: confirm with the guest."
-                ? "Guest says it's not fixed — open a new Work Order."
+                ? "Guest says it's not fixed. Open a new Work Order."
-                  ? "Everything required is satisfied — ready to close."
+                  ? "Everything required is satisfied. Ready to close."
-            text: [ticket.title, ticket.description].filter(Boolean).join(" — "),
+            text: [ticket.title, ticket.description].filter(Boolean).join(" · "),
-                  `P1 escalated to ${sla.escalation.who} — ${sla.escalation.minutes} minutes with no action started.`,
+                  `Right now ticket escalated to ${sla.escalation.who} · ${sla.escalation.minutes} minutes with no action started.`,
-              ? [`Already escalated — ${sla.escalation.who} owns the next check-in.`]
+              ? [`Already escalated: ${sla.escalation.who} owns the next check-in.`]
-                  A photo or file is required here — a written description on its own will not close
+                  A photo or file is required here. A written description on its own will not close
-              <p className="font-medium text-danger">P1 escalated — {sla.escalation.who}</p>
+              <p className="font-medium text-danger">Right now ticket escalated: {sla.escalation.who}</p>
-                    Opening a Work Order is how Resolve tracks the repair — cost, approval and
+                    Opening a Work Order is how Resolve tracks the repair. Cost, approval and
-                    No repair needed — finish this ticket
+                    No repair needed: finish this ticket
-                      <span className="text-muted-foreground">
-                        — {activityAuthorLabel(a as { external_author_name?: string | null; author?: { full_name?: string | null; email?: string | null } | null })}
+                      <span className="text-muted-foreground"> · {activityAuthorLabel(a as { external_author_name?: string | null; author?: { full_name?: string | null; email?: string | null } | null })}
-                    {insuranceRiskLabel(ticket.insurance_risk)} — supervisor visibility
+                    {insuranceRiskLabel(ticket.insurance_risk)} · supervisor visibility
-                    .join(", ") || "—"
+                    .join(", ") || "None"
-                  {ticket.vendor_name ?? "—"}
+                  {ticket.vendor_name ?? "Not set"}
-                      "An upload is required for the current step — add it in Current Work so Resolve credits the requirement.",
+                      "An upload is required for the current step. Add it in Current Work so Resolve credits the requirement.",
-              Guest, homeowner or vendor — from the shared inbox, with the details filled in.
+              Guest, homeowner or vendor, from the shared inbox, with the details filled in.
```

### src/routes/_authenticated/tickets.index.tsx (4 lines changed)
```diff
-      { title: "My Work — Resolve" },
+      { title: "My Work: Resolve" },
-      { property: "og:title", content: "My Work — Resolve" },
+      { property: "og:title", content: "My Work: Resolve" },
-              ? "Nothing is assigned to you right now — check the team queue for unassigned work."
+              ? "Nothing is assigned to you right now. Check the team queue for unassigned work."
-    priority !== "all" ? priority.toUpperCase() : null,
+    priority !== "all" ? priorityMeta(priority).short : null,
```

### src/routes/_authenticated/tickets.new.tsx (1 lines changed)
```diff
-        <span className="whitespace-nowrap font-semibold text-primary">Ask the Coach →</span>
+        <span className="whitespace-nowrap font-semibold text-primary">Ask the Coach</span>
```

### src/routes/_authenticated/vendor.$ticketId.tsx (6 lines changed)
```diff
+import { priorityMeta } from "@/lib/tickets";
-      toast.success("Thanks — the team can see you're on it.");
+      toast.success("Thanks: the team can see you're on it.");
-      toast.success("Marked complete — a coordinator will review and close it out.");
+      toast.success("Marked complete: a coordinator will review and close it out.");
-              {(ticket.priority ?? "").toUpperCase()}
+              {ticket.priority ? priorityMeta(ticket.priority).short : ""}
-              No extra detail was added — call your coordinator if unclear.
+              No extra detail was added. Call your coordinator if unclear.
-        description="Anything you find that we didn't ask about — tell us here rather than leaving it."
+        description="Anything you find that we didn't ask about. Tell us here rather than leaving it."
```

### src/routes/_authenticated/vendor.index.tsx (3 lines changed)
```diff
+import { priorityMeta } from "@/lib/tickets";
-    return "Past due — accept the job and head over.";
+    return "Past due: accept the job and head over.";
-                      {(job.priority ?? "").toUpperCase()}
+                      {job.priority ? priorityMeta(job.priority).short : ""}
```

### src/routes/_authenticated/vendor.scorecard.tsx (7 lines changed)
```diff
-        description="Private to you. We never show your scores to other vendors, and you never see theirs — the ranking below is anonymous."
+        description="Private to you. We never show your scores to other vendors, and you never see theirs. The ranking below is anonymous."
-              value={s.averageOverall !== null ? `${s.averageOverall.toFixed(1)}/5` : "—"}
+              value={s.averageOverall !== null ? `${s.averageOverall.toFixed(1)}/5` : "-"}
-                average and you're Gold Standard — first call on urgent work.
+                average and you're Gold Standard. First call on urgent work.
-          value={s.photoRate !== null ? `${s.photoRate}%` : "—"}
+          value={s.photoRate !== null ? `${s.photoRate}%` : "-"}
-          value={s.onTimeRate !== null ? `${s.onTimeRate}%` : "—"}
+          value={s.onTimeRate !== null ? `${s.onTimeRate}%` : "-"}
-        description="Thoroughness is worth the most — finish the job, don't just stop the leak."
+        description="Thoroughness is worth the most. Finish the job, don't just stop the leak."
-            urgent P1 work.
+            urgent Right now work.
```

### src/routes/_authenticated/vendors.$vendorId.tsx (4 lines changed)
```diff
-      { title: "Vendor profile — Resolve Operations" },
+      { title: "Vendor profile: Resolve Operations" },
-      { property: "og:title", content: "Vendor profile — Resolve Operations" },
+      { property: "og:title", content: "Vendor profile: Resolve Operations" },
-        {v.emergency_only && <StatusBadge tone="escalated">Emergency Only — not routine coverage</StatusBadge>}
+        {v.emergency_only && <StatusBadge tone="escalated">Emergency Only: not routine coverage</StatusBadge>}
-      <dd className="break-words">{v || "—"}</dd>
+      <dd className="break-words">{v || "Not set"}</dd>
```

### src/routes/_authenticated/vendors.index.tsx (2 lines changed)
```diff
-      { title: "Vendors — Resolve Operations" },
+      { title: "Vendors: Resolve Operations" },
-      { property: "og:title", content: "Vendors — Resolve Operations" },
+      { property: "og:title", content: "Vendors: Resolve Operations" },
```

### src/routes/_authenticated/welcome.tsx (3 lines changed)
```diff
-    body: "Each work type carries required steps — test every smoke and CO device, replace anything removed, photograph the wall — and the ticket cannot close until they are done.",
+    body: "Each work type carries required steps. Test every smoke and CO device, replace anything removed, photograph the wall, and the ticket cannot close until they are done.",
-            <p className="font-medium">Resolve executive walkthrough — 1:05</p>
+            <p className="font-medium">Resolve executive walkthrough: 1:05</p>
-                <Link to={b.to}>{b.cta} →</Link>
+                <Link to={b.to}>{b.cta}</Link>
```

### src/routes/_authenticated/work-orders.calendar.tsx (2 lines changed)
```diff
-        description="Everything committed to a date — planned schedules and confirmed vendor arrivals — with double bookings flagged where they happen."
+        description="Everything committed to a date. Planned schedules and confirmed vendor arrivals, with double bookings flagged where they happen."
-      title={`${propertyName} — ${entry.workOrder.title}`}
+      title={`${propertyName} · ${entry.workOrder.title}`}
```

### src/routes/_authenticated/work-orders.index.tsx (2 lines changed)
```diff
-  evidence_missing: "Work is done but the record is not — photos, report or invoice.",
+  evidence_missing: "Work is done but the record is not. Photos, report or invoice.",
-        description="Today's queue — maintenance execution, ordered by what is still unresolved. Work Orders start on the ticket where the issue was reported."
+        description="Today's queue: maintenance execution, ordered by what is still unresolved. Work Orders start on the ticket where the issue was reported."
```

### src/routes/_authenticated/work-orders.manager.tsx (2 lines changed)
```diff
-          description="More than one Work Order on the same home in 90 days — usually a property problem, not a one-off."
+          description="More than one Work Order on the same home in 90 days, usually a property problem, not a one-off."
-                {propertyNames.data?.get(r.property_id) ?? "Property"} — {r.count} Work Orders
+                {propertyNames.data?.get(r.property_id) ?? "Property"} · {r.count} Work Orders
```

### src/routes/_authenticated/work-orders.tsx (2 lines changed)
```diff
-      { title: "Work Orders — Resolve" },
+      { title: "Work Orders: Resolve" },
-      { property: "og:title", content: "Work Orders — Resolve" },
+      { property: "og:title", content: "Work Orders: Resolve" },
```

### src/routes/auth.tsx (2 lines changed)
```diff
-      { title: "Sign in — Resolve" },
+      { title: "Sign in: Resolve" },
-      { property: "og:title", content: "Sign in — Resolve" },
+      { property: "og:title", content: "Sign in: Resolve" },
```

### src/routes/awaiting-access.tsx (2 lines changed)
```diff
-      { title: "Awaiting access — Resolve" },
+      { title: "Awaiting access: Resolve" },
-      { property: "og:title", content: "Awaiting access — Resolve" },
+      { property: "og:title", content: "Awaiting access: Resolve" },
```

### src/routes/guest-feedback.$token.tsx (3 lines changed)
```diff
-      { title: "Guest survey — A Real Home Away" },
+      { title: "Guest survey: A Real Home Away" },
-      { property: "og:title", content: "Guest survey — A Real Home Away" },
+      { property: "og:title", content: "Guest survey: A Real Home Away" },
-          {s.arrival ? ` · ${formatDate(s.arrival)} – ${formatDate(s.departure)}` : ` · checked out ${formatDate(s.departure)}`}
+          {s.arrival ? ` · ${formatDate(s.arrival)} to ${formatDate(s.departure)}` : ` · checked out ${formatDate(s.departure)}`}
```

### src/routes/guest-feedback.index.tsx (2 lines changed)
```diff
-      { title: "How was your stay? — A Real Home Away" },
+      { title: "How was your stay? A Real Home Away" },
-      { property: "og:title", content: "How was your stay? — A Real Home Away" },
+      { property: "og:title", content: "How was your stay? A Real Home Away" },
```

### src/routes/index.tsx (4 lines changed)
```diff
-const TITLE = "Resolve — ARHA's Central Operating Hub";
+const TITLE = "Resolve: ARHA's Central Operating Hub";
-  "Keep Calm. Check Resolve. Tickets, properties, approvals and answers for the A Real Home Away team — finally in one place.";
+  "Keep Calm. Check Resolve. Tickets, properties, approvals and answers for the A Real Home Away team. Finally in one place.";
-    body: "Work moves between onboarding, operations, vendors and homeowners through recorded handoffs — the original owner stays responsible until the receiving side accepts.",
+    body: "Work moves between onboarding, operations, vendors and homeowners through recorded handoffs. The original owner stays responsible until the receiving side accepts.",
-            quarterly reviews accumulate on the same home — so anyone picking it up tomorrow can see
+            quarterly reviews accumulate on the same home, so anyone picking it up tomorrow can see
```

### src/routes/reset-password.tsx (2 lines changed)
```diff
-      { title: "Choose a new password — Resolve" },
+      { title: "Choose a new password: Resolve" },
-      { property: "og:title", content: "Choose a new password — Resolve" },
+      { property: "og:title", content: "Choose a new password: Resolve" },
```
