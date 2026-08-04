/**
 * Reports - Event analytics and reporting page
 *
 * Provides filtered views of event data with monthly, yearly, or custom
 * date range filters. Displays summary statistics and a tabular list
 * of events with their status and amounts. Supports print/PDF export.
 */
import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import Card from '../components/Card';
import Button from '../components/Button';
import Input from '../components/Input';
import Badge from '../components/Badge';
import { formatCurrency, formatDateReadable } from '../utils/helpers';
import { Download, Printer, Calendar, BarChart3 } from 'lucide-react';

/** Displays event reports with date-based filtering and summary stats */
export default function Reports() {
  const { events } = useApp();
  const [filter, setFilter] = useState('monthly'); // monthly | yearly | custom
  const [statusFilter, setStatusFilter] = useState('completed'); // all | completed | confirmed
  const [excludeGST, setExcludeGST] = useState(false);

  // Initialize month/year to current period
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [year, setYear] = useState(() => String(new Date().getFullYear()));
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Helper: calculate event total from itemPrices
  const getEventTotal = (event) => {
    if (event.totalAmount && event.totalAmount > 0) return event.totalAmount;
    const prices = event.itemPrices || {};
    let total = 0;
    Object.values(prices).forEach(p => {
      const qty = Number(p.qty) || 1;
      const rate = Number(p.rate) || 0;
      total += qty * rate;
    });
    return total;
  };

  // Filter events based on selected date range and status
  const filteredEvents = useMemo(() => {
    return events.filter(e => {
      // Status filter
      if (statusFilter !== 'all' && e.status !== statusFilter) return false;

      // Support both new format (mainEvent.date) and old format (e.date)
      const eventDate = e.mainEvent?.date || e.date;
      if (!eventDate) return false;
      const d = new Date(eventDate);
      if (filter === 'monthly') {
        const [y, m] = month.split('-');
        return d.getFullYear() === Number(y) && d.getMonth() + 1 === Number(m);
      }
      if (filter === 'yearly') {
        return d.getFullYear() === Number(year);
      }
      if (filter === 'custom') {
        if (dateFrom && d < new Date(dateFrom)) return false;
        if (dateTo && d > new Date(dateTo + 'T23:59:59')) return false;
        return true;
      }
      return true;
    });
  }, [events, filter, month, year, dateFrom, dateTo]);

  // Compute aggregate statistics from filtered events
  const stats = useMemo(() => {
    const total = filteredEvents.length;
    const drafts = filteredEvents.filter(e => e.status === 'draft').length;
    const confirmed = filteredEvents.filter(e => e.status === 'confirmed').length;
    const completed = filteredEvents.filter(e => e.status === 'completed').length;
    const revenue = filteredEvents.reduce((s, e) => s + getEventTotal(e), 0);
    return { total, drafts, confirmed, completed, revenue };
  }, [filteredEvents]);

  /** Triggers browser print dialog */
  const handlePrint = () => window.print();

  /** Uses browser print dialog which allows "Save as PDF" on all modern browsers */
  const handleDownload = () => {
    const period = filter === 'monthly' ? month : filter === 'yearly' ? year : `${dateFrom} to ${dateTo}`;
    document.title = `Bluebell Report - ${filter} - ${period}`;
    window.print();
    setTimeout(() => { document.title = 'Bluebell'; }, 1000);
  };

  // Filter tab configuration
  const filterTabs = [
    { key: 'monthly', label: 'Monthly' },
    { key: 'yearly', label: 'Yearly' },
    { key: 'custom', label: 'Custom' },
  ];

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-bb-text">Reports</h1>

      {/* Filter Tabs */}
      <div className="flex gap-2">
        {filterTabs.map(t => (
          <button
            key={t.key}
            onClick={() => setFilter(t.key)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors cursor-pointer ${
              filter === t.key
                ? 'bg-bb-accent text-white'
                : 'bg-bb-card border border-bb-border text-bb-muted hover:text-bb-text'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Date Inputs - changes based on active filter tab */}
      <Card>
        <div className="flex flex-wrap gap-3 items-end">
          {filter === 'monthly' && (
            <Input label="Month" type="month" value={month} onChange={e => setMonth(e.target.value)} icon={Calendar} />
          )}
          {filter === 'yearly' && (
            <Input label="Year" type="number" value={year} onChange={e => setYear(e.target.value)} icon={Calendar} className="w-32" />
          )}
          {filter === 'custom' && (
            <>
              <Input label="From" type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} icon={Calendar} />
              <Input label="To" type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} icon={Calendar} />
            </>
          )}
        </div>
      </Card>

      {/* Status Filter + GST Toggle */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1">
          {[{key: 'completed', label: 'Completed'}, {key: 'confirmed', label: 'Confirmed'}, {key: 'all', label: 'All'}].map(s => (
            <button key={s.key} onClick={() => setStatusFilter(s.key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg cursor-pointer transition-colors ${
                statusFilter === s.key ? 'bg-bb-accent text-white' : 'bg-bb-card border border-bb-border text-bb-muted'
              }`}>{s.label}</button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-xs text-bb-muted cursor-pointer">
          <input type="checkbox" checked={excludeGST} onChange={e => setExcludeGST(e.target.checked)} className="rounded" />
          Exclude GST from amounts
        </label>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <p className="text-xs text-bb-muted">Total</p>
          <p className="text-xl font-bold text-bb-text">{stats.total}</p>
        </Card>
        <Card>
          <p className="text-xs text-bb-muted">Confirmed</p>
          <p className="text-xl font-bold text-emerald-400">{stats.confirmed}</p>
        </Card>
        <Card>
          <p className="text-xs text-bb-muted">Completed</p>
          <p className="text-xl font-bold text-blue-400">{stats.completed}</p>
        </Card>
        <Card>
          <p className="text-xs text-bb-muted">Revenue</p>
          <p className="text-lg font-bold text-bb-gold">{formatCurrency(stats.revenue)}</p>
        </Card>
      </div>

      {/* Events Table */}
      <Card>
        {filteredEvents.length === 0 ? (
          <div className="text-center py-8">
            <BarChart3 size={40} className="mx-auto text-bb-muted mb-3" />
            <p className="text-bb-muted">No events in this period</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-bb-border">
                  <th className="py-2 px-2 text-left text-bb-muted font-medium">#</th>
                  <th className="py-2 px-2 text-left text-bb-muted font-medium">Client</th>
                  <th className="py-2 px-2 text-left text-bb-muted font-medium hidden sm:table-cell">Type</th>
                  <th className="py-2 px-2 text-left text-bb-muted font-medium">Date</th>
                  <th className="py-2 px-2 text-left text-bb-muted font-medium">Status</th>
                  <th className="py-2 px-2 text-right text-bb-muted font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {filteredEvents.map((e, i) => (
                  <tr key={e.id} className="border-b border-bb-border/50">
                    <td className="py-2 px-2 text-bb-muted">{i + 1}</td>
                    <td className="py-2 px-2 text-bb-text font-medium truncate max-w-[120px]">{e.clientName}</td>
                    <td className="py-2 px-2 text-bb-muted hidden sm:table-cell">{e.eventType}</td>
                    <td className="py-2 px-2 text-bb-muted">{formatDateReadable(e.mainEvent?.date || e.date)}</td>
                    <td className="py-2 px-2"><Badge variant={e.status}>{e.status}</Badge></td>
                    <td className="py-2 px-2 text-right text-bb-text">{formatCurrency(getEventTotal(e))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Actions */}
      <div className="flex gap-2">
        <Button icon={Download} onClick={handleDownload} variant="secondary">Download PDF</Button>
        <Button icon={Printer} onClick={handlePrint} variant="secondary">Print</Button>
      </div>
    </div>
  );
}
