/**
 * QuotationGenerator - Professional quotation document builder
 *
 * Generates a print-ready quotation for an event. Allows adding/removing items,
 * setting per-item quantities and rates, enabling GST, and grouping items by category.
 * Supports printing, WhatsApp sharing, and saving item prices back to the event.
 */
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import Card from '../components/Card';
import Button from '../components/Button';
import Input from '../components/Input';
import Select from '../components/Select';
import Toggle from '../components/Toggle';
import Modal from '../components/Modal';
import { formatCurrency, formatDateReadable, calcGST, waLink } from '../utils/helpers';
import { ArrowLeft, Printer, MessageSquare, X, Plus, Save, Package, ChevronDown, ChevronRight } from 'lucide-react';

/** Builds and previews a printable quotation document for an event */
export default function QuotationGenerator() {
  const { eventId } = useParams();
  const { events, settings, categories, updateEvent } = useApp();
  const navigate = useNavigate();
  const event = events.find(e => e.id === eventId);

  // Initialize item prices from existing event data
  const [itemPrices, setItemPrices] = useState(() => {
    if (!event) return {};
    const p = {};
    (event.items || []).forEach(item => {
      const existing = event.itemPrices?.[item];
      p[item] = existing || { qty: 1, rate: 0 };
    });
    return p;
  });
  const [gstEnabled, setGstEnabled] = useState(false);
  const [gstRate, setGstRate] = useState(String(settings.defaultGstRate || 18));
  const [validityDays, setValidityDays] = useState(15);

  // Add item state
  const [newItemName, setNewItemName] = useState('');
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState({});

  // Local items list tracking (synced from event)
  const [localItems, setLocalItems] = useState(event?.items || []);

  // Sync localItems when event loads (context may load async from localStorage)
  useEffect(() => {
    if (event?.items && localItems.length === 0) {
      setLocalItems(event.items);
      const p = {};
      event.items.forEach(item => {
        p[item] = event.itemPrices?.[item] || { qty: 1, rate: 0 };
      });
      setItemPrices(p);
    }
  }, [event]);

  // Calculate subtotal from all items
  const subtotal = useMemo(() =>
    localItems.reduce((s, item) => {
      const p = itemPrices[item] || { qty: 1, rate: 0 };
      return s + (p.qty * p.rate);
    }, 0)
  , [localItems, itemPrices]);

  // Calculate GST breakdown
  const gstData = useMemo(() => calcGST(subtotal, gstEnabled ? Number(gstRate) : 0), [subtotal, gstEnabled, gstRate]);

  // Group items by their service category for organized display
  const groupedItems = useMemo(() => {
    const groups = [];
    const assigned = new Set();

    // Assign items to their parent categories
    categories.forEach((cat, idx) => {
      const catItems = localItems.filter(item => (cat.items || []).includes(item));
      if (catItems.length > 0) {
        groups.push({
          id: cat.id,
          name: cat.name,
          icon: cat.icon,
          label: `SECTION ${String.fromCharCode(65 + idx)}: ${cat.name}`,
          items: catItems,
        });
        catItems.forEach(i => assigned.add(i));
      }
    });

    // Items not belonging to any category go into "Other Services"
    const otherItems = localItems.filter(item => !assigned.has(item));
    if (otherItems.length > 0) {
      groups.push({
        id: 'other',
        name: 'Other Services',
        icon: '',
        label: `SECTION ${String.fromCharCode(65 + groups.length)}: Other Services`,
        items: otherItems,
      });
    }

    return groups;
  }, [localItems, categories]);

  if (!event) {
    return (
      <div className="text-center py-12">
        <p className="text-bb-muted">Event not found</p>
        <Button variant="secondary" className="mt-4" onClick={() => navigate(-1)}>Go Back</Button>
      </div>
    );
  }

  /** Adds a custom free-text item to the quotation */
  const handleAddItem = () => {
    const name = newItemName.trim();
    if (!name || localItems.includes(name)) return;
    const updated = [...localItems, name];
    setLocalItems(updated);
    setItemPrices(p => ({ ...p, [name]: { qty: 1, rate: 0 } }));
    setNewItemName('');
  };

  /** Adds a predefined item from a category to the quotation */
  const handleAddFromCategory = (itemName) => {
    if (localItems.includes(itemName)) return;
    const updated = [...localItems, itemName];
    setLocalItems(updated);
    setItemPrices(p => ({ ...p, [itemName]: { qty: 1, rate: 0 } }));
  };

  /** Removes an item from the quotation and its price data */
  const handleRemoveItem = (itemName) => {
    const updated = localItems.filter(i => i !== itemName);
    setLocalItems(updated);
    const newPrices = { ...itemPrices };
    delete newPrices[itemName];
    setItemPrices(newPrices);
  };

  /** Toggles a category's expanded state in the add-from-category modal */
  const toggleCategory = (catId) => {
    setExpandedCategories(prev => ({ ...prev, [catId]: !prev[catId] }));
  };

  /** Persists the current items and prices back to the event in context */
  const handleSave = () => {
    updateEvent(eventId, {
      items: localItems,
      itemPrices: itemPrices,
    });
  };

  /** Triggers the browser print dialog */
  const pdfRef = useRef(null);
  const handlePrint = () => window.print();

  /** Generates a formatted WhatsApp message with quotation details */
  const generateWhatsAppMsg = () => {
    let msg = `*QUOTATION*\n`;
    msg += `From: ${settings.companyName}\n`;
    msg += `To: ${event.clientName}\n`;
    msg += `Date: ${formatDateReadable(new Date().toISOString())}\n\n`;
    msg += `*Event:* ${event.eventType}\n`;
    msg += `*Event Date:* ${formatDateReadable(event.date)}\n\n`;
    msg += `*Items:*\n`;
    localItems.forEach((item, i) => {
      const p = itemPrices[item] || { qty: 1, rate: 0 };
      msg += `${i + 1}. ${item} - Qty: ${p.qty} × ₹${p.rate} = ₹${(p.qty * p.rate).toLocaleString('en-IN')}\n`;
    });
    msg += `\n*Subtotal:* ${formatCurrency(subtotal)}`;
    if (gstEnabled) {
      msg += `\n*GST (${gstRate}%):* ${formatCurrency(gstData.tax)}`;
    }
    msg += `\n*Total:* ${formatCurrency(gstData.total)}\n`;
    msg += `\nValid for ${validityDays} days.\n`;
    msg += `\n${settings.companyName} | ${settings.phone}`;
    return msg;
  };

  /** Opens WhatsApp with the pre-filled quotation message */
  const handleWhatsApp = () => {
    const phone = event.clientWhatsapp || event.clientPhone;
    if (phone) {
      window.open(waLink(phone, generateWhatsAppMsg()), '_blank');
    }
  };

  return (
    <div className="space-y-4 pb-8">
      {/* Controls - hidden in print */}
      <div data-no-print className="space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-bb-card text-bb-muted hover:text-bb-text transition-colors cursor-pointer">
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-xl font-bold text-bb-text">Quotation</h1>
        </div>

        {/* Items & Pricing Card */}
        <Card>
          <h3 className="text-sm font-semibold text-bb-muted uppercase mb-3">Items & Pricing</h3>
          <div className="space-y-2">
            {localItems.map(item => (
              <div key={item} className="flex items-center gap-2 p-2 bg-bb-input rounded-lg">
                <p className="flex-1 text-sm text-bb-text truncate">{item}</p>
                <input
                  type="number" min="1" placeholder="Qty"
                  value={itemPrices[item]?.qty === '' ? '' : (itemPrices[item]?.qty || 1)}
                  onChange={e => setItemPrices(p => ({ ...p, [item]: { ...p[item], qty: e.target.value === '' ? '' : Number(e.target.value) } }))}
                  className="w-16 bg-bb-bg border border-bb-border rounded px-2 py-1.5 text-sm text-bb-text text-center"
                />
                <span className="text-bb-muted text-sm">×</span>
                <input
                  type="number" min="0" placeholder="Rate"
                  value={itemPrices[item]?.rate || ''}
                  onChange={e => setItemPrices(p => ({ ...p, [item]: { ...p[item], rate: Number(e.target.value) || 0 } }))}
                  className="w-24 bg-bb-bg border border-bb-border rounded px-2 py-1 text-sm text-bb-text text-right"
                />
                <button
                  onClick={() => handleRemoveItem(item)}
                  className="p-1.5 rounded-lg text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer"
                  title="Remove item"
                >
                  <X size={16} />
                </button>
              </div>
            ))}

            {localItems.length === 0 && (
              <p className="text-sm text-bb-muted text-center py-4">No items added yet</p>
            )}
          </div>

          {/* Add Item Section */}
          <div className="mt-4 pt-3 border-t border-bb-border space-y-3">
            <p className="text-xs font-semibold text-bb-muted uppercase">Add Item</p>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Enter item name..."
                value={newItemName}
                onChange={e => setNewItemName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddItem()}
                className="flex-1 bg-bb-input border border-bb-border rounded-lg px-3 py-2 text-sm text-bb-text placeholder:text-bb-muted/60 focus:outline-none focus:ring-2 focus:ring-bb-accent"
              />
              <Button size="sm" icon={Plus} onClick={handleAddItem}>Add</Button>
            </div>
            <Button size="sm" variant="outline" icon={Package} onClick={() => setShowCategoryModal(true)}>
              Add from Categories
            </Button>
          </div>

          {/* GST & Validity */}
          <div className="flex flex-wrap items-center gap-4 mt-4 pt-3 border-t border-bb-border">
            <Toggle label="Include GST" checked={gstEnabled} onChange={e => setGstEnabled(e.target.checked)} />
            {gstEnabled && (
              <Select
                label="GST Rate"
                options={['5', '12', '18', '28']}
                value={gstRate}
                onChange={e => setGstRate(e.target.value)}
                className="w-28"
              />
            )}
            <Input
              label="Validity (days)"
              type="number"
              value={validityDays}
              onChange={e => setValidityDays(Number(e.target.value))}
              className="w-32"
            />
          </div>
        </Card>

        {/* Action Buttons */}
        <div data-no-print className="flex gap-2 flex-wrap">
          <Button icon={Save} onClick={handleSave}>Save Quotation</Button>
          <Button icon={Printer} variant="secondary" onClick={handlePrint}>Print / PDF</Button>
          <Button icon={MessageSquare} variant="success" onClick={handleWhatsApp}>Share via WhatsApp</Button>
          <Button variant="secondary" onClick={() => navigate(-1)}>Back</Button>
        </div>
      </div>

      {/* Category Selection Modal - Accordion style */}
      <Modal isOpen={showCategoryModal} onClose={() => setShowCategoryModal(false)} title="Add from Categories" size="lg">
        <div className="space-y-1 max-h-[60vh] overflow-y-auto">
          {categories.map(cat => {
            const availableItems = (cat.items || []).filter(i => !localItems.includes(i));
            const isExpanded = expandedCategories[cat.id];
            return (
              <div key={cat.id} className="border border-bb-border rounded-lg overflow-hidden">
                <button
                  onClick={() => toggleCategory(cat.id)}
                  className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-bb-input transition-colors cursor-pointer"
                >
                  <span className="text-sm font-medium text-bb-text">
                    {cat.icon} {cat.name}
                    <span className="ml-2 text-xs text-bb-muted">({availableItems.length} available)</span>
                  </span>
                  {isExpanded ? <ChevronDown size={16} className="text-bb-muted" /> : <ChevronRight size={16} className="text-bb-muted" />}
                </button>
                {isExpanded && availableItems.length > 0 && (
                  <div className="px-4 pb-3 space-y-1">
                    {availableItems.map(item => (
                      <button
                        key={item}
                        onClick={() => handleAddFromCategory(item)}
                        className="w-full text-left px-3 py-2 rounded-lg text-sm text-bb-text hover:bg-bb-accent/10 hover:text-bb-accent transition-colors cursor-pointer"
                      >
                        <Plus size={14} className="inline mr-2" />{item}
                      </button>
                    ))}
                  </div>
                )}
                {isExpanded && availableItems.length === 0 && (
                  <p className="px-4 pb-3 text-xs text-bb-muted">All items already added</p>
                )}
              </div>
            );
          })}
        </div>
      </Modal>

      {/* === Quotation Preview - printable document === */}
      <div ref={pdfRef} className="bg-white rounded-xl shadow-lg text-gray-800 overflow-x-auto print-doc">
        <div className="p-6 sm:p-8 print:p-10">

          {/* QUOTATION title at top center */}
          <div className="text-center mb-6">
            <h1 className="text-2xl font-extrabold tracking-[0.15em] uppercase" style={{ color: '#652D90' }}>QUOTATION</h1>
            <div className="h-[2px] w-20 mx-auto mt-2" style={{ backgroundColor: '#652D90' }} />
          </div>

          {/* Logo (left) | Company Address (right) */}
          <div className="flex items-start justify-between mb-6 print:mb-8">
            <div className="flex-shrink-0">
              <img src="/logo-purple-horizontal.svg" alt="Bluebell Event Planners" className="h-12 sm:h-14 w-auto object-contain" />
            </div>
            <div className="text-right text-xs text-gray-700 leading-[1.6]">
              <p className="font-bold text-sm text-gray-900">BLUE BELL</p>
              <p>Event Planners LLP</p>
              <p>297/6, Keerikkattil, Karukappilly PO,</p>
              <p>Kolenchery, Ernakulam, Kerala, 682311</p>
              <p>Ph: {settings.phone}</p>
              {settings.gstin && <p>GSTIN: {settings.gstin}</p>}
            </div>
          </div>

          {/* Thin separator */}
          <div className="h-px bg-gray-200 mb-6" />

          {/* From / To - side by side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 print:grid-cols-2">
            {/* To (Client) */}
            <div className="border border-gray-200 rounded-lg p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Bill To / Client</p>
              <p className="text-sm font-semibold text-gray-900">{event.clientName}</p>
              {event.clientPhone && <p className="text-xs text-gray-600">Phone: {event.clientPhone}</p>}
              {event.clientAddress && <p className="text-xs text-gray-600 mt-1">{event.clientAddress}</p>}
            </div>
            {/* Event Details */}
            <div className="border border-gray-200 rounded-lg p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Event Details</p>
              <div className="text-xs text-gray-600 space-y-1">
                {event.eventType && <p><span className="font-medium text-gray-700">Event:</span> {event.eventType}</p>}
                {event.date && <p><span className="font-medium text-gray-700">Date:</span> {formatDateReadable(event.date)}</p>}
                {event.eventLocation && <p><span className="font-medium text-gray-700">Venue:</span> {event.eventLocation}</p>}
                <p><span className="font-medium text-gray-700">Quotation Date:</span> {formatDateReadable(new Date().toISOString())}</p>
                <p><span className="font-medium text-gray-700">Valid for:</span> {validityDays} days</p>
              </div>
            </div>
          </div>

          {/* Items grouped by Category */}
          <div className="mb-8 space-y-6">
            {groupedItems.map((group, groupIdx) => {
              const sectionSubtotal = group.items.reduce((sum, item) => {
                const p = itemPrices[item] || { qty: 1, rate: 0 };
                return sum + (p.qty * p.rate);
              }, 0);

              let slNo = 0;

              return (
                <div key={group.id} className="print:break-inside-avoid">
                  {/* Section Header */}
                  <div className="mb-3">
                    <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide" style={{ color: '#652D90' }}>
                      {group.label}
                    </h3>
                    <div className="h-[1px] mt-1" style={{ backgroundColor: '#652D9030' }} />
                  </div>

                  {/* Section Table */}
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ backgroundColor: '#652D9010' }}>
                        <th className="py-2 px-3 text-left font-semibold text-gray-600 w-10 border-b" style={{ borderBottomColor: '#652D9050' }}>Sl.</th>
                        <th className="py-2 px-3 text-left font-semibold text-gray-600 border-b" style={{ borderBottomColor: '#652D9050' }}>Particulars</th>
                        <th className="py-2 px-3 text-center font-semibold text-gray-600 w-14 border-b" style={{ borderBottomColor: '#652D9050' }}>Qty</th>
                        <th className="py-2 px-3 text-right font-semibold text-gray-600 w-24 border-b" style={{ borderBottomColor: '#652D9050' }}>Rate (₹)</th>
                        <th className="py-2 px-3 text-right font-semibold text-gray-600 w-28 border-b" style={{ borderBottomColor: '#652D9050' }}>Amount (₹)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.items.map((item) => {
                        slNo++;
                        const p = itemPrices[item] || { qty: 1, rate: 0 };
                        return (
                          <tr key={item} className="border-b border-gray-100">
                            <td className="py-2.5 px-3 text-gray-400">{slNo}</td>
                            <td className="py-2.5 px-3 text-gray-800">{item}</td>
                            <td className="py-2.5 px-3 text-center text-gray-700">{p.qty}</td>
                            <td className="py-2.5 px-3 text-right text-gray-700">{formatCurrency(p.rate)}</td>
                            <td className="py-2.5 px-3 text-right font-medium text-gray-900">{formatCurrency(p.qty * p.rate)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  {/* Section Subtotal */}
                  <div className="flex justify-end mt-1">
                    <div className="flex items-center gap-4 px-3 py-2 rounded" style={{ backgroundColor: '#652D9008' }}>
                      <span className="text-xs font-semibold text-gray-500 uppercase">Section Subtotal</span>
                      <span className="text-sm font-bold text-gray-800">{formatCurrency(sectionSubtotal)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Summary Box - All section totals + Grand Total */}
          {groupedItems.length > 0 && (
            <div className="mb-8">
              <div className="border rounded-lg overflow-hidden" style={{ borderColor: '#652D9030' }}>
                <div className="px-4 py-2" style={{ backgroundColor: '#652D9015' }}>
                  <p className="text-xs font-bold uppercase tracking-widest" style={{ color: '#652D90' }}>Summary</p>
                </div>
                <div className="px-4 py-3 space-y-2">
                  {groupedItems.map((group) => {
                    const sectionTotal = group.items.reduce((sum, item) => {
                      const p = itemPrices[item] || { qty: 1, rate: 0 };
                      return sum + (p.qty * p.rate);
                    }, 0);
                    return (
                      <div key={group.id} className="flex justify-between text-sm py-1">
                        <span className="text-gray-600">{group.label}</span>
                        <span className="text-gray-800 font-medium">{formatCurrency(sectionTotal)}</span>
                      </div>
                    );
                  })}

                  <div className="border-t border-gray-200 pt-2 mt-2">
                    <div className="flex justify-between text-sm py-1">
                      <span className="text-gray-500">Subtotal</span>
                      <span className="text-gray-800 font-medium">{formatCurrency(subtotal)}</span>
                    </div>
                    {gstEnabled && (
                      <>
                        <div className="flex justify-between text-sm py-1">
                          <span className="text-gray-500">CGST ({Number(gstRate)/2}%)</span>
                          <span className="text-gray-800">{formatCurrency(gstData.cgst)}</span>
                        </div>
                        <div className="flex justify-between text-sm py-1">
                          <span className="text-gray-500">SGST ({Number(gstRate)/2}%)</span>
                          <span className="text-gray-800">{formatCurrency(gstData.sgst)}</span>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Grand total with accent border */}
                  <div className="pt-2 mt-2" style={{ borderTop: '2px solid #652D90' }}>
                    <div className="flex justify-between items-center">
                      <span className="text-lg font-bold text-gray-900">GRAND TOTAL</span>
                      <span className="text-lg font-bold" style={{ color: '#652D90' }}>{formatCurrency(gstData.total)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Fallback if no grouped items (empty state) */}
          {groupedItems.length === 0 && (
            <div className="mb-8 text-center py-6 text-gray-400 text-sm italic">
              No items added to this quotation yet.
            </div>
          )}

          {/* Terms & Conditions */}
          <div className="border-t border-gray-100 pt-6 mb-6">
            <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: '#652D90' }}>Terms & Conditions</p>
            <ul className="text-xs text-gray-600 space-y-1.5 leading-relaxed">
              <li className="flex items-start gap-2">
                <span className="w-1 h-1 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: '#652D90' }} />
                This quotation is valid for {validityDays} days from the date of issue.
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1 h-1 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: '#652D90' }} />
                Prices are subject to change after the validity period.
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1 h-1 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: '#652D90' }} />
                50% advance payment required to confirm booking.
              </li>
              {settings.termsAndConditions?.map((t, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="w-1 h-1 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: '#652D90' }} />
                  {t}
                </li>
              ))}
            </ul>
          </div>

          {/* Validity Note */}
          <div className="text-center py-3 mb-4 rounded-lg" style={{ backgroundColor: '#652D9008' }}>
            <p className="text-xs text-gray-500 italic">
              This quotation is valid for <span className="font-semibold text-gray-700">{validityDays} days</span> from the date of issue.
            </p>
          </div>

          {/* Footer */}
          <div className="border-t border-gray-200 pt-4 text-center">
            <p className="text-sm font-semibold text-gray-700">{settings.companyName}</p>
            <p className="text-xs text-gray-500 mt-0.5">{settings.phone}{settings.email ? ` | ${settings.email}` : ''}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
