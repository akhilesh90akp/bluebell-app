/**
 * Firebase Configuration & Initialization
 * 
 * Auth persistence: browserLocalPersistence (localStorage-based, works on all platforms)
 * Firestore: persistent local cache for offline support
 */
import { initializeApp } from 'firebase/app';
import { getAuth, browserLocalPersistence, setPersistence } from 'firebase/auth';
import { getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';

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

// Auth: use getAuth (universally compatible, no IndexedDB dependency)
// Then set persistence to localStorage (works on all Android browsers/PWAs)
export const auth = getAuth(app);
setPersistence(auth, browserLocalPersistence).catch((err) => {
  console.warn('Auth persistence setup failed:', err.code);
});

// Firestore: try persistent cache, fallback to default if not supported
let db;
try {
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager(),
    }),
  });
} catch (e) {
  // Already initialized or persistence not supported on this device
  console.warn('Firestore persistent cache unavailable, using default:', e.message);
  db = getFirestore(app);
}

export { db };
export default app;
