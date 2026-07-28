/**
 * AppContext - Global state with Firebase Firestore sync
 * 
 * All data is stored in Firestore under the user's UID.
 * Events, settings, and categories sync across all devices.
 */
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { collection, doc, getDocs, setDoc, deleteDoc, onSnapshot, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { DEFAULT_SETTINGS, DEFAULT_CATEGORIES } from '../constants/data';
import { genId } from '../utils/helpers';

const Ctx = createContext();

export function AppProvider({ children }) {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [events, setEvents] = useState([]);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  const [loaded, setLoaded] = useState(false);
  const [toast, setToast] = useState({ message: '', type: 'success', visible: false });
  const toastTimer = useRef(null);

  /** Show a toast message that auto-dismisses after 3 seconds */
  const showToast = useCallback((message, type = 'success') => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message, type, visible: true });
    toastTimer.current = setTimeout(() => {
      setToast(t => ({ ...t, visible: false }));
      // Clear message after fade-out animation
      setTimeout(() => setToast({ message: '', type: 'success', visible: false }), 300);
    }, 3000);
  }, []);

  // Listen for auth state changes
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoading(false);
    });
    return unsub;
  }, []);

  // Load data from Firestore when user logs in
  useEffect(() => {
    if (!user) {
      setEvents([]);
      setSettings(DEFAULT_SETTINGS);
      setCategories(DEFAULT_CATEGORIES);
      setLoaded(false);
      return;
    }

    const loadData = async () => {
      try {
        // Load events (real-time listener)
        const eventsRef = collection(db, 'users', user.uid, 'events');
        const unsubEvents = onSnapshot(eventsRef, (snapshot) => {
          const evs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
          setEvents(evs);
        });

        // Load settings
        const settingsDoc = await getDoc(doc(db, 'users', user.uid, 'config', 'settings'));
        if (settingsDoc.exists()) {
          setSettings({ ...DEFAULT_SETTINGS, ...settingsDoc.data() });
        }

        // Load categories
        const catsDoc = await getDoc(doc(db, 'users', user.uid, 'config', 'categories'));
        if (catsDoc.exists()) {
          setCategories(catsDoc.data().list || DEFAULT_CATEGORIES);
        }

        setLoaded(true);
        return () => unsubEvents();
      } catch (err) {
        console.error('Error loading data:', err);
        setLoaded(true);
      }
    };

    loadData();
  }, [user]);

  // === Event Operations ===

  const addEvent = async (data) => {
    const id = genId();
    const ev = { ...data, status: 'draft', createdAt: new Date().toISOString() };
    try {
      await setDoc(doc(db, 'users', user.uid, 'events', id), ev);
    } catch (err) {
      console.error('Error adding event:', err);
    }
    return { id, ...ev };
  };

  const updateEvent = async (id, data) => {
    try {
      const evRef = doc(db, 'users', user.uid, 'events', id);
      await setDoc(evRef, { ...data, updatedAt: new Date().toISOString() }, { merge: true });
    } catch (err) {
      console.error('Error updating event:', err);
    }
  };

  const deleteEvent = async (id) => {
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'events', id));
    } catch (err) {
      console.error('Error deleting event:', err);
    }
  };

  // === Settings Operations ===

  const updateSettings = async (data) => {
    const newSettings = { ...settings, ...data };
    setSettings(newSettings);
    try {
      await setDoc(doc(db, 'users', user.uid, 'config', 'settings'), newSettings);
    } catch (err) {
      console.error('Error saving settings:', err);
    }
  };

  // === Category Operations ===

  const saveCategories = async (cats) => {
    setCategories(cats);
    try {
      await setDoc(doc(db, 'users', user.uid, 'config', 'categories'), { list: cats });
    } catch (err) {
      console.error('Error saving categories:', err);
    }
  };

  const addCategory = (cat) => {
    const updated = [...categories, { id: genId(), ...cat }];
    saveCategories(updated);
  };

  const updateCategory = (id, data) => {
    const updated = categories.map(c => c.id === id ? { ...c, ...data } : c);
    saveCategories(updated);
  };

  const deleteCategory = (id) => {
    const updated = categories.filter(c => c.id !== id);
    saveCategories(updated);
  };

  const addItemToCat = (catId, item) => {
    const updated = categories.map(c => c.id === catId ? { ...c, items: [...c.items, item] } : c);
    saveCategories(updated);
  };

  const removeItemFromCat = (catId, item) => {
    const updated = categories.map(c => c.id === catId ? { ...c, items: c.items.filter(i => i !== item) } : c);
    saveCategories(updated);
  };

  // === Auth Operations ===

  const logout = async () => {
    await signOut(auth);
  };

  return (
    <Ctx.Provider value={{
      user, authLoading, logout,
      events, settings, categories, loaded,
      addEvent, updateEvent, deleteEvent,
      updateSettings,
      addCategory, updateCategory, deleteCategory,
      addItemToCat, removeItemFromCat,
      toast, showToast,
    }}>
      {children}
    </Ctx.Provider>
  );
}

export const useApp = () => useContext(Ctx);
