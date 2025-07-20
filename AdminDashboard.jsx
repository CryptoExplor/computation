// src/admin/AdminDashboard.jsx

import React, { useEffect, useState } from "react";
import { db } from "../config/firebaseConfig"; // Updated import path
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  getDoc
} from "firebase/firestore";

export default function AdminDashboard() {
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [newPlan, setNewPlan] = useState("");
  const [status, setStatus] = useState("");

  // Function to load all users from Firestore
  const loadUsers = async () => {
    try {
      const userSnap = await getDocs(collection(db, "users"));
      const data = userSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setUsers(data);
    } catch (error) {
      console.error("Error loading users:", error);
      setStatus("Failed to load users.");
    }
  };

  // Function to handle plan change for a selected user
  const handlePlanChange = async () => {
    if (!selectedUser || !newPlan) {
      setStatus("Please select a user and a new plan.");
      return;
    }
    try {
      const userRef = doc(db, "users", selectedUser.id);
      await updateDoc(userRef, { plan: newPlan });
      setStatus(`Plan updated for ${selectedUser.email} to ${newPlan}.`);
      loadUsers(); // Reload users to reflect changes
      setSelectedUser(null); // Clear selection
      setNewPlan(""); // Clear new plan selection
    } catch (error) {
      console.error("Error updating plan:", error);
      setStatus("Failed to update plan.");
    }
  };

  // Function to fetch user usage (clients, reports) - currently not directly used in this component's render, but available
  const fetchUsage = async (uid) => {
    try {
      const userRef = doc(db, "users", uid);
      const snapshot = await getDoc(userRef);
      return snapshot.exists() ? snapshot.data().usage || {} : {};
    } catch (error) {
      console.error("Error fetching usage:", error);
      return {};
    }
  };

  // Load users on component mount
  useEffect(() => {
    loadUsers();
  }, []);

  return (
    <div className="p-6 max-w-4xl mx-auto bg-white rounded-lg shadow-md font-inter">
      <h2 className="text-2xl font-bold mb-6 text-gray-800">Admin Panel</h2>

      {/* Users Table */}
      <div className="overflow-x-auto mb-6">
        <table className="w-full table-auto text-sm border-collapse">
          <thead>
            <tr className="bg-gray-200 text-gray-700 uppercase text-left">
              <th className="p-3 border-b border-gray-300 rounded-tl-lg">Email</th>
              <th className="p-3 border-b border-gray-300">Plan</th>
              <th className="p-3 border-b border-gray-300">Clients</th>
              <th className="p-3 border-b border-gray-300">Reports</th>
              <th className="p-3 border-b border-gray-300 rounded-tr-lg">Change Plan</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-gray-200 hover:bg-gray-50 transition duration-150 ease-in-out">
                <td className="p-3">{u.email}</td>
                <td className="p-3">{u.plan}</td>
                <td className="p-3">{u.usage?.clients || 0}</td>
                <td className="p-3">{u.usage?.reports || 0}</td>
                <td className="p-3">
                  <select
                    onChange={(e) => {
                      setSelectedUser(u);
                      setNewPlan(e.target.value);
                    }}
                    className="border border-gray-300 px-3 py-1 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-150 ease-in-out"
                    value={selectedUser?.id === u.id ? newPlan : ""} // Pre-select if this user is chosen
                  >
                    <option value="">--Select--</option>
                    <option value="free">Free</option>
                    <option value="family">Family</option>
                    <option value="pro">Pro</option>
                    <option value="agency">Agency</option>
                    <option value="admin">Admin</option> {/* Added admin option */}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Update Plan Button and Status */}
      {selectedUser && newPlan && (
        <button
          onClick={handlePlanChange}
          className="bg-blue-600 text-white px-5 py-2 rounded-md shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition duration-200 ease-in-out"
        >
          Update Plan for {selectedUser.email}
        </button>
      )}

      {status && (
        <p className={`mt-4 text-sm font-medium ${status.includes("Failed") ? "text-red-600" : "text-green-600"}`}>
          {status}
        </p>
      )}
    </div>
  );
}
