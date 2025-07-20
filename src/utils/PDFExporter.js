// src/utils/PDFExporter.js

import jsPDF from "jspdf";
import "jspdf-autotable";

/**
 * Generates a PDF summary report for a given client's ITR data.
 * @param {object} client - The client data object.
 */
export function generatePDF(client) {
  const doc = new jsPDF();

  doc.setFontSize(18);
  doc.text("ITR Summary Report", 14, 22);

  doc.setFontSize(12);
  doc.text(`Client Name: ${client.name}`, 14, 32);
  doc.text(`PAN: ${client.pan}`, 14, 39);
  doc.text(`Assessment Year: ${client.assessmentYear}`, 14, 46);
  doc.text(`Filing Status: ${client.filingStatus}`, 14, 53);
  doc.text(`Tax Regime: ${client.taxRegime}`, 14, 60);
  doc.text(`Age: ${client.age}`, 14, 67);

  doc.setFontSize(14);
  doc.text("Income Details", 14, 77);
  doc.autoTable({
    startY: 80,
    head: [['Income Head', 'Amount (₹)']],
    body: [
      ['Salary', client.incomeDetails.salary?.toLocaleString('en-IN')],
      ['House Property', client.incomeDetails.houseProperty?.toLocaleString('en-IN')],
      ['Business Income', client.incomeDetails.businessIncome?.toLocaleString('en-IN')],
      ['Capital Gains (ST)', client.incomeDetails.capitalGains.shortTerm?.toLocaleString('en-IN')],
      ['Capital Gains (LT)', client.incomeDetails.capitalGains.longTerm?.toLocaleString('en-IN')],
      ['Other Sources', client.incomeDetails.otherSources?.toLocaleString('en-IN')],
      ['Gross Total Income', client.incomeDetails.grossTotalIncome?.toLocaleString('en-IN')],
    ],
    theme: 'grid',
    styles: { fontSize: 10, cellPadding: 2 },
    headStyles: { fillColor: [200, 200, 200], textColor: [0, 0, 0] },
  });

  let finalY = doc.autoTable.previous.finalY + 10;
  doc.setFontSize(14);
  doc.text("Deductions", 14, finalY);
  doc.autoTable({
    startY: finalY + 3,
    head: [['Section', 'Amount (₹)']],
    body: [
      ['80C', client.deductions.section80C?.toLocaleString('en-IN')],
      ['80D', client.deductions.section80D?.toLocaleString('en-IN')],
      ['80G', client.deductions.section80G?.toLocaleString('en-IN')],
      ['Total Deductions', client.deductions.totalDeductions?.toLocaleString('en-IN')],
    ],
    theme: 'grid',
    styles: { fontSize: 10, cellPadding: 2 },
    headStyles: { fillColor: [200, 200, 200], textColor: [0, 0, 0] },
  });

  finalY = doc.autoTable.previous.finalY + 10;
  doc.setFontSize(14);
  doc.text("Tax Computation & Payment", 14, finalY);
  doc.autoTable({
    startY: finalY + 3,
    head: [['Description', 'Amount (₹)']],
    body: [
      ['Net Taxable Income', client.netTaxableIncome?.toLocaleString('en-IN')],
      ['Tax on Income', client.taxComputation.taxOnIncome?.toLocaleString('en-IN')],
      ['87A Rebate', client.taxComputation.rebate87A?.toLocaleString('en-IN')],
      ['Cess', client.taxComputation.cess?.toLocaleString('en-IN')],
      ['Total Tax Liability', client.taxComputation.totalTaxLiability?.toLocaleString('en-IN')],
      ['TDS (Salary)', client.taxPaid.tdsSalary?.toLocaleString('en-IN')],
      ['TDS (Others)', client.taxPaid.tdsOthers?.toLocaleString('en-IN')],
      ['Advance Tax', client.taxPaid.advanceTax?.toLocaleString('en-IN')],
      ['Self-Assessment Tax', client.taxPaid.selfAssessmentTax?.toLocaleString('en-IN')],
      ['Total Tax Paid', client.taxPaid.totalTaxPaid?.toLocaleString('en-IN')],
    ],
    theme: 'grid',
    styles: { fontSize: 10, cellPadding: 2 },
    headStyles: { fillColor: [200, 200, 200], textColor: [0, 0, 0] },
  });

  finalY = doc.autoTable.previous.finalY + 10;
  doc.setFontSize(14);
  doc.text("Final Settlement", 14, finalY);
  doc.autoTable({
    startY: finalY + 3,
    head: [['Description', 'Amount (₹)']],
    body: [
      ['Tax Liability', client.finalSettlement.taxLiability?.toLocaleString('en-IN')],
      ['Total Tax Paid', client.finalSettlement.taxPaid?.toLocaleString('en-IN')],
      ['Refund Due', client.finalSettlement.refundDue?.toLocaleString('en-IN')],
      ['Tax Payable', client.finalSettlement.taxPayable?.toLocaleString('en-IN')],
    ],
    theme: 'grid',
    styles: { fontSize: 10, cellPadding: 2 },
    headStyles: { fillColor: [200, 200, 200], textColor: [0, 0, 0] },
  });

  doc.save(`${client.name}_${client.assessmentYear}_ITR_Summary.pdf`);
}
