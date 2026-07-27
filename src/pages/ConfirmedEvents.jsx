/**
 * ConfirmedEvents - Confirmed and completed events management
 *
 * Displays all confirmed/completed events with expandable details.
 * Provides functionality to add items, set per-item pricing,
 * mark events as done, and navigate to quotation/bill generators.
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import Card from '../components/Card';
import Button from '../components/Button';
import Input from '../components/Input';
import Badge from '../components/Badge';
import Modal from '../components/Modal';
import { formatCurrency, formatDateReadable, daysUntil, telLink, waLink } from '../utils/helpers';
import {
  Search, Phone, MessageSquare, FileText, CheckCircle2,
  CalendarDays, MapPin, PackageOpen, Plus, X, Receipt, Edit3,
  ChevronDown, ChevronUp, Home, Navigation, StickyNote,
} from 'lucide-react';

/** Manages confirmed events with pricing, item addition, and completion */
export default function ConfirmedEvents() {
  const { events, categories, updateEvent } = useApp();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [addItemModal, setAddItemModal] = useState(null); // event id for add-item modal
  const [priceModal, setPriceModal] = useState(null); // event id for pricing modal
  const [newItem, setNewItem] = useState('');
  const [prices, setPrices] = useState({});
  const [expandedId, setExpandedId] = useState(null);

  // Filter confirmed/completed events by search query
  const confirmedEvents = events
    .filter(e => e.status === 'confirmed' || e.status === 'completed')
    .filter(e => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        e.clientName?.toLowerCase().includes(q) ||
        e.eventType?.toLowerCase().includes(q) ||
        e.eventLocation?.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt));

  /** Adds a new item to an event's items list (prevents duplicates) */
  const handleAddItem = (eventId, item) => {
    if (!item.trim()) return;
    const ev = events.find(e => e.id === eventId);
    if (ev) {
      const items = [...(ev.items || [])];
      if (!items.includes(item.trim())) {
        items.push(item.trim());
        updateEvent(eventId, { items });
      }
    }
    setNewItem('');
  };

  /** Opens the pricing modal with current item prices pre-filled */
  const openPriceModal = (ev) => {
    const p = {};
    (ev.items || []).forEach(item => {
      const existing = ev.itemPrices?.[item];
      p[item] = existing || { qty: 1, rate: 0 };
    });
    setPrices(p);
    setPriceModal(ev.id);
  };

  /** Saves item prices and calculates the total amount */
  const savePrices = () => {
    if (!priceModal) return;
    const total = Object.values(prices).reduce((sum, p) => sum + (p.qty * p.rate), 0);
    updateEvent(priceModal, { itemPrices: prices, totalAmount: total });
    setPriceModal(null);
  };

  /** Marks an event as completed */
  const markDone = (id) => {
    updateEvent(id, { status: 'completed' });
  };

  /** Toggles the expanded/collapsed state of an event card */
  const toggleExpand = (id) => {
    setExpandedId(prev => prev === id ? null : id);
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-bb-text">Confirmed Events</h1>

      <Input
        placeholder="Search events..."
        icon={Search}
        value={search}
        onChange={e => setSearch(e.target.value)}
      />

      {confirmedEvents.length === 0 ? (
        <Card>
          <div className="text-center py-10">
            <PackageOpen size={44} className="mx-auto text-bb-muted mb-3" />
            <p className="text-bb-muted font-medium">No confirmed events</p>
            <p className="text-sm text-bb-muted/60 mt-1">Confirm a draft to see it here</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {confirmedEvents.map(ev => {
            const days = daysUntil(ev.date);
            const items = ev.items || [];
            const isExpanded = expandedId === ev.id;
            return (
              <Card key={ev.id}>
                <div className="space-y-3">
                  {/* Collapsed Header - Clickable */}
                  <div
                    className="flex items-start justify-between cursor-pointer"
                    onClick={() => toggleExpand(ev.id)}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-semibold text-bb-text truncate">{ev.clientName}</p>
                        <Badge variant={ev.status}>{ev.eventType}</Badge>
                        <Badge variant={ev.status}>{ev.status}</Badge>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-bb-muted">
                        {ev.date && (
                          <span className="flex items-center gap-1">
                            <CalendarDays size={14} />
                            {formatDateReadable(ev.date)}
                          </span>
                        )}
                        {ev.totalAmount > 0 && (
                          <span className="font-bold text-bb-gold">{formatCurrency(ev.totalAmount)}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {days !== null && days >= 0 && ev.status === 'confirmed' && (
                        <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                          days <= 3 ? 'bg-red-100 text-red-700' :
                          days <= 7 ? 'bg-amber-100 text-amber-700' :
                          'bg-emerald-100 text-emerald-700'
                        }`}>
                          {days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : `${days}d`}
                        </span>
                      )}
                      {isExpanded ? (
                        <ChevronUp size={18} className="text-bb-muted" />
                      ) : (
                        <ChevronDown size={18} className="text-bb-muted" />
                      )}
                    </div>
                  </div>

                  {/* Expanded Content */}
                  {isExpanded && (
                    <div className="space-y-3 pt-2 border-t border-bb-border">
                      {/* Items with Prices */}
                      {items.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-bb-muted uppercase mb-1.5">Items</p>
                          <div className="space-y-1">
                            {items.map(item => {
                              const price = ev.itemPrices?.[item];
                              return (
                                <div key={item} className="flex items-center justify-between text-sm px-2 py-1 rounded bg-bb-input">
                                  <span className="text-bb-text">{item}</span>
                                  {price && price.rate > 0 && (
                                    <span className="text-bb-muted text-xs">
                                      {price.qty} × ₹{price.rate.toLocaleString('en-IN')} = ₹{(price.qty * price.rate).toLocaleString('en-IN')}
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Notes */}
                      {ev.notes && (
                        <div>
                          <p className="text-xs font-semibold text-bb-muted uppercase mb-1">Notes</p>
                          <p className="text-sm text-bb-muted bg-bb-input rounded-lg px-3 py-2">{ev.notes}</p>
                        </div>
                      )}

                      {/* Location Details */}
                      <div className="space-y-2">
                        {ev.clientAddress && (
                          <div className="flex items-start gap-2 text-sm text-bb-muted">
                            <Home size={14} className="flex-shrink-0 mt-0.5" />
                            <span>Client Address: <span className="text-bb-text">{ev.clientAddress}</span></span>
                          </div>
                        )}
                        {ev.houseLocation && (
                          <div className="flex items-start gap-2 text-sm text-bb-muted">
                            <Navigation size={14} className="flex-shrink-0 mt-0.5" />
                            <span>House Location: <span className="text-bb-text">{ev.houseLocation}</span></span>
                          </div>
                        )}
                        {ev.eventLocation && (
                          <div className="flex items-start gap-2 text-sm text-bb-muted">
                            <MapPin size={14} className="flex-shrink-0 mt-0.5" />
                            <span>Event Location: <span className="text-bb-text">{ev.eventLocation}</span></span>
                          </div>
                        )}
                      </div>

                      {/* Action Buttons */}
                      <div className="flex flex-wrap gap-2 pt-2 border-t border-bb-border">
                        {ev.clientPhone && (
                          <a href={telLink(ev.clientPhone)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-colors">
                            <Phone size={14} /> Call
                          </a>
                        )}
                        {(ev.clientWhatsapp || ev.clientPhone) && (
                          <a href={waLink(ev.clientWhatsapp || ev.clientPhone)} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-colors">
                            <MessageSquare size={14} /> WhatsApp
                          </a>
                        )}
                        <Button size="sm" variant="ghost" icon={Edit3} onClick={() => navigate(`/edit/${ev.id}`)}>Edit</Button>
                        <Button size="sm" variant="secondary" icon={Plus} onClick={() => setAddItemModal(ev.id)}>Add Item</Button>
                        <Button size="sm" variant="secondary" onClick={() => openPriceModal(ev)}>Set Prices</Button>
                        <Button size="sm" variant="secondary" icon={FileText} onClick={() => navigate(`/quotation/${ev.id}`)}>Quote</Button>
                        <Button size="sm" variant="secondary" icon={Receipt} onClick={() => navigate(`/bill/${ev.id}`)}>Bill</Button>
                        {ev.status === 'confirmed' && (
                          <Button size="sm" variant="success" icon={CheckCircle2} onClick={() => markDone(ev.id)}>Mark Done</Button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Action Buttons - Always visible in collapsed view */}
                  {!isExpanded && (
                    <div className="flex flex-wrap gap-2 pt-2 border-t border-bb-border">
                      <Button size="sm" variant="ghost" icon={Edit3} onClick={() => navigate(`/edit/${ev.id}`)}>Edit</Button>
                      <Button size="sm" variant="secondary" icon={Plus} onClick={() => setAddItemModal(ev.id)}>Add Item</Button>
                      <Button size="sm" variant="secondary" onClick={() => openPriceModal(ev)}>Set Prices</Button>
                      <Button size="sm" variant="secondary" icon={FileText} onClick={() => navigate(`/quotation/${ev.id}`)}>Quote</Button>
                      <Button size="sm" variant="secondary" icon={Receipt} onClick={() => navigate(`/bill/${ev.id}`)}>Bill</Button>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add Item Modal */}
      <Modal isOpen={!!addItemModal} onClose={() => setAddItemModal(null)} title="Add Item" size="md">
        <div className="space-y-3 max-h-[60vh] overflow-y-auto">
          {/* Custom Input */}
          <div className="flex gap-2">
            <Input placeholder="Custom item..." value={newItem} onChange={e => setNewItem(e.target.value)}
              className="flex-1"
              onKeyDown={e => e.key === 'Enter' && (handleAddItem(addItemModal, newItem))}
            />
            <Button size="sm" onClick={() => handleAddItem(addItemModal, newItem)}>Add</Button>
          </div>

          {/* Category items - browse from predefined categories */}
          <div className="space-y-2 mt-3">
            {categories.map(cat => (
              <div key={cat.id}>
                <p className="text-xs font-semibold text-bb-muted uppercase mb-1">{cat.icon} {cat.name}</p>
                <div className="flex flex-wrap gap-1.5">
                  {cat.items.map(item => {
                    const ev = events.find(e => e.id === addItemModal);
                    const selected = ev?.items?.includes(item);
                    return (
                      <button
                        key={item}
                        onClick={() => !selected && handleAddItem(addItemModal, item)}
                        disabled={selected}
                        className={`text-xs px-2 py-1 rounded-full border transition-colors cursor-pointer ${
                          selected
                            ? 'bg-bb-accent/20 border-bb-accent text-bb-accent opacity-50 cursor-not-allowed'
                            : 'bg-bb-input border-bb-border text-bb-text hover:border-bb-accent'
                        }`}
                      >
                        {item}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </Modal>

      {/* Set Prices Modal */}
      <Modal isOpen={!!priceModal} onClose={() => setPriceModal(null)} title="Set Prices" size="lg">
        <div className="space-y-3 max-h-[60vh] overflow-y-auto">
          {Object.entries(prices).map(([item, val]) => (
            <div key={item} className="flex items-center gap-3 p-2 bg-bb-input rounded-lg">
              <p className="flex-1 text-sm text-bb-text truncate">{item}</p>
              <input
                type="number"
                min="1"
                placeholder="Qty"
                value={val.qty}
                onChange={e => setPrices(p => ({ ...p, [item]: { ...p[item], qty: Number(e.target.value) || 1 } }))}
                className="w-16 bg-bb-bg border border-bb-border rounded px-2 py-1 text-sm text-bb-text text-center"
              />
              <span className="text-bb-muted text-sm">×</span>
              <input
                type="number"
                min="0"
                placeholder="Rate"
                value={val.rate || ''}
                onChange={e => setPrices(p => ({ ...p, [item]: { ...p[item], rate: Number(e.target.value) || 0 } }))}
                className="w-24 bg-bb-bg border border-bb-border rounded px-2 py-1 text-sm text-bb-text text-right"
              />
              <span className="text-xs text-bb-muted w-20 text-right">
                = ₹{(val.qty * val.rate).toLocaleString('en-IN')}
              </span>
            </div>
          ))}

          {/* Total and save */}
          <div className="pt-3 border-t border-bb-border flex justify-between items-center">
            <p className="font-semibold text-bb-text">
              Total: ₹{Object.values(prices).reduce((s, p) => s + p.qty * p.rate, 0).toLocaleString('en-IN')}
            </p>
            <Button onClick={savePrices}>Save Prices</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
