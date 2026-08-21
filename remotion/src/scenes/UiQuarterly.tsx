import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { C } from "../theme";
import { Callout, Caption, Pill, useEnter } from "../components/Ui";
import { PortalScreen, Stat } from "../components/Portal";

const NAV = ["Dashboard", "Matters", "Properties", "Quarterly", "Playbooks"];

const rows = [
  { home: "4412 S Gary Ave", market: "Tulsa", mgr: "Marisol R.", due: "Sep 04", state: "Due in 14 days", tone: C.slate },
  { home: "1207 NW 32nd St", market: "OKC", mgr: "Dana P.", due: "Aug 12", state: "Overdue 9 days", tone: C.orange },
  { home: "612 Carlton Landing", market: "Carlton", mgr: "Unassigned", due: "Oct 22", state: "Scheduled", tone: C.teal },
  { home: "8840 Fall Creek Rd", market: "Indy", mgr: "Terrence K.", due: "Sep 19", state: "Scheduled", tone: C.teal },
];

export const UiQuarterly: React.FC = () => {
  const frame = useCurrentFrame();
  const e = useEnter(14);

  return (
    <AbsoluteFill>
      <PortalScreen workspace="Operations" nav={NAV} active="Quarterly">
        <div style={{ fontSize: 32, fontWeight: 700 }}>Quarterly property inspections</div>
        <div style={{ fontSize: 17, color: C.slate, marginTop: 4 }}>
          First inspection 30 days after handoff. Every one after that, exactly 90 days later — scheduled by the
          system, not by a person's calendar.
        </div>

        <div style={{ display: "flex", gap: 16, marginTop: 20 }}>
          <Stat label="Overdue" value="25" note="escalated to supervisors" delay={10} color={C.orange} />
          <Stat label="Due in 30 days" value="53" note="tickets open automatically" delay={18} />
          <Stat label="Markets covered" value="6" note="Tulsa · OKC · Indy · Fort Worth · Carlton · Houston" delay={26} />
        </div>

        <div style={{ marginTop: 20, background: "#fff", border: "1px solid #E2DED4", borderRadius: 12, overflow: "hidden", opacity: e }}>
          <div style={{ display: "flex", padding: "12px 18px", background: "#F1EEE6", fontSize: 15, color: C.slate, letterSpacing: 1 }}>
            <div style={{ flex: 2 }}>HOME</div>
            <div style={{ flex: 1 }}>MARKET</div>
            <div style={{ flex: 1.3 }}>REGIONAL CLEANING MANAGER</div>
            <div style={{ flex: 1 }}>NEXT INSPECTION</div>
            <div style={{ flex: 1.1 }}>STATUS</div>
          </div>
          {rows.map((r, i) => {
            const o = interpolate(frame, [24 + i * 12, 44 + i * 12], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            return (
              <div
                key={r.home}
                style={{
                  display: "flex",
                  alignItems: "center",
                  padding: "14px 18px",
                  borderTop: "1px solid #EDE9DF",
                  fontSize: 19,
                  opacity: o,
                  transform: `translateX(${(1 - o) * 16}px)`,
                }}
              >
                <div style={{ flex: 2, fontWeight: 700 }}>{r.home}</div>
                <div style={{ flex: 1 }}>{r.market}</div>
                <div style={{ flex: 1.3, color: r.mgr === "Unassigned" ? C.orange : C.charcoal }}>{r.mgr}</div>
                <div style={{ flex: 1 }}>{r.due}</div>
                <div style={{ flex: 1.1 }}>
                  <Pill label={r.state} bg={r.tone} />
                </div>
              </div>
            );
          })}
        </div>
      </PortalScreen>

      <Callout
        text="The 23-step cleaning checklist rides on the ticket. Completing it rolls the next date 90 days forward."
        x={1140}
        y={760}
        delay={110}
        width={480}
      />
      <Caption kicker="Quarterly" text="Inspections schedule and assign themselves by market." />
    </AbsoluteFill>
  );
};
