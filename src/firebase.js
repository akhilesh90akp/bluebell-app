/**
 * Firebase Configuration & Initialization
 * 
 * Auth persistence is set to IndexedDB (most reliable on mobile/PWA).
 * Firestore uses persistent cache by default in Firebase v10+.
 */
import { initializeApp } from 'firebase/app';
import { getAuth, indexedDBLocalPersistence, browserLocalPersistence, initializeAuth } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';

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

// Initialize auth with IndexedDB persistence (most reliable on mobile/PWA)
// Falls back to localStorage if IndexedDB is unavailable
let auth;
try {
  auth = initializeAuth(app, {
    persistence: [indexedDBLocalPersistence, browserLocalPersistence],
  });
} catch (e) {
  // If already initialized (hot reload in dev), get existing instance
  auth = getAuth(app);
}

export { auth };

// Initialize Firestore with persistent local cache
// This allows the app to work offline and syncs when back online
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
  }),
});

export default app;
