import { AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { C } from "../theme";

const F = "Carlito, sans-serif";

export type Cap = { at: number; dur: number; text: string; strong?: boolean };

export const Backdrop: React.FC = () => (
  <AbsoluteFill
    style={{
      background: `radial-gradient(1200px 700px at 20% 0%, #2b3538 0%, ${C.charcoal} 45%, ${C.ink} 100%)`,
    }}
  />
);

/** Small section label that rides above the screen. */
export const Chip: React.FC<{ label: string; tone?: string }> = ({ label, tone = C.teal }) => (
  <div
    style={{
      position: "absolute",
      left: 84,
      top: 44,
      display: "flex",
      alignItems: "center",
      gap: 12,
      fontFamily: F,
      color: C.ivory,
      fontSize: 26,
      letterSpacing: 2,
      textTransform: "uppercase",
    }}
  >
    <span style={{ width: 10, height: 10, borderRadius: 10, background: tone }} />
    {label}
  </div>
);

const Caption: React.FC<{ cap: Cap; frame: number }> = ({ cap, frame }) => {
  const local = frame - cap.at;
  if (local < -6 || local > cap.dur + 12) return null;
  const inP = interpolate(local, [0, 14], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const outP = interpolate(local, [cap.dur, cap.dur + 12], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const o = inP * outP;
  return (
    <div
      style={{
        position: "absolute",
        left: 84,
        bottom: 74,
        maxWidth: 1180,
        opacity: o,
        transform: `translateY(${interpolate(inP, [0, 1], [26, 0])}px)`,
        display: "flex",
        alignItems: "stretch",
        gap: 18,
      }}
    >
      <div style={{ width: 6, borderRadius: 6, background: cap.strong ? C.orange : C.teal }} />
      <div
        style={{
          background: "rgba(18,23,25,0.9)",
          borderRadius: 12,
          padding: cap.strong ? "18px 28px" : "14px 24px",
          fontFamily: F,
          color: C.ivory,
          fontSize: cap.strong ? 46 : 36,
          fontWeight: cap.strong ? 700 : 400,
          lineHeight: 1.25,
        }}
      >
        {cap.text}
      </div>
    </div>
  );
};

/** A live screenshot with a slow push-in toward a focal point, plus timed captions. */
export const Shot: React.FC<{
  src: string;
  dur: number;
  fx?: number;
  fy?: number;
  z0?: number;
  z1?: number;
  chip?: string;
  caps?: Cap[];
}> = ({ src, dur, fx = 0.5, fy = 0.35, z0 = 1.02, z1 = 1.12, chip, caps = [] }) => {
  const frame = useCurrentFrame();
  const z = interpolate(frame, [0, dur], [z0, z1], {
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.quad),
  });
  const appear = interpolate(frame, [0, 16], [0, 1], { extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  const lift = interpolate(appear, [0, 1], [34, 0]);
  const drift = Math.sin(frame / 90) * 3;

  return (
    <AbsoluteFill>
      <Backdrop />
      <div
        style={{
          position: "absolute",
          left: 80,
          top: 96,
          width: 1760,
          height: 900,
          borderRadius: 18,
          overflow: "hidden",
          boxShadow: "0 60px 130px rgba(0,0,0,0.6)",
          background: C.ivory,
          opacity: appear,
          transform: `translateY(${lift + drift}px)`,
        }}
      >
        <Img
          src={staticFile(`shots/${src}.png`)}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: `${fx * 100}% ${fy * 100}%`,
            transform: `scale(${z})`,
            transformOrigin: `${fx * 100}% ${fy * 100}%`,
          }}
        />
      </div>
      {chip && <Chip label={chip} />}
      {caps.map((c, i) => (
        <Caption key={i} cap={c} frame={frame} />
      ))}
    </AbsoluteFill>
  );
};
