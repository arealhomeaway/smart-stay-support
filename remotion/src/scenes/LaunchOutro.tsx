import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { C } from "../theme";

const F = "Carlito, sans-serif";

export const LaunchOutro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = (d: number) => spring({ frame: frame - d, fps, config: { damping: 200 } });
  const a = s(0);
  const b = s(34);
  const c = s(80);
  const d = s(120);

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(1300px 800px at 70% 90%, #2c383b 0%, ${C.charcoal} 50%, ${C.ink} 100%)`,
        fontFamily: F,
        color: C.ivory,
      }}
    >
      <div style={{ position: "absolute", left: 150, top: 300 }}>
        <div
          style={{
            fontSize: 74,
            fontWeight: 700,
            opacity: a,
            transform: `translateY(${interpolate(a, [0, 1], [40, 0])}px)`,
            maxWidth: 1500,
          }}
        >
          Resolve is now our primary Operations workspace.
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 20,
            marginTop: 60,
            opacity: b,
            transform: `translateX(${interpolate(b, [0, 1], [-40, 0])}px)`,
          }}
        >
          <div style={{ width: 90, height: 6, background: C.orange, borderRadius: 6 }} />
          <div style={{ fontSize: 62 }}>See it. Own it. Move it forward.</div>
        </div>
        <div
          style={{
            fontSize: 96,
            fontWeight: 700,
            color: C.teal,
            marginTop: 70,
            opacity: c,
            transform: `scale(${interpolate(c, [0, 1], [0.94, 1])})`,
            transformOrigin: "left center",
          }}
        >
          Keep Calm. Check Resolve.
        </div>
        <div style={{ opacity: d * 0.9, marginTop: 60 }}>
          <Img src={staticFile("arha-logo-white.png")} style={{ width: 120 }} />
        </div>
      </div>
    </AbsoluteFill>
  );
};
