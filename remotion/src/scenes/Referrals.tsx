import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { C } from "../theme";
import { PhoneFrame, SceneStage } from "../components/PhoneFrame";

export const Referrals = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const phoneIn = spring({ frame, fps, config: { damping: 18 } });

  // Coin counter
  const amount = Math.floor(interpolate(spring({ frame: frame - 30, fps, config: { damping: 30, stiffness: 60 } }), [0, 1], [0, 1500]));

  return (
    <AbsoluteFill style={{ background: `linear-gradient(135deg, ${C.yellow}22, ${C.ink} 60%)` }}>
      <SceneStage label="Refer · Earn · Repeat" index="06">
        <div style={{ transform: `translateY(${(1 - phoneIn) * 80}px)`, opacity: phoneIn }}>
          <PhoneFrame>
            <div style={{ padding: "70px 24px 24px" }}>
              <h2 style={{ fontFamily: "Oswald", fontSize: 44, margin: 0, color: C.black, letterSpacing: 1, textTransform: "uppercase" }}>Referrals</h2>
              <p style={{ fontFamily: "Inter", fontSize: 16, color: "#666", margin: "4px 0 18px" }}>Bring a hire or a job · get paid</p>

              <div style={{ background: C.black, borderRadius: 22, padding: 26, color: "#fff", position: "relative", overflow: "hidden" }}>
                <div style={{ position: "absolute", top: -40, right: -40, width: 200, height: 200, background: `${C.yellow}33`, borderRadius: "50%" }} />
                <p style={{ fontFamily: "Oswald", fontSize: 16, margin: 0, color: C.yellow, letterSpacing: 3, textTransform: "uppercase" }}>YOUR EARNINGS YTD</p>
                <p style={{ fontFamily: "Oswald", fontSize: 80, margin: "6px 0 0", color: C.yellow, fontWeight: 700, letterSpacing: 2 }}>${amount.toLocaleString()}</p>
                <p style={{ fontFamily: "Inter", fontSize: 14, color: "#aaa", margin: "8px 0 0" }}>3 paid · 1 reviewing</p>
              </div>

              <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {[
                  { l: "REFER A HIRE", s: "$500 paid", icon: "👷" },
                  { l: "REFER A JOB", s: "Up to $1,000", icon: "🏗️" },
                ].map((b, i) => {
                  const bIn = spring({ frame: frame - 40 - i * 8, fps, config: { damping: 18 } });
                  return (
                    <div key={b.l} style={{
                      background: C.yellow, borderRadius: 18, padding: 18,
                      transform: `scale(${bIn})`, opacity: bIn,
                    }}>
                      <div style={{ fontSize: 32 }}>{b.icon}</div>
                      <p style={{ fontFamily: "Oswald", fontSize: 20, margin: "8px 0 2px", color: C.black, fontWeight: 700, letterSpacing: 1 }}>{b.l}</p>
                      <p style={{ fontFamily: "Inter", fontSize: 13, color: C.black, margin: 0 }}>{b.s}</p>
                    </div>
                  );
                })}
              </div>

              <div style={{ marginTop: 16, background: "#fff", border: "1px solid #eee", borderRadius: 16, padding: 16 }}>
                <p style={{ fontFamily: "Oswald", fontSize: 14, color: "#888", margin: 0, letterSpacing: 2 }}>RECENT</p>
                {[
                  { n: "Tony G. → Hired", t: "PAID · $500", c: C.green },
                  { n: "Riverside St Job", t: "REVIEWING", c: "#888" },
                ].map((r, i) => (
                  <div key={r.n} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: i === 0 ? "1px solid #f0f0f0" : "none" }}>
                    <span style={{ fontFamily: "Inter", fontSize: 16, color: C.black }}>{r.n}</span>
                    <span style={{ fontFamily: "Oswald", fontSize: 13, color: r.c, letterSpacing: 1 }}>{r.t}</span>
                  </div>
                ))}
              </div>
            </div>
          </PhoneFrame>
        </div>
      </SceneStage>
    </AbsoluteFill>
  );
};
