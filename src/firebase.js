/**
 * Firebase Configuration & Initialization
 */
import { initializeApp } from 'firebase/app';
import { getAuth, browserLocalPersistence, setPersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCGtwV4ePNuGIdzULROXZWPACdImEzuA-0",
  authDomain: "bluebell-event.netlify.app",
  projectId: "bluebell-event",
  storageBucket: "bluebell-event.firebasestorage.app",
  messagingSenderId: "282114023514",
  appId: "1:282114023514:web:dcb8b436cd90e8741a3863",
  measurementId: "G-H5BYMZQCX7"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Ensure auth persists across page reloads and browser restarts
setPersistence(auth, browserLocalPersistence);

export const db = getFirestore(app);
export default app;
