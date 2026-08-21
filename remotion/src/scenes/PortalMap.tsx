import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { C } from "../theme";
import { Caption } from "../components/Ui";

const nodes = [
  { id: "exec", t: "Executive", s: "Command Center · health scores", x: 760, y: 120, w: 400, color: C.gold },
  { id: "ops", t: "Coordinators", s: "Matters · Coach · Handoffs", x: 760, y: 430, w: 400, color: C.teal },
  { id: "vendor", t: "Vendors", s: "Jobs · check-in · scorecards", x: 200, y: 640, w: 420, color: C.orange },
  { id: "owner", t: "Homeowners", s: "90-day program · time log", x: 1300, y: 640, w: 420, color: C.deepTeal },
];

const flows: { from: string; to: string; at: number; label: string }[] = [
  { from: "ops", to: "vendor", at: 60, label: "dispatch" },
  { from: "vendor", to: "ops", at: 110, label: "evidence" },
  { from: "ops", to: "owner", at: 160, label: "tasks" },
  { from: "owner", to: "ops", at: 205, label: "logged hours" },
  { from: "ops", to: "exec", at: 250, label: "live KPIs" },
];

const center = (id: string) => {
  const n = nodes.find((x) => x.id === id)!;
  return { x: n.x + n.w / 2, y: n.y + 52 };
};

export const PortalMap: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill style={{ fontFamily: "var(--brand-font)" }}>
      <div
        style={{
          position: "absolute",
          left: 140,
          top: 70,
          fontSize: 22,
          letterSpacing: 8,
          textTransform: "uppercase",
          color: C.teal,
          opacity: interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" }),
        }}
      >
        How the portals talk to each other
      </div>

      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
        {flows.map((f) => {
          const a = center(f.from);
          const b = center(f.to);
          const p = interpolate(frame, [f.at, f.at + 34], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          const x = a.x + (b.x - a.x) * p;
          const y = a.y + (b.y - a.y) * p;
          const shown = frame > f.at;
          return (
            <g key={`${f.from}-${f.to}-${f.at}`}>
              <line
                x1={a.x}
                y1={a.y}
                x2={a.x + (b.x - a.x) * p}
                y2={a.y + (b.y - a.y) * p}
                stroke={`${C.ivory}55`}
                strokeWidth={2}
                strokeDasharray="8 8"
              />
              {shown && (
                <>
                  <circle cx={x} cy={y} r={9} fill={C.teal} />
                  <text
                    x={(a.x + b.x) / 2}
                    y={(a.y + b.y) / 2 - 12}
                    fill={C.ivory}
                    fontSize={22}
                    textAnchor="middle"
                    opacity={interpolate(frame, [f.at + 8, f.at + 26], [0, 0.9], {
                      extrapolateLeft: "clamp",
                      extrapolateRight: "clamp",
                    })}
                  >
                    {f.label}
                  </text>
                </>
              )}
            </g>
          );
        })}
      </svg>

      {nodes.map((n, i) => {
        const s = spring({ frame: frame - (14 + i * 10), fps, config: { damping: 18, stiffness: 130 } });
        return (
          <div
            key={n.id}
            style={{
              position: "absolute",
              left: n.x,
              top: n.y,
              width: n.w,
              padding: "20px 24px",
              borderRadius: 14,
              background: `${C.charcoal}f2`,
              border: `2px solid ${n.color}`,
              opacity: s,
              transform: `scale(${interpolate(s, [0, 1], [0.9, 1])})`,
            }}
          >
            <div style={{ fontSize: 30, fontWeight: 700, color: C.ivory }}>{n.t}</div>
            <div style={{ fontSize: 20, color: `${C.ivory}aa`, marginTop: 6 }}>{n.s}</div>
          </div>
        );
      })}

      <Caption
        kicker="One record"
        text="Nothing is re-keyed. Every portal writes to the same matter."
      />
    </AbsoluteFill>
  );
};
