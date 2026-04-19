import React from "react";
import { C } from "../theme";

// Tiny inline SVG glyphs to replace emoji (no emoji font in headless Chromium)
const wrap = (children: React.ReactNode, size = 24) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {children}
  </svg>
);

export const IconSun = ({ size = 22, color = C.yellow }: { size?: number; color?: string }) => (
  <span style={{ color, display: "inline-flex" }}>{wrap(<><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" /></>, size)}</span>
);

export const IconPin = ({ size = 16, color = "#444" }: { size?: number; color?: string }) => (
  <span style={{ color, display: "inline-flex" }}>{wrap(<><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></>, size)}</span>
);

export const IconDoc = ({ size = 16, color = "#444" }: { size?: number; color?: string }) => (
  <span style={{ color, display: "inline-flex" }}>{wrap(<><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="8" y1="13" x2="16" y2="13" /><line x1="8" y1="17" x2="16" y2="17" /></>, size)}</span>
);

export const IconShovel = ({ size = 16, color = C.black }: { size?: number; color?: string }) => (
  <span style={{ color, display: "inline-flex" }}>{wrap(<><path d="M2 22l5-5" /><path d="M14 14l-7 7" /><path d="M18 4l4 4-8 8-4-4z" /><path d="M14 4h4v4" /></>, size)}</span>
);

export const IconTruck = ({ size = 32, color = C.yellow }: { size?: number; color?: string }) => (
  <span style={{ color, display: "inline-flex" }}>{wrap(<><rect x="1" y="6" width="13" height="11" rx="1" /><path d="M14 9h4l3 3v5h-7" /><circle cx="6" cy="19" r="2" /><circle cx="17" cy="19" r="2" /></>, size)}</span>
);

export const IconShirt = ({ size = 56, color = "#bbb" }: { size?: number; color?: string }) => (
  <span style={{ color, display: "inline-flex" }}>{wrap(<><path d="M20.38 3.46L16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z" /></>, size)}</span>
);

export const IconJacket = ({ size = 28, color = C.black }: { size?: number; color?: string }) => (
  <span style={{ color, display: "inline-flex" }}>{wrap(<><path d="M16 2L12 6 8 2 3 4v18h18V4z" /><path d="M12 6v16" /></>, size)}</span>
);

export const IconHardHat = ({ size = 32, color = C.black }: { size?: number; color?: string }) => (
  <span style={{ color, display: "inline-flex" }}>{wrap(<><path d="M2 18h20v3H2z" /><path d="M4 18a8 8 0 0 1 16 0" /><path d="M10 6h4v8" /></>, size)}</span>
);

export const IconCrane = ({ size = 32, color = C.black }: { size?: number; color?: string }) => (
  <span style={{ color, display: "inline-flex" }}>{wrap(<><path d="M3 21h18" /><path d="M6 21V8L21 3v5" /><path d="M6 8h15" /><path d="M10 8v6h4" /></>, size)}</span>
);

export const IconWarn = ({ size = 28, color = C.yellowDeep }: { size?: number; color?: string }) => (
  <span style={{ color, display: "inline-flex" }}>{wrap(<><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></>, size)}</span>
);
