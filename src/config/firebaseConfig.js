// src/config/firebaseConfig.js

import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Use __firebase_config if available, otherwise use placeholders
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {
  apiKey: "AIzaSyC70iMVmZ2Xskik0zMP8TcUM4d2olBw4TE",
  authDomain: "computationtax.firebaseapp.com",
  projectId: "computationtax",
  storageBucket: "computationtax.firebasestorage.app",
  messagingSenderId: "413709098206",
  appId: "1:413709098206:web:be583c64514bdd9590764f"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
