import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { C } from "../theme";
import { Callout, Caption, Card, Cursor, PageTitle, Pill, Screen } from "../components/Ui";

const sources = [
  {
    name: "OwnerRez",
    state: "Connected",
    tone: C.deepTeal,
    detail: "Properties, live stays, tasks",
    last: "Synced 2 minutes ago",
  },
  {
    name: "Breezeway",
    state: "Ready — awaiting API key",
    tone: C.gold,
    detail: "Field tasks, completion photos",
    last: "Turns on the day credentials land",
  },
];

const imported = [
  { src: "OwnerRez", t: "Water heater inspection — 852 Inland Dr.", p: "P1", c: C.orange, s: "New → imported" },
  { src: "OwnerRez", t: "Post-stay damage report — Harbor Loft", p: "P2", c: C.gold, s: "Status changed → In progress" },
  { src: "Breezeway", t: "Deep clean escalation — Cedar House", p: "P3", c: C.deepTeal, s: "Queued for sync" },
  { src: "OwnerRez", t: "Smoke detector battery — Maple Court", p: "P2", c: C.gold, s: "Already in queue — skipped" },
];

export const UiIntegrations: React.FC = () => {
  const frame = useCurrentFrame();
  const progress = interpolate(frame, [96, 168], [0, 100], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill>
      <Screen active="Integrations">
        <PageTitle title="Integrations" sub="Inbound sync — outside systems feed the same queue" />

        <div style={{ display: "flex", gap: 16 }}>
          {sources.map((s, i) => (
            <Card key={s.name} delay={6 + i * 8} style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ fontSize: 24, fontWeight: 700 }}>{s.name}</div>
                <Pill label={s.state} bg={s.tone} />
              </div>
              <div style={{ fontSize: 17, color: C.slate, marginTop: 8 }}>{s.detail}</div>
              <div style={{ fontSize: 16, color: C.slate, marginTop: 4 }}>{s.last}</div>
            </Card>
          ))}
          <Card delay={22} style={{ width: 330 }}>
            <div style={{ fontSize: 17, color: C.slate }}>Automatic refresh</div>
            <div style={{ fontSize: 26, fontWeight: 700, marginTop: 6 }}>Every 15 minutes</div>
            <div
              style={{
                marginTop: 12,
                background: C.teal,
                color: C.ink,
                borderRadius: 9,
                padding: "11px 14px",
                fontWeight: 700,
                fontSize: 19,
                textAlign: "center",
                transform: `scale(${frame > 92 && frame < 104 ? 0.96 : 1})`,
              }}
            >
              {progress > 0 && progress < 100 ? `Syncing… ${Math.round(progress)}%` : "Sync all sources"}
            </div>
          </Card>
        </div>

        <Card delay={40} style={{ marginTop: 18, padding: 0, overflow: "hidden" }}>
          <div
            style={{
              padding: "14px 18px",
              fontSize: 21,
              fontWeight: 700,
              borderBottom: "1px solid #EDE9E0",
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            Imported matters
            <span style={{ fontSize: 16, color: C.slate, fontWeight: 400 }}>
              deduped by source task ID · home matched automatically
            </span>
          </div>
          <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
            {imported.map((r, i) => {
              const o = interpolate(frame, [120 + i * 16, 138 + i * 16], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              });
              const skipped = r.s.includes("skipped");
              return (
                <div
                  key={r.t}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    padding: "12px 13px",
                    borderRadius: 10,
                    border: "1px solid #E6E2D8",
                    background: skipped ? "#F3F1EA" : "#fff",
                    opacity: o,
                    transform: `translateX(${interpolate(o, [0, 1], [-18, 0])}px)`,
                  }}
                >
                  <Pill label={r.src} bg={C.charcoal} />
                  <Pill label={r.p} bg={r.c} />
                  <span style={{ fontSize: 19, fontWeight: 600 }}>{r.t}</span>
                  <span
                    style={{
                      marginLeft: "auto",
                      fontSize: 16,
                      color: skipped ? C.slate : C.deepTeal,
                      fontWeight: skipped ? 400 : 700,
                    }}
                  >
                    {r.s}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>
      </Screen>

      <Callout
        text="Tasks created in OwnerRez or Breezeway land here as matters — nobody re-types anything."
        x={200}
        y={800}
        delay={196}
        color={C.teal}
        width={520}
      />
      <Callout
        text="Duplicates are skipped and status changes are written to the matter's timeline."
        x={790}
        y={800}
        delay={230}
        width={520}
      />

      <Cursor
        path={[
          { f: 0, x: 1500, y: 700 },
          { f: 60, x: 1640, y: 330 },
          { f: 96, x: 1640, y: 348 },
          { f: 150, x: 800, y: 560 },
          { f: 240, x: 900, y: 620 },
        ]}
      />
      <Caption kicker="Inbound sync" text="Inbound sync makes Resolve the single queue." />
    </AbsoluteFill>
  );
};
