import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { C } from "../theme";
import { PhoneFrame, SceneStage } from "../components/PhoneFrame";
import { IconWarn } from "../components/Icons";

export const TimeOff = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const phoneIn = spring({ frame, fps, config: { damping: 18 } });

  // Calendar selection sweep
  const days = Array.from({ length: 35 }, (_, i) => i - 2);
  const selectedStart = 14;
  const selectedEnd = interpolate(spring({ frame: frame - 30, fps, config: { damping: 30, stiffness: 80 } }), [0, 1], [selectedStart, 21]);

  // Warning toast appears late
  const warnIn = spring({ frame: frame - 70, fps, config: { damping: 14 } });

  return (
    <AbsoluteFill style={{ background: `linear-gradient(135deg, #1c1c1c, ${C.ink})` }}>
      <SceneStage label="Time Off · Notice Rules" index="05">
        <div style={{ transform: `translateY(${(1 - phoneIn) * 80}px)`, opacity: phoneIn }}>
          <PhoneFrame>
            <div style={{ padding: "70px 24px 24px" }}>
              <h2 style={{ fontFamily: "Oswald", fontSize: 44, margin: 0, color: C.black, letterSpacing: 1, textTransform: "uppercase" }}>Request Time Off</h2>
              <p style={{ fontFamily: "Inter", fontSize: 16, color: "#666", margin: "4px 0 18px" }}>2-week notice · 4 weeks for foremen</p>

              <div style={{ background: "#fff", border: "1px solid #eee", borderRadius: 18, padding: 18 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                  <span style={{ fontFamily: "Oswald", fontSize: 24, color: C.black, fontWeight: 700 }}>APRIL 2026</span>
                  <span style={{ fontFamily: "Oswald", fontSize: 18, color: "#888" }}>‹ ›</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
                  {["S","M","T","W","T","F","S"].map(d => (
                    <div key={d} style={{ textAlign: "center", fontFamily: "Oswald", fontSize: 14, color: "#aaa", padding: 4 }}>{d}</div>
                  ))}
                  {days.map((d) => {
                    const inRange = d >= selectedStart && d <= selectedEnd;
                    const isStart = d === selectedStart;
                    const valid = d > 0 && d <= 30;
                    return (
                      <div key={d} style={{
                        textAlign: "center", padding: "10px 0", borderRadius: 8, fontFamily: "Inter", fontSize: 16,
                        background: inRange ? C.yellow : "transparent",
                        color: !valid ? "#ddd" : inRange ? C.black : "#333",
                        fontWeight: isStart ? 700 : 400,
                      }}>{valid ? d : ""}</div>
                    );
                  })}
                </div>
              </div>

              <div style={{ marginTop: 14, display: "flex", gap: 10 }}>
                <div style={{ flex: 1, background: "#fff", border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
                  <p style={{ fontFamily: "Oswald", fontSize: 12, color: "#888", margin: 0, letterSpacing: 2 }}>TYPE</p>
                  <p style={{ fontFamily: "Oswald", fontSize: 22, color: C.black, margin: "2px 0 0", fontWeight: 700 }}>VACATION</p>
                </div>
                <div style={{ flex: 1, background: "#fff", border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
                  <p style={{ fontFamily: "Oswald", fontSize: 12, color: "#888", margin: 0, letterSpacing: 2 }}>NOTICE</p>
                  <p style={{ fontFamily: "Oswald", fontSize: 22, color: C.red, margin: "2px 0 0", fontWeight: 700 }}>5 DAYS</p>
                </div>
              </div>

              <div style={{
                marginTop: 16, background: "#FFF8E1", border: `2px solid ${C.yellow}`, borderRadius: 14, padding: 16,
                transform: `translateY(${(1 - warnIn) * 30}px) scale(${0.9 + warnIn * 0.1})`, opacity: warnIn,
                display: "flex", gap: 12,
              }}>
                <IconWarn size={32} />
                <div>
                  <p style={{ fontFamily: "Oswald", fontSize: 20, margin: 0, color: C.black, fontWeight: 700, letterSpacing: 1 }}>SHORT NOTICE</p>
                  <p style={{ fontFamily: "Inter", fontSize: 14, color: "#444", margin: "4px 0 0" }}>Vacation needs 14 days notice. Submit anyway?</p>
                </div>
              </div>
            </div>
          </PhoneFrame>
        </div>
      </SceneStage>
    </AbsoluteFill>
  );
};
