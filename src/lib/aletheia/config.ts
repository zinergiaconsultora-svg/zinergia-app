// Configuration Constants for Aletheia Engine

// REE (Red Eléctrica Española) Average Consumption Profiles (Perfil Tipo A)
// Used to project a single month's consumption to an annual estimate.
// Values represent the % of total annual consumption typically occurring in that month.
export const REE_PROFILES: Record<number, number> = {
    0: 0.11,  // January (Winter peak)
    1: 0.10,  // February
    2: 0.09,  // March
    3: 0.075, // April
    4: 0.065, // May (Lowest)
    5: 0.07,  // June
    6: 0.085, // July (Summer AC)
    7: 0.08,  // August
    8: 0.07,  // September
    9: 0.075, // October
    10: 0.08, // November
    11: 0.10, // December
};

// Default Costs for ROI Calculations (Estimates)
export const HARDWARE_COSTS = {
    CAPACITOR_BANK_BASE: 800, // Base installation cost €
    CAPACITOR_COST_PER_KVAR: 35, // Cost per unit of reactive power capability
};

export const TAX_CONFIG = {
    IEE: 0.051127, // Impuesto Eléctrico (Standard) - Often reduced by gov, but standard is this. 
    // NOTE: Aletheia compares BASE IMPONIBLE, so this is mostly for "Total Bill" projection if needed.
    IVA_REDUCED: 0.10,
    IVA_STANDARD: 0.21,
    METER_RENTAL_DEFAULT: 0.81, // €/month approx for digital meter
};

export const THRESHOLDS = {
    P6_NIGHT_OWL: 0.50, // If >50% consumption is P6, tag as Night Owl/Weekend
    POWER_BLOAT_BUFFER: 0.15, // Suggested power = MaxDemand * 1.15
};
