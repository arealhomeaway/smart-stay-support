import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { C } from "../theme";

export const Scene5: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const line = interpolate(frame, [24, 60], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const accept = spring({ frame: frame - 62, fps, config: { damping: 12, stiffness: 160 } });

  const Seat = ({ title, sub, delay, tone }: { title: string; sub: string; delay: number; tone: string }) => {
    const s = spring({ frame: frame - delay, fps, config: { damping: 200 } });
    return (
      <div
        style={{
          width: 380,
          background: `${C.charcoal}f2`,
          border: `1px solid ${tone}88`,
          borderRadius: 10,
          padding: "26px 28px",
          opacity: s,
          transform: `translateY(${interpolate(s, [0, 1], [40, 0])}px)`,
        }}
      >
        <div style={{ fontFamily: "var(--brand-font)", fontSize: 22, color: tone, letterSpacing: 3, textTransform: "uppercase" }}>
          {sub}
        </div>
        <div style={{ fontFamily: "var(--brand-font)", fontSize: 34, fontWeight: 700, color: C.ivory, marginTop: 8 }}>
          {title}
        </div>
      </div>
    );
  };

  return (
    <AbsoluteFill style={{ padding: "0 130px", justifyContent: "center" }}>
      <div
        style={{
          fontFamily: "var(--brand-font)",
          fontWeight: 700,
          fontSize: 58,
          color: C.ivory,
          opacity: interpolate(frame, [0, 16], [0, 1], { extrapolateRight: "clamp" }),
        }}
      >
        A handoff isn&apos;t done until it&apos;s <span style={{ color: C.teal }}>accepted.</span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 30, marginTop: 60 }}>
        <Seat sub="Handing off" title="Guest Experience — Day" delay={14} tone={C.slate} />
        <div style={{ position: "relative", width: 220, height: 4, background: `${C.slate}44` }}>
          <div style={{ position: "absolute", inset: 0, width: `${line * 100}%`, background: C.teal }} />
          <div
            style={{
              position: "absolute",
              top: -9,
              left: `calc(${line * 100}% - 11px)`,
              width: 22,
              height: 22,
              borderRadius: 11,
              background: C.teal,
              opacity: line > 0 ? 1 : 0,
            }}
          />
        </div>
        <Seat sub="Receiving" title="Property Ops — Evening" delay={30} tone={C.teal} />
      </div>

      <div
        style={{
          marginTop: 46,
          display: "inline-flex",
          alignSelf: "flex-start",
          alignItems: "center",
          gap: 14,
          background: C.teal,
          color: C.ink,
          fontFamily: "var(--brand-font)",
          fontWeight: 700,
          fontSize: 28,
          padding: "16px 30px",
          borderRadius: 8,
          opacity: accept,
          transform: `scale(${interpolate(accept, [0, 1], [0.85, 1])})`,
        }}
      >
        Accepted — ownership transferred
      </div>
    </AbsoluteFill>
  );
};
