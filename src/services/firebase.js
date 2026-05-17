// src/services/firebase.js
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyBHArOG7EPDBVVbtnt9J8YKdkb5MN9SV08",
  authDomain: "to-let-pro-14e09.firebaseapp.com",
  projectId: "to-let-pro-14e09",
  storageBucket: "to-let-pro-14e09.firebasestorage.app",
  messagingSenderId: "100291826945",
  appId: "1:100291826945:web:78671cae8a8eb831a27700",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);