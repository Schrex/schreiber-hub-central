import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { C } from "../theme";
import { PhoneFrame, SceneStage } from "../components/PhoneFrame";
import { IconTruck } from "../components/Icons";

const orders = [
  { truck: "T-14", driver: "J. Alvarez", mat: "#2 Stone", from: "Buffalo Crushed", to: "Elmwood", status: "IN PROGRESS", c: C.yellow },
  { truck: "T-22", driver: "D. Cole", mat: "Topsoil", from: "Yard", to: "Main St", status: "SCHEDULED", c: "#888" },
  { truck: "T-09", driver: "R. Patel", mat: "Spoils Out", from: "Allen St", to: "Dump", status: "COMPLETE", c: C.green },
];

export const Dispatch = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const phoneIn = spring({ frame, fps, config: { damping: 18 } });
  const wheel = (frame * 30) % 360;

  return (
    <AbsoluteFill style={{ background: `linear-gradient(160deg, #161616, ${C.ink})` }}>
      <SceneStage label="Dispatch · Trucks Today" index="03">
        <div style={{ transform: `translateY(${(1 - phoneIn) * 80}px)`, opacity: phoneIn }}>
          <PhoneFrame>
            <div style={{ padding: "70px 24px 24px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
                <h2 style={{ fontFamily: "Oswald", fontSize: 44, margin: 0, color: C.black, letterSpacing: 1, textTransform: "uppercase" }}>Dispatch</h2>
                <div style={{ background: C.black, color: C.yellow, padding: "6px 12px", borderRadius: 8, fontFamily: "Oswald", fontSize: 18, letterSpacing: 1 }}>TUE · APR 21</div>
              </div>

              <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
                {[
                  { l: "TRUCKS", v: 7 },
                  { l: "LOADS", v: 24 },
                  { l: "DONE", v: 9 },
                ].map((s, i) => {
                  const sIn = spring({ frame: frame - 12 - i * 4, fps, config: { damping: 16 } });
                  return (
                    <div key={s.l} style={{ flex: 1, background: i === 0 ? C.yellow : "#fff", border: "1px solid #eee", borderRadius: 14, padding: 12, textAlign: "center", transform: `scale(${sIn})` }}>
                      <p style={{ fontFamily: "Oswald", fontSize: 38, margin: 0, color: C.black, fontWeight: 700 }}>{s.v}</p>
                      <p style={{ fontFamily: "Oswald", fontSize: 13, margin: 0, color: i === 0 ? C.black : "#888", letterSpacing: 2 }}>{s.l}</p>
                    </div>
                  );
                })}
              </div>

              {orders.map((o, i) => {
                const oIn = spring({ frame: frame - 26 - i * 8, fps, config: { damping: 20 } });
                return (
                  <div key={o.truck} style={{
                    background: "#fff", border: "1px solid #eee", borderRadius: 16, padding: 16, marginBottom: 12,
                    transform: `translateX(${(1 - oIn) * 80}px)`, opacity: oIn, display: "flex", gap: 14, alignItems: "center",
                  }}>
                    <div style={{ width: 60, height: 60, background: C.black, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", color: C.yellow, position: "relative", overflow: "hidden" }}>
                      <IconTruck size={32} />
                      {i === 0 && <div style={{ position: "absolute", bottom: 4, right: 4, width: 12, height: 12, border: `2px solid ${C.yellow}`, borderRadius: "50%", borderTopColor: "transparent", transform: `rotate(${wheel}deg)` }} />}
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontFamily: "Oswald", fontSize: 22, margin: 0, color: C.black, fontWeight: 700 }}>{o.truck} · {o.driver}</p>
                      <p style={{ fontFamily: "Inter", fontSize: 14, color: "#666", margin: "2px 0 0" }}>{o.mat} · {o.from} → {o.to}</p>
                    </div>
                    <span style={{ background: o.c, color: o.c === C.yellow ? C.black : "#fff", fontFamily: "Oswald", fontSize: 11, padding: "4px 8px", borderRadius: 6, letterSpacing: 1, whiteSpace: "nowrap" }}>{o.status}</span>
                  </div>
                );
              })}
            </div>
          </PhoneFrame>
        </div>
      </SceneStage>
    </AbsoluteFill>
  );
};
