import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { CSSProperties, ReactNode } from "react";
import { C } from "../theme";

export const NAV = ["Dashboard", "Matters", "Oversight", "Seats", "Properties", "Playbooks"];

const F = "var(--brand-font)";

export const useEnter = (delay = 0, damping = 200) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - delay, fps, config: { damping } });
};

/** Mock browser + app chrome. Body is the ivory app surface. */
export const Screen: React.FC<{
  active: string;
  children: ReactNode;
  zoom?: number;
  pan?: { x?: number; y?: number };
}> = ({ active, children, zoom = 1, pan }) => {
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
        border: `1px solid ${C.ivory}22`,
        opacity: interpolate(s, [0, 1], [0, 1]),
        transform: `translateY(${lift + float}px) scale(${zoom}) translate(${pan?.x ?? 0}px, ${pan?.y ?? 0}px)`,
        transformOrigin: "center top",
      }}
    >
      {/* app header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 26,
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
              background: C.teal,
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
        <div style={{ display: "flex", gap: 4 }}>
          {NAV.map((n) => {
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
        <div
          style={{
            marginLeft: "auto",
            padding: "8px 15px",
            borderRadius: 8,
            background: C.teal,
            color: C.ink,
            fontWeight: 700,
            fontSize: 15,
          }}
        >
          + Log a matter
        </div>
      </div>
      <div style={{ padding: "26px 34px", fontFamily: F, color: C.charcoal }}>{children}</div>
    </div>
  );
};

export const PageTitle: React.FC<{ title: string; sub?: string; delay?: number }> = ({ title, sub, delay = 4 }) => {
  const s = useEnter(delay);
  return (
    <div style={{ opacity: s, transform: `translateY(${interpolate(s, [0, 1], [14, 0])}px)`, marginBottom: 20 }}>
      <div style={{ fontSize: 34, fontWeight: 700 }}>{title}</div>
      {sub ? <div style={{ fontSize: 17, color: C.slate, marginTop: 4 }}>{sub}</div> : null}
    </div>
  );
};

export const Card: React.FC<{ children: ReactNode; style?: CSSProperties; delay?: number; tone?: string }> = ({
  children,
  style,
  delay = 0,
  tone,
}) => {
  const s = useEnter(delay);
  return (
    <div
      style={{
        background: "#fff",
        border: `1px solid ${tone ?? "#E2DED4"}`,
        borderRadius: 12,
        padding: 18,
        opacity: s,
        transform: `translateY(${interpolate(s, [0, 1], [18, 0])}px)`,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

export const Pill: React.FC<{ label: string; bg: string; color?: string; style?: CSSProperties }> = ({
  label,
  bg,
  color = "#fff",
  style,
}) => (
  <span
    style={{
      background: bg,
      color,
      borderRadius: 999,
      padding: "4px 11px",
      fontSize: 14,
      fontWeight: 700,
      whiteSpace: "nowrap",
      ...style,
    }}
  >
    {label}
  </span>
);

export const CountUp: React.FC<{ to: number; delay?: number; color?: string }> = ({ to, delay = 0, color }) => {
  const frame = useCurrentFrame();
  const v = Math.round(
    interpolate(frame - delay, [0, 26], [0, to], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
  );
  return <span style={{ fontSize: 42, fontWeight: 700, color: color ?? C.charcoal }}>{v}</span>;
};

/** Typewriter that reveals text between two frames. */
export const Typed: React.FC<{ text: string; from: number; per?: number; style?: CSSProperties }> = ({
  text,
  from,
  per = 1.6,
  style,
}) => {
  const frame = useCurrentFrame();
  const n = Math.max(0, Math.min(text.length, Math.floor((frame - from) / per)));
  const caret = frame > from && n < text.length;
  return (
    <span style={style}>
      {text.slice(0, n)}
      {caret ? <span style={{ opacity: Math.floor(frame / 6) % 2 ? 0.2 : 1 }}>|</span> : null}
    </span>
  );
};

export const Field: React.FC<{ label: string; children: ReactNode; delay?: number; width?: number | string }> = ({
  label,
  children,
  delay = 0,
  width = "100%",
}) => {
  const s = useEnter(delay);
  return (
    <div style={{ width, opacity: s, transform: `translateY(${interpolate(s, [0, 1], [12, 0])}px)` }}>
      <div style={{ fontSize: 14, color: C.slate, marginBottom: 6 }}>{label}</div>
      <div
        style={{
          border: "1px solid #DAD5C9",
          borderRadius: 9,
          background: "#fff",
          padding: "11px 13px",
          fontSize: 18,
          minHeight: 24,
        }}
      >
        {children}
      </div>
    </div>
  );
};

/** Checklist row that ticks at `tickAt`. */
export const CheckRow: React.FC<{ label: string; hint?: string; tickAt?: number; delay?: number }> = ({
  label,
  hint,
  tickAt,
  delay = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = useEnter(delay);
  const done = tickAt !== undefined && frame >= tickAt;
  const pop = spring({ frame: frame - (tickAt ?? 0), fps, config: { damping: 10, stiffness: 200 } });
  return (
    <div
      style={{
        display: "flex",
        gap: 13,
        alignItems: "flex-start",
        padding: "11px 13px",
        border: `1px solid ${done ? `${C.teal}66` : "#E2DED4"}`,
        background: done ? `${C.teal}12` : "#fff",
        borderRadius: 10,
        opacity: s,
        transform: `translateX(${interpolate(s, [0, 1], [18, 0])}px)`,
      }}
    >
      <div
        style={{
          width: 24,
          height: 24,
          borderRadius: 6,
          border: `2px solid ${done ? C.teal : "#C9C3B4"}`,
          background: done ? C.teal : "#fff",
          color: "#fff",
          display: "grid",
          placeItems: "center",
          fontSize: 16,
          fontWeight: 700,
          transform: `scale(${done ? interpolate(pop, [0, 1], [0.6, 1]) : 1})`,
          flexShrink: 0,
        }}
      >
        {done ? "✓" : ""}
      </div>
      <div>
        <div style={{ fontSize: 18, fontWeight: 600 }}>{label}</div>
        {hint ? <div style={{ fontSize: 14, color: C.slate, marginTop: 2 }}>{hint}</div> : null}
      </div>
    </div>
  );
};

/** Narration caption pinned to the bottom of the frame. */
export const Caption: React.FC<{ kicker: string; text: string }> = ({ kicker, text }) => {
  const frame = useCurrentFrame();
  const o = interpolate(frame, [6, 22], [0, 1], { extrapolateRight: "clamp", extrapolateLeft: "clamp" });
  return (
    <div
      style={{
        position: "absolute",
        left: 130,
        bottom: 34,
        right: 130,
        display: "flex",
        alignItems: "baseline",
        gap: 20,
        opacity: o,
        fontFamily: F,
        transform: `translateY(${interpolate(o, [0, 1], [16, 0])}px)`,
      }}
    >
      <span
        style={{
          fontSize: 16,
          letterSpacing: 5,
          textTransform: "uppercase",
          color: C.teal,
          whiteSpace: "nowrap",
        }}
      >
        {kicker}
      </span>
      <span style={{ fontSize: 30, color: C.ivory, fontWeight: 700 }}>{text}</span>
    </div>
  );
};

/** Floating annotation that points at part of the UI. */
export const Callout: React.FC<{
  text: string;
  x: number;
  y: number;
  delay: number;
  color?: string;
  width?: number;
}> = ({ text, x, y, delay, color = C.orange, width = 330 }) => {
  const s = useEnter(delay, 16);
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width,
        padding: "12px 16px",
        borderRadius: 10,
        background: C.ink,
        border: `2px solid ${color}`,
        color: C.ivory,
        fontFamily: F,
        fontSize: 19,
        lineHeight: 1.3,
        boxShadow: "0 20px 40px rgba(0,0,0,0.45)",
        opacity: s,
        transform: `translateY(${interpolate(s, [0, 1], [14, 0])}px) scale(${interpolate(s, [0, 1], [0.94, 1])})`,
      }}
    >
      <span style={{ color, fontWeight: 700 }}>▸ </span>
      {text}
    </div>
  );
};

/** Animated pointer travelling through keyframe positions. */
export const Cursor: React.FC<{ path: { f: number; x: number; y: number }[] }> = ({ path }) => {
  const frame = useCurrentFrame();
  const fs = path.map((p) => p.f);
  const x = interpolate(frame, fs, path.map((p) => p.x), {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const y = interpolate(frame, fs, path.map((p) => p.y), {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const near = path.find((p) => Math.abs(frame - p.f) < 6 && p !== path[0]);
  const ring = near ? interpolate(Math.abs(frame - near.f), [0, 6], [1, 0]) : 0;
  return (
    <div style={{ position: "absolute", left: x, top: y, pointerEvents: "none" }}>
      {ring > 0 && (
        <div
          style={{
            position: "absolute",
            left: -22,
            top: -22,
            width: 44,
            height: 44,
            borderRadius: 999,
            border: `3px solid ${C.teal}`,
            opacity: ring,
            transform: `scale(${interpolate(ring, [0, 1], [1.6, 0.6])})`,
          }}
        />
      )}
      <svg width="30" height="34" viewBox="0 0 24 28">
        <path d="M2 2 L2 22 L7.5 17 L11 25 L14.5 23.4 L11 15.6 L18 15.6 Z" fill={C.ivory} stroke={C.ink} strokeWidth="1.6" />
      </svg>
    </div>
  );
};

export const AbsFill = AbsoluteFill;
