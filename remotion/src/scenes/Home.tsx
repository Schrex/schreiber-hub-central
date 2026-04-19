import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { C } from "../theme";
import { PhoneFrame, SceneStage } from "../components/PhoneFrame";

const tiles = [
  { l: "Schedule", b: "Today" },
  { l: "Jobs", b: "" },
  { l: "Dispatch", b: "" },
  { l: "Vendors", b: "" },
  { l: "Equipment", b: "" },
  { l: "Receipts", b: "" },
  { l: "Time Off", b: "" },
  { l: "Plans", b: "3" },
  { l: "Apparel", b: "" },
];

export const Home = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const phoneIn = spring({ frame, fps, config: { damping: 18 } });

  return (
    <AbsoluteFill style={{ background: `radial-gradient(circle at 30% 20%, #1d1d1d 0%, ${C.ink} 60%)` }}>
      <SceneStage label="One App. The Whole Crew." index="01">
        <div style={{ transform: `translateY(${(1 - phoneIn) * 80}px) scale(${0.95 + phoneIn * 0.05})`, opacity: phoneIn }}>
          <PhoneFrame>
            <div style={{ padding: "70px 30px 30px", height: "100%", display: "flex", flexDirection: "column", gap: 18 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <p style={{ fontFamily: "Oswald", fontSize: 22, color: "#999", margin: 0, letterSpacing: 3, textTransform: "uppercase" }}>Good morning</p>
                  <h2 style={{ fontFamily: "Oswald", fontSize: 44, margin: 0, color: C.black, fontWeight: 700 }}>MIKE R.</h2>
                </div>
                <div style={{ background: C.yellow, color: C.black, fontWeight: 700, padding: "8px 14px", borderRadius: 8, fontFamily: "Oswald", letterSpacing: 2, fontSize: 18 }}>FOREMAN</div>
              </div>

              <div style={{ background: C.black, color: C.yellow, padding: 16, borderRadius: 16, fontFamily: "Oswald", fontSize: 22, letterSpacing: 1, display: "flex", justifyContent: "space-between" }}>
                <span>☀ 64°F · LIGHT WIND</span>
                <span style={{ color: "#888" }}>BUFFALO</span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                {tiles.map((t, i) => {
                  const tIn = spring({ frame: frame - 20 - i * 4, fps, config: { damping: 18 } });
                  return (
                    <div key={t.l} style={{
                      background: "#fff", border: "1px solid #e5e5e5", borderRadius: 18, padding: 16,
                      height: 130, display: "flex", flexDirection: "column", justifyContent: "space-between",
                      transform: `translateY(${(1 - tIn) * 30}px) scale(${0.9 + tIn * 0.1})`, opacity: tIn,
                      boxShadow: "0 4px 14px -6px #0002",
                    }}>
                      <div style={{ width: 38, height: 38, background: `${C.yellow}33`, borderRadius: 10, border: `1px solid ${C.yellow}66` }} />
                      <div>
                        <p style={{ fontFamily: "Oswald", fontSize: 20, margin: 0, color: C.black, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>{t.l}</p>
                        {t.b && <span style={{ fontSize: 11, background: C.yellow, color: C.black, padding: "2px 6px", borderRadius: 6, fontWeight: 700 }}>{t.b}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </PhoneFrame>
        </div>
      </SceneStage>
    </AbsoluteFill>
  );
};
