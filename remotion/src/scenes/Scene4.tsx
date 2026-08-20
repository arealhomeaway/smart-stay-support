import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { C } from "../theme";

const steps = [
  "Stop the leak at the source",
  "Test every smoke and CO alarm in the home",
  "Any device removed is replaced the same visit",
  "Photo proof of the finished wall",
  "Guest confirms the issue is resolved",
];

export const Scene4: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill style={{ padding: "0 130px", justifyContent: "center" }}>
      <div
        style={{
          fontFamily: "var(--brand-font)",
          fontWeight: 700,
          fontSize: 58,
          color: C.ivory,
          opacity: interpolate(frame, [0, 16], [0, 1], { extrapolateRight: "clamp" }),
          transform: `translateY(${interpolate(frame, [0, 20], [26, 0], { extrapolateRight: "clamp" })}px)`,
        }}
      >
        The playbook goes out <span style={{ color: C.gold }}>with the vendor.</span>
      </div>

      <div style={{ marginTop: 44 }}>
        {steps.map((s, i) => {
          const appear = spring({ frame: frame - (18 + i * 11), fps, config: { damping: 200 } });
          const check = spring({ frame: frame - (46 + i * 13), fps, config: { damping: 12, stiffness: 180 } });
          return (
            <div
              key={s}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 24,
                padding: "13px 0",
                opacity: appear,
                transform: `translateX(${interpolate(appear, [0, 1], [40, 0])}px)`,
              }}
            >
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 6,
                  border: `2px solid ${interpolate(check, [0, 1], [0, 1]) > 0.5 ? C.teal : C.slate}`,
                  background: `${C.teal}${check > 0.5 ? "ff" : "00"}`,
                  display: "grid",
                  placeItems: "center",
                  transform: `scale(${interpolate(check, [0, 1], [1, 1.06])})`,
                }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M4 12.5L9.5 18L20 6"
                    stroke={C.ink}
                    strokeWidth="3.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeDasharray="30"
                    strokeDashoffset={interpolate(check, [0, 1], [30, 0])}
                  />
                </svg>
              </div>
              <div
                style={{
                  fontFamily: "var(--brand-font)",
                  fontSize: 34,
                  color: i === 2 ? C.gold : C.ivory,
                  fontWeight: i === 2 ? 700 : 400,
                }}
              >
                {s}
              </div>
            </div>
          );
        })}
      </div>

      <div
        style={{
          marginTop: 30,
          fontFamily: "var(--brand-font)",
          fontSize: 26,
          color: C.slate,
          opacity: interpolate(frame, [120, 140], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
        }}
      >
        The matter cannot close until every required step has evidence.
      </div>
    </AbsoluteFill>
  );
};
