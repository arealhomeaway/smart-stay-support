import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { C } from "../theme";

const audiences = [
  { t: "Executive", s: "Command Center" },
  { t: "Coordinators", s: "Operations" },
  { t: "Vendors", s: "Field portal" },
  { t: "Homeowners", s: "Owner portal" },
];

export const TrainingIntro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const mark = spring({ frame, fps, config: { damping: 14, stiffness: 140 } });

  return (
    <AbsoluteFill style={{ padding: "0 140px", justifyContent: "center", fontFamily: "var(--brand-font)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
        <div
          style={{
            width: 68,
            height: 68,
            borderRadius: 10,
            background: C.teal,
            color: C.ink,
            display: "grid",
            placeItems: "center",
            fontWeight: 700,
            fontSize: 40,
            opacity: mark,
            transform: `scale(${interpolate(mark, [0, 1], [0.7, 1])})`,
          }}
        >
          R
        </div>
        <div
          style={{
            fontSize: 24,
            letterSpacing: 8,
            textTransform: "uppercase",
            color: C.teal,
            opacity: interpolate(frame, [10, 34], [0, 1], { extrapolateRight: "clamp" }),
          }}
        >
          A Real Home Away · Team training
        </div>
      </div>

      <div
        style={{
          fontWeight: 700,
          fontSize: 86,
          lineHeight: 1.1,
          color: C.ivory,
          maxWidth: 1300,
          marginTop: 30,
          opacity: interpolate(frame, [22, 52], [0, 1], { extrapolateRight: "clamp" }),
          transform: `translateY(${interpolate(frame, [22, 58], [40, 0], { extrapolateRight: "clamp" })}px)`,
        }}
      >
        Resolve is one operating system for everyone who touches a home.
      </div>

      <div
        style={{
          marginTop: 24,
          fontSize: 32,
          color: C.gold,
          maxWidth: 1200,
          opacity: interpolate(frame, [64, 92], [0, 1], { extrapolateRight: "clamp" }),
        }}
      >
        Four portals, one shared record. Take your time with this one — every screen you are about to see is
        a screen you will use.
      </div>

      <div style={{ display: "flex", gap: 16, marginTop: 52 }}>
        {audiences.map((a, i) => {
          const s = spring({ frame: frame - (92 + i * 12), fps, config: { damping: 18, stiffness: 140 } });
          return (
            <div
              key={a.t}
              style={{
                padding: "18px 26px",
                borderRadius: 12,
                border: `1px solid ${C.teal}77`,
                background: `${C.charcoal}cc`,
                opacity: s,
                transform: `translateY(${interpolate(s, [0, 1], [30, 0])}px)`,
              }}
            >
              <div style={{ fontSize: 26, color: C.ivory, fontWeight: 700 }}>{a.t}</div>
              <div style={{ fontSize: 19, color: `${C.ivory}99`, marginTop: 4 }}>{a.s}</div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
