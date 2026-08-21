import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { C } from "../theme";
import { Callout, Caption, CountUp, Pill, useEnter } from "../components/Ui";
import { Meter, PortalScreen, Stat } from "../components/Portal";

const NAV = ["My jobs", "Map", "Schedule", "Documents", "Scorecard"];

const criteria = [
  { l: "On-time arrival", v: 92, delay: 40 },
  { l: "Evidence complete on first try", v: 88, delay: 55 },
  { l: "Guest-ready quality (supervisor rating)", v: 96, delay: 70 },
  { l: "No callbacks / re-opens", v: 78, delay: 85 },
];

export const UiVendorScore: React.FC = () => {
  const frame = useCurrentFrame();
  const e = useEnter(20);
  const gold = frame > 170;

  return (
    <AbsoluteFill>
      <PortalScreen workspace="Vendor" accent={C.orange} nav={NAV} active="Scorecard">
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ fontSize: 32, fontWeight: 700 }}>Your scorecard</div>
          <Pill label={gold ? "Gold Standard" : "Preferred"} bg={gold ? C.gold : C.slate} />
        </div>
        <div style={{ fontSize: 17, color: C.slate, marginTop: 4 }}>
          Private to you. Vendors never see each other's names or a public leaderboard.
        </div>

        <div style={{ display: "flex", gap: 16, marginTop: 20 }}>
          <Stat label="Points this quarter" value={<CountUp to={1480} delay={20} color={C.gold} />} note="+120 from last job" delay={14} />
          <Stat label="Jobs scored" value={<CountUp to={34} delay={26} />} note="4.7 / 5 average" delay={22} />
          <Stat
            label="You rank in the"
            value={<span style={{ color: C.deepTeal }}>top 15%</span>}
            note="anonymous percentile of ARHA partners"
            delay={30}
          />
        </div>

        <div style={{ display: "flex", gap: 18, marginTop: 20 }}>
          <div
            style={{
              flex: 1.3,
              background: "#fff",
              border: "1px solid #E2DED4",
              borderRadius: 12,
              padding: 20,
              opacity: e,
            }}
          >
            <div style={{ fontSize: 15, color: C.slate, letterSpacing: 2 }}>WHAT EARNS POINTS</div>
            <div style={{ display: "grid", gap: 14, marginTop: 14 }}>
              {criteria.map((c) => (
                <div key={c.l}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 18 }}>
                    <span>{c.l}</span>
                    <span style={{ fontWeight: 700 }}>{c.v}%</span>
                  </div>
                  <Meter value={c.v} from={c.delay} to={c.delay + 40} color={c.v > 85 ? C.teal : C.orange} style={{ marginTop: 6 }} />
                </div>
              ))}
            </div>
          </div>

          <div
            style={{
              flex: 1,
              background: gold ? `${C.gold}14` : "#fff",
              border: `1px solid ${gold ? C.gold : "#E2DED4"}`,
              borderRadius: 12,
              padding: 20,
              opacity: e,
            }}
          >
            <div style={{ fontSize: 15, color: C.slate, letterSpacing: 2 }}>NEXT TIER</div>
            <div style={{ fontSize: 26, fontWeight: 700, marginTop: 8 }}>Gold Standard</div>
            <div style={{ fontSize: 18, color: C.slate, marginTop: 6, lineHeight: 1.4 }}>
              Five consecutive jobs rated above the ARHA average. Gold partners get first refusal on dispatch in
              their territory.
            </div>
            <Meter value={100} from={140} to={172} color={C.gold} height={16} style={{ marginTop: 16 }} />
            <div
              style={{
                marginTop: 10,
                fontSize: 20,
                fontWeight: 700,
                color: C.gold,
                opacity: interpolate(frame, [172, 190], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
              }}
            >
              🏅 Unlocked — 5 of 5 above-average jobs
            </div>
          </div>
        </div>
      </PortalScreen>

      <Callout
        text="Internal staff are never scored this way. Gamification is for vendor quality only."
        x={140}
        y={770}
        delay={200}
        width={470}
        color={C.gold}
      />
      <Caption kicker="Gamification" text="Good work compounds into better dispatch — and everyone can see why." />
    </AbsoluteFill>
  );
};
