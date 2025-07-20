import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged, signOut } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, getDocs, deleteDoc, query, onSnapshot, updateDoc } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import jsPDF from 'jspdf';
import 'jspdf-autotable'; // For table support in PDF
import { v4 as uuidv4 } from 'uuid'; // For generating unique IDs

// Tailwind CSS is assumed to be available
// <script src="https://cdn.tailwindcss.com"></script>

// IMPORTANT: Ensure the Razorpay checkout script is loaded in your index.html
// <script src="https://checkout.razorpay.com/v1/checkout.js"></script>

// --- Firebase Configuration ---
// This configuration is typically in a separate file (firebaseConfig.js)
// For this single-file compilation, it's included here.
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// Get the app ID from the global variable, or use a default
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// --- Tax Rules Configuration (taxRules.js content) ---
// This would typically be in src/config/taxRules.js
const taxRules = {
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
  "2024-25": {
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
  "2024-25-new": {
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
  }
  // Add more AYs as needed
};

// --- Tax Computation Logic (computeTax function) ---
// This would typically be part of src/utils/computeTax.js
const calculateAge = (dobStr) => {
  if (!dobStr) return 30; // default age fallback
  const dob = new Date(dobStr);
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  return age;
};

const computeTax = (income, age = 30, ay = "2024-25", regime = "Old") => {
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
    console.warn(`Tax rules for AY ${ay} and regime ${regime} not found. Falling back to 2024-25 Old.`);
    const fallbackRule = taxRules["2024-25"];
    slabsToUse = fallbackRule.slabs;
    rule.cessRate = fallbackRule.cessRate;
    rule.rebate87A = fallbackRule.rebate87A;
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
    console.error("No slabs found for computation.");
    return { tax: 0, cess: 0, totalTax: 0, rebate: 0 };
  }

  let tax = 0;
  let prevLimit = 0;

  for (const slab of slabsToUse) {
    const taxableAmountInSlab = Math.min(slab.limit - prevLimit, income - prevLimit);
    if (taxableAmountInSlab <= 0) break;
    tax += taxableAmountInSlab * slab.rate;
    prevLimit = slab.limit;
  }

  let rebate = 0;
  if (income <= rule.rebate87A.limit) {
    rebate = Math.min(tax, rule.rebate87A.maxRebate);
  }

  const taxAfterRebate = Math.max(0, tax - rebate);
  const cess = taxAfterRebate * rule.cessRate;
  const totalTax = taxAfterRebate + cess;

  return { tax: taxAfterRebate, cess, totalTax, rebate };
};


// --- ITR JSON Parsing Logic (parseITR.js content) ---
// This would typically be in src/utils/parseITR.js
const parseITR = (jsonData) => {
  const clientData = {};

  try {
    // Basic Client Metadata
    clientData.name = jsonData?.PartA_Gen1?.Name || "N/A";
    clientData.pan = jsonData?.PartA_Gen1?.PAN || "N/A";
    clientData.assessmentYear = jsonData?.ITRForm?.AssessmentYear || "N/A";
    clientData.filingStatus = jsonData?.FilingStatus?.Status || "N/A";

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

    // Tax Computation
    const { tax, cess, totalTax, rebate } = computeTax(netTaxableIncome, clientData.age, clientData.assessmentYear, regime);
    clientData.taxComputation = {
      taxOnIncome: tax,
      cess: cess,
      totalTaxLiability: totalTax,
      rebate87A: rebate
    };

    // Tax Paid
    const taxPaid = {
      tdsSalary: jsonData?.TaxPaid?.TDSonSalaries || 0,
      tdsOthers: jsonData?.TaxPaid?.TDSonOtherThanSals || 0,
      advanceTax: jsonData?.TaxPaid?.AdvanceTax || 0,
      selfAssessmentTax: jsonData?.TaxPaid?.SelfAssessmentTax || 0,
      totalTaxPaid: jsonData?.TaxPaid?.TotalTaxPaid || 0,
    };
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
};

// --- PDF Export Logic (PDFExporter.js content) ---
// This would typically be in src/utils/PDFExporter.js
const exportClientSummaryToPdf = (client) => {
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
};

// --- CSV Export Logic (exportCSV.js content) ---
// This would typically be in src/utils/exportCSV.js
const exportAllClientsToCsv = (clients) => {
  if (clients.length === 0) {
    console.warn("No clients to export to CSV.");
    return;
  }

  const headers = [
    "Name", "PAN", "Assessment Year", "Filing Status", "Tax Regime", "Age",
    "Gross Total Income", "Total Deductions", "Net Taxable Income",
    "Tax on Income", "87A Rebate", "Cess", "Total Tax Liability",
    "Total Tax Paid", "Refund Due", "Tax Payable"
  ];

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

  let csvContent = headers.map(header => `"${header}"`).join(",") + "\n";
  rows.forEach(row => {
    csvContent += row.map(cell => `"${cell}"`).join(",") + "\n";
  });

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'all_clients_itr_summary.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
};

// --- Razorpay Payment Component ---
// This would typically be in src/components/RazorpayPayment.jsx
const RazorpayPayment = ({ plan, amount, onSuccess, onError }) => {
  const handlePayment = () => {
    if (typeof window.Razorpay === 'undefined') {
      onError("Razorpay script not loaded. Please ensure it's included in index.html.");
      return;
    }

    const options = {
      key: "rzp_test_YOUR_KEY_ID", // IMPORTANT: Replace with your live key from Razorpay Dashboard
      amount: amount * 100, // amount in smallest currency unit (paise)
      currency: "INR",
      name: "TaxDashboard Plans",
      description: `Purchase ${plan} Plan`,
      handler: function (response) {
        console.log("Razorpay success response:", response);
        onSuccess(response);
      },
      prefill: {
        name: auth.currentUser?.displayName || "User Name",
        email: auth.currentUser?.email || "user@example.com",
      },
      theme: {
        color: "#3399cc",
      },
    };

    const razor = new window.Razorpay(options);
    razor.on('payment.failed', function (response){
      console.error("Razorpay payment failed:", response);
      onError(`Payment failed: ${response.error.description || 'Unknown error'}`);
    });
    razor.open();
  };

  return (
    <button onClick={handlePayment} className="bg-indigo-600 text-white px-4 py-2 rounded-md shadow-sm hover:bg-indigo-700 transition duration-200 ease-in-out">
      Buy {plan} – ₹{amount}
    </button>
  );
};

// --- Plans Page Component ---
const PlansPage = ({ userId, onPlanUpdate, onBackToDashboard, setError }) => {
  const plans = [
    { name: "Free", clients: 1, reports: 1, price: 0, description: "Limited access for personal use." },
    { name: "Family", clients: 5, reports: 15, price: 500, description: "Ideal for small families or individuals with multiple returns." },
    { name: "Pro", clients: 15, reports: 60, price: 1499, description: "For professionals managing a moderate client base." },
    { name: "Agency", clients: 100, reports: 250, price: 4999, description: "Comprehensive solution for large tax agencies." },
  ];

  const handlePaymentSuccess = async (planName, response) => {
    try {
      await onPlanUpdate(planName, response);
      console.log(`Plan ${planName} updated successfully for user ${userId}`);
    } catch (error) {
      console.error("Error updating plan in Firestore:", error);
      setError("Failed to update plan after payment. Please contact support.");
      // Do not re-throw here, as RazorpayPayment's onError handles it.
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <h2 className="text-3xl font-bold text-gray-800 mb-6">Choose Your Plan</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {plans.map((plan) => (
          <div key={plan.name} className="bg-white rounded-lg shadow-lg p-6 flex flex-col items-center text-center border-2 border-gray-200 hover:border-indigo-500 transition duration-300 ease-in-out">
            <h3 className="text-2xl font-bold text-indigo-700 mb-2">{plan.name}</h3>
            <p className="text-gray-600 mb-4">{plan.description}</p>
            <p className="text-4xl font-extrabold text-gray-900 mb-4">
              {plan.price === 0 ? "Free" : `₹${plan.price}/year`}
            </p>
            <ul className="text-gray-700 text-left mb-6 space-y-2">
              <li><span className="font-semibold">{plan.clients}</span> Client{plan.clients !== 1 ? 's' : ''}</li>
              <li><span className="font-semibold">{plan.reports}</span> Reports/year</li>
              {plan.name === "Free" ? (
                <li>❌ PDF/CSV Export</li>
              ) : (
                <li>✅ PDF/CSV Export</li>
              )}
            </ul>
            {plan.price > 0 ? (
              <RazorpayPayment
                plan={plan.name}
                amount={plan.price}
                onSuccess={(res) => handlePaymentSuccess(plan.name, res)}
                onError={setError}
              />
            ) : (
              <button disabled className="bg-gray-300 text-gray-700 px-4 py-2 rounded-md cursor-not-allowed">
                Current Plan
              </button>
            )}
          </div>
        ))}
      </div>
      <div className="mt-8 text-center">
        <button
          onClick={onBackToDashboard}
          className="px-6 py-3 bg-gray-500 text-white rounded-md shadow-sm hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-opacity-50 transition duration-200 ease-in-out"
        >
          Back to Dashboard
        </button>
      </div>
    </div>
  );
};

// Custom Confirmation Modal Component
const ConfirmationModal = ({ message, onConfirm, onCancel }) => {
  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Confirm Action</h3>
        <p className="text-gray-700 mb-6">{message}</p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-gray-300 text-gray-800 rounded-md hover:bg-gray-400 transition duration-200"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition duration-200"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
};


// Main React App Component
const App = () => {
  const [user, setUser] = useState(null);
  const [userId, setUserId] = useState(null);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedClient, setSelectedClient] = useState(null); // For detailed view
  const [currentPage, setCurrentPage] = useState('dashboard'); // 'dashboard' or 'plans'
  const [userPlan, setUserPlan] = useState({ plan: 'free', usage: { clients: 0, reports: 0 } });

  // State for confirmation modal
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null); // Function to execute on confirm


  // Firebase Auth Listener and Initialization
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        setUserId(currentUser.uid);
      } else {
        // Sign in anonymously if no user is logged in
        try {
          // Use __initial_auth_token if available for custom authentication
          if (typeof __initial_auth_token !== 'undefined') {
            await signInWithCustomToken(auth, __initial_auth_token);
          } else {
            await signInAnonymously(auth);
          }
        } catch (authError) {
          console.error("Error signing in:", authError);
          setError("Failed to authenticate. Please try again.");
        }
      }
      setLoading(false);
    });

    return () => unsubscribe(); // Clean up the listener
  }, []);

  // Fetch user plan and clients when user ID is available
  useEffect(() => {
    if (!userId) return;

    // Listen for user plan changes
    const userDocRef = doc(db, `artifacts/${appId}/users`, userId);
    const unsubscribePlan = onSnapshot(userDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setUserPlan({
          plan: data.plan || 'free',
          usage: data.usage || { clients: 0, reports: 0 },
          createdAt: data.createdAt // Keep createdAt for future use if needed
        });
      } else {
        // Initialize user document if it doesn't exist
        setDoc(userDocRef, {
          plan: 'free',
          usage: { clients: 0, reports: 0 },
          createdAt: new Date().toISOString()
        }, { merge: true });
        setUserPlan({ plan: 'free', usage: { clients: 0, reports: 0 } });
      }
    }, (err) => {
      console.error("Error fetching user plan:", err);
      setError("Failed to load user plan. Some features might be restricted.");
    });


    const clientsCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/clients`);
    const q = query(clientsCollectionRef);

    const unsubscribeClients = onSnapshot(q, (snapshot) => {
      const clientsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setClients(clientsData);
      setError(null); // Clear any previous errors
    }, (err) => {
      console.error("Error fetching clients:", err);
      setError("Failed to load clients. Please try refreshing.");
    });

    return () => {
      unsubscribePlan();
      unsubscribeClients();
    }; // Clean up both listeners
  }, [userId]);

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (file.type !== "application/json") {
      setError("Please upload a valid JSON file.");
      return;
    }

    // Define plan limits for client uploads (should match PLAN_LIMITS in planLogic.js if used separately)
    const planLimits = {
      free: { maxClients: 1, maxReports: 1 },
      family: { maxClients: 5, maxReports: 15 },
      pro: { maxClients: 15, maxReports: 60 },
      agency: { maxClients: 100, maxReports: 250 },
      admin: { maxClients: Infinity, maxReports: Infinity } // Admin has unlimited access
    };

    const currentClientCount = clients.length;
    const maxClients = planLimits[userPlan.plan]?.maxClients || 1; // Default to 1 for unknown plans

    if (userPlan.plan !== 'admin' && currentClientCount >= maxClients) {
      setError(`Your current plan (${userPlan.plan}) allows a maximum of ${maxClients} clients. Please upgrade your plan to add more.`);
      return;
    }


    setUploading(true);
    setError(null);

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const jsonData = JSON.parse(e.target.result);
          const parsedClientData = parseITR(jsonData);

          if (!parsedClientData) {
            setError("Failed to parse ITR JSON. Please ensure it's a valid ITR file.");
            setUploading(false);
            return;
          }

          // Generate a unique ID for the client document
          const clientId = uuidv4();

          // Upload raw JSON to Firebase Storage
          const storageRef = ref(storage, `artifacts/${appId}/users/${userId}/jsonFiles/${clientId}.json`);
          await uploadBytes(storageRef, file);
          const jsonDownloadURL = await getDownloadURL(storageRef);

          // Save parsed data to Firestore
          const clientDocRef = doc(db, `artifacts/${appId}/users/${userId}/clients`, clientId);
          await setDoc(clientDocRef, {
            ...parsedClientData,
            jsonRef: jsonDownloadURL, // Store reference to the raw JSON
            uid: userId, // Store user ID for security rules
          });

          // Update client count in user's plan usage
          const userDocRef = doc(db, `artifacts/${appId}/users`, userId);
          await updateDoc(userDocRef, {
            'usage.clients': currentClientCount + 1
          });

          console.log("Client data uploaded and saved successfully!");

        } catch (parseError) {
          console.error("Error processing file:", parseError);
          setError("Error processing file. Please check file content.");
        } finally {
          setUploading(false);
        }
      };
      reader.readAsText(file);
    } catch (uploadError) {
      console.error("Error during file upload:", uploadError);
      setError("Error uploading file. Please try again.");
      setUploading(false);
    }
  };

  const handleDeleteClient = (clientId, jsonRef) => {
    // Show custom confirmation modal instead of window.confirm
    setShowConfirmModal(true);
    setConfirmAction(() => async () => {
      setError(null);
      try {
        // Delete from Firestore
        await deleteDoc(doc(db, `artifacts/${appId}/users/${userId}/clients`, clientId));

        // Delete raw JSON from Storage if jsonRef exists
        if (jsonRef) {
          const fileRef = ref(storage, jsonRef);
          await deleteObject(fileRef);
        }

        // Decrement client count in user's plan usage
        const userDocRef = doc(db, `artifacts/${appId}/users`, userId);
        await updateDoc(userDocRef, {
          'usage.clients': Math.max(0, userPlan.usage.clients - 1)
        });

        console.log("Client deleted successfully!");
      } catch (deleteError) {
        console.error("Error deleting client:", deleteError);
        setError("Failed to delete client. Please try again.");
      } finally {
        setShowConfirmModal(false); // Close modal
        setConfirmAction(null); // Clear action
      }
    });
  };

  const handleDownloadOriginalJson = async (jsonRef, fileName) => {
    if (!jsonRef) {
      setError("Original JSON file not found for this client.");
      return;
    }
    try {
      const response = await fetch(jsonRef);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${fileName}_original.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (downloadError) {
      console.error("Error downloading original JSON:", downloadError);
      setError("Failed to download original JSON. It might have been deleted.");
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      setUser(null);
      setUserId(null);
      setClients([]);
      setSelectedClient(null);
      setError(null);
      setCurrentPage('dashboard'); // Reset to dashboard on sign out
      console.log("User signed out.");
    } catch (error) {
      console.error("Error signing out:", error);
      setError("Failed to sign out.");
    }
  };

  const handlePlanUpdate = async (planName, paymentResponse) => {
    if (!userId) {
      setError("User not authenticated to update plan.");
      return;
    }
    try {
      const userDocRef = doc(db, `artifacts/${appId}/users`, userId);
      await updateDoc(userDocRef, {
        plan: planName.toLowerCase(),
        paymentInfo: paymentResponse,
        updatedAt: new Date().toISOString()
      });
      setError(`Plan upgraded to ${planName} successfully!`);
      setCurrentPage('dashboard'); // Navigate back to dashboard
    } catch (error) {
      console.error("Error updating user plan in Firestore:", error);
      setError("Failed to update plan. Please try again or contact support.");
      throw error; // Re-throw to be caught by RazorpayPayment's onError
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100 font-inter">
        <div className="text-xl font-semibold text-gray-700">Loading Dashboard...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 font-inter text-gray-800 p-4 sm:p-6 lg:p-8">
      {/* Navbar */}
      <nav className="flex items-center justify-between bg-white p-4 rounded-lg shadow-md mb-6">
        <h1 className="text-2xl font-bold text-indigo-700">ITR Dashboard</h1>
        <div className="flex items-center space-x-4">
          {userId && (
            <span className="text-sm text-gray-600 hidden sm:block">
              User ID: <span className="font-semibold">{userId}</span>
            </span>
          )}
          {user && (
            <>
              <span className="text-sm text-gray-600">Plan: <span className="font-semibold capitalize">{userPlan.plan}</span></span>
              <button
                onClick={() => setCurrentPage('plans')}
                className="px-4 py-2 bg-blue-500 text-white rounded-md shadow-sm hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition duration-200 ease-in-out"
              >
                Upgrade Plan
              </button>
              <button
                onClick={handleSignOut}
                className="px-4 py-2 bg-red-500 text-white rounded-md shadow-sm hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-50 transition duration-200 ease-in-out"
              >
                Sign Out
              </button>
            </>
          )}
        </div>
      </nav>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-md relative mb-4" role="alert">
          <strong className="font-bold">Error!</strong>
          <span className="block sm:inline"> {error}</span>
          <span className="absolute top-0 bottom-0 right-0 px-4 py-3 cursor-pointer" onClick={() => setError(null)}>
            <svg className="fill-current h-6 w-6 text-red-500" role="button" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><title>Close</title><path d="M14.348 14.849a1.2 1.2 0 0 1-1.697 0L10 11.103l-2.651 3.746a1.2 1.2 0 0 1-1.697-1.697l3.746-2.651-3.746-2.651a1.2 1.2 0 0 1 1.697-1.697L10 8.897l2.651-3.746a1.2 1.2 0 0 1 1.697 1.697L11.103 10l3.746 2.651a1.2 1.2 0 0 1 0 1.698z"/></svg>
          </span>
        </div>
      )}

      {currentPage === 'dashboard' ? (
        <>
          {/* Upload Section */}
          <div className="bg-white p-6 rounded-lg shadow-md mb-6">
            <h2 className="text-xl font-semibold text-gray-700 mb-4">Upload ITR JSON</h2>
            <label
              htmlFor="file-upload"
              className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-md cursor-pointer bg-gray-50 hover:bg-gray-100 transition duration-200 ease-in-out"
            >
              <input
                id="file-upload"
                type="file"
                accept=".json"
                onChange={handleFileUpload}
                className="hidden"
                disabled={uploading}
              />
              {uploading ? (
                <div className="flex items-center space-x-2 text-indigo-600">
                  <svg className="animate-spin h-5 w-5 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Uploading & Parsing...</span>
                </div>
              ) : (
                <p className="text-gray-500">Drag & drop your ITR JSON here, or click to browse</p>
              )}
            </label>
          </div>

          {/* Client List / Dashboard View */}
          <div className="bg-white p-6 rounded-lg shadow-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-gray-700">Your Clients</h2>
              {clients.length > 0 && (
                <button
                  onClick={() => exportAllClientsToCsv(clients)}
                  className="px-4 py-2 bg-green-500 text-white rounded-md shadow-sm hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50 transition duration-200 ease-in-out"
                >
                  Export All to CSV
                </button>
              )}
            </div>

            {clients.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No clients uploaded yet. Upload an ITR JSON to get started!</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {clients.map((client) => (
                  <div key={client.id} className="bg-gray-50 border border-gray-200 rounded-lg p-4 shadow-sm flex flex-col justify-between">
                    <div>
                      <h3 className="text-lg font-bold text-indigo-700 mb-1">{client.name}</h3>
                      <p className="text-sm text-gray-600">PAN: {client.pan}</p>
                      <p className="text-sm text-gray-600">AY: {client.assessmentYear} ({client.taxRegime} Regime)</p>
                      <p className="text-sm text-gray-600">Net Taxable Income: ₹{client.netTaxableIncome?.toLocaleString('en-IN')}</p>
                      <p className="text-sm text-gray-600">Total Tax Liability: ₹{client.taxComputation?.totalTaxLiability?.toLocaleString('en-IN')}</p>
                      <p className="text-sm text-gray-600">Total Tax Paid: ₹{client.taxPaid?.totalTaxPaid?.toLocaleString('en-IN')}</p>
                      {client.finalSettlement?.refundDue > 0 && (
                        <p className="text-sm font-semibold text-green-600">Refund Due: ₹{client.finalSettlement.refundDue?.toLocaleString('en-IN')}</p>
                      )}
                      {client.finalSettlement?.taxPayable > 0 && (
                        <p className="text-sm font-semibold text-red-600">Tax Payable: ₹{client.finalSettlement.taxPayable?.toLocaleString('en-IN')}</p>
                      )}
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        onClick={() => setSelectedClient(client)}
                        className="flex-1 px-3 py-1 bg-blue-500 text-white text-sm rounded-md shadow-sm hover:bg-blue-600 transition duration-200 ease-in-out min-w-[100px]"
                      >
                        View Details
                      </button>
                      <button
                        onClick={() => exportClientSummaryToPdf(client)}
                        className="flex-1 px-3 py-1 bg-purple-500 text-white text-sm rounded-md shadow-sm hover:bg-purple-600 transition duration-200 ease-in-out min-w-[100px]"
                      >
                        Download PDF
                      </button>
                      <button
                        onClick={() => handleDownloadOriginalJson(client.jsonRef, client.name)}
                        className="flex-1 px-3 py-1 bg-gray-500 text-white text-sm rounded-md shadow-sm hover:bg-gray-600 transition duration-200 ease-in-out min-w-[100px]"
                      >
                        Download Original JSON
                      </button>
                      <button
                        onClick={() => handleDeleteClient(client.id, client.jsonRef)}
                        className="flex-1 px-3 py-1 bg-red-500 text-white text-sm rounded-md shadow-sm hover:bg-red-600 transition duration-200 ease-in-out min-w-[100px]"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      ) : (
        <PlansPage userId={userId} onPlanUpdate={handlePlanUpdate} onBackToDashboard={() => setCurrentPage('dashboard')} setError={setError} />
      )}


      {/* Client Details Modal */}
      {selectedClient && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex justify-between items-center border-b pb-3 mb-4">
              <h2 className="text-2xl font-bold text-indigo-700">Client Details: {selectedClient.name}</h2>
              <button
                onClick={() => setSelectedClient(null)}
                className="text-gray-500 hover:text-gray-700 text-2xl font-bold"
              >
                &times;
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-700 mb-2">Basic Information</h3>
                <p><strong>PAN:</strong> {selectedClient.pan}</p>
                <p><strong>Assessment Year:</strong> {selectedClient.assessmentYear}</p>
                <p><strong>Filing Status:</strong> {selectedClient.filingStatus}</p>
                <p><strong>Tax Regime:</strong> {selectedClient.taxRegime}</p>
                <p><strong>Age:</strong> {selectedClient.age}</p>
                <p><strong>Uploaded At:</strong> {new Date(selectedClient.uploadedAt).toLocaleDateString()}</p>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-700 mb-2">Summary</h3>
                <p><strong>Gross Total Income:</strong> ₹{selectedClient.incomeDetails.grossTotalIncome?.toLocaleString('en-IN')}</p>
                <p><strong>Total Deductions:</strong> ₹{selectedClient.deductions.totalDeductions?.toLocaleString('en-IN')}</p>
                <p><strong>Net Taxable Income:</strong> ₹{selectedClient.netTaxableIncome?.toLocaleString('en-IN')}</p>
                <p><strong>Total Tax Liability:</strong> ₹{selectedClient.taxComputation?.totalTaxLiability?.toLocaleString('en-IN')}</p>
                <p><strong>Total Tax Paid:</strong> ₹{selectedClient.taxPaid?.totalTaxPaid?.toLocaleString('en-IN')}</p>
                <p className={selectedClient.finalSettlement?.refundDue > 0 ? "text-green-600 font-bold" : "text-red-600 font-bold"}>
                  {selectedClient.finalSettlement?.refundDue > 0 ? `Refund Due: ₹${selectedClient.finalSettlement.refundDue?.toLocaleString('en-IN')}` : `Tax Payable: ₹${selectedClient.finalSettlement.taxPayable?.toLocaleString('en-IN')}`}
                </p>
              </div>
            </div>

            <h3 className="text-lg font-semibold text-gray-700 mb-2">Detailed Income Breakdown</h3>
            <div className="overflow-x-auto mb-6">
              <table className="min-w-full bg-white border border-gray-200 rounded-md">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="py-2 px-4 border-b text-left text-sm font-medium text-gray-700">Income Head</th>
                    <th className="py-2 px-4 border-b text-left text-sm font-medium text-gray-700">Amount (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="hover:bg-gray-50">
                    <td className="py-2 px-4 border-b text-sm text-gray-800">Salary</td>
                    <td className="py-2 px-4 border-b text-sm text-gray-800">{selectedClient.incomeDetails.salary?.toLocaleString('en-IN')}</td>
                  </tr>
                  <tr className="hover:bg-gray-50">
                    <td className="py-2 px-4 border-b text-sm text-gray-800">House Property</td>
                    <td className="py-2 px-4 border-b text-sm text-gray-800">{selectedClient.incomeDetails.houseProperty?.toLocaleString('en-IN')}</td>
                  </tr>
                  <tr className="hover:bg-gray-50">
                    <td className="py-2 px-4 border-b text-sm text-gray-800">Business Income</td>
                    <td className="py-2 px-4 border-b text-sm text-gray-800">{selectedClient.incomeDetails.businessIncome?.toLocaleString('en-IN')}</td>
                  </tr>
                  <tr className="hover:bg-gray-50">
                    <td className="py-2 px-4 border-b text-sm text-gray-800">Capital Gains (Short Term)</td>
                    <td className="py-2 px-4 border-b text-sm text-gray-800">{selectedClient.incomeDetails.capitalGains?.shortTerm?.toLocaleString('en-IN')}</td>
                  </tr>
                  <tr className="hover:bg-gray-50">
                    <td className="py-2 px-4 border-b text-sm text-gray-800">Capital Gains (Long Term)</td>
                    <td className="py-2 px-4 border-b text-sm text-gray-800">{selectedClient.incomeDetails.capitalGains?.longTerm?.toLocaleString('en-IN')}</td>
                  </tr>
                  <tr className="hover:bg-gray-50">
                    <td className="py-2 px-4 border-b text-sm text-gray-800">Other Sources</td>
                    <td className="py-2 px-4 border-b text-sm text-gray-800">{selectedClient.incomeDetails.otherSources?.toLocaleString('en-IN')}</td>
                  </tr>
                  <tr className="bg-gray-100 font-semibold">
                    <td className="py-2 px-4 border-b text-sm text-gray-800">Gross Total Income</td>
                    <td className="py-2 px-4 border-b text-sm text-gray-800">{selectedClient.incomeDetails.grossTotalIncome?.toLocaleString('en-IN')}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <h3 className="text-lg font-semibold text-gray-700 mb-2">Deductions</h3>
            <div className="overflow-x-auto mb-6">
              <table className="min-w-full bg-white border border-gray-200 rounded-md">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="py-2 px-4 border-b text-left text-sm font-medium text-gray-700">Section</th>
                    <th className="py-2 px-4 border-b text-left text-sm font-medium text-gray-700">Amount (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="hover:bg-gray-50">
                    <td className="py-2 px-4 border-b text-sm text-gray-800">80C</td>
                    <td className="py-2 px-4 border-b text-sm text-gray-800">{selectedClient.deductions.section80C?.toLocaleString('en-IN')}</td>
                  </tr>
                  <tr className="hover:bg-gray-50">
                    <td className="py-2 px-4 border-b text-sm text-gray-800">80D</td>
                    <td className="py-2 px-4 border-b text-sm text-gray-800">{selectedClient.deductions.section80D?.toLocaleString('en-IN')}</td>
                  </tr>
                  <tr className="hover:bg-gray-50">
                    <td className="py-2 px-4 border-b text-sm text-gray-800">80G</td>
                    <td className="py-2 px-4 border-b text-sm text-gray-800">{selectedClient.deductions.section80G?.toLocaleString('en-IN')}</td>
                  </tr>
                  <tr className="bg-gray-100 font-semibold">
                    <td className="py-2 px-4 border-b text-sm text-gray-800">Total Deductions</td>
                    <td className="py-2 px-4 border-b text-sm text-gray-800">{selectedClient.deductions.totalDeductions?.toLocaleString('en-IN')}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <h3 className="text-lg font-semibold text-gray-700 mb-2">Tax Calculation & Payments</h3>
            <div className="overflow-x-auto mb-6">
              <table className="min-w-full bg-white border border-gray-200 rounded-md">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="py-2 px-4 border-b text-left text-sm font-medium text-gray-700">Description</th>
                    <th className="py-2 px-4 border-b text-left text-sm font-medium text-gray-700">Amount (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="hover:bg-gray-50">
                    <td className="py-2 px-4 border-b text-sm text-gray-800">Tax on Income</td>
                    <td className="py-2 px-4 border-b text-sm text-gray-800">{selectedClient.taxComputation?.taxOnIncome?.toLocaleString('en-IN')}</td>
                  </tr>
                  <tr className="hover:bg-gray-50">
                    <td className="py-2 px-4 border-b text-sm text-gray-800">87A Rebate</td>
                    <td className="py-2 px-4 border-b text-sm text-gray-800">{selectedClient.taxComputation?.rebate87A?.toLocaleString('en-IN')}</td>
                  </tr>
                  <tr className="hover:bg-gray-50">
                    <td className="py-2 px-4 border-b text-sm text-gray-800">Cess</td>
                    <td className="py-2 px-4 border-b text-sm text-gray-800">{selectedClient.taxComputation?.cess?.toLocaleString('en-IN')}</td>
                  </tr>
                  <tr className="bg-gray-100 font-semibold">
                    <td className="py-2 px-4 border-b text-sm text-gray-800">Total Tax Liability</td>
                    <td className="py-2 px-4 border-b text-sm text-gray-800">{selectedClient.taxComputation?.totalTaxLiability?.toLocaleString('en-IN')}</td>
                  </tr>
                  <tr className="hover:bg-gray-50">
                    <td className="py-2 px-4 border-b text-sm text-gray-800">TDS (Salary)</td>
                    <td className="py-2 px-4 border-b text-sm text-gray-800">{selectedClient.taxPaid?.tdsSalary?.toLocaleString('en-IN')}</td>
                  </tr>
                  <tr className="hover:bg-gray-50">
                    <td className="py-2 px-4 border-b text-sm text-gray-800">TDS (Others)</td>
                    <td className="py-2 px-4 border-b text-sm text-gray-800">{selectedClient.taxPaid?.tdsOthers?.toLocaleString('en-IN')}</td>
                  </tr>
                  <tr className="hover:bg-gray-50">
                    <td className="py-2 px-4 border-b text-sm text-gray-800">Advance Tax</td>
                    <td className="py-2 px-4 border-b text-sm text-gray-800">{selectedClient.taxPaid?.advanceTax?.toLocaleString('en-IN')}</td>
                  </tr>
                  <tr className="hover:bg-gray-50">
                    <td className="py-2 px-4 border-b text-sm text-gray-800">Self-Assessment Tax</td>
                    <td className="py-2 px-4 border-b text-sm text-gray-800">{selectedClient.taxPaid?.selfAssessmentTax?.toLocaleString('en-IN')}</td>
                  </tr>
                  <tr className="bg-gray-100 font-semibold">
                    <td className="py-2 px-4 border-b text-sm text-gray-800">Total Tax Paid</td>
                    <td className="py-2 px-4 border-b text-sm text-gray-800">{selectedClient.taxPaid?.totalTaxPaid?.toLocaleString('en-IN')}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => exportClientSummaryToPdf(selectedClient)}
                className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition duration-200"
              >
                Download PDF
              </button>
              <button
                onClick={() => setSelectedClient(null)}
                className="px-4 py-2 bg-gray-300 text-gray-800 rounded-md hover:bg-gray-400 transition duration-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal Render */}
      {showConfirmModal && (
        <ConfirmationModal
          message="Are you sure you want to delete this client? This action cannot be undone."
          onConfirm={confirmAction}
          onCancel={() => {
            setShowConfirmModal(false);
            setConfirmAction(null);
          }}
        />
      )}
    </div>
  );
};

export default App;
