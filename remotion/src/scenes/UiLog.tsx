import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { C } from "../theme";
import { Callout, Caption, Card, Cursor, Field, Pill, PageTitle, Screen, Typed, useEnter } from "../components/Ui";

export const UiLog: React.FC = () => {
  const frame = useCurrentFrame();
  const priority = useEnter(126, 14);

  return (
    <AbsoluteFill>
      <Screen active="Matters">
        <PageTitle title="Log a matter" sub="One record. One owner. One clock." />

        <div style={{ display: "flex", gap: 22 }}>
          <div style={{ flex: 1.35, display: "flex", flexDirection: "column", gap: 16 }}>
            <Field label="What needs to happen?" delay={10}>
              <Typed text="Carbon monoxide alarm sounding — guest in the home" from={22} per={1.1} />
            </Field>

            <div style={{ display: "flex", gap: 16 }}>
              <Field label="Property" delay={54} width="50%">
                {frame > 66 ? "852 Inland Dr." : <span style={{ color: "#B4AE9F" }}>Select a property</span>}
              </Field>
              <Field label="Work type" delay={60} width="50%">
                {frame > 80 ? "Safety devices (smoke / CO / security)" : <span style={{ color: "#B4AE9F" }}>Pick the closest match</span>}
              </Field>
            </div>

            <div style={{ display: "flex", gap: 16 }}>
              <Field label="Guest impact" delay={86} width="50%">
                {frame > 96 ? "Safety or security" : <span style={{ color: "#B4AE9F" }}>—</span>}
              </Field>
              <Field label="Occupancy (live from OwnerRez)" delay={90} width="50%">
                {frame > 100 ? (
                  <span>
                    Occupied <Pill label="OwnerRez" bg={`${C.deepTeal}22`} color={C.deepTeal} style={{ marginLeft: 8, fontSize: 12 }} />
                  </span>
                ) : (
                  <span style={{ color: "#B4AE9F" }}>Checking OwnerRez for the current reservation…</span>
                )}
              </Field>
            </div>
          </div>

          <div style={{ flex: 1 }}>
            <Card delay={112} tone={`${C.orange}55`} style={{ background: `${C.orange}0d` }}>
              <div style={{ fontSize: 15, letterSpacing: 3, textTransform: "uppercase", color: C.slate }}>
                Priority — set by the facts
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  marginTop: 12,
                  transform: `scale(${interpolate(priority, [0, 1], [0.8, 1])})`,
                  opacity: priority,
                }}
              >
                <div
                  style={{
                    background: C.orange,
                    color: "#fff",
                    fontWeight: 700,
                    fontSize: 34,
                    borderRadius: 10,
                    padding: "6px 16px",
                  }}
                >
                  P1
                </div>
                <div style={{ fontSize: 20, fontWeight: 700 }}>Critical — immediate action</div>
              </div>
              <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 9 }}>
                {[
                  ["Acknowledge the guest", "3 min"],
                  ["Begin action", "5 min"],
                  ["Escalate to Lead", "15 min"],
                ].map(([k, v], i) => (
                  <div
                    key={k}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: 18,
                      opacity: interpolate(frame, [136 + i * 10, 150 + i * 10], [0, 1], {
                        extrapolateLeft: "clamp",
                        extrapolateRight: "clamp",
                      }),
                    }}
                  >
                    <span style={{ color: C.slate }}>{k}</span>
                    <span style={{ fontWeight: 700 }}>{v}</span>
                  </div>
                ))}
              </div>
              <div
                style={{
                  marginTop: 16,
                  paddingTop: 14,
                  borderTop: "1px solid #E2DED4",
                  fontSize: 17,
                  opacity: interpolate(frame, [168, 182], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
                }}
              >
                Routed to <strong>Property Operations</strong> · Team B
              </div>
            </Card>
          </div>
        </div>
      </Screen>

      <Callout
        text="Occupancy is pulled live from OwnerRez — nobody guesses whether a guest is in the home."
        x={150}
        y={706}
        delay={104}
        color={C.teal}
        width={420}
      />
      <Callout
        text="Coordinators never pick a priority. Guest impact + occupancy set it, so the clock is honest."
        x={1150}
        y={706}
        delay={140}
        width={430}
      />

      <Cursor
        path={[
          { f: 0, x: 300, y: 520 },
          { f: 18, x: 420, y: 292 },
          { f: 52, x: 420, y: 292 },
          { f: 64, x: 430, y: 402 },
          { f: 84, x: 980, y: 402 },
          { f: 108, x: 1000, y: 500 },
          { f: 130, x: 1420, y: 330 },
          { f: 200, x: 1440, y: 350 },
        ]}
      />
      <Caption kicker="Step 1" text="Intake takes about twenty seconds — and the app does the thinking." />
    </AbsoluteFill>
  );
};
