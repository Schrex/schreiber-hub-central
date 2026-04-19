import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { C } from "../theme";
import { PhoneFrame, SceneStage } from "../components/PhoneFrame";

const jobs = [
  { name: "Elmwood Reconstruction", num: "#2415", tag: "ACTIVE", c: C.green, gc: "Picone Construction" },
  { name: "Main St Sewer Lateral", num: "#2418", tag: "ACTIVE", c: C.green, gc: "City of Buffalo" },
  { name: "Allen St Site Prep", num: "#2422", tag: "HOLD", c: "#E6B800", gc: "LP Ciminelli" },
];

export const Jobs = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const phoneIn = spring({ frame, fps, config: { damping: 18 } });
  const pinPulse = 1 + Math.sin(frame / 8) * 0.15;

  return (
    <AbsoluteFill style={{ background: `linear-gradient(135deg, #1a1a1a, ${C.ink})` }}>
      <SceneStage label="Jobs · Plans · GPS" index="02">
        <div style={{ transform: `translateY(${(1 - phoneIn) * 80}px)`, opacity: phoneIn }}>
          <PhoneFrame>
            <div style={{ padding: "70px 24px 24px", height: "100%" }}>
              <h2 style={{ fontFamily: "Oswald", fontSize: 44, margin: 0, color: C.black, letterSpacing: 1, textTransform: "uppercase" }}>Active Jobs</h2>
              <p style={{ fontFamily: "Inter", fontSize: 18, color: "#666", margin: "4px 0 20px" }}>3 sites · tap for plans, contacts, dig tickets</p>

              {jobs.map((j, i) => {
                const jIn = spring({ frame: frame - 18 - i * 8, fps, config: { damping: 20 } });
                return (
                  <div key={j.num} style={{
                    background: "#fff", border: "1px solid #eee", borderRadius: 20, padding: 20, marginBottom: 14,
                    transform: `translateX(${(1 - jIn) * -60}px)`, opacity: jIn,
                    borderLeft: `6px solid ${C.yellow}`,
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontFamily: "Oswald", fontSize: 26, margin: 0, color: C.black, fontWeight: 700 }}>{j.name}</p>
                        <p style={{ fontFamily: "Inter", fontSize: 16, color: "#666", margin: "4px 0 0" }}>{j.num} · {j.gc}</p>
                      </div>
                      <span style={{ background: j.c, color: "#fff", fontFamily: "Oswald", fontSize: 14, padding: "4px 10px", borderRadius: 6, letterSpacing: 1 }}>{j.tag}</span>
                    </div>
                    <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                      <span style={{ background: "#f3f3f3", padding: "6px 12px", borderRadius: 8, fontSize: 14, fontFamily: "Inter", color: "#444" }}>📍 GPS</span>
                      <span style={{ background: "#f3f3f3", padding: "6px 12px", borderRadius: 8, fontSize: 14, fontFamily: "Inter", color: "#444" }}>📋 Plans</span>
                      <span style={{ background: `${C.yellow}33`, padding: "6px 12px", borderRadius: 8, fontSize: 14, fontFamily: "Inter", color: C.black, fontWeight: 600 }}>⛏ 811 Dig</span>
                    </div>
                  </div>
                );
              })}

              <div style={{ marginTop: 20, background: "#f7f7f5", borderRadius: 18, padding: 18, position: "relative", overflow: "hidden", height: 180 }}>
                <p style={{ fontFamily: "Oswald", fontSize: 20, margin: 0, color: "#666", letterSpacing: 2, textTransform: "uppercase" }}>Site Map</p>
                <div style={{ position: "absolute", top: "55%", left: "30%", width: 24, height: 24, background: C.red, borderRadius: "50%", transform: `translate(-50%,-50%) scale(${pinPulse})`, boxShadow: `0 0 0 ${pinPulse * 8}px ${C.red}33` }} />
                <div style={{ position: "absolute", top: "70%", left: "60%", width: 20, height: 20, background: C.yellow, borderRadius: "50%", border: `3px solid ${C.black}` }} />
              </div>
            </div>
          </PhoneFrame>
        </div>
      </SceneStage>
    </AbsoluteFill>
  );
};
