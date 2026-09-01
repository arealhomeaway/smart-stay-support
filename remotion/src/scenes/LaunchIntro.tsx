import { AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig, spring } from "remotion";
import { C } from "../theme";

const F = "Carlito, sans-serif";

export const LaunchIntro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = (d: number, damping = 200) => spring({ frame: frame - d, fps, config: { damping } });

  const logo = s(0);
  const title = s(10);
  const tag = s(34);
  const sub = s(70);
  const sweep = interpolate(frame, [0, 90], [0, 1], { extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(1400px 900px at 30% 10%, #2c383b 0%, ${C.charcoal} 50%, ${C.ink} 100%)`,
      }}
    >
      <div
        style={{
          position: "absolute",
          left: -200,
          top: 0,
          width: 700,
          height: 1080,
          background: `linear-gradient(90deg, transparent, ${C.teal}22, transparent)`,
          transform: `translateX(${sweep * 1900}px) skewX(-12deg)`,
        }}
      />
      <div style={{ position: "absolute", left: 150, top: 300, fontFamily: F, color: C.ivory }}>
        <div style={{ opacity: logo, transform: `translateY(${interpolate(logo, [0, 1], [30, 0])}px)` }}>
          <Img src={staticFile("arha-logo-white.png")} style={{ width: 150 }} />
        </div>
        <div
          style={{
            fontSize: 148,
            fontWeight: 700,
            letterSpacing: -2,
            marginTop: 18,
            opacity: title,
            transform: `translateY(${interpolate(title, [0, 1], [50, 0])}px)`,
          }}
        >
          ARHA Resolve
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 20,
            marginTop: 6,
            opacity: tag,
            transform: `translateX(${interpolate(tag, [0, 1], [-40, 0])}px)`,
          }}
        >
          <div style={{ width: 90, height: 6, background: C.teal, borderRadius: 6 }} />
          <div style={{ fontSize: 54, color: C.teal, letterSpacing: 1 }}>Keep Calm. Check Resolve.</div>
        </div>
        <div
          style={{
            fontSize: 46,
            marginTop: 54,
            opacity: sub * 0.85,
            transform: `translateY(${interpolate(sub, [0, 1], [26, 0])}px)`,
          }}
        >
          Your new Operations workspace.
        </div>
      </div>
    </AbsoluteFill>
  );
};
