import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { C } from "../theme";

const rules = [
  "One matter per issue — log it once, in Resolve.",
  "The property picks the pod; priority and time pick the person.",
  "A handoff is not complete until it is accepted.",
  "Nothing closes without the evidence the playbook requires.",
];

export const TrainingOutro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const mark = spring({ frame, fps, config: { damping: 14, stiffness: 140 } });

  return (
    <AbsoluteFill style={{ justifyContent: "center", padding: "0 140px", fontFamily: "var(--brand-font)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
        <div
          style={{
            width: 80,
            height: 80,
            borderRadius: 12,
            background: C.teal,
            display: "grid",
            placeItems: "center",
            fontWeight: 700,
            fontSize: 46,
            color: C.ink,
            opacity: mark,
            transform: `scale(${interpolate(mark, [0, 1], [0.7, 1])})`,
          }}
        >
          R
        </div>
        <div
          style={{
            fontWeight: 700,
            fontSize: 74,
            color: C.ivory,
            opacity: interpolate(frame, [8, 30], [0, 1], { extrapolateRight: "clamp" }),
          }}
        >
          The four rules that never change
        </div>
      </div>

      <div style={{ display: "grid", gap: 14, marginTop: 44 }}>
        {rules.map((r, i) => {
          const s = spring({ frame: frame - (30 + i * 20), fps, config: { damping: 18, stiffness: 130 } });
          return (
            <div
              key={r}
              style={{
                fontSize: 32,
                color: C.ivory,
                display: "flex",
                gap: 16,
                opacity: s,
                transform: `translateY(${interpolate(s, [0, 1], [24, 0])}px)`,
              }}
            >
              <span style={{ color: C.gold, fontWeight: 700 }}>{i + 1}.</span>
              {r}
            </div>
          );
        })}
      </div>

      <div
        style={{
          marginTop: 52,
          fontSize: 28,
          color: C.gold,
          opacity: interpolate(frame, [120, 148], [0, 1], { extrapolateRight: "clamp" }),
        }}
      >
        This is where we are today — more is coming. Questions go to your supervisor or the Coach.
      </div>
    </AbsoluteFill>
  );
};
