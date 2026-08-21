import { interpolate, useCurrentFrame } from "remotion";
import type { CSSProperties, ReactNode } from "react";
import { C } from "../theme";
import { useEnter } from "./Ui";

const F = "var(--brand-font)";

/**
 * Same app chrome as `Screen`, but with a portal-specific nav and a workspace
 * badge, so each audience (staff, vendor, owner, executive) reads distinctly.
 */
export const PortalScreen: React.FC<{
  workspace: string;
  accent?: string;
  nav: string[];
  active: string;
  action?: string;
  children: ReactNode;
}> = ({ workspace, accent = C.teal, nav, active, action, children }) => {
  const frame = useCurrentFrame();
  const s = useEnter(0);
  const lift = interpolate(s, [0, 1], [40, 0]);
  const float = Math.sin(frame / 70) * 4;

  return (
    <div
      style={{
        position: "absolute",
        left: 130,
        top: 96,
        width: 1660,
        height: 800,
        borderRadius: 18,
        overflow: "hidden",
        background: C.ivory,
        boxShadow: "0 60px 120px rgba(0,0,0,0.55)",
        opacity: interpolate(s, [0, 1], [0, 1]),
        transform: `translateY(${lift + float}px)`,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 22,
          padding: "0 26px",
          height: 62,
          background: C.charcoal,
          color: C.ivory,
          fontFamily: F,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 30,
              height: 30,
              borderRadius: 7,
              background: accent,
              color: C.ink,
              display: "grid",
              placeItems: "center",
              fontWeight: 700,
              fontSize: 17,
            }}
          >
            R
          </div>
          <div style={{ fontWeight: 700, fontSize: 20 }}>Resolve</div>
        </div>
        <div
          style={{
            padding: "5px 12px",
            borderRadius: 999,
            border: `1px solid ${accent}`,
            color: accent,
            fontSize: 14,
            fontWeight: 700,
            letterSpacing: 1,
            textTransform: "uppercase",
          }}
        >
          {workspace}
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {nav.map((n) => {
            const on = n === active;
            return (
              <div
                key={n}
                style={{
                  padding: "7px 13px",
                  borderRadius: 8,
                  fontSize: 15,
                  color: on ? C.ivory : `${C.ivory}99`,
                  background: on ? `${C.ivory}1f` : "transparent",
                  fontWeight: on ? 700 : 400,
                }}
              >
                {n}
              </div>
            );
          })}
        </div>
        {action ? (
          <div
            style={{
              marginLeft: "auto",
              padding: "8px 15px",
              borderRadius: 8,
              background: accent,
              color: C.ink,
              fontWeight: 700,
              fontSize: 15,
            }}
          >
            {action}
          </div>
        ) : null}
      </div>
      <div style={{ padding: "26px 34px", fontFamily: F, color: C.charcoal }}>{children}</div>
    </div>
  );
};

/** Horizontal progress/meter bar that fills between two frames. */
export const Meter: React.FC<{
  value: number;
  from?: number;
  to?: number;
  color?: string;
  height?: number;
  style?: CSSProperties;
}> = ({ value, from = 10, to = 50, color = C.teal, height = 12, style }) => {
  const frame = useCurrentFrame();
  const w = interpolate(frame, [from, to], [0, value], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <div
      style={{ background: "#E6E1D6", borderRadius: 999, height, overflow: "hidden", ...style }}
    >
      <div style={{ width: `${w}%`, height: "100%", background: color, borderRadius: 999 }} />
    </div>
  );
};

/** Small labelled stat block used across the portal scenes. */
export const Stat: React.FC<{ label: string; value: ReactNode; note?: string; delay?: number; color?: string }> = ({
  label,
  value,
  note,
  delay = 0,
  color,
}) => {
  const s = useEnter(delay);
  return (
    <div
      style={{
        flex: 1,
        background: "#fff",
        border: "1px solid #E2DED4",
        borderRadius: 12,
        padding: "16px 18px",
        opacity: s,
        transform: `translateY(${interpolate(s, [0, 1], [18, 0])}px)`,
      }}
    >
      <div style={{ fontSize: 15, color: C.slate }}>{label}</div>
      <div style={{ fontSize: 38, fontWeight: 700, marginTop: 4, color: color ?? C.charcoal }}>{value}</div>
      {note ? <div style={{ fontSize: 14, color: C.slate, marginTop: 2 }}>{note}</div> : null}
    </div>
  );
};
