import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { C } from "../theme";

export const Scene6: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const mark = spring({ frame, fps, config: { damping: 14, stiffness: 140 } });
  const sway = Math.sin(frame / 40) * 6;

  return (
    <AbsoluteFill style={{ justifyContent: "center", padding: "0 140px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 28, transform: `translateY(${sway}px)` }}>
        <div
          style={{
            width: 96,
            height: 96,
            borderRadius: 12,
            background: C.teal,
            display: "grid",
            placeItems: "center",
            fontFamily: "var(--brand-font)",
            fontWeight: 700,
            fontSize: 56,
            color: C.ink,
            opacity: mark,
            transform: `scale(${interpolate(mark, [0, 1], [0.7, 1])})`,
          }}
        >
          R
        </div>
        <div
          style={{
            fontFamily: "var(--brand-font)",
            fontWeight: 700,
            fontSize: 92,
            color: C.ivory,
            opacity: interpolate(frame, [8, 28], [0, 1], { extrapolateRight: "clamp" }),
            transform: `translateX(${interpolate(frame, [8, 34], [-24, 0], { extrapolateRight: "clamp" })}px)`,
          }}
        >
          Resolve
        </div>
      </div>

      <div
        style={{
          marginTop: 26,
          fontFamily: "var(--brand-font)",
          fontSize: 36,
          color: C.gold,
          opacity: interpolate(frame, [26, 50], [0, 1], { extrapolateRight: "clamp" }),
          transform: `translateY(${interpolate(frame, [26, 50], [22, 0], { extrapolateRight: "clamp" })}px)`,
        }}
      >
        Common sense, written down and enforced.
      </div>

      <div
        style={{
          marginTop: 46,
          height: 3,
          width: interpolate(frame, [46, 90], [0, 760], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
          background: `linear-gradient(90deg, ${C.teal}, ${C.orange})`,
        }}
      />
    </AbsoluteFill>
  );
};
