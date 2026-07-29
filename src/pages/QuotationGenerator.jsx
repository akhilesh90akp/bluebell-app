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
  const { events, settings, categories, updateEvent, showToast } = useApp();
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
    showToast('Quotation saved');
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
      <div ref={pdfRef} className="print-doc" style={{backgroundColor: 'white', color: '#111827', fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif', maxWidth: '800px', margin: '0 auto', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'}}>
        <div style={{padding: '32px'}}>

          {/* QUOTATION title at top center */}
          <div style={{textAlign: 'center', marginBottom: '24px'}}>
            <h1 style={{fontSize: '24px', fontWeight: '800', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#652D90', margin: 0}}>QUOTATION</h1>
            <div style={{height: '2px', width: '80px', margin: '8px auto 0', backgroundColor: '#652D90'}} />
          </div>

          {/* Logo (left) | Company Address (right) */}
          <div style={{display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px'}}>
            <div style={{flexShrink: 0}}>
              <img src="/logo-purple-horizontal.svg" alt="Bluebell" style={{height: '48px', width: 'auto'}} />
            </div>
            <div style={{textAlign: 'right', fontSize: '11px', color: '#374151', lineHeight: '1.6'}}>
              <p style={{fontWeight: 'bold', fontSize: '13px', color: '#111827', margin: '0 0 2px'}}>BLUE BELL</p>
              <p style={{margin: '0 0 1px'}}>Event Planners LLP</p>
              <p style={{margin: '0 0 1px'}}>297/6, Keerikkattil, Karukappilly PO,</p>
              <p style={{margin: '0 0 1px'}}>Kolenchery, Ernakulam, Kerala, 682311</p>
              <p style={{margin: '0 0 1px'}}>Ph: {settings.phone}</p>
              {settings.gstin && <p style={{margin: 0}}>GSTIN: {settings.gstin}</p>}
            </div>
          </div>

          {/* Thin separator */}
          <div style={{height: '1px', backgroundColor: '#e5e7eb', marginBottom: '24px'}} />

          {/* From / To - side by side */}
          <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '32px'}}>
            {/* To (Client) */}
            <div style={{border: '1px solid #e5e7eb', borderRadius: '8px', padding: '16px'}}>
              <p style={{fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#9ca3af', marginBottom: '8px'}}>Bill To / Client</p>
              <p style={{fontSize: '13px', fontWeight: '600', color: '#111827', margin: '0 0 4px'}}>{event.clientName}</p>
              {event.clientPhone && <p style={{fontSize: '11px', color: '#4b5563', margin: '0 0 2px'}}>Phone: {event.clientPhone}</p>}
              {event.clientAddress && <p style={{fontSize: '11px', color: '#4b5563', marginTop: '4px'}}>{event.clientAddress}</p>}
            </div>
            {/* Event Details */}
            <div style={{border: '1px solid #e5e7eb', borderRadius: '8px', padding: '16px'}}>
              <p style={{fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#9ca3af', marginBottom: '8px'}}>Event Details</p>
              <div style={{fontSize: '11px', color: '#4b5563', lineHeight: '1.8'}}>
                {event.eventType && <p style={{margin: '0 0 3px'}}><span style={{fontWeight: '500', color: '#374151'}}>Event:</span> {event.eventType}</p>}
                {event.date && <p style={{margin: '0 0 3px'}}><span style={{fontWeight: '500', color: '#374151'}}>Date:</span> {formatDateReadable(event.date)}</p>}
                {event.eventLocation && <p style={{margin: '0 0 3px'}}><span style={{fontWeight: '500', color: '#374151'}}>Venue:</span> {event.eventLocation}</p>}
                <p style={{margin: '0 0 3px'}}><span style={{fontWeight: '500', color: '#374151'}}>Quotation Date:</span> {formatDateReadable(new Date().toISOString())}</p>
                <p style={{margin: 0}}><span style={{fontWeight: '500', color: '#374151'}}>Valid for:</span> {validityDays} days</p>
              </div>
            </div>
          </div>

          {/* Items grouped by Category */}
          <div style={{marginBottom: '32px'}}>
            {groupedItems.map((group, groupIdx) => {
              const sectionSubtotal = group.items.reduce((sum, item) => {
                const p = itemPrices[item] || { qty: 1, rate: 0 };
                return sum + (p.qty * p.rate);
              }, 0);

              let slNo = 0;

              return (
                <div key={group.id} style={{marginBottom: '24px', pageBreakInside: 'avoid'}}>
                  {/* Section Header */}
                  <div style={{marginBottom: '12px'}}>
                    <h3 style={{fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#652D90', margin: 0}}>
                      {group.label}
                    </h3>
                    <div style={{height: '1px', marginTop: '4px', backgroundColor: 'rgba(101, 45, 144, 0.19)'}} />
                  </div>

                  {/* Section Table */}
                  <table style={{width: '100%', borderCollapse: 'collapse', fontSize: '12px'}}>
                    <thead>
                      <tr style={{backgroundColor: 'rgba(101, 45, 144, 0.06)'}}>
                        <th style={{padding: '8px 12px', textAlign: 'left', fontWeight: '600', color: '#4b5563', width: '40px', borderBottom: '2px solid rgba(101, 45, 144, 0.31)', fontSize: '11px'}}>Sl.</th>
                        <th style={{padding: '8px 12px', textAlign: 'left', fontWeight: '600', color: '#4b5563', borderBottom: '2px solid rgba(101, 45, 144, 0.31)', fontSize: '11px'}}>Particulars</th>
                        <th style={{padding: '8px 12px', textAlign: 'center', fontWeight: '600', color: '#4b5563', width: '50px', borderBottom: '2px solid rgba(101, 45, 144, 0.31)', fontSize: '11px'}}>Qty</th>
                        <th style={{padding: '8px 12px', textAlign: 'right', fontWeight: '600', color: '#4b5563', width: '90px', borderBottom: '2px solid rgba(101, 45, 144, 0.31)', fontSize: '11px'}}>Rate (₹)</th>
                        <th style={{padding: '8px 12px', textAlign: 'right', fontWeight: '600', color: '#4b5563', width: '100px', borderBottom: '2px solid rgba(101, 45, 144, 0.31)', fontSize: '11px'}}>Amount (₹)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.items.map((item) => {
                        slNo++;
                        const p = itemPrices[item] || { qty: 1, rate: 0 };
                        return (
                          <tr key={item} style={{borderBottom: '1px solid #f3f4f6'}}>
                            <td style={{padding: '10px 12px', color: '#9ca3af'}}>{slNo}</td>
                            <td style={{padding: '10px 12px', color: '#1f2937'}}>{item}</td>
                            <td style={{padding: '10px 12px', textAlign: 'center', color: '#374151'}}>{p.qty}</td>
                            <td style={{padding: '10px 12px', textAlign: 'right', color: '#374151'}}>{formatCurrency(p.rate)}</td>
                            <td style={{padding: '10px 12px', textAlign: 'right', fontWeight: '500', color: '#111827'}}>{formatCurrency(p.qty * p.rate)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  {/* Section Subtotal */}
                  <div style={{display: 'flex', justifyContent: 'flex-end', marginTop: '4px'}}>
                    <div style={{display: 'flex', alignItems: 'center', gap: '16px', padding: '8px 12px', borderRadius: '4px', backgroundColor: 'rgba(101, 45, 144, 0.03)'}}>
                      <span style={{fontSize: '11px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase'}}>Section Subtotal</span>
                      <span style={{fontSize: '13px', fontWeight: 'bold', color: '#1f2937'}}>{formatCurrency(sectionSubtotal)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Summary Box - All section totals + Grand Total */}
          {groupedItems.length > 0 && (
            <div style={{marginBottom: '32px'}}>
              <div style={{border: '1px solid rgba(101, 45, 144, 0.19)', borderRadius: '8px', overflow: 'hidden'}}>
                <div style={{padding: '8px 16px', backgroundColor: 'rgba(101, 45, 144, 0.08)'}}>
                  <p style={{fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#652D90', margin: 0}}>Summary</p>
                </div>
                <div style={{padding: '12px 16px'}}>
                  {groupedItems.map((group) => {
                    const sectionTotal = group.items.reduce((sum, item) => {
                      const p = itemPrices[item] || { qty: 1, rate: 0 };
                      return sum + (p.qty * p.rate);
                    }, 0);
                    return (
                      <div key={group.id} style={{display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '4px 0'}}>
                        <span style={{color: '#4b5563'}}>{group.label}</span>
                        <span style={{color: '#1f2937', fontWeight: '500'}}>{formatCurrency(sectionTotal)}</span>
                      </div>
                    );
                  })}

                  <div style={{borderTop: '1px solid #e5e7eb', paddingTop: '8px', marginTop: '8px'}}>
                    <div style={{display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '4px 0'}}>
                      <span style={{color: '#6b7280'}}>Subtotal</span>
                      <span style={{color: '#1f2937', fontWeight: '500'}}>{formatCurrency(subtotal)}</span>
                    </div>
                    {gstEnabled && (
                      <>
                        <div style={{display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '4px 0'}}>
                          <span style={{color: '#6b7280'}}>CGST ({Number(gstRate)/2}%)</span>
                          <span style={{color: '#1f2937'}}>{formatCurrency(gstData.cgst)}</span>
                        </div>
                        <div style={{display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '4px 0'}}>
                          <span style={{color: '#6b7280'}}>SGST ({Number(gstRate)/2}%)</span>
                          <span style={{color: '#1f2937'}}>{formatCurrency(gstData.sgst)}</span>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Grand total with accent border */}
                  <div style={{paddingTop: '8px', marginTop: '8px', borderTop: '2px solid #652D90'}}>
                    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                      <span style={{fontSize: '17px', fontWeight: 'bold', color: '#111827'}}>GRAND TOTAL</span>
                      <span style={{fontSize: '17px', fontWeight: 'bold', color: '#652D90'}}>{formatCurrency(gstData.total)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Fallback if no grouped items (empty state) */}
          {groupedItems.length === 0 && (
            <div style={{marginBottom: '32px', textAlign: 'center', padding: '24px 0', color: '#9ca3af', fontSize: '13px', fontStyle: 'italic'}}>
              No items added to this quotation yet.
            </div>
          )}

          {/* Terms & Conditions */}
          <div style={{borderTop: '1px solid #f3f4f6', paddingTop: '24px', marginBottom: '24px'}}>
            <p style={{fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#652D90', marginBottom: '12px'}}>Terms & Conditions</p>
            <ul style={{fontSize: '11px', color: '#4b5563', lineHeight: '1.8', margin: 0, padding: 0, listStyle: 'none'}}>
              <li style={{display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '6px'}}>
                <span style={{width: '4px', height: '4px', borderRadius: '50%', marginTop: '6px', flexShrink: 0, backgroundColor: '#652D90'}} />
                This quotation is valid for {validityDays} days from the date of issue.
              </li>
              <li style={{display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '6px'}}>
                <span style={{width: '4px', height: '4px', borderRadius: '50%', marginTop: '6px', flexShrink: 0, backgroundColor: '#652D90'}} />
                Prices are subject to change after the validity period.
              </li>
              <li style={{display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '6px'}}>
                <span style={{width: '4px', height: '4px', borderRadius: '50%', marginTop: '6px', flexShrink: 0, backgroundColor: '#652D90'}} />
                50% advance payment required to confirm booking.
              </li>
              {settings.termsAndConditions?.map((t, i) => (
                <li key={i} style={{display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '6px'}}>
                  <span style={{width: '4px', height: '4px', borderRadius: '50%', marginTop: '6px', flexShrink: 0, backgroundColor: '#652D90'}} />
                  {t}
                </li>
              ))}
            </ul>
          </div>

          {/* Validity Note */}
          <div style={{textAlign: 'center', padding: '12px 0', marginBottom: '16px', borderRadius: '8px', backgroundColor: 'rgba(101, 45, 144, 0.03)'}}>
            <p style={{fontSize: '11px', color: '#6b7280', fontStyle: 'italic', margin: 0}}>
              This quotation is valid for <span style={{fontWeight: '600', color: '#374151'}}>{validityDays} days</span> from the date of issue.
            </p>
          </div>

          {/* Footer */}
          <div style={{borderTop: '1px solid #e5e7eb', paddingTop: '16px', textAlign: 'center'}}>
            <p style={{fontSize: '13px', fontWeight: '600', color: '#374151', margin: '0 0 4px'}}>{settings.companyName}</p>
            <p style={{fontSize: '11px', color: '#6b7280', margin: 0}}>{settings.phone}{settings.email ? ` | ${settings.email}` : ''}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
