// src/utils/exportCSV.js

/**
 * Exports a list of client data to a CSV file.
 * @param {Array<object>} clients - An array of client data objects.
 */
export const exportAllClientsToCsv = (clients) => {
  if (clients.length === 0) {
    console.warn("No clients to export to CSV.");
    return;
  }

  // Define CSV headers
  const headers = [
    "Name", "PAN", "Assessment Year", "Filing Status", "Tax Regime", "Age",
    "Gross Total Income", "Total Deductions", "Net Taxable Income",
    "Tax on Income", "87A Rebate", "Cess", "Total Tax Liability",
    "Total Tax Paid", "Refund Due", "Tax Payable"
  ];

  // Map client data to CSV rows, ensuring numbers are formatted and strings are quoted
  const rows = clients.map(client => [
    client.name,
    client.pan,
    client.assessmentYear,
    client.filingStatus,
    client.taxRegime,
    client.age,
    client.incomeDetails.grossTotalIncome?.toLocaleString('en-IN'),
    client.deductions.totalDeductions?.toLocaleString('en-IN'),
    client.netTaxableIncome?.toLocaleString('en-IN'),
    client.taxComputation.taxOnIncome?.toLocaleString('en-IN'),
    client.taxComputation.rebate87A?.toLocaleString('en-IN'),
    client.taxComputation.cess?.toLocaleString('en-IN'),
    client.taxComputation.totalTaxLiability?.toLocaleString('en-IN'),
    client.taxPaid.totalTaxPaid?.toLocaleString('en-IN'),
    client.finalSettlement.refundDue?.toLocaleString('en-IN'),
    client.finalSettlement.taxPayable?.toLocaleString('en-IN')
  ]);

  // Combine headers and rows into CSV content
  let csvContent = headers.map(header => `"${header}"`).join(",") + "\n"; // Quote headers too
  rows.forEach(row => {
    csvContent += row.map(cell => `"${cell}"`).join(",") + "\n"; // Enclose all cells in quotes
  });

  // Create a Blob and trigger download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  if (link.download !== undefined) { // Feature detection for download attribute
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'all_clients_itr_summary.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url); // Clean up the URL object
  } else {
    console.error("Your browser does not support downloading files this way.");
  }
};
