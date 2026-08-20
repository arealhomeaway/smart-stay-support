import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { C } from "../theme";

const chips = ["Intake", "Coach", "Dispatch", "Handoff", "Close"];

export const SceneExecIntro: React.FC = () => {
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
            opacity: interpolate(frame, [8, 26], [0, 1], { extrapolateRight: "clamp" }),
          }}
        >
          A Real Home Away · Resolve
        </div>
      </div>

      <div
        style={{
          fontWeight: 700,
          fontSize: 92,
          lineHeight: 1.08,
          color: C.ivory,
          maxWidth: 1250,
          marginTop: 26,
          opacity: interpolate(frame, [14, 36], [0, 1], { extrapolateRight: "clamp" }),
          transform: `translateY(${interpolate(frame, [14, 40], [40, 0], { extrapolateRight: "clamp" })}px)`,
        }}
      >
        One queue for every issue, every home, every system.
      </div>

      <div
        style={{
          marginTop: 22,
          fontSize: 34,
          color: C.gold,
          opacity: interpolate(frame, [40, 62], [0, 1], { extrapolateRight: "clamp" }),
        }}
      >
        Executive walkthrough — intake to close, including inbound sync.
      </div>

      <div style={{ display: "flex", gap: 14, marginTop: 46 }}>
        {chips.map((c, i) => {
          const s = spring({ frame: frame - (54 + i * 8), fps, config: { damping: 16, stiffness: 150 } });
          return (
            <div
              key={c}
              style={{
                padding: "12px 22px",
                borderRadius: 999,
                border: `1px solid ${C.teal}88`,
                background: `${C.charcoal}cc`,
                color: C.ivory,
                fontSize: 24,
                opacity: s,
                transform: `translateY(${interpolate(s, [0, 1], [26, 0])}px)`,
              }}
            >
              {c}
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
