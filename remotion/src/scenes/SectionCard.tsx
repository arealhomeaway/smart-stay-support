import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { C } from "../theme";

const F = "Carlito, sans-serif";

export const SectionCard: React.FC<{ n: string; title: string; line?: string }> = ({ n, title, line }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = (d: number) => spring({ frame: frame - d, fps, config: { damping: 200 } });
  const a = s(0);
  const b = s(9);
  const c = s(20);
  const bar = interpolate(a, [0, 1], [0, 1]);

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(115deg, ${C.ink} 0%, ${C.charcoal} 55%, #263134 100%)`,
        fontFamily: F,
        color: C.ivory,
      }}
    >
      <div style={{ position: "absolute", left: 150, top: 400 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 22, opacity: a }}>
          <div style={{ width: bar * 120, height: 6, background: C.teal, borderRadius: 6 }} />
          <div style={{ fontSize: 30, letterSpacing: 5, color: C.teal }}>{n}</div>
        </div>
        <div
          style={{
            fontSize: 116,
            fontWeight: 700,
            letterSpacing: -1,
            marginTop: 14,
            opacity: b,
            transform: `translateY(${interpolate(b, [0, 1], [44, 0])}px)`,
          }}
        >
          {title}
        </div>
        {line && (
          <div
            style={{
              fontSize: 42,
              marginTop: 12,
              opacity: c * 0.8,
              transform: `translateY(${interpolate(c, [0, 1], [26, 0])}px)`,
            }}
          >
            {line}
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};
