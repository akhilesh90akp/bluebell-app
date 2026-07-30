/**
 * App - Root component with routing and auth gating
 */
import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext';
import Toast from './components/Toast';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import NewDraft from './pages/NewDraft';
import EditDraft from './pages/EditDraft';
import DraftsList from './pages/DraftsList';
import ConfirmedEvents from './pages/ConfirmedEvents';
import BillGenerator from './pages/BillGenerator';
import QuotationGenerator from './pages/QuotationGenerator';
import Reports from './pages/Reports';
import Settings from './pages/Settings';

function AppRoutes() {
  const { user, authLoading, toast } = useApp();

  // Show loading while checking auth
  if (authLoading) {
    return (
      <div className="min-h-[100dvh] bg-bb-sidebar flex items-center justify-center">
        <div className="text-center">
          <img src="/logo-gold.png" alt="Bluebell" className="h-12 mx-auto mb-4 animate-pulse" />
          <p className="text-bb-sidebar-muted text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  // Show login if not authenticated
  if (!user) {
    return <Login />;
  }

  // Authenticated - show main app
  return (
    <BrowserRouter basename="/bluebell-app">
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/new" element={<NewDraft />} />
          <Route path="/edit/:eventId" element={<EditDraft />} />
          <Route path="/drafts" element={<DraftsList />} />
          <Route path="/confirmed" element={<ConfirmedEvents />} />
          <Route path="/bill/:eventId" element={<BillGenerator />} />
          <Route path="/quotation/:eventId" element={<QuotationGenerator />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
      </Routes>
      <Toast message={toast.message} type={toast.type} isVisible={toast.visible} />
    </BrowserRouter>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppRoutes />
    </AppProvider>
  );
}
