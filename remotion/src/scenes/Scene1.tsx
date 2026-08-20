import { AbsoluteFill, Sequence, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { C } from "../theme";

const lines = ["A leak under the sink.", "An alarm no one could find.", "A hole where the detector was."];

export const Scene1: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill style={{ padding: "0 140px", justifyContent: "center" }}>
      <div
        style={{
          fontFamily: "var(--brand-font)",
          fontSize: 24,
          letterSpacing: 8,
          textTransform: "uppercase",
          color: C.teal,
          opacity: interpolate(frame, [4, 22], [0, 1], { extrapolateRight: "clamp" }),
          transform: `translateX(${interpolate(frame, [4, 30], [-30, 0], { extrapolateRight: "clamp" })}px)`,
        }}
      >
        One night, one property
      </div>

      {lines.map((line, i) => {
        const delay = 18 + i * 22;
        const s = spring({ frame: frame - delay, fps, config: { damping: 200 } });
        return (
          <Sequence key={line} from={0} layout="none">
            <div
              style={{
                fontFamily: "var(--brand-font)",
                fontWeight: 700,
                fontSize: 88,
                lineHeight: 1.12,
                color: i === 2 ? C.orange : C.ivory,
                opacity: s,
                transform: `translateY(${interpolate(s, [0, 1], [46, 0])}px)`,
                filter: `blur(${interpolate(s, [0, 1], [10, 0])}px)`,
                marginTop: i === 0 ? 28 : 0,
              }}
            >
              {line}
            </div>
          </Sequence>
        );
      })}

      <div
        style={{
          marginTop: 40,
          height: 3,
          width: interpolate(frame, [86, 120], [0, 620], { extrapolateRight: "clamp", extrapolateLeft: "clamp" }),
          background: C.gold,
        }}
      />
    </AbsoluteFill>
  );
};
