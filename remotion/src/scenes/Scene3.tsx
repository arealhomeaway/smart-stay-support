import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { C } from "../theme";

const rows = [
  { k: "Property", v: "852 Inland Dr." },
  { k: "Occupancy", v: "Guest in house — live from OwnerRez" },
  { k: "Priority", v: "P1 · Safety" },
  { k: "Owning seat", v: "Property Ops — Evening" },
];

export const Scene3: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const card = spring({ frame: frame - 6, fps, config: { damping: 200 } });

  return (
    <AbsoluteFill style={{ padding: "0 130px", justifyContent: "center" }}>
      <div
        style={{
          fontFamily: "var(--brand-font)",
          fontSize: 22,
          letterSpacing: 6,
          textTransform: "uppercase",
          color: C.teal,
          opacity: interpolate(frame, [0, 14], [0, 1], { extrapolateRight: "clamp" }),
        }}
      >
        Resolve
      </div>
      <div
        style={{
          fontFamily: "var(--brand-font)",
          fontWeight: 700,
          fontSize: 64,
          color: C.ivory,
          marginTop: 10,
          opacity: interpolate(frame, [4, 22], [0, 1], { extrapolateRight: "clamp" }),
        }}
      >
        One matter. One owner. One clock.
      </div>

      <div
        style={{
          marginTop: 44,
          width: 1080,
          background: `${C.charcoal}f2`,
          border: `1px solid ${C.slate}66`,
          borderLeft: `6px solid ${C.orange}`,
          borderRadius: 10,
          padding: "30px 36px",
          opacity: card,
          transform: `translateY(${interpolate(card, [0, 1], [50, 0])}px) scale(${interpolate(card, [0, 1], [0.97, 1])})`,
        }}
      >
        {rows.map((r, i) => {
          const s = spring({ frame: frame - (26 + i * 10), fps, config: { damping: 200 } });
          return (
            <div
              key={r.k}
              style={{
                display: "flex",
                gap: 40,
                padding: "14px 0",
                borderBottom: i < rows.length - 1 ? `1px solid ${C.slate}33` : "none",
                opacity: s,
                transform: `translateX(${interpolate(s, [0, 1], [28, 0])}px)`,
              }}
            >
              <div style={{ fontFamily: "var(--brand-font)", fontSize: 26, color: C.slate, width: 260 }}>{r.k}</div>
              <div
                style={{
                  fontFamily: "var(--brand-font)",
                  fontSize: 30,
                  fontWeight: 700,
                  color: r.k === "Priority" ? C.orange : C.ivory,
                }}
              >
                {r.v}
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
