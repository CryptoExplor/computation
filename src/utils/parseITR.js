// src/utils/parseITR.js

import { computeTax, calculateAge } from "./computeTax"; // Import from computeTax.js
import { taxRules } from "../config/taxRules"; // Import taxRules for cessRate

/**
 * Parses ITR JSON and computes a standardized summary.
 * Supports basic ITR-1, ITR-2, ITR-3 structures with fallbacks.
 * @param {object} jsonData - The raw ITR JSON data.
 * @returns {object|null} A structured client data object, or null if parsing fails.
 */
export function parseITRJson(jsonData) {
  const clientData = {};

  try {
    // Basic Client Metadata
    clientData.name = jsonData?.PartA_Gen1?.Name || "N/A";
    clientData.pan = jsonData?.PartA_Gen1?.PAN || "N/A";
    clientData.assessmentYear = jsonData?.ITRForm?.AssessmentYear || "2024-25";
    clientData.filingStatus = jsonData?.FilingStatus?.Status || "Filed";

    // Calculate age from DOB
    clientData.age = calculateAge(jsonData?.PartA_Gen1?.DOB || "");

    // Determine regime (Old/New)
    const regime = jsonData?.PartB_TTI?.isOptingForNewTaxRegime === "Y" ? "New" : "Old";
    clientData.taxRegime = regime;

    // Income Computation
    const incomeDetails = {
      salary: jsonData?.PartA_TotalIncome?.Salaries || 0,
      houseProperty: jsonData?.PartA_TotalIncome?.IncomeFromHP || 0,
      businessIncome: jsonData?.PartA_TotalIncome?.IncomeFromBP || 0,
      capitalGains: {
        shortTerm: jsonData?.ScheduleCG?.TotalSTCG || 0,
        longTerm: jsonData?.ScheduleCG?.TotalLTCG || 0,
      },
      otherSources: jsonData?.PartA_TotalIncome?.IncomeFromOS || 0,
      grossTotalIncome: jsonData?.PartA_TotalIncome?.GrossTotalIncome || 0,
    };
    clientData.incomeDetails = incomeDetails;

    // Deductions
    const deductions = {
      section80C: jsonData?.PartA_TotalIncome?.Deductions?.Section80C || 0,
      section80D: jsonData?.PartA_TotalIncome?.Deductions?.Section80D || 0,
      section80G: jsonData?.PartA_TotalIncome?.Deductions?.Section80G || 0,
      totalDeductions: jsonData?.PartA_TotalIncome?.TotalDeductions || 0,
    };
    clientData.deductions = deductions;

    // Net Taxable Income
    const netTaxableIncome = incomeDetails.grossTotalIncome - deductions.totalDeductions;
    clientData.netTaxableIncome = netTaxableIncome;

    // Tax Computation using the imported computeTax function
    const { tax, cess, totalTax, rebate } = computeTax(
      netTaxableIncome,
      clientData.age,
      clientData.assessmentYear,
      regime
    );

    clientData.taxComputation = {
      taxOnIncome: tax,
      cess: cess,
      totalTaxLiability: totalTax,
      rebate87A: rebate
    };

    // Tax Paid
    const taxPaid = {
      tdsSalary: jsonData?.TaxPaid?.TDSonSalaries?.reduce((sum, item) => sum + (item?.TotalTDSSalary || 0), 0) || 0,
      tdsOthers: jsonData?.TaxPaid?.TDSonOthThanSals?.reduce((sum, item) => sum + (item?.TotalTDSonOthThanSals || 0), 0) || 0,
      advanceTax: jsonData?.TaxPaid?.AdvanceTax?.reduce((sum, item) => sum + (item?.Amt || 0), 0) || 0,
      selfAssessmentTax: jsonData?.TaxPaid?.SelfAssessmentTax?.reduce((sum, item) => sum + (item?.Amt || 0), 0) || 0,
    };
    taxPaid.totalTaxPaid = taxPaid.tdsSalary + taxPaid.tdsOthers + taxPaid.advanceTax + taxPaid.selfAssessmentTax;
    clientData.taxPaid = taxPaid;

    // Final Settlement
    const finalSettlement = {
      taxLiability: totalTax,
      taxPaid: taxPaid.totalTaxPaid,
      refundDue: Math.max(0, taxPaid.totalTaxPaid - totalTax),
      taxPayable: Math.max(0, totalTax - taxPaid.totalTaxPaid),
    };
    clientData.finalSettlement = finalSettlement;

    clientData.notes = ""; // Placeholder for notes
    clientData.uploadedAt = new Date().toISOString();

  } catch (error) {
    console.error("Error parsing ITR JSON:", error);
    return null; // Return null if parsing fails
  }

  return clientData;
}
