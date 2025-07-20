// src/pages/LoginPage.jsx

import React, { useState } from "react";
import { auth, db } from "../config/firebaseConfig"; // Ensure this path is correct
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";

/**
 * LoginPage component handles user login and registration.
 * @param {object} props - Component props.
 * @param {function} props.onLogin - Callback function to be called upon successful login/registration.
 */
export default function LoginPage({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isRegister, setIsRegister] = useState(false); // State to toggle between login and register
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false); // Loading state for buttons

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(""); // Clear previous errors
    setLoading(true); // Set loading state

    try {
      if (isRegister) {
        // Register new user
        const userCred = await createUserWithEmailAndPassword(auth, email, password);
        const uid = userCred.user.uid;
        // Initialize user data in Firestore
        await setDoc(doc(db, "users", uid), {
          email,
          plan: "free", // Default plan for new users
          createdAt: Date.now(),
          usage: { clients: 0, reports: 0 } // Initialize usage
        });
        onLogin(userCred.user); // Pass the user object to the parent component
      } else {
        // Sign in existing user
        const userCred = await signInWithEmailAndPassword(auth, email, password);
        onLogin(userCred.user); // Pass the user object to the parent component
      }
    } catch (err) {
      setError(err.message); // Display Firebase authentication errors
    } finally {
      setLoading(false); // Reset loading state
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 font-inter">
      <form onSubmit={handleSubmit} className="bg-white p-8 rounded-xl shadow-md w-full max-w-sm">
        <h2 className="text-2xl font-semibold mb-6 text-center text-gray-800">
          {isRegister ? "Create Account" : "Login to ITR Dashboard"}
        </h2>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full mb-4 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full mb-4 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          required
        />
        {error && <p className="text-red-500 text-sm mb-4 text-center">{error}</p>}
        <button
          type="submit"
          className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition duration-200 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={loading}
        >
          {loading ? (isRegister ? "Creating..." : "Logging in...") : (isRegister ? "Create Account" : "Login")}
        </button>
        <p className="mt-6 text-sm text-gray-600 text-center">
          {isRegister ? "Already have an account?" : "Don’t have an account?"}{" "}
          <button
            type="button"
            onClick={() => {
              setIsRegister(!isRegister);
              setError(""); // Clear error when toggling form
            }}
            className="text-blue-600 underline hover:text-blue-800 focus:outline-none"
          >
            {isRegister ? "Login here" : "Register"}
          </button>
        </p>
      </form>
    </div>
  );
}
