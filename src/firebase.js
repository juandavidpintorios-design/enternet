import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDZqoU3LffoOuIssq67ILj947Jnv5iaz68",
  authDomain: "enternet-2e70d.firebaseapp.com",
  projectId: "enternet-2e70d",
  storageBucket: "enternet-2e70d.firebasestorage.app",
  messagingSenderId: "320058113736",
  appId: "1:320058113736:web:b38b1c5ea65b0eb99f6ffd",
  measurementId: "G-0KQX87ZBPZ"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);