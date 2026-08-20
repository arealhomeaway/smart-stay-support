import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { C } from "../theme";
import { Callout, Caption, Card, Cursor, Pill, PageTitle, Screen, Typed } from "../components/Ui";

export const UiHandoff: React.FC = () => {
  const frame = useCurrentFrame();
  const accepted = frame > 138;

  return (
    <AbsoluteFill>
      <Screen active="Matters">
        <PageTitle title="Handoff — shift change at 6:00 PM" sub="A handoff is not complete until it is accepted." />

        <div style={{ display: "flex", gap: 20 }}>
          <Card delay={8} style={{ flex: 1.3 }}>
            <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>Hand this matter to another seat</div>
            <div style={{ display: "flex", gap: 14, marginBottom: 14 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, color: C.slate, marginBottom: 6 }}>Receiving seat</div>
                <div style={{ border: "1px solid #DAD5C9", borderRadius: 9, padding: "11px 13px", fontSize: 18, background: "#fff" }}>
                  {frame > 34 ? "Property Operations — Night coverage" : <span style={{ color: "#B4AE9F" }}>Choose a seat</span>}
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, color: C.slate, marginBottom: 6 }}>Person on that seat now</div>
                <div style={{ border: "1px solid #DAD5C9", borderRadius: 9, padding: "11px 13px", fontSize: 18, background: "#fff" }}>
                  {frame > 42 ? "D. Whitfield" : <span style={{ color: "#B4AE9F" }}>—</span>}
                </div>
              </div>
            </div>
            <div style={{ fontSize: 14, color: C.slate, marginBottom: 6 }}>Required handoff summary</div>
            <div
              style={{
                border: "1px solid #DAD5C9",
                borderRadius: 9,
                padding: "13px 15px",
                minHeight: 132,
                fontSize: 18,
                lineHeight: 1.45,
                background: "#fff",
              }}
            >
              <Typed
                text="CO alarm confirmed at the water heater. Fire dept advised gas off. Guest moved to the front bedroom. Next: gas tech confirmed for 8:00 AM, replacement CO unit installed, photo attached. Watch for: guest asked about a partial refund."
                from={52}
                per={0.62}
              />
            </div>
            <div
              style={{
                marginTop: 14,
                display: "inline-block",
                padding: "11px 22px",
                borderRadius: 9,
                background: frame > 112 ? C.teal : "#E6E2D8",
                color: frame > 112 ? C.ink : "#A9A395",
                fontWeight: 700,
                fontSize: 18,
              }}
            >
              Send handoff
            </div>
          </Card>

          <Card delay={16} style={{ flex: 1 }} tone={accepted ? `${C.teal}66` : `${C.gold}66`}>
            <div style={{ fontSize: 20, fontWeight: 700 }}>Ownership</div>
            <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <Pill label="Accountable owner" bg="#EFEBE1" color={C.slate} />
                <span style={{ fontSize: 20, fontWeight: 700 }}>{accepted ? "D. Whitfield" : "M. Alvarez"}</span>
              </div>
              <div
                style={{
                  padding: "13px 15px",
                  borderRadius: 10,
                  background: accepted ? `${C.teal}12` : `${C.gold}12`,
                  border: `1px solid ${accepted ? `${C.teal}55` : `${C.gold}55`}`,
                  fontSize: 18,
                }}
              >
                {accepted ? (
                  <>
                    <strong>Accepted at 5:58 PM.</strong> Ownership transferred. Clock continues without a reset.
                  </>
                ) : (
                  <>
                    <strong>Pending acceptance.</strong> M. Alvarez is still accountable until D. Whitfield accepts.
                  </>
                )}
              </div>
              <div style={{ fontSize: 16, color: C.slate, lineHeight: 1.5 }}>
                Activity log: handoff sent 5:54 PM · summary recorded · {accepted ? "accepted 5:58 PM" : "awaiting acceptance"}
              </div>
            </div>
          </Card>
        </div>
      </Screen>

      <Callout text="No “I thought you had it.” The sender stays accountable until someone accepts." x={150} y={706} delay={120} width={470} />

      <Cursor
        path={[
          { f: 0, x: 900, y: 620 },
          { f: 34, x: 430, y: 330 },
          { f: 50, x: 500, y: 470 },
          { f: 112, x: 350, y: 665 },
          { f: 138, x: 1250, y: 430 },
          { f: 180, x: 1270, y: 445 },
        ]}
      />
      <Caption kicker="Step 4" text="Handoffs are accepted, not announced." />
    </AbsoluteFill>
  );
};
