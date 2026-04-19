import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring, Sequence } from "remotion";
import { C } from "../theme";

export const Intro = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const logoIn = spring({ frame, fps, config: { damping: 14, stiffness: 90 } });
  const lineW = interpolate(spring({ frame: frame - 10, fps, config: { damping: 200 } }), [0, 1], [0, 540]);
  const titleY = interpolate(spring({ frame: frame - 18, fps, config: { damping: 18 } }), [0, 1], [40, 0]);
  const titleO = interpolate(frame, [18, 32], [0, 1], { extrapolateRight: "clamp" });
  const subO = interpolate(frame, [32, 48], [0, 1], { extrapolateRight: "clamp" });
  const stripeX = interpolate(frame, [0, 75], [-200, 200]);

  return (
    <AbsoluteFill style={{ backgroundColor: C.ink, alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: -100, left: -200, width: 1500, height: 250, background: C.yellow, transform: `rotate(-12deg) translateX(${stripeX}px)`, opacity: 0.08 }} />
      <div style={{ position: "absolute", bottom: -100, right: -200, width: 1500, height: 250, background: C.yellow, transform: `rotate(-12deg) translateX(${-stripeX}px)`, opacity: 0.08 }} />

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 24 }}>
        <div style={{
          width: 220, height: 220, borderRadius: 50, background: C.yellow,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: "Oswald", fontWeight: 700, fontSize: 130, color: C.black,
          transform: `scale(${logoIn}) rotate(${(1 - logoIn) * -20}deg)`,
          boxShadow: `0 30px 80px -20px ${C.yellow}aa`,
        }}>SE</div>
        <div style={{ height: 4, width: lineW, background: C.yellow }} />
        <h1 style={{
          fontFamily: "Oswald", fontWeight: 700, fontSize: 96, color: C.white,
          margin: 0, letterSpacing: 3, textTransform: "uppercase", textAlign: "center",
          transform: `translateY(${titleY}px)`, opacity: titleO, lineHeight: 0.95,
        }}>Schreiber<br/>Excavating</h1>
        <p style={{ fontFamily: "Inter", fontSize: 36, color: C.gray, margin: 0, letterSpacing: 8, textTransform: "uppercase", opacity: subO }}>Field App Tour</p>
      </div>
    </AbsoluteFill>
  );
};
