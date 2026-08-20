import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { C } from "../theme";

export const PersistentBackground: React.FC = () => {
  const frame = useCurrentFrame();
  const drift = Math.sin(frame / 90) * 40;
  const drift2 = Math.cos(frame / 120) * 60;
  return (
    <AbsoluteFill style={{ backgroundColor: C.ink }}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(1100px 700px at ${18 + drift / 8}% ${28 + drift2 / 20}%, ${C.deepTeal}44, transparent 65%),
                       radial-gradient(900px 600px at ${86 - drift / 10}% ${78 + drift / 25}%, ${C.orange}22, transparent 60%),
                       linear-gradient(160deg, ${C.charcoal} 0%, ${C.ink} 100%)`,
        }}
      />
      <AbsoluteFill
        style={{
          opacity: 0.06,
          backgroundImage: `linear-gradient(${C.ivory} 1px, transparent 1px), linear-gradient(90deg, ${C.ivory} 1px, transparent 1px)`,
          backgroundSize: "80px 80px",
          transform: `translate(${drift / 6}px, ${drift2 / 8}px)`,
        }}
      />
    </AbsoluteFill>
  );
};

export const PersistentAccents: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          height: 6,
          width: `${interpolate(frame, [0, 1400], [0, 100], { extrapolateRight: "clamp" })}%`,
          background: `linear-gradient(90deg, ${C.teal}, ${C.gold})`,
          opacity: 0.9,
        }}
      />
      <div
        style={{
          position: "absolute",
          right: 64,
          bottom: 48,
          fontFamily: "var(--brand-font)",
          fontSize: 22,
          letterSpacing: 4,
          color: `${C.ivory}66`,
          textTransform: "uppercase",
        }}
      >
        A Real Home Away
      </div>
    </AbsoluteFill>
  );
};
