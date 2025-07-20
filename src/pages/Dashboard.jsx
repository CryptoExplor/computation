// src/pages/Dashboard.jsx

import React, { useEffect, useState } from "react";
import { auth, db } from "../config/firebaseConfig"; // Ensure this path is correct
import { collection, onSnapshot } from "firebase/firestore";
import { signOut } from "firebase/auth";
import ClientCard from "../components/ClientCard"; // Ensure this path is correct
import { exportAllClientsToCsv } from "../utils/exportCSV"; // Assuming exportCSV.js exists and exports this function

/**
 * Dashboard component displays a list of clients and provides logout/export functionality.
 * @param {object} props - Component props.
 * @param {object} props.user - The authenticated user object.
 */
export default function Dashboard({ user }) {
  const [clients, setClients] = useState([]);

  useEffect(() => {
    if (!user) return;

    // Listen for real-time updates to the clients collection for the current user
    const unsubscribe = onSnapshot(
      collection(db, `artifacts/${typeof __app_id !== 'undefined' ? __app_id : 'default-app-id'}/users/${user.uid}/clients`),
      (snapshot) => {
        const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setClients(data);
      },
      (error) => {
        console.error("Error fetching clients:", error);
        // Handle error, e.g., display a message to the user
      }
    );

    // Clean up the listener when the component unmounts or user changes
    return () => unsubscribe();
  }, [user]); // Re-run effect if user object changes

  // Handles user logout
  const handleLogout = async () => {
    try {
      await signOut(auth);
      // Reloading the window will trigger re-authentication or show login page
      window.location.reload();
    } catch (error) {
      console.error("Error signing out:", error);
      // Handle logout error
    }
  };

  return (
    <div className="p-6 bg-gray-100 min-h-screen font-inter">
      {/* Header and Action Buttons */}
      <div className="flex justify-between items-center mb-6 bg-white p-4 rounded-lg shadow-md">
        <h2 className="text-2xl font-semibold text-gray-800">Welcome, {user?.email || "Guest"}</h2>
        <div className="flex gap-3">
          {clients.length > 0 && (
            <button
              onClick={() => exportAllClientsToCsv(clients)}
              className="px-4 py-2 bg-blue-600 text-white rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition duration-200 ease-in-out"
            >
              Export All to CSV
            </button>
          )}
          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-red-600 text-white rounded-md shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-50 transition duration-200 ease-in-out"
          >
            Logout
          </button>
        </div>
      </div>

      {/* Client List Display */}
      {clients.length === 0 ? (
        <p className="text-gray-600 text-center py-10 text-lg">No clients added yet. Upload an ITR JSON to begin!</p>
      ) : (
        <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {clients.map((client) => (
            <ClientCard key={client.id} client={client} />
          ))}
        </div>
      )}
    </div>
  );
}
