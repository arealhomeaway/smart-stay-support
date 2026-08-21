import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { C } from "../theme";
import { Callout, Caption, CheckRow, Pill, useEnter } from "../components/Ui";
import { PortalScreen } from "../components/Portal";

const NAV = ["My jobs", "Map", "Schedule", "Documents", "Scorecard"];

export const UiVendorJob: React.FC = () => {
  const frame = useCurrentFrame();
  const accepted = frame > 70;
  const checkedIn = frame > 130;
  const e = useEnter(10);

  return (
    <AbsoluteFill>
      <PortalScreen workspace="Vendor" accent={C.orange} nav={NAV} active="My jobs">
        <div style={{ fontSize: 32, fontWeight: 700 }}>Dispatched to Ruiz Handyman Co.</div>
        <div style={{ fontSize: 17, color: C.slate, marginTop: 4 }}>
          Your crew sees the brief, the access notes and the evidence you owe — nothing else about the home.
        </div>

        <div style={{ display: "flex", gap: 18, marginTop: 22 }}>
          <div
            style={{
              flex: 1.25,
              background: "#fff",
              border: "1px solid #E2DED4",
              borderRadius: 12,
              padding: 20,
              opacity: e,
              transform: `translateY(${(1 - e) * 18}px)`,
            }}
          >
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <Pill label="P2" bg={C.orange} />
              <div style={{ fontWeight: 700, fontSize: 22 }}>#1841 · Smoke detector removed by guest</div>
            </div>
            <div style={{ fontSize: 17, color: C.slate, marginTop: 6 }}>
              4412 S Gary Ave, Tulsa · Guest in house until Sun · Lockbox 4417
            </div>

            <div style={{ marginTop: 16, fontSize: 15, color: C.slate, letterSpacing: 2 }}>SCOPE FROM THE COACH</div>
            <div
              style={{
                marginTop: 8,
                background: `${C.teal}10`,
                border: `1px solid ${C.teal}55`,
                borderRadius: 10,
                padding: 14,
                fontSize: 18,
                lineHeight: 1.45,
              }}
            >
              Replace the removed detector with a like-for-like unit. Test every smoke and CO device in the home.
              Patch and paint the mount point — never leave an open hole. Photograph the wall before and after.
            </div>

            <div style={{ display: "flex", gap: 12, marginTop: 18 }}>
              <div
                style={{
                  padding: "12px 22px",
                  borderRadius: 9,
                  background: accepted ? `${C.teal}22` : C.orange,
                  color: accepted ? C.deepTeal : "#fff",
                  border: accepted ? `1px solid ${C.teal}` : "none",
                  fontWeight: 700,
                  fontSize: 19,
                }}
              >
                {accepted ? "✓ Accepted 6:12 PM" : "Accept job"}
              </div>
              <div
                style={{
                  padding: "12px 22px",
                  borderRadius: 9,
                  border: `1px solid ${checkedIn ? C.teal : "#DAD5C9"}`,
                  background: checkedIn ? `${C.teal}18` : "#fff",
                  fontWeight: 700,
                  fontSize: 19,
                  color: checkedIn ? C.deepTeal : C.charcoal,
                }}
              >
                {checkedIn ? "✓ Checked in on site (GPS verified)" : "Check in on arrival"}
              </div>
            </div>
          </div>

          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, color: C.slate, letterSpacing: 2, marginBottom: 8 }}>
              CLOSURE EVIDENCE REQUIRED
            </div>
            <div style={{ display: "grid", gap: 10 }}>
              <CheckRow label="Photo of the repaired wall" tickAt={165} delay={30} />
              <CheckRow label="All alarms tested & logged" tickAt={190} delay={38} />
              <CheckRow label="Parts / invoice attached" tickAt={215} delay={46} />
            </div>
            <div
              style={{
                marginTop: 14,
                fontSize: 17,
                color: C.slate,
                opacity: interpolate(frame, [225, 250], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
              }}
            >
              The job cannot be marked complete until all three are attached.
            </div>
          </div>
        </div>
      </PortalScreen>

      <Callout
        text="Dispatch ranks vendors by territory ZIP, trade, compliance and current load — no group texts."
        x={140}
        y={760}
        delay={40}
        width={480}
        color={C.orange}
      />
      <Caption kicker="Vendor portal" text="The brief, the standard and the proof travel with the job." />
    </AbsoluteFill>
  );
};
