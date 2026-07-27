/**
 * AppContext - Global application state management
 *
 * Provides centralized state for events, settings, and service categories.
 * Data is persisted to localStorage and loaded on app initialization.
 * Exposes CRUD operations for events, settings, and categories.
 */
import React, { createContext, useContext, useState, useEffect } from 'react';
import { DEFAULT_SETTINGS, DEFAULT_CATEGORIES } from '../constants/data';
import { genId } from '../utils/helpers';

const Ctx = createContext();

/** Provider component that wraps the app and supplies global state */
export function AppProvider({ children }) {
  const [events, setEvents] = useState([]);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  const [loaded, setLoaded] = useState(false);

  // Load persisted data from localStorage on mount
  useEffect(() => {
    try {
      const e = localStorage.getItem('bb_events');
      const s = localStorage.getItem('bb_settings');
      const c = localStorage.getItem('bb_categories');
      if (e) setEvents(JSON.parse(e));
      if (s) setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(s) });
      if (c) setCategories(JSON.parse(c));
    } catch(err) { console.error(err); }
    setLoaded(true);
  }, []);

  // Persist events to localStorage whenever they change
  useEffect(() => { if (loaded) localStorage.setItem('bb_events', JSON.stringify(events)); }, [events, loaded]);

  // Persist settings to localStorage whenever they change
  useEffect(() => { if (loaded) localStorage.setItem('bb_settings', JSON.stringify(settings)); }, [settings, loaded]);

  // Persist categories to localStorage whenever they change
  useEffect(() => { if (loaded) localStorage.setItem('bb_categories', JSON.stringify(categories)); }, [categories, loaded]);

  /** Creates a new event with generated ID and draft status */
  const addEvent = (data) => {
    const ev = { id: genId(), ...data, status: 'draft', createdAt: new Date().toISOString() };
    setEvents(p => [...p, ev]);
    return ev;
  };

  /** Updates an existing event by ID with partial data */
  const updateEvent = (id, data) => setEvents(p => p.map(e => e.id === id ? { ...e, ...data, updatedAt: new Date().toISOString() } : e));

  /** Deletes an event by ID */
  const deleteEvent = (id) => setEvents(p => p.filter(e => e.id !== id));

  /** Merges new settings into the existing settings object */
  const updateSettings = (data) => setSettings(p => ({ ...p, ...data }));

  /** Adds a new service category with generated ID */
  const addCategory = (cat) => setCategories(p => [...p, { id: genId(), ...cat }]);

  /** Updates an existing category by ID */
  const updateCategory = (id, data) => setCategories(p => p.map(c => c.id === id ? { ...c, ...data } : c));

  /** Deletes a category by ID */
  const deleteCategory = (id) => setCategories(p => p.filter(c => c.id !== id));

  /** Appends an item to a specific category's items list */
  const addItemToCat = (catId, item) => setCategories(p => p.map(c => c.id === catId ? { ...c, items: [...c.items, item] } : c));

  /** Removes an item from a specific category's items list */
  const removeItemFromCat = (catId, item) => setCategories(p => p.map(c => c.id === catId ? { ...c, items: c.items.filter(i => i !== item) } : c));

  return (
    <Ctx.Provider value={{ events, settings, categories, loaded, addEvent, updateEvent, deleteEvent, updateSettings, addCategory, updateCategory, deleteCategory, addItemToCat, removeItemFromCat }}>
      {children}
    </Ctx.Provider>
  );
}

/** Custom hook to access the global app context */
export const useApp = () => useContext(Ctx);
