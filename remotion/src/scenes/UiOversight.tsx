import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { C } from "../theme";
import { Callout, Caption, Card, Cursor, PageTitle, Pill, Screen } from "../components/Ui";

const ladder = [
  { t: "0:00", l: "Matter logged — coordinator on seat", c: C.deepTeal },
  { t: "3:00", l: "Guest must be acknowledged", c: C.deepTeal },
  { t: "5:00", l: "Action must have begun", c: C.gold },
  { t: "15:00", l: "Auto-escalates to Pod Lead", c: C.orange },
  { t: "30:00", l: "Escalates to Leadership", c: C.orange },
];

export const UiOversight: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill>
      <Screen active="Oversight">
        <PageTitle title="Oversight queue" sub="Where a manager looks when they have five minutes." />

        <div style={{ display: "flex", gap: 20 }}>
          <div style={{ flex: 1.25, display: "flex", flexDirection: "column", gap: 12 }}>
            {[
              { h: "Breached response standard", n: "2 matters", c: C.orange, d: "No hot water · Maple Court — 6m overdue" },
              { h: "Unaccepted handoffs", n: "1 matter", c: C.gold, d: "Sent 22m ago, nobody has accepted" },
              { h: "Waiting with no review date", n: "3 matters", c: C.gold, d: "Waiting is fine. Waiting without a date is not." },
              { h: "Closed without evidence", n: "0 matters", c: C.deepTeal, d: "Closure gates are holding" },
            ].map((r, i) => (
              <Card key={r.h} delay={8 + i * 6} tone={`${r.c}55`} style={{ background: `${r.c}0d` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ fontSize: 21, fontWeight: 700 }}>{r.h}</div>
                  <Pill label={r.n} bg={r.c} />
                </div>
                <div style={{ fontSize: 17, color: C.slate, marginTop: 5 }}>{r.d}</div>
              </Card>
            ))}
          </div>

          <Card delay={40} style={{ flex: 1 }}>
            <div style={{ fontSize: 21, fontWeight: 700, marginBottom: 16 }}>P1 escalation ladder</div>
            {ladder.map((s, i) => {
              const o = interpolate(frame, [54 + i * 12, 70 + i * 12], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              });
              return (
                <div key={s.t} style={{ display: "flex", gap: 16, opacity: o }}>
                  <div style={{ width: 74, textAlign: "right", fontSize: 19, fontWeight: 700, color: s.c }}>{s.t}</div>
                  <div style={{ position: "relative", width: 20 }}>
                    <div style={{ position: "absolute", left: 8, top: 4, bottom: -4, width: 3, background: "#E6E2D8" }} />
                    <div
                      style={{
                        position: "absolute",
                        left: 2,
                        top: 5,
                        width: 15,
                        height: 15,
                        borderRadius: 999,
                        background: s.c,
                      }}
                    />
                  </div>
                  <div style={{ fontSize: 18, paddingBottom: 22 }}>{s.l}</div>
                </div>
              );
            })}
            <div style={{ fontSize: 16, color: C.slate, marginTop: 4, lineHeight: 1.5 }}>
              The ladder runs whether or not anyone remembers it.
            </div>
          </Card>
        </div>
      </Screen>

      <Callout text="Nothing rots quietly. Missed clocks, stale waits and unaccepted handoffs surface here." x={150} y={706} delay={90} color={C.teal} width={480} />

      <Cursor
        path={[
          { f: 0, x: 1400, y: 600 },
          { f: 26, x: 500, y: 300 },
          { f: 60, x: 520, y: 400 },
          { f: 100, x: 1250, y: 420 },
          { f: 160, x: 1265, y: 435 },
        ]}
      />
      <Caption kicker="Oversight" text="Managers supervise the system, not each other's memory." />
    </AbsoluteFill>
  );
};
