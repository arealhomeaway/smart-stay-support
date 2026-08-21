import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { C } from "../theme";
import { Callout, Caption, CheckRow, Pill, Typed, useEnter } from "../components/Ui";
import { Meter, PortalScreen, Stat } from "../components/Portal";

const NAV = ["My program", "Tasks", "Time log", "Report"];

export const UiOwner: React.FC = () => {
  const frame = useCurrentFrame();
  const e = useEnter(16);
  const saved = frame > 190;

  return (
    <AbsoluteFill>
      <PortalScreen workspace="Homeowner" accent={C.deepTeal} nav={NAV} active="My program" action="Log my time">
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ fontSize: 32, fontWeight: 700 }}>90-day participation program</div>
          <Pill label="Day 47 of 90" bg={C.deepTeal} />
        </div>
        <div style={{ fontSize: 17, color: C.slate, marginTop: 4 }}>
          Run with DFY for the short-term-rental tax position. Owners do the work; Resolve keeps the record.
        </div>

        <div style={{ display: "flex", gap: 16, marginTop: 20 }}>
          <Stat label="Hours you have logged" value="63.5" note="entered by you, never prefilled" delay={12} color={C.deepTeal} />
          <Stat label="Qualifying activities" value="18" note="across 2 homes" delay={20} />
          <Stat label="Tasks waiting on you" value="3" note="1 marked urgent" delay={28} color={C.orange} />
        </div>

        <div style={{ display: "flex", gap: 18, marginTop: 20 }}>
          <div style={{ flex: 1.1, background: "#fff", border: "1px solid #E2DED4", borderRadius: 12, padding: 20, opacity: e }}>
            <div style={{ fontSize: 15, color: C.slate, letterSpacing: 2 }}>LOG PARTICIPATION</div>
            <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, color: C.slate, marginBottom: 6 }}>Activity</div>
                <div style={{ border: "1px solid #DAD5C9", borderRadius: 9, background: "#fff", padding: "11px 13px", fontSize: 18 }}>
                  <Typed text="Approved vendor quote & met handyman on site" from={70} per={1.4} />
                </div>
              </div>
              <div style={{ width: 170 }}>
                <div style={{ fontSize: 14, color: C.slate, marginBottom: 6 }}>Hours</div>
                <div style={{ border: "1px solid #DAD5C9", borderRadius: 9, background: "#fff", padding: "11px 13px", fontSize: 18 }}>
                  <Typed text="2.5" from={150} per={4} />
                </div>
              </div>
            </div>
            <div
              style={{
                marginTop: 16,
                padding: "12px 22px",
                borderRadius: 9,
                display: "inline-block",
                background: saved ? `${C.teal}22` : C.deepTeal,
                color: saved ? C.deepTeal : "#fff",
                border: saved ? `1px solid ${C.teal}` : "none",
                fontWeight: 700,
                fontSize: 19,
              }}
            >
              {saved ? "✓ Saved to your compliance log" : "Save entry"}
            </div>
            <div style={{ fontSize: 16, color: C.slate, marginTop: 14, lineHeight: 1.4 }}>
              Resolve never estimates or prefills an owner's time. Every minute in the report was typed by the owner.
            </div>
          </div>

          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, color: C.slate, letterSpacing: 2, marginBottom: 8 }}>TASKS SENT TO YOU</div>
            <div style={{ display: "grid", gap: 10 }}>
              <CheckRow label="Approve $340 water-heater quote" hint="Texted & emailed — P1" tickAt={120} delay={24} />
              <CheckRow label="Review Q3 inspection photos" hint="Emailed" tickAt={0} delay={32} />
              <CheckRow label="Confirm October owner-stay dates" delay={40} />
            </div>
            <div style={{ marginTop: 16, fontSize: 15, color: C.slate, letterSpacing: 2 }}>PROGRAM PROGRESS</div>
            <Meter value={52} from={40} to={90} color={C.deepTeal} height={16} style={{ marginTop: 8 }} />
            <div
              style={{
                fontSize: 17,
                color: C.slate,
                marginTop: 8,
                opacity: interpolate(frame, [95, 120], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
              }}
            >
              At day 90 the owner downloads a dated participation report — no reconstruction from memory.
            </div>
          </div>
        </div>
      </PortalScreen>

      <Caption kicker="Owner portal" text="Owners participate; the evidence builds itself as they go." />
      <Callout
        text="P1 items reach owners by push, email and text — coordinators stop chasing approvals."
        x={1160}
        y={775}
        delay={210}
        width={460}
        color={C.deepTeal}
      />
    </AbsoluteFill>
  );
};
