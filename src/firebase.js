/**
 * Firebase Configuration & Initialization
 * Connects the app to Bluebell Event Firebase project
 */
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCGtwV4ePNuGIdzULROXZWPACdImEzuA-0",
  authDomain: "bluebell-event.firebaseapp.com",
  projectId: "bluebell-event",
  storageBucket: "bluebell-event.firebasestorage.app",
  messagingSenderId: "282114023514",
  appId: "1:282114023514:web:dcb8b436cd90e8741a3863",
  measurementId: "G-H5BYMZQCX7"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);
export default app;
