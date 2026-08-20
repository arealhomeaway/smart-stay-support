import { AbsoluteFill, Sequence, interpolate, useCurrentFrame } from "remotion";
import { C } from "../theme";
import { Callout, Caption, Card, CheckRow, Cursor, Pill, Screen } from "../components/Ui";

export const UiTicket: React.FC = () => {
  const frame = useCurrentFrame();
  const ackDone = frame > 60;

  return (
    <AbsoluteFill>
      <Screen active="Matters">
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <Pill label="P1" bg={C.orange} />
          <div style={{ fontSize: 30, fontWeight: 700 }}>CO alarm sounding — guest in the home</div>
          <Pill label="852 Inland Dr." bg="#EFEBE1" color={C.slate} />
          <div style={{ marginLeft: "auto", fontSize: 16, color: C.slate }}>
            Owner: <strong style={{ color: C.charcoal }}>Property Operations · M. Alvarez</strong>
          </div>
        </div>

        <div style={{ display: "flex", gap: 20, marginTop: 18 }}>
          <div style={{ flex: 1.5, display: "flex", flexDirection: "column", gap: 14 }}>
            <Card delay={6} style={{ padding: 0 }}>
              <div style={{ padding: "13px 18px", fontSize: 20, fontWeight: 700, borderBottom: "1px solid #EDE9E0" }}>
                Response standard
              </div>
              <div style={{ display: "flex", gap: 14, padding: 16 }}>
                {[
                  { k: "Acknowledged", v: ackDone ? "in 1m 12s" : "due in 3m", ok: ackDone },
                  { k: "Action begun", v: frame > 96 ? "in 4m 02s" : "due in 5m", ok: frame > 96 },
                  { k: "Escalation", v: "Lead at 15m", ok: true },
                ].map((c) => (
                  <div
                    key={c.k}
                    style={{
                      flex: 1,
                      border: `1px solid ${c.ok ? `${C.teal}55` : `${C.gold}66`}`,
                      background: c.ok ? `${C.teal}10` : `${C.gold}10`,
                      borderRadius: 10,
                      padding: "11px 13px",
                    }}
                  >
                    <div style={{ fontSize: 15, color: C.slate }}>{c.k}</div>
                    <div style={{ fontSize: 21, fontWeight: 700, color: c.ok ? C.deepTeal : C.charcoal }}>{c.v}</div>
                  </div>
                ))}
              </div>
            </Card>

            <Card delay={16} style={{ padding: 0 }}>
              <div style={{ padding: "13px 18px", borderBottom: "1px solid #EDE9E0", display: "flex", alignItems: "center" }}>
                <div style={{ fontSize: 20, fontWeight: 700 }}>Resolution playbook — Safety device service</div>
                <div style={{ marginLeft: "auto", fontSize: 16, color: C.slate }}>
                  {Math.min(5, Math.max(0, Math.floor((frame - 108) / 26) + 1))} of 5 complete
                </div>
              </div>
              <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 9 }}>
                <CheckRow label="Confirm the source of the alarm before touching it" hint="Smoke, CO and security are three different devices" delay={22} tickAt={108} />
                <CheckRow label="Test every smoke, CO and security device in the home" hint="Required by the playbook — not optional" delay={26} tickAt={134} />
                <CheckRow label="Replace any device removed — never leave an opening" hint="Photo evidence required" delay={30} tickAt={160} />
                <CheckRow label="Check the appliance the alarm points to (water heater, furnace)" delay={34} tickAt={186} />
                <CheckRow label="Confirm with the guest that the alarm has stopped" delay={38} tickAt={212} />
              </div>
            </Card>
          </div>

          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 14 }}>
            <Card delay={26}>
              <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 10 }}>Vendor instructions (auto-generated)</div>
              <div style={{ fontSize: 17, lineHeight: 1.45, color: C.charcoal }}>
                “Guest is on site. Test all smoke, CO and security devices. If a device is removed, it must be replaced
                before you leave. Photograph the wall. Check the water heater and furnace for CO.”
              </div>
              <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
                <Pill label="Sent to handyman" bg={`${C.deepTeal}18`} color={C.deepTeal} />
                <Pill label="Breezeway task" bg="#EFEBE1" color={C.slate} />
              </div>
            </Card>

            <Card delay={34} tone={frame > 232 ? `${C.orange}66` : undefined} style={{ background: frame > 232 ? `${C.orange}0d` : "#fff" }}>
              <div style={{ fontSize: 20, fontWeight: 700 }}>Close it out properly</div>
              <div style={{ fontSize: 16, color: C.slate, marginTop: 6 }}>Required before this matter can be closed:</div>
              <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 7, fontSize: 17 }}>
                {[
                  ["Every playbook step complete", frame > 212],
                  ["Photo of the replaced device", frame > 240],
                  ["Guest confirmation received", frame > 262],
                ].map(([k, ok]) => (
                  <div key={String(k)} style={{ display: "flex", gap: 9, alignItems: "center" }}>
                    <span style={{ color: ok ? C.deepTeal : C.orange, fontWeight: 700 }}>{ok ? "✓" : "✕"}</span>
                    <span style={{ color: ok ? C.charcoal : C.slate }}>{k}</span>
                  </div>
                ))}
              </div>
              <div
                style={{
                  marginTop: 14,
                  padding: "11px 0",
                  textAlign: "center",
                  borderRadius: 9,
                  fontWeight: 700,
                  fontSize: 18,
                  background: frame > 262 ? C.teal : "#E6E2D8",
                  color: frame > 262 ? C.ink : "#A9A395",
                }}
              >
                {frame > 262 ? "Close matter" : "Close matter (locked)"}
              </div>
            </Card>
          </div>
        </div>
      </Screen>

      <Sequence from={0} durationInFrames={230} layout="none">
        <Callout
          text="This is the part that failed in real life: the checklist forces every alarm to be tested and replaced."
          x={1160}
          y={730}
          delay={120}
          width={470}
        />
      </Sequence>
      <Sequence from={236} layout="none">
        <Callout
          text="The close button stays locked until evidence and guest confirmation exist."
          x={1160}
          y={730}
          delay={0}
          color={C.teal}
          width={470}
        />
      </Sequence>


      <Cursor
        path={[
          { f: 0, x: 520, y: 260 },
          { f: 108, x: 330, y: 470 },
          { f: 134, x: 330, y: 522 },
          { f: 160, x: 330, y: 578 },
          { f: 186, x: 330, y: 632 },
          { f: 212, x: 330, y: 684 },
          { f: 262, x: 1430, y: 690 },
          { f: 296, x: 1440, y: 700 },
        ]}
      />
      <Caption kicker="Step 3" text="The playbook is the instruction the handyman never got." />
    </AbsoluteFill>
  );
};
