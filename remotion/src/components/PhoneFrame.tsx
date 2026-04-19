import React from "react";
import { C } from "../theme";

export const PhoneFrame: React.FC<{ children: React.ReactNode; tint?: string }> = ({ children, tint = C.white }) => (
  <div
    style={{
      width: 620,
      height: 1280,
      borderRadius: 70,
      background: C.black,
      padding: 18,
      boxShadow: `0 40px 120px -20px ${C.yellow}55, 0 30px 80px -10px #000a`,
      border: `2px solid #333`,
    }}
  >
    <div
      style={{
        width: "100%",
        height: "100%",
        borderRadius: 54,
        background: tint,
        overflow: "hidden",
        position: "relative",
      }}
    >
      <div style={{ position: "absolute", top: 14, left: "50%", transform: "translateX(-50%)", width: 130, height: 30, background: "#000", borderRadius: 20, zIndex: 10 }} />
      {children}
    </div>
  </div>
);

export const SceneStage: React.FC<{ children: React.ReactNode; label: string; index: string }> = ({ children, label, index }) => (
  <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 60 }}>
    <div style={{ position: "absolute", top: 70, left: 60, right: 60, display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
      <span style={{ fontFamily: "Oswald", fontSize: 72, fontWeight: 700, color: C.yellow, letterSpacing: 2, textTransform: "uppercase", lineHeight: 0.9 }}>{label}</span>
      <span style={{ fontFamily: "Oswald", fontSize: 40, color: "#555", letterSpacing: 4 }}>{index}</span>
    </div>
    <div style={{ marginTop: 80 }}>{children}</div>
  </div>
);
