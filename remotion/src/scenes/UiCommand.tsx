import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { C } from "../theme";
import { Callout, Caption, CountUp, useEnter } from "../components/Ui";
import { Meter, PortalScreen, Stat } from "../components/Portal";

const NAV = ["Command Center", "Analytics", "Operations", "Vendors", "Owners", "Audit"];

const breakdown = [
  { l: "Response standard met", v: 94, w: "30%" },
  { l: "Vendor compliance current", v: 81, w: "25%" },
  { l: "Owner program on track", v: 88, w: "20%" },
  { l: "Onboarding to handoff", v: 72, w: "15%" },
  { l: "Data quality (addresses, markets)", v: 97, w: "10%" },
];

export const UiCommand: React.FC = () => {
  const frame = useCurrentFrame();
  const e = useEnter(16);

  return (
    <AbsoluteFill>
      <PortalScreen workspace="Executive" accent={C.gold} nav={NAV} active="Command Center">
        <div style={{ fontSize: 32, fontWeight: 700 }}>Company health</div>
        <div style={{ fontSize: 17, color: C.slate, marginTop: 4 }}>
          Every score opens to show the matters behind it. No number in Resolve is unexplainable.
        </div>

        <div style={{ display: "flex", gap: 18, marginTop: 20 }}>
          <div
            style={{
              width: 330,
              background: "#fff",
              border: `1px solid ${C.gold}66`,
              borderRadius: 12,
              padding: 22,
              opacity: e,
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 15, color: C.slate, letterSpacing: 2 }}>HEALTH SCORE</div>
            <div style={{ fontSize: 96, fontWeight: 700, color: C.gold, lineHeight: 1.1 }}>
              <CountUp to={87} delay={18} color={C.gold} />
            </div>
            <div style={{ fontSize: 18, color: C.slate }}>up 6 points this month</div>
            <Meter value={87} from={20} to={70} color={C.gold} height={14} style={{ marginTop: 14 }} />
          </div>

          <div style={{ flex: 1, background: "#fff", border: "1px solid #E2DED4", borderRadius: 12, padding: 20, opacity: e }}>
            <div style={{ fontSize: 15, color: C.slate, letterSpacing: 2 }}>WHAT MAKES UP THE SCORE</div>
            <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
              {breakdown.map((b, i) => (
                <div key={b.l}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 18 }}>
                    <span>
                      {b.l} <span style={{ color: C.slate }}>· weight {b.w}</span>
                    </span>
                    <span style={{ fontWeight: 700 }}>{b.v}</span>
                  </div>
                  <Meter
                    value={b.v}
                    from={30 + i * 10}
                    to={70 + i * 10}
                    color={b.v >= 85 ? C.teal : b.v >= 75 ? C.gold : C.orange}
                    height={10}
                    style={{ marginTop: 5 }}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 16, marginTop: 18 }}>
          <Stat label="Open matters" value={<CountUp to={41} delay={90} />} note="6 at P1" delay={80} />
          <Stat label="Vendors compliant" value="112 / 138" note="26 expiring insurance" delay={88} color={C.orange} />
          <Stat label="Homes onboarding" value="9" note="3 awaiting handoff acceptance" delay={96} />
          <Stat label="Owners in program" value="14" note="avg day 38 of 90" delay={104} />
        </div>
      </PortalScreen>

      <Callout
        text="Executives never ask for a status report. The report is the app."
        x={140}
        y={780}
        delay={140}
        width={430}
        color={C.gold}
      />
      <Caption kicker="Command Center" text="One score for the company — and the click-through that proves it." />
      <AbsoluteFill
        style={{
          opacity: interpolate(frame, [0, 12], [1, 0], { extrapolateRight: "clamp" }),
          background: C.ink,
          pointerEvents: "none",
        }}
      />
    </AbsoluteFill>
  );
};
