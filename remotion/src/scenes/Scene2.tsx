import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { C } from "../theme";

const fragments = [
  { label: "Guest text", tone: C.slate },
  { label: "Handyman call", tone: C.slate },
  { label: "Sticky note", tone: C.slate },
  { label: "Nobody owns it", tone: C.orange },
];

export const Scene2: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill style={{ padding: "0 140px", justifyContent: "center" }}>
      <div
        style={{
          fontFamily: "var(--brand-font)",
          fontWeight: 700,
          fontSize: 66,
          color: C.ivory,
          maxWidth: 900,
          opacity: interpolate(frame, [0, 16], [0, 1], { extrapolateRight: "clamp" }),
          transform: `translateY(${interpolate(frame, [0, 20], [30, 0], { extrapolateRight: "clamp" })}px)`,
        }}
      >
        The instructions lived in someone&apos;s head.
      </div>

      <div style={{ display: "flex", gap: 22, marginTop: 56 }}>
        {fragments.map((f, i) => {
          const s = spring({ frame: frame - (20 + i * 9), fps, config: { damping: 14, stiffness: 140 } });
          const wobble = Math.sin((frame - i * 12) / 18) * 2.2;
          return (
            <div
              key={f.label}
              style={{
                fontFamily: "var(--brand-font)",
                fontSize: 26,
                color: f.tone === C.orange ? C.orange : C.ivory,
                border: `1px solid ${f.tone}88`,
                background: `${C.charcoal}cc`,
                padding: "22px 26px",
                borderRadius: 8,
                opacity: s,
                transform: `translateY(${interpolate(s, [0, 1], [60, 0])}px) rotate(${wobble * (i % 2 ? -1 : 1)}deg)`,
              }}
            >
              {f.label}
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
