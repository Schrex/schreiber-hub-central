import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { C } from "../theme";

export const Outro = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const logoIn = spring({ frame, fps, config: { damping: 14 } });
  const lineW = interpolate(spring({ frame: frame - 8, fps, config: { damping: 200 } }), [0, 1], [0, 700]);
  const tIn = interpolate(spring({ frame: frame - 16, fps, config: { damping: 18 } }), [0, 1], [40, 0]);
  const tagO = interpolate(frame, [16, 32], [0, 1], { extrapolateRight: "clamp" });
  const subO = interpolate(frame, [40, 56], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ background: C.ink, alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, background: `radial-gradient(circle at center, ${C.yellow}1c, transparent 60%)` }} />
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 30 }}>
        <div style={{
          width: 200, height: 200, borderRadius: 46, background: C.yellow,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: "Oswald", fontWeight: 700, fontSize: 120, color: C.black,
          transform: `scale(${logoIn})`,
        }}>SE</div>
        <div style={{ height: 4, width: lineW, background: C.yellow }} />
        <h1 style={{
          fontFamily: "Oswald", fontWeight: 700, fontSize: 110, color: C.white,
          margin: 0, letterSpacing: 4, textTransform: "uppercase", textAlign: "center",
          transform: `translateY(${tIn}px)`, opacity: tagO, lineHeight: 0.9,
        }}>Built For<br/><span style={{ color: C.yellow }}>The Field.</span></h1>
        <p style={{ fontFamily: "Inter", fontSize: 30, color: C.gray, margin: 0, letterSpacing: 6, textTransform: "uppercase", opacity: subO }}>Schreiber Excavating</p>
      </div>
    </AbsoluteFill>
  );
};
