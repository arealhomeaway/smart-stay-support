import { AbsoluteFill } from "remotion";
import { C } from "../theme";
import { Callout, Caption, Cursor, Pill, useEnter } from "../components/Ui";
import { PortalScreen } from "../components/Portal";

const portals = [
  { t: "Operations", s: "Matters, Coach, playbooks, handoffs", who: "Coordinators & supervisors", color: C.teal },
  { t: "Vendor portal", s: "Dispatched jobs, check-in, scorecard", who: "Field partners", color: C.orange },
  { t: "Owner portal", s: "90-day participation program", who: "Homeowners", color: C.deepTeal },
  { t: "Command Center", s: "Company health, KPIs, data quality", who: "Executive staff", color: C.gold },
  { t: "Onboarding", s: "New homes to handoff-accepted", who: "Onboarding staff", color: C.slate },
  { t: "Quarterly", s: "Inspection schedule by market", who: "Cleaning supervisors", color: C.gold },
];

export const UiHub: React.FC = () => (
  <AbsoluteFill>
    <PortalScreen workspace="Hub" nav={["Hub", "Operations", "Vendors", "Owners", "Command Center"]} active="Hub">
      <div style={{ fontSize: 34, fontWeight: 700 }}>Welcome back, Emily</div>
      <div style={{ fontSize: 17, color: C.slate, marginTop: 4, display: "flex", gap: 10, alignItems: "center" }}>
        <Pill label="Platform Owner" bg={C.charcoal} /> A Real Home Away
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginTop: 24 }}>
        {portals.map((p, i) => (
          <PortalTile key={p.t} {...p} delay={18 + i * 12} />
        ))}
      </div>
    </PortalScreen>

    <Callout
      text="You only see the portals your role authorises. Nobody has to be told which tab to avoid."
      x={1180}
      y={720}
      delay={120}
      width={420}
    />
    <Cursor
      path={[
        { f: 0, x: 900, y: 620 },
        { f: 90, x: 470, y: 470 },
        { f: 150, x: 900, y: 620 },
      ]}
    />
    <Caption kicker="Your home" text="One sign-in. Resolve opens the workspaces you are cleared for." />
  </AbsoluteFill>
);

const PortalTile: React.FC<{ t: string; s: string; who: string; color: string; delay: number }> = ({
  t,
  s,
  who,
  color,
  delay,
}) => {
  const e = useEnter(delay);
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #E2DED4",
        borderLeft: `5px solid ${color}`,
        borderRadius: 12,
        padding: "18px 20px",
        opacity: e,
        transform: `translateY(${(1 - e) * 20}px)`,
      }}
    >
      <div style={{ fontSize: 24, fontWeight: 700 }}>{t}</div>
      <div style={{ fontSize: 17, color: C.slate, marginTop: 6, minHeight: 46 }}>{s}</div>
      <div style={{ fontSize: 15, color, fontWeight: 700, marginTop: 4 }}>{who}</div>
    </div>
  );
};
