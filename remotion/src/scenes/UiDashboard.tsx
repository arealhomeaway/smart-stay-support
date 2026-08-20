import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { C } from "../theme";
import { Callout, Caption, Card, CountUp, Cursor, PageTitle, Pill, Screen } from "../components/Ui";

const rows = [
  { p: "P1", c: C.orange, t: "CO alarm sounding — guest in the home", prop: "852 Inland Dr.", s: "Open", clock: "Action due in 2m", late: false },
  { p: "P1", c: C.orange, t: "No hot water, arrival in 3 hours", prop: "Maple Court", s: "Dispatched", clock: "Overdue 6m", late: true },
  { p: "P2", c: C.gold, t: "Leak under kitchen sink — recheck", prop: "852 Inland Dr.", s: "In progress", clock: "Action due in 41m", late: false },
  { p: "P2", c: C.gold, t: "Lockbox code not working", prop: "Harbor Loft", s: "Waiting on guest", clock: "Review 4:00 PM", late: false },
  { p: "P3", c: C.deepTeal, t: "Replace missing smoke detector cover", prop: "Cedar House", s: "Open", clock: "Due tomorrow", late: false },
];

export const UiDashboard: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill>
      <Screen active="Dashboard">
        <PageTitle title="Operations dashboard" sub="34 properties · 12 live issues" />

        <div style={{ display: "flex", gap: 16 }}>
          {[
            { l: "Open matters", v: 12, c: C.charcoal },
            { l: "SLA breached", v: 2, c: C.orange },
            { l: "Not yet acknowledged", v: 1, c: C.gold },
            { l: "Closed this week", v: 47, c: C.deepTeal },
          ].map((s, i) => (
            <Card key={s.l} delay={6 + i * 5} style={{ flex: 1 }}>
              <CountUp to={s.v} delay={16 + i * 6} color={s.c} />
              <div style={{ fontSize: 16, color: C.slate, marginTop: 4 }}>{s.l}</div>
            </Card>
          ))}
        </div>

        <Card delay={44} style={{ marginTop: 18, padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "14px 18px", fontSize: 21, fontWeight: 700, borderBottom: "1px solid #EDE9E0" }}>
            Needs attention now
          </div>
          <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
            {rows.map((r, i) => {
              const o = interpolate(frame, [54 + i * 7, 68 + i * 7], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              });
              const hovered = frame > 118 && i === 0;
              return (
                <div
                  key={r.t}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    padding: "11px 13px",
                    borderRadius: 10,
                    border: `1px solid ${hovered ? `${C.teal}77` : "#E6E2D8"}`,
                    background: hovered ? `${C.teal}10` : "#fff",
                    opacity: o,
                    transform: `translateY(${interpolate(o, [0, 1], [12, 0])}px)`,
                  }}
                >
                  <Pill label={r.p} bg={r.c} />
                  <span style={{ fontSize: 19, fontWeight: 600 }}>{r.t}</span>
                  <span style={{ fontSize: 16, color: C.slate }}>{r.prop}</span>
                  <Pill label={r.s} bg="#EFEBE1" color={C.slate} />
                  <span
                    style={{
                      marginLeft: "auto",
                      fontSize: 17,
                      fontWeight: r.late ? 700 : 400,
                      color: r.late ? C.orange : C.slate,
                    }}
                  >
                    {r.clock}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>
      </Screen>

      <Callout text="Every open matter sorted by the clock that is closest to breaching." x={1180} y={250} delay={78} color={C.teal} width={400} />
      <Callout text="Red means a response standard was missed — it never quietly disappears." x={1180} y={392} delay={104} width={400} />

      <Cursor
        path={[
          { f: 0, x: 1500, y: 640 },
          { f: 24, x: 700, y: 300 },
          { f: 70, x: 720, y: 470 },
          { f: 118, x: 640, y: 540 },
          { f: 170, x: 660, y: 552 },
        ]}
      />
      <Caption kicker="Triage" text="The dashboard is a triage board, not a report." />
    </AbsoluteFill>
  );
};
