/**
 * App - Root application component
 *
 * Sets up the router and global context provider.
 * All pages are rendered within a shared Layout component.
 */
import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import NewDraft from './pages/NewDraft';
import EditDraft from './pages/EditDraft';
import DraftsList from './pages/DraftsList';
import ConfirmedEvents from './pages/ConfirmedEvents';
import BillGenerator from './pages/BillGenerator';
import QuotationGenerator from './pages/QuotationGenerator';
import Reports from './pages/Reports';
import Settings from './pages/Settings';

/** Root component that wires routing and global state */
export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
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
      </BrowserRouter>
    </AppProvider>
  );
}
