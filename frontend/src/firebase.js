// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBK6G9lNk4Pgys7a5VLdH5ksXM4HnQzeKU",
  authDomain: "pointsale-fcea8.firebaseapp.com",
  projectId: "pointsale-fcea8",
  storageBucket: "pointsale-fcea8.firebasestorage.app",
  messagingSenderId: "671643569909",
  appId: "1:671643569909:web:699e074692f9f3c7013fbc"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);