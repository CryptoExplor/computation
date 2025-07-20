// src/config/taxRules.js

/**
 * Defines the tax rules (slabs, cess, and rebate) for different assessment years
 * and tax regimes (Old and New).
 */
export const taxRules = {
  "2023-24": {
    regime: "Old",
    slabs: [
      { limit: 250000, rate: 0 },
      { limit: 500000, rate: 0.05 },
      { limit: 1000000, rate: 0.20 },
      { limit: Infinity, rate: 0.30 }
    ],
    seniorSlabs: [ // Age 60 to 80
      { limit: 300000, rate: 0 },
      { limit: 500000, rate: 0.05 },
      { limit: 1000000, rate: 0.20 },
      { limit: Infinity, rate: 0.30 }
    ],
    superSeniorSlabs: [ // Age 80+
      { limit: 500000, rate: 0 },
      { limit: 1000000, rate: 0.20 },
      { limit: Infinity, rate: 0.30 }
    ],
    cessRate: 0.04,
    rebate87A: { limit: 500000, maxRebate: 12500 }
  },
  "2024-25": { // Current AY (example)
    regime: "Old",
    slabs: [
      { limit: 250000, rate: 0 },
      { limit: 500000, rate: 0.05 },
      { limit: 1000000, rate: 0.20 },
      { limit: Infinity, rate: 0.30 }
    ],
    seniorSlabs: [
      { limit: 300000, rate: 0 },
      { limit: 500000, rate: 0.05 },
      { limit: 1000000, rate: 0.20 },
      { limit: Infinity, rate: 0.30 }
    ],
    superSeniorSlabs: [
      { limit: 500000, rate: 0 },
      { limit: 1000000, rate: 0.20 },
      { limit: Infinity, rate: 0.30 }
    ],
    cessRate: 0.04,
    rebate87A: { limit: 500000, maxRebate: 12500 }
  },
  "2024-25-new": { // New Regime for 2024-25
    regime: "New",
    slabs: [
      { limit: 300000, rate: 0 },
      { limit: 600000, rate: 0.05 },
      { limit: 900000, rate: 0.10 },
      { limit: 1200000, rate: 0.15 },
      { limit: 1500000, rate: 0.20 },
      { limit: Infinity, rate: 0.30 }
    ],
    cessRate: 0.04,
    rebate87A: { limit: 700000, maxRebate: 25000 } // New regime rebate limit
  },
  // Add rules for future assessment years (e.g., "2025-26", "2025-26-new") here
  // This structure makes the tax computation dynamic and easily extendable.
};
