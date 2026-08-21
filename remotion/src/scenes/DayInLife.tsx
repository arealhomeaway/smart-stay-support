import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { C } from "../theme";
import { Caption } from "../components/Ui";

const beats = [
  { t: "7:40 AM", who: "Guest", c: C.slate, d: "Message lands. Resolve opens a matter and pulls occupancy from OwnerRez." },
  { t: "7:43 AM", who: "Coordinator", c: C.teal, d: "Asks the Coach, follows the playbook, sets P2 and the response clock starts." },
  { t: "8:05 AM", who: "Vendor", c: C.orange, d: "Accepts the dispatch, checks in on site, uploads the required photos." },
  { t: "11:20 AM", who: "Owner", c: C.deepTeal, d: "Approves the quote from the owner portal and logs their own time." },
  { t: "5:00 PM", who: "Supervisor", c: C.gold, d: "Oversight shows nothing stalled; the handoff was accepted, not just sent." },
];

export const DayInLife: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill style={{ fontFamily: "var(--brand-font)", padding: "90px 140px 0" }}>
      <div
        style={{
          fontSize: 22,
          letterSpacing: 8,
          textTransform: "uppercase",
          color: C.teal,
          opacity: interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" }),
        }}
      >
        One matter, one day, four portals
      </div>
      <div
        style={{
          fontSize: 58,
          fontWeight: 700,
          color: C.ivory,
          marginTop: 12,
          opacity: interpolate(frame, [10, 34], [0, 1], { extrapolateRight: "clamp" }),
        }}
      >
        This is what it looks like in practice.
      </div>

      <div style={{ marginTop: 44, display: "grid", gap: 16 }}>
        {beats.map((b, i) => {
          const at = 34 + i * 34;
          const s = spring({ frame: frame - at, fps, config: { damping: 18, stiffness: 130 } });
          return (
            <div
              key={b.t}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 24,
                padding: "18px 26px",
                borderRadius: 12,
                background: `${C.charcoal}e0`,
                borderLeft: `6px solid ${b.c}`,
                opacity: s,
                transform: `translateX(${interpolate(s, [0, 1], [-40, 0])}px)`,
              }}
            >
              <div style={{ width: 130, fontSize: 26, fontWeight: 700, color: b.c }}>{b.t}</div>
              <div style={{ width: 200, fontSize: 24, color: C.ivory, fontWeight: 700 }}>{b.who}</div>
              <div style={{ flex: 1, fontSize: 24, color: `${C.ivory}cc` }}>{b.d}</div>
            </div>
          );
        })}
      </div>

      <Caption kicker="Day to day" text="Nobody re-typed anything. The matter carried itself." />
    </AbsoluteFill>
  );
};
