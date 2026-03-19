import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyBV3uaLt32-LHdIJn5gRTI-qSdZAK-jnyE",
  authDomain: "wfh-tracker-20277.firebaseapp.com",
  databaseURL: "https://wfh-tracker-20277-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "wfh-tracker-20277",
  storageBucket: "wfh-tracker-20277.firebasestorage.app",
  messagingSenderId: "471222379207",
  appId: "1:471222379207:web:6657e65a3ff51aa63d14e2"
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
