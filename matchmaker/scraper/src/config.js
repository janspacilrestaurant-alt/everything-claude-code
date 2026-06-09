// Segment → keyword + source mapping driving the daily scrape.
// Aligns with the 6 segments in matchmaker/CLAUDE.md.

export const SEGMENTS = {
  machines: {
    label: "Stroje",
    offerSources: ["machineseeker", "exapro", "surplex"],
    demandSources: ["een", "ted"],
    queries: [
      "CNC lathe", "CNC milling machine", "machining center",
      "5-axis machining", "press brake", "fiber laser cutter",
    ],
  },
  CNC: {
    label: "CNC zakázky",
    offerSources: ["machineseeker"],
    demandSources: ["een", "ted"],
    queries: [
      "CNC machining subcontracting", "CNC turning supplier",
      "precision machining partner",
    ],
  },
  tooling: {
    label: "Tooling / Formy",
    offerSources: ["machineseeker", "surplex"],
    demandSources: ["een"],
    queries: ["injection mold", "stamping die", "Sandvik Capto", "tool holder"],
  },
  MRO: {
    label: "MRO / ND",
    offerSources: ["machineseeker"],
    demandSources: ["een"],
    queries: [
      "Siemens spindle motor", "Fanuc servo amplifier",
      "Heidenhain linear encoder", "Rexroth IndraDrive",
    ],
  },
  reverse: {
    label: "Reverse engineering",
    offerSources: [],
    demandSources: ["een"],
    queries: ["reverse engineering", "3D scanning service", "DMLS titanium"],
  },
  building: {
    label: "Stavební materiál",
    offerSources: [],
    demandSources: ["ted"],
    queries: ["steel construction", "IPE HEB beam", "reinforcement mesh"],
  },
};

// Polite scraping: don't hammer marketplaces.
export const SOURCE_DELAYS_MS = {
  machineseeker: 1500,
  exapro: 2000,
  surplex: 1500,
  een: 1000,
  ted: 1000,
};
