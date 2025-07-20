// src/pages/UploadPage.jsx

import React, { useState } from "react";
import { parseITRJson } from "../utils/parseITR"; // Ensure this path is correct
import { db, storage } from "../config/firebaseConfig"; // Ensure this path is correct
import { ref, uploadBytes } from "firebase/storage";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { v4 as uuidv4 } from "uuid"; // Import uuid for unique IDs

/**
 * UploadPage component handles uploading and parsing of ITR JSON files.
 * It also includes logic for checking plan limits before saving.
 * @param {object} props - Component props.
 * @param {object} props.user - The authenticated user object.
 * @param {function} props.onClientAdded - Callback function to be called after a client is successfully added.
 */
export default function UploadPage({ user, onClientAdded }) {
  const [file, setFile] = useState(null);
  const [message, setMessage] = useState("");
  const [uploading, setUploading] = useState(false);

  // Define plan limits (can also be imported from a separate planLogic.js if available)
  const PLAN_LIMITS = {
    free: { maxClients: 1, maxReports: 1 },
    family: { maxClients: 5, maxReports: 15 },
    pro: { maxClients: 15, maxReports: 60 },
    agency: { maxClients: 100, maxReports: 250 },
    admin: { maxClients: Infinity, maxReports: Infinity } // Admin has unlimited access
  };

  const handleUpload = async () => {
    if (!file || !user) {
      setMessage("Please select a file and ensure you are logged in.");
      return;
    }

    setUploading(true);
    setMessage(""); // Clear previous messages

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const jsonContent = JSON.parse(e.target.result);
          const parsedData = parseITRJson(jsonContent);

          if (!parsedData) {
            throw new Error("Invalid ITR JSON structure or parsing failed.");
          }

          // Fetch user's current plan and usage
          const userRef = doc(db, "users", user.uid);
          const userSnap = await getDoc(userRef);
          const userData = userSnap.data();

          const plan = userData?.plan || "free";
          const usage = userData?.usage || { clients: 0, reports: 0 };

          const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.free;

          // Check plan limits
          if (usage.clients >= limits.maxClients) {
            setMessage(`Client limit (${limits.maxClients}) reached for your ${limits.name}. Please upgrade your plan.`);
            setUploading(false);
            return;
          }

          if (usage.reports >= limits.maxReports) {
            setMessage(`Report generation limit (${limits.maxReports}) reached for your ${limits.name}. Please upgrade your plan.`);
            setUploading(false);
            return;
          }

          const id = uuidv4(); // Generate a unique ID for the client document
          const clientRef = doc(db, `artifacts/${typeof __app_id !== 'undefined' ? __app_id : 'default-app-id'}/users/${user.uid}/clients`, id);

          // Save parsed summary to Firestore
          await setDoc(clientRef, {
            ...parsedData,
            createdAt: Date.now(),
            uid: user.uid // Ensure UID is stored for security rules
          });

          // Update user's usage counts in Firestore
          await setDoc(userRef, {
            ...userData,
            usage: {
              clients: usage.clients + 1,
              reports: usage.reports + 1
            }
          }, { merge: true }); // Use merge to avoid overwriting other user data

          // Save original file to Firebase Storage
          const storageRef = ref(storage, `artifacts/${typeof __app_id !== 'undefined' ? __app_id : 'default-app-id'}/users/${user.uid}/jsonFiles/${id}.json`);
          await uploadBytes(storageRef, file);

          setMessage("Client ITR parsed & saved successfully!");
          setFile(null); // Clear the selected file
          onClientAdded?.(); // Call callback if provided

        } catch (parseError) {
          console.error("Error processing file:", parseError);
          setMessage("Failed to process file: " + parseError.message);
        } finally {
          setUploading(false);
        }
      };
      reader.readAsText(file);
    } catch (err) {
      console.error("Error during file read/upload:", err);
      setMessage("Failed to read or upload file: " + err.message);
      setUploading(false);
    }
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow-md font-inter">
      <h2 className="text-xl font-semibold mb-4 text-gray-800">Upload ITR JSON</h2>
      <label
        htmlFor="file-upload"
        className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-md cursor-pointer bg-gray-50 hover:bg-gray-100 transition duration-200 ease-in-out"
      >
        <input
          id="file-upload"
          type="file"
          accept="application/json"
          onChange={(e) => setFile(e.target.files[0])}
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
          <p className="text-gray-500">
            {file ? `Selected: ${file.name}` : "Drag & drop your ITR JSON here, or click to browse"}
          </p>
        )}
      </label>

      <button
        onClick={handleUpload}
        disabled={!file || uploading}
        className={`mt-4 w-full px-4 py-2 rounded-md shadow-sm transition duration-200 ease-in-out
          ${!file || uploading ? "bg-gray-400 cursor-not-allowed" : "bg-green-600 text-white hover:bg-green-700"}`}
      >
        {uploading ? "Processing..." : "Upload & Parse"}
      </button>
      {message && (
        <p className={`mt-4 text-sm ${message.includes("Failed") || message.includes("limit reached") ? "text-red-600" : "text-green-600"}`}>
          {message}
        </p>
      )}
    </div>
  );
}
