// src/utils/computeTax.js

import { taxRules } from "../config/taxRules"; // Ensure this path is correct

/**
 * Computes the income tax based on income, age, assessment year, and tax regime.
 * Applies relevant tax slabs, 87A rebate, and cess.
 * @param {number} income - The net taxable income.
 * @param {number} age - The age of the taxpayer.
 * @param {string} ay - The assessment year (e.g., "2024-25").
 * @param {string} regime - The tax regime ("Old" or "New").
 * @returns {object} An object containing tax, cess, totalTax, and rebate.
 */
export function computeTax(income, age = 30, ay = "2024-25", regime = "Old") {
  let slabsToUse;
  let ruleKey;

  // Determine the correct rule key based on AY and regime
  if (regime === "New") {
    ruleKey = `${ay}-new`;
  } else {
    ruleKey = ay;
  }

  const rule = taxRules[ruleKey];

  if (!rule) {
    console.warn(`Tax rules for AY ${ay} and regime ${regime} not found. Falling back to 2024-25 Old Regime.`);
    // Fallback to a default rule if the specific rule is not found
    const fallbackRule = taxRules["2024-25"];
    slabsToUse = fallbackRule.slabs;
    // Ensure fallback rule has necessary properties, or provide defaults
    rule.cessRate = fallbackRule.cessRate || 0.04;
    rule.rebate87A = fallbackRule.rebate87A || { limit: 500000, maxRebate: 12500 };
  } else {
    // Select slabs based on age for Old Regime
    if (regime === "Old") {
      if (age >= 80 && rule.superSeniorSlabs) {
        slabsToUse = rule.superSeniorSlabs;
      } else if (age >= 60 && rule.seniorSlabs) {
        slabsToUse = rule.seniorSlabs;
      } else {
        slabsToUse = rule.slabs;
      }
    } else { // New Regime uses standard slabs regardless of age
      slabsToUse = rule.slabs;
    }
  }

  if (!slabsToUse) {
    console.error("No valid tax slabs found for computation. Returning zero tax.");
    return { tax: 0, cess: 0, totalTax: 0, rebate: 0 };
  }

  let tax = 0;
  let prevLimit = 0;

  // Calculate tax based on slabs
  for (const slab of slabsToUse) {
    const taxableAmountInSlab = Math.min(slab.limit - prevLimit, income - prevLimit);
    if (taxableAmountInSlab <= 0) break; // Stop if no more taxable income in this slab
    tax += taxableAmountInSlab * slab.rate;
    prevLimit = slab.limit;
  }

  let rebate = 0;
  // Apply 87A rebate if income is within the limit
  if (rule.rebate87A && income <= rule.rebate87A.limit) {
    rebate = Math.min(tax, rule.rebate87A.maxRebate);
  }

  const taxAfterRebate = Math.max(0, tax - rebate); // Ensure tax doesn't go below zero
  const cess = taxAfterRebate * (rule.cessRate || 0.04); // Apply cess, with fallback rate
  const totalTax = taxAfterRebate + cess;

  return { tax: taxAfterRebate, cess, totalTax, rebate };
}

/**
 * Calculates age from a date of birth string.
 * @param {string} dobStr - Date of birth in a string format (e.g., "YYYY-MM-DD").
 * @returns {number} The calculated age, or 30 as a default if DOB is invalid.
 */
export function calculateAge(dobStr) {
  if (!dobStr) return 30; // default age fallback for invalid DOB
  const dob = new Date(dobStr);
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  return age;
}
