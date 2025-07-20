// src/components/ClientCard.jsx

import React from "react";
import { generatePDF } from "../utils/PDFExporter"; // Ensure this path is correct

/**
 * ClientCard component displays a summary of client ITR data.
 * @param {object} props - Component props.
 * @param {object} props.client - The client data object.
 */
export default function ClientCard({ client }) {
  const {
    name,
    pan,
    assessmentYear,
    finalSettlement,
  } = client;

  return (
    <div className="border rounded-xl p-4 shadow-sm bg-white">
      <h3 className="text-lg font-semibold mb-1">{name}</h3>
      <p className="text-sm text-gray-600">PAN: {pan}</p>
      <p className="text-sm">AY: {assessmentYear}</p>
      <p className="text-sm mt-1 font-medium text-green-700">
        Tax Paid: ₹{finalSettlement.taxPaid?.toLocaleString('en-IN')} | Refund: ₹{finalSettlement.refundDue?.toLocaleString('en-IN')}
      </p>
      <button
        onClick={() => generatePDF(client)}
        className="mt-3 text-sm bg-indigo-600 text-white px-3 py-1 rounded hover:bg-indigo-700"
      >
        Download PDF
      </button>
    </div>
  );
}
