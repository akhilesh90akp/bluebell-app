/**
 * QuotationGenerator - Professional quotation document builder
 *
 * Generates a print-ready quotation for an event. Groups items by main event
 * and sub-events. Allows adding/removing items, setting per-item quantities
 * and rates, and enabling GST. Supports printing and WhatsApp sharing.
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

/**
 * Helper: get all items from an event (both old and new format).
 * Returns { allItems, eventGroups } where eventGroups is an array of
 * { name, date, location, items } for display in the document.
 */
function getEventItemsData(event) {
  // New format with mainEvent
  if (event.mainEvent) {
    const mainItems = event.mainEvent.items || [];
    const subEvents = event.subEvents || [];
    const allItems = [...mainItems];
    subEvents.forEach(s => {
      (s.items || []).forEach(item => {
        if (!allItems.includes(item)) allItems.push(item);
      });
    });

    const eventGroups = [];
    if (mainItems.length > 0 || allItems.length === 0) {
      eventGroups.push({
        id: 'main',
        name: event.mainEvent.name || event.eventType || 'Main Event',
        date: event.mainEvent.date || '',
        location: event.mainEvent.location || '',
        items: mainItems,
      });
    }
    subEvents.forEach(s => {
      if ((s.items || []).length > 0) {
        eventGroups.push({
          id: s.id || s.name,
          name: s.name || 'Sub Event',
          date: s.date || '',
          location: s.location || '',
          items: s.items,
        });
      }
    });

    return { allItems, eventGroups };
  }

  // Old format (flat items array)
  const items = event.items || [];
  const eventGroups = [{
    id: 'main',
    name: event.eventType || 'Event',
    date: event.date || '',
    location: event.eventLocation || '',
    items: items,
  }];
  return { allItems: items, eventGroups };
}

/** Builds and previews a printable quotation document for an event */
export default function QuotationGenerator() {
  const { eventId } = useParams();
  const { events, settings, categories, updateEvent, showToast } = useApp();
  const navigate = useNavigate();
  const event = events.find(e => e.id === eventId);

  // Initialize item prices from existing event data using eventId::itemName keys
  const [itemPrices, setItemPrices] = useState(() => {
    if (!event) return {};
    const p = {};
    const stored = event.itemPrices || {};
    if (event.mainEvent) {
      (event.mainEvent.items || []).forEach(item => {
        const key = `main::${item}`;
        p[key] = stored[key] || stored[item] || { qty: 1, rate: 0 };
      });
      (event.subEvents || []).forEach(s => {
        (s.items || []).forEach(item => {
          const key = `${s.id}::${item}`;
          p[key] = stored[key] || stored[item] || { qty: 1, rate: 0 };
        });
      });
    } else {
      // Old format: flat items
      (event.items || []).forEach(item => {
        const key = `main::${item}`;
        p[key] = stored[key] || stored[item] || { qty: 1, rate: 0 };
      });
    }
    return p;
  });
  const [gstEnabled, setGstEnabled] = useState(false);
  const [gstRate, setGstRate] = useState(String(settings.defaultGstRate || 18));
  const [validityDays, setValidityDays] = useState(15);

  // Add item state
  const [newItemName, setNewItemName] = useState('');
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState({});

  // Local items list tracking (synced from event) - stores keys in eventId::itemName format
  const [localItems, setLocalItems] = useState(() => {
    if (!event) return [];
    const keys = [];
    if (event.mainEvent) {
      (event.mainEvent.items || []).forEach(item => keys.push(`main::${item}`));
      (event.subEvents || []).forEach(s => {
        (s.items || []).forEach(item => keys.push(`${s.id}::${item}`));
      });
    } else {
      (event.items || []).forEach(item => keys.push(`main::${item}`));
    }
    return keys;
  });

  // Ref for printable section (must be before early return)
  const pdfRef = useRef(null);

  // Sync localItems when event loads (context may load async from Firestore)
  useEffect(() => {
    if (event && localItems.length === 0) {
      const keys = [];
      const p = {};
      const stored = event.itemPrices || {};
      if (event.mainEvent) {
        (event.mainEvent.items || []).forEach(item => {
          const key = `main::${item}`;
          keys.push(key);
          p[key] = stored[key] || stored[item] || { qty: 1, rate: 0 };
        });
        (event.subEvents || []).forEach(s => {
          (s.items || []).forEach(item => {
            const key = `${s.id}::${item}`;
            keys.push(key);
            p[key] = stored[key] || stored[item] || { qty: 1, rate: 0 };
          });
        });
      } else {
        (event.items || []).forEach(item => {
          const key = `main::${item}`;
          keys.push(key);
          p[key] = stored[key] || stored[item] || { qty: 1, rate: 0 };
        });
      }
      setLocalItems(keys);
      setItemPrices(p);
    }
  }, [event]);

  // Calculate subtotal from all items
  const subtotal = useMemo(() =>
    localItems.reduce((s, key) => {
      const p = itemPrices[key] || { qty: 1, rate: 0 };
      return s + (p.qty * p.rate);
    }, 0)
  , [localItems, itemPrices]);

  // Calculate GST breakdown
  const gstData = useMemo(() => calcGST(subtotal, gstEnabled ? Number(gstRate) : 0), [subtotal, gstEnabled, gstRate]);

  // Build event groups for printable document using current local items
  const printGroups = useMemo(() => {
    if (!event) return [];
    // Use the event structure to determine groups
    if (event.mainEvent) {
      const groups = [];
      // Get item names from localItems keys that belong to main
      const mainItemKeys = localItems.filter(k => k.startsWith('main::'));
      const mainItemNames = mainItemKeys.map(k => k.replace('main::', ''));

      if (mainItemNames.length > 0) {
        groups.push({
          id: 'main',
          name: event.mainEvent.name || event.eventType || 'Main Event',
          date: event.mainEvent.date || '',
          location: event.mainEvent.location || '',
          items: mainItemNames,
        });
      }
      (event.subEvents || []).forEach(s => {
        const subItemKeys = localItems.filter(k => k.startsWith(`${s.id}::`));
        const subItemNames = subItemKeys.map(k => k.replace(`${s.id}::`, ''));
        if (subItemNames.length > 0) {
          groups.push({
            id: s.id || s.name,
            name: s.name || 'Sub Event',
            date: s.date || '',
            location: s.location || '',
            items: subItemNames,
          });
        }
      });
      return groups;
    }

    // Old format - single group
    const mainItemNames = localItems.map(k => k.replace('main::', ''));
    return [{
      id: 'main',
      name: event.eventType || 'Event',
      date: event.date || '',
      location: event.eventLocation || '',
      items: mainItemNames,
    }];
  }, [event, localItems]);

  if (!event) {
    return (
      <div className="text-center py-12">
        <p className="text-bb-muted">Event not found</p>
        <Button variant="secondary" className="mt-4" onClick={() => navigate(-1)}>Go Back</Button>
      </div>
    );
  }

  /** Adds a custom free-text item to the quotation (added to main event by default) */
  const handleAddItem = () => {
    const name = newItemName.trim();
    if (!name) return;
    const key = `main::${name}`;
    if (localItems.includes(key)) return;
    const updated = [...localItems, key];
    setLocalItems(updated);
    setItemPrices(p => ({ ...p, [key]: { qty: 1, rate: 0 } }));
    setNewItemName('');
  };

  /** Adds a predefined item from a category to the quotation (added to main event) */
  const handleAddFromCategory = (itemName) => {
    const key = `main::${itemName}`;
    if (localItems.includes(key)) return;
    const updated = [...localItems, key];
    setLocalItems(updated);
    setItemPrices(p => ({ ...p, [key]: { qty: 1, rate: 0 } }));
  };

  /** Removes an item from the quotation and its price data */
  const handleRemoveItem = (key) => {
    const updated = localItems.filter(i => i !== key);
    setLocalItems(updated);
    const newPrices = { ...itemPrices };
    delete newPrices[key];
    setItemPrices(newPrices);
  };

  /** Toggles a category's expanded state in the add-from-category modal */
  const toggleCategory = (catId) => {
    setExpandedCategories(prev => ({ ...prev, [catId]: !prev[catId] }));
  };

  /** Persists the current items and prices back to the event in context */
  const handleSave = () => {
    // Save itemPrices with eventId::itemName keys
    const updateData = { itemPrices: itemPrices };

    if (event.mainEvent) {
      // Reconstruct mainEvent items from localItems keys
      const mainItems = localItems
        .filter(k => k.startsWith('main::'))
        .map(k => k.replace('main::', ''));
      updateData.mainEvent = { ...event.mainEvent, items: mainItems };

      // Reconstruct sub-event items from localItems keys
      const subEvents = (event.subEvents || []).map(s => {
        const subItems = localItems
          .filter(k => k.startsWith(`${s.id}::`))
          .map(k => k.replace(`${s.id}::`, ''));
        return { ...s, items: subItems };
      });
      updateData.subEvents = subEvents;
    } else {
      const items = localItems.map(k => k.replace('main::', ''));
      updateData.items = items;
    }

    updateEvent(eventId, updateData);
    showToast('Quotation saved');
  };

  /** Triggers the browser print dialog with descriptive PDF filename */
  const handlePrint = () => {
    const dateStr = displayDate ? formatDateReadable(displayDate) : formatDateReadable(new Date().toISOString());
    document.title = `Quotation - ${event.clientName || 'Client'} ${event.eventType || 'Event'} ${dateStr}`;
    window.print();
    document.title = 'Bluebell';
  };

  /** Generates a formatted WhatsApp message with quotation details */
  const generateWhatsAppMsg = () => {
    let msg = `*QUOTATION*\n`;
    msg += `From: ${settings.companyName}\n`;
    msg += `To: ${event.clientName}\n`;
    msg += `Date: ${formatDateReadable(new Date().toISOString())}\n\n`;
    msg += `*Event:* ${event.eventType}\n`;
    const mainDate = event.mainEvent?.date || event.date;
    if (mainDate) msg += `*Event Date:* ${formatDateReadable(mainDate)}\n\n`;
    msg += `*Items:*\n`;
    localItems.forEach((key, i) => {
      const itemName = key.includes('::') ? key.split('::').slice(1).join('::') : key;
      const p = itemPrices[key] || { qty: 1, rate: 0 };
      msg += `${i + 1}. ${itemName} - Qty: ${p.qty} × ₹${p.rate} = ₹${(p.qty * p.rate).toLocaleString('en-IN')}\n`;
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

  // Get the main event date for display
  const displayDate = event.mainEvent?.date || event.date || '';

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
            {localItems.map(key => {
              const itemName = key.includes('::') ? key.split('::').slice(1).join('::') : key;
              const eventPrefix = key.includes('::') ? key.split('::')[0] : 'main';
              const groupLabel = eventPrefix === 'main'
                ? (event.mainEvent?.name || event.eventType || 'Main Event')
                : ((event.subEvents || []).find(s => s.id === eventPrefix)?.name || 'Sub Event');
              return (
                <div key={key} className="flex items-center gap-2 p-2 bg-bb-input rounded-lg">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-bb-text truncate">{itemName}</p>
                    {printGroups.length > 1 && (
                      <p className="text-xs text-bb-muted truncate">{groupLabel}</p>
                    )}
                  </div>
                  <input
                    type="number" min="1" placeholder="Qty"
                    value={itemPrices[key]?.qty === '' ? '' : (itemPrices[key]?.qty || 1)}
                    onChange={e => setItemPrices(p => ({ ...p, [key]: { ...p[key], qty: e.target.value === '' ? '' : Number(e.target.value) } }))}
                    className="w-16 bg-bb-bg border border-bb-border rounded px-2 py-1.5 text-sm text-bb-text text-center"
                  />
                  <span className="text-bb-muted text-sm">×</span>
                  <input
                    type="number" min="0" placeholder="Rate"
                    value={itemPrices[key]?.rate || ''}
                    onChange={e => setItemPrices(p => ({ ...p, [key]: { ...p[key], rate: Number(e.target.value) || 0 } }))}
                    className="w-24 bg-bb-bg border border-bb-border rounded px-2 py-1 text-sm text-bb-text text-right"
                  />
                  <button
                    onClick={() => handleRemoveItem(key)}
                    className="p-1.5 rounded-lg text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer"
                    title="Remove item"
                  >
                    <X size={16} />
                  </button>
                </div>
              );
            })}

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
            const availableItems = (cat.items || []).filter(i => !localItems.includes(`main::${i}`));
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
      <div ref={pdfRef} className="print-doc" style={{backgroundColor: 'white', color: '#1f2937', fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif', maxWidth: '800px', margin: '0 auto', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'}}>
        <table style={{width: '100%', borderCollapse: 'collapse', padding: '0', margin: '0'}}>
          <tbody>
            {/* Row 1: Title */}
            <tr>
              <td colSpan="5" style={{textAlign: 'center', padding: '24px 24px 12px'}}>
                <span style={{fontSize: '20px', fontWeight: '800', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#652D90'}}>QUOTATION</span>
                <div style={{height: '3px', width: '80px', margin: '8px auto 0', backgroundColor: '#652D90', borderRadius: '2px'}} />
              </td>
            </tr>

            {/* Row 2: Company address left, Logo right */}
            <tr>
              <td colSpan="3" style={{verticalAlign: 'top', padding: '12px 24px', fontSize: '11px', color: '#4b5563', lineHeight: '1.7'}}>
                <span style={{fontWeight: '700', fontSize: '13px', color: '#1f2937'}}>BLUE BELL</span><span style={{color: '#4b5563'}}> — Event Planners LLP</span><br/>
                297/6, Keerikkattil, Karukappilly PO,<br/>
                Kolenchery, Ernakulam, Kerala, 682311<br/>
                Ph: {settings.phone} | GSTIN: {settings.gstin}
              </td>
              <td colSpan="2" style={{verticalAlign: 'top', textAlign: 'right', padding: '12px 24px'}}>
                <img src={import.meta.env.BASE_URL + "logo-purple-horizontal.svg"} alt="Bluebell" style={{height: '40px', width: 'auto'}} />
              </td>
            </tr>

            {/* Row 3: Thin gray separator */}
            <tr>
              <td colSpan="5" style={{padding: '0 24px'}}>
                <div style={{height: '1px', backgroundColor: '#e5e7eb'}} />
              </td>
            </tr>

            {/* Row 4: Two boxes with purple top border */}
            <tr>
              <td colSpan="3" style={{verticalAlign: 'top', padding: '16px 24px 12px', width: '60%'}}>
                <div style={{borderTop: '3px solid #652D90', padding: '12px 0 0'}}>
                  <span style={{fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#652D90'}}>BILL TO/ CLIENT</span><br/>
                  <span style={{fontSize: '14px', fontWeight: '700', color: '#1f2937', lineHeight: '2'}}>{event.clientName}</span><br/>
                  {event.clientPhone && <span style={{fontSize: '11px', color: '#6b7280'}}>Phone: {event.clientPhone}</span>}
                  {event.clientAddress && <><br/><span style={{fontSize: '11px', color: '#6b7280'}}>{event.clientAddress}</span></>}
                </div>
              </td>
              <td colSpan="2" style={{verticalAlign: 'top', padding: '16px 24px 12px', width: '40%'}}>
                <div style={{borderTop: '3px solid #652D90', padding: '12px 0 0', fontSize: '11px', color: '#4b5563', lineHeight: '1.9'}}>
                  <span style={{fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#652D90'}}>EVENT DETAILS</span><br/>
                  {event.eventType && <>Event: {event.eventType}<br/></>}
                  {displayDate && <>Date: {formatDateReadable(displayDate)}<br/></>}
                  {(event.mainEvent?.location || event.eventLocation) && <>Venue: {event.mainEvent?.location || event.eventLocation}<br/></>}
                  Quote Date: {formatDateReadable(new Date().toISOString())}<br/>
                  Valid for: {validityDays} Days
                </div>
              </td>
            </tr>

            {/* Items grouped by Event */}
            {printGroups.map((group) => {
              const sectionSubtotal = group.items.reduce((sum, item) => {
                const key = `${group.id}::${item}`;
                const p = itemPrices[key] || itemPrices[item] || { qty: 1, rate: 0 };
                return sum + (p.qty * p.rate);
              }, 0);

              let slNo = 0;

              return (
                <React.Fragment key={group.id}>
                  {/* Row 5: Event section header */}
                  <tr>
                    <td colSpan="5" style={{padding: '16px 24px 6px'}}>
                      <span style={{fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#652D90'}}>
                        {group.name}{group.date ? ` — ${formatDateReadable(group.date)}` : ''}{group.location ? `, ${group.location}` : ''}
                      </span>
                      <div style={{height: '2px', marginTop: '6px', backgroundColor: '#652D90', opacity: 0.3, borderRadius: '1px'}} />
                    </td>
                  </tr>

                  {/* Row 6: Table column headers */}
                  <tr style={{backgroundColor: '#f5f0fa'}}>
                    <th style={{padding: '8px 12px 8px 24px', textAlign: 'left', fontWeight: '600', color: '#4b5563', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em', width: '40px'}}>Sl.</th>
                    <th style={{padding: '8px 12px', textAlign: 'left', fontWeight: '600', color: '#4b5563', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em'}}>Particulars</th>
                    <th style={{padding: '8px 12px', textAlign: 'center', fontWeight: '600', color: '#4b5563', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em', width: '50px'}}>Qty</th>
                    <th style={{padding: '8px 12px', textAlign: 'right', fontWeight: '600', color: '#4b5563', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em', width: '90px'}}>Rate (₹)</th>
                    <th style={{padding: '8px 12px 8px 12px', textAlign: 'right', fontWeight: '600', color: '#4b5563', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em', width: '100px', paddingRight: '24px'}}>Amount (₹)</th>
                  </tr>

                  {/* Item rows */}
                  {group.items.map((item) => {
                    slNo++;
                    const key = `${group.id}::${item}`;
                    const p = itemPrices[key] || itemPrices[item] || { qty: 1, rate: 0 };
                    return (
                      <tr key={item} style={{borderBottom: '1px solid #f0f0f0'}}>
                        <td style={{padding: '10px 12px 10px 24px', color: '#6b7280', fontSize: '12px'}}>{slNo}</td>
                        <td style={{padding: '10px 12px', color: '#1f2937', fontSize: '12px'}}>{item}</td>
                        <td style={{padding: '10px 12px', textAlign: 'center', color: '#4b5563', fontSize: '12px'}}>{p.qty}</td>
                        <td style={{padding: '10px 12px', textAlign: 'right', color: '#4b5563', fontSize: '12px'}}>{formatCurrency(p.rate)}</td>
                        <td style={{padding: '10px 12px', textAlign: 'right', fontWeight: '600', color: '#1f2937', fontSize: '12px', paddingRight: '24px'}}>{formatCurrency(p.qty * p.rate)}</td>
                      </tr>
                    );
                  })}

                  {/* Section subtotal row */}
                  <tr>
                    <td colSpan="5" style={{textAlign: 'right', padding: '10px 24px 16px'}}>
                      <span style={{fontSize: '11px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', marginRight: '16px'}}>Subtotal</span>
                      <span style={{fontSize: '14px', fontWeight: '700', color: '#1f2937'}}>{formatCurrency(sectionSubtotal)}</span>
                    </td>
                  </tr>
                </React.Fragment>
              );
            })}

            {/* Fallback if no items */}
            {printGroups.length === 0 && (
              <tr>
                <td colSpan="5" style={{textAlign: 'center', padding: '24px', color: '#6b7280', fontSize: '12px', fontStyle: 'italic'}}>
                  No items added to this quotation yet.
                </td>
              </tr>
            )}

            {/* Summary section */}
            {printGroups.length > 0 && (
              <>
                <tr><td colSpan="5" style={{padding: '4px 0'}} /></tr>

                <tr>
                  <td colSpan="5" style={{padding: '0 24px'}}>
                    <table style={{width: '100%', borderCollapse: 'collapse', border: '1px solid #e5e7eb', borderRadius: '6px', overflow: 'hidden'}}>
                      <tbody>
                        <tr style={{backgroundColor: '#f5f0fa'}}>
                          <td colSpan="2" style={{padding: '8px 16px', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#652D90'}}>SUMMARY</td>
                        </tr>
                        {printGroups.map((group) => {
                          const sectionTotal = group.items.reduce((sum, item) => {
                            const key = `${group.id}::${item}`;
                            const p = itemPrices[key] || itemPrices[item] || { qty: 1, rate: 0 };
                            return sum + (p.qty * p.rate);
                          }, 0);
                          return (
                            <tr key={group.id} style={{borderBottom: '1px solid #f3f4f6'}}>
                              <td style={{fontSize: '12px', color: '#4b5563', padding: '8px 16px'}}>{group.name}</td>
                              <td style={{fontSize: '12px', color: '#1f2937', fontWeight: '500', textAlign: 'right', padding: '8px 16px'}}>{formatCurrency(sectionTotal)}</td>
                            </tr>
                          );
                        })}
                        <tr style={{borderTop: '1px solid #e5e7eb'}}>
                          <td style={{fontSize: '12px', color: '#6b7280', padding: '8px 16px'}}>Subtotal</td>
                          <td style={{fontSize: '12px', color: '#1f2937', fontWeight: '500', textAlign: 'right', padding: '8px 16px'}}>{formatCurrency(subtotal)}</td>
                        </tr>
                        {gstEnabled && (
                          <>
                            <tr style={{borderTop: '1px solid #f3f4f6'}}>
                              <td style={{fontSize: '12px', color: '#6b7280', padding: '6px 16px'}}>CGST ({Number(gstRate)/2}%)</td>
                              <td style={{fontSize: '12px', color: '#1f2937', textAlign: 'right', padding: '6px 16px'}}>{formatCurrency(gstData.cgst)}</td>
                            </tr>
                            <tr style={{borderTop: '1px solid #f3f4f6'}}>
                              <td style={{fontSize: '12px', color: '#6b7280', padding: '6px 16px'}}>SGST ({Number(gstRate)/2}%)</td>
                              <td style={{fontSize: '12px', color: '#1f2937', textAlign: 'right', padding: '6px 16px'}}>{formatCurrency(gstData.sgst)}</td>
                            </tr>
                          </>
                        )}
                        <tr style={{borderTop: '2px solid #652D90'}}>
                          <td style={{fontSize: '16px', fontWeight: '700', color: '#1f2937', padding: '12px 16px'}}>GRAND TOTAL</td>
                          <td style={{fontSize: '16px', fontWeight: '700', color: '#652D90', textAlign: 'right', padding: '12px 16px'}}>{formatCurrency(gstData.total)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </td>
                </tr>
              </>
            )}

            {/* Terms & Conditions */}
            <tr>
              <td colSpan="5" style={{padding: '20px 24px 8px'}}>
                <span style={{fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#652D90'}}>TERMS & CONDITIONS</span>
                <div style={{marginTop: '8px', fontSize: '11px', color: '#4b5563', lineHeight: '1.6'}}>
                  <div style={{padding: '2px 0'}}>1. This quotation is valid for {validityDays} days from the date of issue.</div>
                  <div style={{padding: '2px 0'}}>2. Prices are subject to change after the validity period.</div>
                  <div style={{padding: '2px 0'}}>3. 50% advance payment required to confirm booking.</div>
                  {settings.termsAndConditions?.map((t, i) => (
                    <div key={i} style={{padding: '2px 0'}}>{i + 4}. {t}</div>
                  ))}
                </div>
              </td>
            </tr>

            {/* Validity bar */}
            <tr>
              <td colSpan="5" style={{padding: '12px 24px'}}>
                <div style={{backgroundColor: '#f3f4f6', borderRadius: '4px', padding: '10px 16px', textAlign: 'center'}}>
                  <span style={{fontSize: '11px', color: '#6b7280', fontStyle: 'italic'}}>
                    This quotation is valid for <span style={{fontWeight: '700', color: '#1f2937'}}>{validityDays} days</span> from the date of issue.
                  </span>
                </div>
              </td>
            </tr>

            {/* Footer */}
            <tr>
              <td colSpan="5" style={{textAlign: 'center', padding: '16px 24px 24px', borderTop: '1px solid #e5e7eb'}}>
                <span style={{fontSize: '14px', fontWeight: '700', color: '#1f2937'}}>BLUE BELL</span><br/>
                <span style={{fontSize: '11px', color: '#6b7280', marginTop: '4px', display: 'inline-block'}}>{settings.phone}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
