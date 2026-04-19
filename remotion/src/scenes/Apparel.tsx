import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { C } from "../theme";
import { PhoneFrame, SceneStage } from "../components/PhoneFrame";
import { IconShirt, IconJacket, IconHardHat } from "../components/Icons";

const items = [
  { name: "Hi-Vis Tee", price: "Issued", colors: ["#FFD60A", "#E03131"], Icon: IconShirt },
  { name: "Beanie", price: "Issued", colors: ["#222", "#888"], Icon: IconHardHat },
  { name: "Soft-Shell Jacket", price: "Issued", colors: ["#222", "#FFD60A"], Icon: IconJacket },
  { name: "Class 3 Vest", price: "Issued", colors: ["#FFD60A"], Icon: IconShirt },
];

export const Apparel = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const phoneIn = spring({ frame, fps, config: { damping: 18 } });
  const cartBounce = 1 + Math.sin(frame / 6) * 0.08;

  return (
    <AbsoluteFill style={{ background: `linear-gradient(180deg, #1a1a1a, ${C.ink})` }}>
      <SceneStage label="Crew Apparel" index="04">
        <div style={{ transform: `translateY(${(1 - phoneIn) * 80}px)`, opacity: phoneIn }}>
          <PhoneFrame>
            <div style={{ padding: "70px 24px 24px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <h2 style={{ fontFamily: "Oswald", fontSize: 44, margin: 0, color: C.black, letterSpacing: 1, textTransform: "uppercase" }}>Order Gear</h2>
                <div style={{ width: 50, height: 50, borderRadius: 14, background: C.yellow, display: "flex", alignItems: "center", justifyContent: "center", transform: `scale(${cartBounce})` }}><IconJacket size={26} /></div>
              </div>
              <p style={{ fontFamily: "Inter", fontSize: 16, color: "#666", margin: "0 0 18px" }}>Pick size & color. Office handles the rest.</p>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {items.map((it, i) => {
                  const iIn = spring({ frame: frame - 16 - i * 6, fps, config: { damping: 18 } });
                  return (
                    <div key={it.name} style={{
                      background: "#fff", border: "1px solid #eee", borderRadius: 18, padding: 14,
                      transform: `translateY(${(1 - iIn) * 40}px) scale(${0.92 + iIn * 0.08})`, opacity: iIn,
                    }}>
                      <div style={{ height: 140, background: "#f3f3f3", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center" }}><it.Icon size={68} color="#888" /></div>
                      <p style={{ fontFamily: "Oswald", fontSize: 22, margin: "10px 0 4px", color: C.black, fontWeight: 700 }}>{it.name}</p>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontFamily: "Oswald", fontSize: 13, background: C.black, color: C.yellow, padding: "3px 8px", borderRadius: 6, letterSpacing: 1 }}>{it.price}</span>
                        <div style={{ display: "flex", gap: 4 }}>
                          {it.colors.map((c, ci) => (
                            <div key={ci} style={{ width: 18, height: 18, borderRadius: "50%", background: c, border: "1px solid #ccc" }} />
                          ))}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 4, marginTop: 8 }}>
                        {["S", "M", "L", "XL"].map((s) => (
                          <div key={s} style={{ flex: 1, textAlign: "center", padding: "5px 0", border: "1px solid #ddd", borderRadius: 6, fontFamily: "Oswald", fontSize: 13, color: "#444" }}>{s}</div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div style={{ marginTop: 16, background: C.black, color: C.yellow, padding: 16, borderRadius: 14, textAlign: "center", fontFamily: "Oswald", fontSize: 22, letterSpacing: 2 }}>
                REQUEST ORDER →
              </div>
            </div>
          </PhoneFrame>
        </div>
      </SceneStage>
    </AbsoluteFill>
  );
};
