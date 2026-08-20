import { AbsoluteFill, Sequence, interpolate, useCurrentFrame } from "remotion";
import { C } from "../theme";
import { Caption, Card, CheckRow, PageTitle, Pill, Screen } from "../components/Ui";

const Properties: React.FC = () => (
  <Screen active="Properties">
    <PageTitle title="Properties" sub="34 homes · 31 linked to OwnerRez" />
    <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
      <Pill label="Import from OwnerRez" bg={C.teal} color={C.ink} style={{ fontSize: 17, padding: "9px 16px" }} />
      <Pill label="Add property" bg="#EFEBE1" color={C.slate} style={{ fontSize: 17, padding: "9px 16px" }} />
    </div>
    <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
      {[
        ["852 Inland Dr.", "Occupied · 2 open matters", "Water shutoff: garage, left of heater"],
        ["Maple Court", "Same-day arrival · 1 open", "Gate code 4412 · lockbox on rail"],
        ["Harbor Loft", "Vacant · 0 open", "Parking spot 12 · elevator key required"],
        ["Cedar House", "Occupied · 1 open", "CO detector replaced 6/14"],
        ["Willow Bend", "Vacant · 0 open", "Breaker panel in hall closet"],
        ["Ridgeline Cabin", "Occupied · 0 open", "Well pump — do not run dry"],
      ].map(([n, s, note], i) => (
        <Card key={n} delay={8 + i * 4} style={{ width: 490 }}>
          <div style={{ fontSize: 21, fontWeight: 700 }}>{n}</div>
          <div style={{ fontSize: 16, color: C.slate, marginTop: 3 }}>{s}</div>
          <div style={{ fontSize: 16, marginTop: 9, color: C.charcoal }}>🔑 {note}</div>
        </Card>
      ))}
    </div>
  </Screen>
);

const Playbooks: React.FC = () => (
  <Screen active="Playbooks">
    <PageTitle title="Playbooks" sub="The standards that get enforced on every matter." />
    <div style={{ display: "flex", gap: 18 }}>
      <Card delay={6} style={{ flex: 1 }}>
        <div style={{ fontSize: 21, fontWeight: 700, marginBottom: 12 }}>Safety device service</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <CheckRow label="Identify which device is sounding" delay={10} />
          <CheckRow label="Test all smoke / CO / security devices" hint="Required for closure" delay={14} />
          <CheckRow label="Replace, never simply remove" hint="Photo required" delay={18} />
          <CheckRow label="Check the appliance behind the alarm" delay={22} />
        </div>
      </Card>
      <Card delay={10} style={{ flex: 1 }}>
        <div style={{ fontSize: 21, fontWeight: 700, marginBottom: 12 }}>Water leak</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <CheckRow label="Shut off supply and photograph the source" delay={14} />
          <CheckRow label="Run the fixture for 5 minutes after repair" hint="Required for closure" delay={18} />
          <CheckRow label="Check the cabinet, floor and unit below" delay={22} />
          <CheckRow label="Guest confirms it is dry before closing" delay={26} />
        </div>
      </Card>
    </div>
  </Screen>
);

const Seats: React.FC = () => (
  <Screen active="Seats">
    <PageTitle title="Seats & coverage" sub="Work routes to a seat. People sit in seats." />
    <div style={{ display: "flex", gap: 18 }}>
      {[
        { n: "Guest Experience & Reservations", s: "Team A", who: "J. Rios", cov: "7:00 AM – 3:00 PM", c: C.deepTeal },
        { n: "Property Operations", s: "Team B", who: "M. Alvarez", cov: "7:00 AM – 6:00 PM", c: C.gold },
        { n: "Leadership", s: "Escalation", who: "E. Jimenez", cov: "On call", c: C.orange },
      ].map((r, i) => (
        <Card key={r.n} delay={8 + i * 6} style={{ flex: 1 }} tone={`${r.c}55`}>
          <Pill label={r.s} bg={r.c} />
          <div style={{ fontSize: 22, fontWeight: 700, marginTop: 10 }}>{r.n}</div>
          <div style={{ fontSize: 18, marginTop: 8 }}>On seat now: <strong>{r.who}</strong></div>
          <div style={{ fontSize: 16, color: C.slate, marginTop: 4 }}>Coverage {r.cov}</div>
        </Card>
      ))}
    </div>
    <Card delay={30} style={{ marginTop: 16 }}>
      <div style={{ fontSize: 18 }}>
        <strong>The golden rule:</strong> the property determines the pod — priority and time determine who gets the
        task.
      </div>
    </Card>
  </Screen>
);

export const UiLibrary: React.FC = () => {
  const frame = useCurrentFrame();
  const slide = (from: number) =>
    interpolate(frame, [from - 8, from], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill>
      <Sequence from={0} durationInFrames={66} layout="none">
        <AbsoluteFill style={{ opacity: 1 - slide(66) * 0 }}>
          <Properties />
        </AbsoluteFill>
      </Sequence>
      <Sequence from={66} durationInFrames={62} layout="none">
        <Playbooks />
      </Sequence>
      <Sequence from={128} durationInFrames={80} layout="none">
        <Seats />
      </Sequence>
      <Caption kicker="Behind it all" text="Properties, playbooks and seats — the memory your team stops carrying." />
    </AbsoluteFill>
  );
};
