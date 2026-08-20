import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { C } from "../theme";

const stats = [
  { v: "One", l: "queue for OwnerRez, Breezeway and guest messages" },
  { v: "3 min", l: "acknowledgement standard on every P1, tracked live" },
  { v: "0", l: "matters closed without the required safety evidence" },
];

export const SceneImpact: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill style={{ padding: "0 140px", justifyContent: "center", fontFamily: "var(--brand-font)" }}>
      <div
        style={{
          fontSize: 22,
          letterSpacing: 8,
          textTransform: "uppercase",
          color: C.teal,
          opacity: interpolate(frame, [0, 18], [0, 1], { extrapolateRight: "clamp" }),
        }}
      >
        What it changes
      </div>

      <div
        style={{
          fontWeight: 700,
          fontSize: 68,
          color: C.ivory,
          maxWidth: 1150,
          marginTop: 16,
          opacity: interpolate(frame, [8, 30], [0, 1], { extrapolateRight: "clamp" }),
          transform: `translateY(${interpolate(frame, [8, 34], [30, 0], { extrapolateRight: "clamp" })}px)`,
        }}
      >
        Risk is caught by the system, not by whoever happens to be awake.
      </div>

      <div style={{ display: "flex", gap: 22, marginTop: 54 }}>
        {stats.map((s, i) => {
          const sp = spring({ frame: frame - (34 + i * 12), fps, config: { damping: 18, stiffness: 130 } });
          return (
            <div
              key={s.l}
              style={{
                flex: 1,
                padding: "26px 28px",
                borderRadius: 12,
                background: `${C.charcoal}dd`,
                border: `1px solid ${C.teal}55`,
                opacity: sp,
                transform: `translateY(${interpolate(sp, [0, 1], [46, 0])}px)`,
              }}
            >
              <div style={{ fontSize: 54, fontWeight: 700, color: C.gold }}>{s.v}</div>
              <div style={{ fontSize: 23, color: C.ivory, marginTop: 8, lineHeight: 1.35 }}>{s.l}</div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
