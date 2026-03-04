import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAMNSU3XfqRuQs8Q_0iTdwURQretj-YCMo",
  authDomain: "dive-9d8ce.firebaseapp.com",
  projectId: "dive-9d8ce",
  storageBucket: "dive-9d8ce.firebasestorage.app",
  messagingSenderId: "120764530345",
  appId: "1:120764530345:web:c7f42f77ec3067fe6cf3b8",
  measurementId: "G-CQ6BJQ1FBW"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const analytics = typeof window !== 'undefined' ? getAnalytics(app) : null;
export const db = getFirestore(app);
