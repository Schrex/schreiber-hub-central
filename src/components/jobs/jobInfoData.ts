// Foreman-facing job info digests, keyed by job_number.
// Extracted from estimating/scheduling reports (HCSS exports + proposal).

export interface BidItem {
  code: string;
  desc: string;
  qty: number;
  unit: string;
}

export interface PhaseSummary {
  code: string;
  name: string;
  manhours: number;
  shifts: number;
}

export interface CrewLine {
  code: string;
  desc: string;
  size: number; // labor pieces
}

export interface EquipmentLine {
  code: string;
  desc: string;
  shareOfShift: number; // 0-1, how much of a shift it's needed
}

export interface MaterialLine {
  desc: string;
  qty: number;
  unit: string;
  vendor?: string;
}

export interface SubLine {
  scope: string;
  vendor?: string;
  qty: number;
  unit: string;
}

export interface JobInfo {
  jobNumber: string;
  name: string;
  estimator: string;
  proposalDate: string;
  planSet: string;
  totalManhours: number;
  totalShifts: number;
  hoursPerShift: number;
  phases: PhaseSummary[];
  scope: { section: string; items: BidItem[] }[];
  crews: CrewLine[];
  equipment: EquipmentLine[];
  materials: { vendor: string; lines: MaterialLine[] }[];
  subs: SubLine[];
  inclusions: string[];
  exclusions: string[];
  notes: string[];
}

export const JOB_INFO: Record<string, JobInfo> = {
  J2601: {
    jobNumber: "J2601",
    name: "Talmudical Institute of Upstate NY",
    estimator: "Ryan Irish",
    proposalDate: "01/27/2026",
    planSet: "Full Set – 07/25/2025",
    totalManhours: 3513,
    totalShifts: 139.5,
    hoursPerShift: 9,
    phases: [
      { code: "100", name: "Sanitary", manhours: 216, shifts: 8.5 },
      { code: "200", name: "Storm", manhours: 617, shifts: 24.7 },
      { code: "300", name: "Water", manhours: 284, shifts: 10.5 },
      { code: "400", name: "Pavement", manhours: 105, shifts: 5.1 },
      { code: "450", name: "Concrete", manhours: 639, shifts: 23.1 },
      { code: "500", name: "Erosion Control", manhours: 58, shifts: 2.8 },
      { code: "550", name: "Demo", manhours: 88, shifts: 5.8 },
      { code: "600", name: "Grading", manhours: 639, shifts: 23.1 },
      { code: "700", name: "Foundation", manhours: 650, shifts: 23.9 },
      { code: "800", name: "Other Utilities", manhours: 122, shifts: 6.8 },
      { code: "900", name: "General", manhours: 93, shifts: 5.2 },
    ],
    scope: [
      {
        section: "Sanitary",
        items: [
          { code: "1120", desc: "8\" SDR35 0–12' deep", qty: 768, unit: "LF" },
          { code: "1130", desc: "6\" SDR21", qty: 61, unit: "LF" },
          { code: "1136", desc: "6\" × 6\" Sanitary Clean out", qty: 1, unit: "EA" },
          { code: "1325", desc: "6\" × 8\" Sanitary Clean out", qty: 1, unit: "EA" },
          { code: "1505", desc: "Sanitary 4' Dia Manhole 0–12'", qty: 4, unit: "EA" },
          { code: "1535", desc: "Grease Trap", qty: 1, unit: "EA" },
          { code: "1725", desc: "Connect & Core Sanitary MH", qty: 1, unit: "EA" },
        ],
      },
      {
        section: "Storm",
        items: [
          { code: "2220", desc: "Underdrain 4\" HDPE Perf", qty: 421, unit: "LF" },
          { code: "2233", desc: "6\" SDR21 Storm line", qty: 95, unit: "LF" },
          { code: "2235", desc: "8\" HDPE", qty: 130, unit: "LF" },
          { code: "2240", desc: "8\" HDPE Perf", qty: 426, unit: "LF" },
          { code: "2255", desc: "12\" HDPE", qty: 132, unit: "LF" },
          { code: "2260", desc: "12\" HDPE Perf", qty: 130, unit: "LF" },
          { code: "2270", desc: "15\" HDPE Perf", qty: 233, unit: "LF" },
          { code: "2275", desc: "18\" HDPE", qty: 80, unit: "LF" },
          { code: "2290", desc: "24\" HDPE Perf", qty: 44, unit: "LF" },
          { code: "2710", desc: "Catch Basin 2'×2'", qty: 5, unit: "EA" },
          { code: "2715", desc: "Catch Basin 2.5'×2.5'", qty: 3, unit: "EA" },
          { code: "2720", desc: "Catch Basin 3'×3'", qty: 3, unit: "EA" },
          { code: "2770", desc: "12\" Nyloplast", qty: 10, unit: "EA" },
          { code: "2775", desc: "18\" Nyloplast", qty: 1, unit: "EA" },
          { code: "2778", desc: "Storm Outlet Structure", qty: 1, unit: "EA" },
          { code: "2920", desc: "Stone Edge Treatment", qty: 475, unit: "LF" },
          { code: "2935", desc: "Bioretention area", qty: 3323, unit: "SF" },
          { code: "2950", desc: "Emergency Spillway / Low Flow Channel", qty: 1104, unit: "SF" },
          { code: "2953", desc: "Splash Blocks", qty: 4, unit: "EA" },
        ],
      },
      {
        section: "Water",
        items: [
          { code: "3205", desc: "4\" DIP", qty: 104, unit: "LF" },
          { code: "3208", desc: "4\" Valve", qty: 1, unit: "EA" },
          { code: "3210", desc: "6\" DIP", qty: 657, unit: "LF" },
          { code: "3610", desc: "4\" Cap", qty: 4, unit: "EA" },
          { code: "3620", desc: "6\" Valve", qty: 2, unit: "EA" },
          { code: "3625", desc: "6\" Bend", qty: 3, unit: "EA" },
          { code: "3700", desc: "1\" Sample taps", qty: 7, unit: "EA" },
          { code: "3710", desc: "6\" Hydrant (all parts)", qty: 1, unit: "EA" },
        ],
      },
      {
        section: "Erosion Control",
        items: [
          { code: "5005", desc: "Silt fence", qty: 1035, unit: "LF" },
          { code: "5010", desc: "Orange Fence", qty: 1319, unit: "LF" },
          { code: "5020", desc: "Check Dams", qty: 1, unit: "EA" },
          { code: "5025", desc: "Permanent Check Dam", qty: 1, unit: "EA" },
          { code: "5065", desc: "Construction Entrance", qty: 1, unit: "EA" },
          { code: "5070", desc: "Concrete washout pit", qty: 1, unit: "EA" },
        ],
      },
      {
        section: "Demo",
        items: [
          { code: "5505", desc: "Clearing tree", qty: 2, unit: "EA" },
          { code: "5525", desc: "Miscellaneous Removals", qty: 3, unit: "LOAD" },
          { code: "5535", desc: "Abandon Sanitary Lateral", qty: 2, unit: "EA" },
          { code: "5540", desc: "Abandon Storm Lateral", qty: 1, unit: "EA" },
          { code: "5544", desc: "Remove Lights", qty: 2, unit: "EA" },
        ],
      },
      {
        section: "Earthwork",
        items: [
          { code: "—", desc: "Topsoil strip", qty: 7527, unit: "CY" },
          { code: "—", desc: "Cut to fill (estimated)", qty: 16374, unit: "CY" },
          { code: "6110", desc: "Remove & Export", qty: 310, unit: "CY" },
        ],
      },
    ],
    crews: [
      { code: "P360", desc: "360 Pipe crew (excavator + tamp + loader)", size: 3 },
      { code: "P210", desc: "210 Pipe crew", size: 3 },
      { code: "P210NC", desc: "210 Pipe crew, no compactor", size: 3 },
      { code: "P050", desc: "50 Pipe crew (small excavator)", size: 3 },
      { code: "LAB2", desc: "2-man labor crew (senior + helper)", size: 2 },
      { code: "GR700", desc: "Grading crew", size: 2 },
      { code: "EXEN", desc: "Excavator + operator (rate items)", size: 1 },
    ],
    equipment: [
      { code: "8EX360", desc: "Excavator 360 w/ grade", shareOfShift: 1.0 },
      { code: "8EX200", desc: "Excavator 210", shareOfShift: 1.0 },
      { code: "8EX80", desc: "Excavator 75–80", shareOfShift: 1.0 },
      { code: "8ZLOAD", desc: "Articulated Loader", shareOfShift: 0.25 },
      { code: "8ZTAMP", desc: "Tamper / wacker", shareOfShift: 0.15 },
      { code: "8ZSKID", desc: "Skid Steer", shareOfShift: 1.0 },
    ],
    materials: [
      {
        vendor: "DOLOMITE",
        lines: [
          { desc: "2B Stone (sub-base)", qty: 6298, unit: "TON", vendor: "DOLOMITE" },
          { desc: "2B 0050 Light stone fill", qty: 94, unit: "TON", vendor: "DOLOMITE" },
          { desc: "2B 0080 Asphalt sub-base stone", qty: 2617, unit: "TON", vendor: "DOLOMITE" },
        ],
      },
      {
        vendor: "FW WEBB",
        lines: [
          { desc: "4\" HDPE Perf underdrain", qty: 421, unit: "LF", vendor: "FW WEBB" },
          { desc: "Catch basin frames & grates 3'×3'", qty: 10, unit: "EA", vendor: "FW WEBB" },
          { desc: "1\" Curb stops / brass plugs", qty: 7, unit: "EA", vendor: "FW WEBB" },
          { desc: "Filter Fabric 180n", qty: 15585, unit: "SF", vendor: "FW WEBB" },
          { desc: "6\" SDR21 Wyes / 45° / cleanouts", qty: 5, unit: "EA", vendor: "FW WEBB" },
          { desc: "6\" DIP fittings (caps, bends, repair couplers)", qty: 18, unit: "EA", vendor: "FW WEBB" },
          { desc: "6\" Hydrant assembly", qty: 1, unit: "EA", vendor: "FW WEBB" },
        ],
      },
      {
        vendor: "LAKELAND",
        lines: [
          { desc: "12\" / 18\" Nyloplast structures", qty: 11, unit: "EA", vendor: "LAKELAND" },
          { desc: "Catch basins (precast 2'×2', 2.5', 3'×3')", qty: 11, unit: "EA", vendor: "LAKELAND" },
          { desc: "4' Sanitary manholes & grease trap", qty: 5, unit: "EA", vendor: "LAKELAND" },
          { desc: "6×12\" / 6×18\" Anchor pipe", qty: 21, unit: "EA", vendor: "LAKELAND" },
        ],
      },
    ],
    subs: [
      { scope: "Asphalt – paving", vendor: "AEY ENT", qty: 45941, unit: "SF" },
      { scope: "Asphalt – base course", vendor: "AEY ENT", qty: 36851, unit: "SF" },
      { scope: "Asphalt – binder", vendor: "AEY ENT", qty: 75501, unit: "SF" },
      { scope: "Asphalt – top course", vendor: "AEY ENT", qty: 75501, unit: "SF" },
      { scope: "Concrete (sidewalks, pads, curbs)", vendor: "HYNES C", qty: 949, unit: "EA" },
      { scope: "Fencing", vendor: "EMPIRE F", qty: 2, unit: "EA" },
      { scope: "Granite Curb installation", qty: 42, unit: "LF" },
      { scope: "Layout / surveying", qty: 1, unit: "EA" },
      { scope: "Striping", qty: 1, unit: "EA" },
      { scope: "Tree Clearing", qty: 2, unit: "EA" },
    ],
    inclusions: [
      "1 ft of clean draining stone under foundation, wrapped in filter fabric.",
      "Existing fill under building floor stays in place — geo report cleared it.",
      "Topsoil strip thinner than expected: dirt is exported, less topsoil to haul off.",
    ],
    exclusions: [
      "Bonds and permits",
      "Rock or >4' boulder excavation (blasting or mechanical)",
      "Compaction testing",
      "Winter heat for concrete",
      "Adverse ground conditions: groundwater, running sand, rock — including extra bedding/cover",
      "Major dewatering beyond a 2\" submersible pump",
      "Fine grading of topsoil, rockhounding, hydroseeding, landscaping",
    ],
    notes: [
      "All employees OSHA-10; project leaders OSHA-30.",
      "3rd-party safety inspections performed weekly.",
      "Estimator cell: 585-455-0377 (Ryan Irish).",
    ],
  },
};
