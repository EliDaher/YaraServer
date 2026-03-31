// src/firebaseConfig.ts
import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";
import dotenv from "dotenv";

dotenv.config(); // تحميل متغيرات البيئة

const firebaseConfig = {
  apiKey: process.env.FIREBASE_apiKey,
  authDomain: process.env.FIREBASE_authDomain,
  databaseURL: process.env.FIREBASE_databaseURL,
  projectId: process.env.FIREBASE_projectId,
  storageBucket: process.env.FIREBASE_storageBucket,
  messagingSenderId: process.env.FIREBASE_messagingSenderId,
  appId: process.env.FIREBASE_appId,
  measurementId: process.env.FIREBASE_measurementId,
  // apiKey: "AIzaSyAkyaaWvnUK77-RGMeB0t4PEA_7uE4sTzU",
  // authDomain: "aboomar-ab9ae.firebaseapp.com",
  // databaseURL: "https://aboomar-ab9ae-default-rtdb.firebaseio.com",
  // projectId: "aboomar-ab9ae",
  // storageBucket: "aboomar-ab9ae.firebasestorage.app",
  // messagingSenderId: "49589156271",
  // appId: "1:49589156271:web:a74eac5dd593c44c7f575a",
  // measurementId: "G-571039T3K6",
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

export { app, database };
