import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { C } from "../theme";
import { Callout, Caption, Card, CheckRow, Cursor, Field, PageTitle, Pill, Screen, Typed } from "../components/Ui";

export const UiCoach: React.FC = () => {
  const frame = useCurrentFrame();
  const thinking = frame > 108 && frame < 150;

  return (
    <AbsoluteFill>
      <Screen active="Ask the Coach">
        <PageTitle title="Ask the Coach" sub="Describe the situation in plain words — get the play, not a search result" />

        <Field label="What is happening?" delay={8}>
          <Typed text="There is an active leak in a vacant house and I can't reach the owner." from={26} per={1.15} />
        </Field>

        <div style={{ display: "flex", gap: 16, marginTop: 18 }}>
          <Card delay={150} style={{ flex: 1.15 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <Pill label="P1" bg={C.orange} />
              <span style={{ fontSize: 20, fontWeight: 700 }}>Active water intrusion — vacant home</span>
            </div>
            <CheckRow label="Shut off the main water supply before anything else" hint="Coordinator confirms location from the home profile" delay={158} tickAt={210} />
            <div style={{ height: 8 }} />
            <CheckRow label="Photograph the source and all affected rooms" hint="Required evidence before this matter can close" delay={166} tickAt={224} />
            <div style={{ height: 8 }} />
            <CheckRow label="Check ceilings and floors below for spread" delay={174} />
            <div style={{ height: 8 }} />
            <CheckRow label="Test every smoke and CO alarm before the vendor leaves" hint="Nothing is removed unless it is replaced same visit" delay={182} />
          </Card>

          <Card delay={162} style={{ flex: 1 }}>
            <div style={{ fontSize: 19, fontWeight: 700, marginBottom: 8 }}>Vendor brief — copy &amp; send</div>
            <div
              style={{
                fontSize: 16.5,
                lineHeight: 1.45,
                color: C.charcoal,
                background: "#F6F4EE",
                border: "1px solid #E4E0D6",
                borderRadius: 9,
                padding: 13,
                minHeight: 150,
              }}
            >
              <Typed
                text="852 Inland Dr. is vacant. Main shutoff is in the garage, left of the water heater. Stop the leak, then photograph the source and every wet surface. Test all smoke and CO alarms before you leave. If a device must come out, replace it the same visit and patch the wall. Text photos to the coordinator before departure."
                from={186}
                per={0.42}
              />
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
              <div
                style={{
                  background: C.teal,
                  color: C.ink,
                  fontWeight: 700,
                  fontSize: 17,
                  padding: "10px 14px",
                  borderRadius: 9,
                  transform: `scale(${frame > 268 && frame < 280 ? 0.96 : 1})`,
                }}
              >
                Open a matter with this plan
              </div>
              <div
                style={{
                  border: `1px solid ${C.slate}55`,
                  color: C.slate,
                  fontSize: 17,
                  padding: "10px 14px",
                  borderRadius: 9,
                }}
              >
                Guest / owner message
              </div>
            </div>
          </Card>
        </div>
      </Screen>

      {thinking ? (
        <Callout text="Coach is checking the ARHA playbooks and this home's profile…" x={620} y={300} delay={0} color={C.gold} width={480} />
      ) : null}

      <Callout text="Priority, risk flags and closure evidence are set for the coordinator." x={1170} y={210} delay={196} color={C.teal} width={400} />
      <Callout text="One click turns the plan into a live matter with the checklist attached." x={200} y={800} delay={244} width={560} />

      <Cursor
        path={[
          { f: 0, x: 1400, y: 680 },
          { f: 30, x: 620, y: 300 },
          { f: 120, x: 700, y: 330 },
          { f: 200, x: 1050, y: 560 },
          { f: 268, x: 1220, y: 700 },
        ]}
      />
      <Caption kicker="Coaching" text="The Coach turns a sentence into a defensible plan." />
    </AbsoluteFill>
  );
};
