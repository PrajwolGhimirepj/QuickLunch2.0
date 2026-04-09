// Firebase config + Firestore setup

import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBhcwf5imjB5GPwMNxbfKwJzduhPeNFffc",
  authDomain: "quicklunch-15ba1.firebaseapp.com",
  projectId: "quicklunch-15ba1",
  storageBucket: "quicklunch-15ba1.firebasestorage.app",
  messagingSenderId: "587113462126",
  appId: "1:587113462126:web:4e101dbd07887b257ee97f",
  measurementId: "G-RHR0GCGFLF",
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
