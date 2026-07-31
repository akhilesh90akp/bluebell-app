/**
 * BillGenerator - Invoice/bill document builder
 *
 * Generates a professional GST-compliant invoice for completed events.
 * Groups items by main event and sub-events. Supports configurable invoice
 * number, discount, GST (intra/inter-state), and round-off.
 * Includes print and WhatsApp sharing capabilities.
 */
import React, { useState, useMemo, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import Button from '../components/Button';
import Input from '../components/Input';
import Select from '../components/Select';
import Toggle from '../components/Toggle';
import Card from '../components/Card';
import { formatCurrency, formatDateReadable, calcGST, roundOff, genInvoiceNo, waLink } from '../utils/helpers';
import { DEFAULT_SAC_CODE } from '../constants/data';
import { ArrowLeft, Printer, MessageSquare } from 'lucide-react';

/**
 * Helper: get all items and event groups from an event (both old and new format).
 */
function getEventItemsData(event) {
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
    if (mainItems.length > 0) {
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

    // If no groups but there are items (items added via quotation that aren't in mainEvent)
    if (eventGroups.length === 0 && allItems.length > 0) {
      eventGroups.push({
        id: 'main',
        name: event.mainEvent.name || event.eventType || 'Event',
        date: event.mainEvent.date || '',
        location: event.mainEvent.location || '',
        items: allItems,
      });
    }

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

/** Builds and previews a printable invoice document for an event */
export default function BillGenerator() {
  const { eventId } = useParams();
  const { events, settings } = useApp();
  const navigate = useNavigate();
  const event = events.find(e => e.id === eventId);

  // Count existing invoices for sequential numbering
  const billedCount = events.filter(e => e.invoiceNo).length;

  // Invoice configuration state
  const [invoiceNo, setInvoiceNo] = useState(() => genInvoiceNo(settings.invoicePrefix, billedCount));
  const [invoiceDate, setInvoiceDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [billToName, setBillToName] = useState(event?.clientName || '');
  const [billToAddress, setBillToAddress] = useState(event?.clientAddress || '');
  const [discount, setDiscount] = useState(0);
  const [gstEnabled, setGstEnabled] = useState(true);
  const [gstRate, setGstRate] = useState(String(settings.defaultGstRate || 18));
  const [interState, setInterState] = useState(false);

  // Ref for printable section
  const pdfRef = useRef(null);

  // Get items and groups (backward compatible)
  const { allItems, eventGroups } = useMemo(() => event ? getEventItemsData(event) : { allItems: [], eventGroups: [] }, [event]);
  const storedPrices = event?.itemPrices || {};

  // Calculate subtotal from all item prices using eventId::itemName keys with fallback
  const subtotal = useMemo(() => {
    return eventGroups.reduce((total, group) => {
      return total + group.items.reduce((s, item) => {
        const key = `${group.id}::${item}`;
        const p = storedPrices[key] || storedPrices[item] || { qty: 1, rate: 0 };
        return s + (p.qty * p.rate);
      }, 0);
    }, 0);
  }, [eventGroups, event]);

  // Apply discount then calculate GST
  const afterDiscount = subtotal - (Number(discount) || 0);
  const gstData = useMemo(() => calcGST(afterDiscount, gstEnabled ? Number(gstRate) : 0, interState), [afterDiscount, gstEnabled, gstRate, interState]);
  const rounded = useMemo(() => roundOff(gstData.total), [gstData.total]);

  if (!event) {
    return (
      <div className="text-center py-12">
        <p className="text-bb-muted">Event not found</p>
        <Button variant="secondary" className="mt-4" onClick={() => navigate(-1)}>Go Back</Button>
      </div>
    );
  }

  /** Triggers the browser print dialog with descriptive PDF filename */
  const handlePrint = () => {
    const dateStr = formatDateReadable(invoiceDate);
    document.title = `Invoice - ${billToName || event.clientName || 'Client'} ${invoiceNo} ${dateStr}`;
    window.print();
    document.title = 'Bluebell';
  };

  /** Generates a formatted WhatsApp message with invoice details */
  const generateWhatsAppMsg = () => {
    let msg = `*INVOICE #${invoiceNo}*\n`;
    msg += `Date: ${formatDateReadable(invoiceDate)}\n`;
    msg += `From: ${settings.companyName}\n`;
    msg += `To: ${billToName}\n\n`;
    msg += `*Items:*\n`;
    let idx = 0;
    eventGroups.forEach(group => {
      group.items.forEach(item => {
        idx++;
        const key = `${group.id}::${item}`;
        const p = storedPrices[key] || storedPrices[item] || { qty: 1, rate: 0 };
        msg += `${idx}. ${item} - ₹${(p.qty * p.rate).toLocaleString('en-IN')}\n`;
      });
    });
    msg += `\nSubtotal: ${formatCurrency(subtotal)}`;
    if (discount > 0) msg += `\nDiscount: -${formatCurrency(discount)}`;
    if (gstEnabled) {
      if (interState) {
        msg += `\nIGST (${gstRate}%): ${formatCurrency(gstData.igst)}`;
      } else {
        msg += `\nCGST (${Number(gstRate)/2}%): ${formatCurrency(gstData.cgst)}`;
        msg += `\nSGST (${Number(gstRate)/2}%): ${formatCurrency(gstData.sgst)}`;
      }
    }
    msg += `\n*TOTAL: ${formatCurrency(rounded.rounded)}*\n`;
    msg += `\n${settings.companyName} | ${settings.phone}`;
    return msg;
  };

  /** Opens WhatsApp with the pre-filled invoice message */
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
          <h1 className="text-xl font-bold text-bb-text">Invoice</h1>
        </div>

        {/* Invoice configuration form */}
        <Card>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input label="Invoice No" value={invoiceNo} onChange={e => setInvoiceNo(e.target.value)} />
            <Input label="Invoice Date" type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} />
            <Input label="Bill To (Name)" value={billToName} onChange={e => setBillToName(e.target.value)} />
            <Input label="Bill To (Address)" value={billToAddress} onChange={e => setBillToAddress(e.target.value)} />
            <Input label="Discount (₹)" type="number" value={discount} onChange={e => setDiscount(e.target.value)} />
            <Select label="GST Rate" options={['5', '12', '18', '28']} value={gstRate} onChange={e => setGstRate(e.target.value)} />
          </div>
          <div className="flex items-center gap-6 mt-4">
            <Toggle label="GST" checked={gstEnabled} onChange={e => setGstEnabled(e.target.checked)} />
            <Toggle label="Inter-State (IGST)" checked={interState} onChange={e => setInterState(e.target.checked)} />
          </div>
        </Card>

        {/* Action buttons */}
        <div data-no-print className="flex gap-2 flex-wrap">
          <Button icon={Printer} onClick={handlePrint}>Print / Save PDF</Button>
          <Button icon={MessageSquare} variant="success" onClick={handleWhatsApp}>Share via WhatsApp</Button>
          <Button variant="secondary" onClick={() => navigate(-1)}>Back</Button>
        </div>
      </div>

      {/* === Invoice Preview - printable document === */}
      <div ref={pdfRef} className="print-doc" style={{backgroundColor: 'white', color: '#111827', fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif', maxWidth: '800px', margin: '0 auto', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'}}>
        <div style={{padding: '20px'}}>

          {/* INVOICE title at top center */}
          <div style={{textAlign: 'center', marginBottom: '16px'}}>
            <h1 style={{fontSize: '24px', fontWeight: '800', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#111827', margin: 0}}>INVOICE</h1>
            <div style={{height: '2px', width: '80px', margin: '8px auto 0', backgroundColor: '#111827'}} />
          </div>

          {/* Logo (left) | Company Address (right) */}
          <table style={{width: '100%', borderCollapse: 'collapse', marginBottom: '16px'}}>
            <tbody>
              <tr>
                <td style={{verticalAlign: 'top', width: '50%'}}>
                  <img src={import.meta.env.BASE_URL + "logo-purple-horizontal.svg"} alt="Bluebell" style={{height: '48px', width: 'auto'}} />
                </td>
                <td style={{verticalAlign: 'top', width: '50%', textAlign: 'right', fontSize: '11px', color: '#374151', lineHeight: '1.6'}}>
                  <p style={{fontWeight: 'bold', fontSize: '13px', color: '#111827', margin: '0 0 2px'}}>BLUE BELL</p>
                  <p style={{margin: '0 0 1px'}}>Event Planners LLP</p>
                  <p style={{margin: '0 0 1px'}}>297/6, Keerikkattil, Karukappilly PO,</p>
                  <p style={{margin: '0 0 1px'}}>Kolenchery, Ernakulam, Kerala, 682311</p>
                  <p style={{margin: '0 0 1px'}}>Ph: {settings.phone}</p>
                  {settings.gstin && <p style={{margin: 0}}>GSTIN/UIN: {settings.gstin}</p>}
                </td>
              </tr>
            </tbody>
          </table>

          {/* Thin separator */}
          <div style={{borderTop: '1px solid #e5e7eb', marginBottom: '12px'}} />

          {/* Invoice details row */}
          <table style={{width: '100%', borderCollapse: 'collapse', marginBottom: '16px'}}>
            <tbody>
              <tr>
                <td style={{verticalAlign: 'top', width: '50%'}}>
                  <p style={{fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#9ca3af', marginBottom: '4px'}}>Bill To</p>
                  <p style={{fontSize: '15px', fontWeight: '600', color: '#111827', margin: 0}}>{billToName}</p>
                  {billToAddress && <p style={{fontSize: '13px', color: '#4b5563', whiteSpace: 'pre-line', marginTop: '2px'}}>{billToAddress}</p>}
                </td>
                <td style={{verticalAlign: 'top', width: '50%', textAlign: 'right'}}>
                  <div>
                    <p style={{fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#9ca3af', margin: 0}}>Date</p>
                    <p style={{fontSize: '13px', fontWeight: '500', color: '#1f2937', margin: '2px 0 0'}}>{formatDateReadable(invoiceDate)}</p>
                  </div>
                  <div style={{marginTop: '10px'}}>
                    <p style={{fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#9ca3af', margin: 0}}>Invoice #</p>
                    <p style={{fontSize: '13px', fontWeight: '500', color: '#1f2937', margin: '2px 0 0'}}>{invoiceNo}</p>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>

          {/* Items grouped by Event */}
          <div style={{marginBottom: '20px'}}>
            {eventGroups.map((group) => {
              let slNo = 0;
              const groupSubtotal = group.items.reduce((sum, item) => {
                const key = `${group.id}::${item}`;
                const p = storedPrices[key] || storedPrices[item] || { qty: 1, rate: 0 };
                return sum + (p.qty * p.rate);
              }, 0);

              return (
                <div key={group.id} style={{marginBottom: '24px', pageBreakInside: 'avoid'}}>
                  {/* Event group header */}
                  {eventGroups.length > 1 && (
                    <div style={{marginBottom: '8px'}}>
                      <p style={{fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#374151', margin: 0}}>
                        {group.name}{group.date ? ` — ${formatDateReadable(group.date)}` : ''}{group.location ? `, ${group.location}` : ''}
                      </p>
                      <div style={{height: '1px', marginTop: '4px', backgroundColor: '#e5e7eb'}} />
                    </div>
                  )}

                  {/* Items Table */}
                  <table style={{width: '100%', borderCollapse: 'collapse', fontSize: '12px'}}>
                    <thead>
                      <tr style={{borderBottom: '2px solid #111827'}}>
                        <th style={{padding: '10px 8px', textAlign: 'left', fontWeight: '600', color: '#374151', width: '40px'}}>No.</th>
                        <th style={{padding: '10px 8px', textAlign: 'left', fontWeight: '600', color: '#374151', width: '90px'}}>SAC CODE</th>
                        <th style={{padding: '10px 8px', textAlign: 'left', fontWeight: '600', color: '#374151'}}>DESCRIPTION</th>
                        <th style={{padding: '10px 8px', textAlign: 'center', fontWeight: '600', color: '#374151', width: '50px'}}>QTY</th>
                        <th style={{padding: '10px 8px', textAlign: 'right', fontWeight: '600', color: '#374151', width: '90px'}}>PRICE</th>
                        <th style={{padding: '10px 8px', textAlign: 'right', fontWeight: '600', color: '#374151', width: '100px'}}>AMOUNT</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.items.map((item) => {
                        slNo++;
                        const key = `${group.id}::${item}`;
                        const p = storedPrices[key] || storedPrices[item] || { qty: 1, rate: 0 };
                        return (
                          <tr key={item} style={{borderBottom: '1px solid #f3f4f6'}}>
                            <td style={{padding: '10px 8px', color: '#6b7280'}}>{slNo}</td>
                            <td style={{padding: '10px 8px', color: '#6b7280', fontFamily: 'monospace', fontSize: '11px'}}>{DEFAULT_SAC_CODE}</td>
                            <td style={{padding: '10px 8px', color: '#1f2937'}}>{item}</td>
                            <td style={{padding: '10px 8px', textAlign: 'center', color: '#374151'}}>{p.qty}</td>
                            <td style={{padding: '10px 8px', textAlign: 'right', color: '#374151'}}>{formatCurrency(p.rate)}</td>
                            <td style={{padding: '10px 8px', textAlign: 'right', fontWeight: '500', color: '#111827'}}>{formatCurrency(p.qty * p.rate)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  {/* Group subtotal (only show if multiple groups) */}
                  {eventGroups.length > 1 && (
                    <table style={{width: '100%', borderCollapse: 'collapse', marginTop: '4px'}}>
                      <tbody>
                        <tr>
                          <td style={{textAlign: 'right', padding: '6px 8px'}}>
                            <span style={{fontSize: '11px', fontWeight: '600', color: '#6b7280', marginRight: '12px'}}>Subtotal:</span>
                            <span style={{fontSize: '12px', fontWeight: 'bold', color: '#1f2937'}}>{formatCurrency(groupSubtotal)}</span>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  )}
                </div>
              );
            })}
          </div>

          {/* Totals + Bank/Terms section */}
          <table style={{width: '100%', borderCollapse: 'collapse', marginBottom: '20px'}}>
            <tbody>
              <tr>
                {/* Bank Details - Left */}
                <td style={{verticalAlign: 'top', width: '33%', paddingRight: '12px'}}>
                  <p style={{fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#9ca3af', marginBottom: '8px'}}>Bank Account Details</p>
                  <div style={{fontSize: '11px', color: '#4b5563', lineHeight: '1.8'}}>
                    <p style={{margin: '0 0 3px'}}><span style={{color: '#6b7280'}}>Account Name:</span> <span style={{color: '#1f2937'}}>{settings.bankDetails?.accountName}</span></p>
                    <p style={{margin: '0 0 3px'}}><span style={{color: '#6b7280'}}>A/C No:</span> <span style={{color: '#1f2937', fontFamily: 'monospace'}}>{settings.bankDetails?.accountNo}</span></p>
                    <p style={{margin: '0 0 3px'}}><span style={{color: '#6b7280'}}>Bank:</span> <span style={{color: '#1f2937'}}>{settings.bankDetails?.bankName}</span></p>
                    <p style={{margin: '0 0 3px'}}><span style={{color: '#6b7280'}}>Branch:</span> <span style={{color: '#1f2937'}}>{settings.bankDetails?.branch}</span></p>
                    <p style={{margin: 0}}><span style={{color: '#6b7280'}}>IFSC Code:</span> <span style={{color: '#1f2937', fontFamily: 'monospace'}}>{settings.bankDetails?.ifscCode}</span></p>
                  </div>
                </td>

                {/* Terms - Center */}
                <td style={{verticalAlign: 'top', width: '33%', paddingLeft: '12px', paddingRight: '12px'}}>
                  <p style={{fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#9ca3af', marginBottom: '8px'}}>Terms & Conditions</p>
                  <ol style={{fontSize: '11px', color: '#4b5563', lineHeight: '1.8', margin: 0, paddingLeft: '16px'}}>
                    {settings.termsAndConditions?.map((t, i) => <li key={i} style={{marginBottom: '3px'}}>{t}</li>)}
                  </ol>
                </td>

                {/* Totals - Right */}
                <td style={{verticalAlign: 'top', width: '34%', paddingLeft: '12px'}}>
                  <div style={{backgroundColor: '#f9fafb', borderRadius: '8px', padding: '16px'}}>
                    <table style={{width: '100%', borderCollapse: 'collapse'}}>
                      <tbody>
                        <tr>
                          <td style={{fontSize: '13px', color: '#6b7280', paddingBottom: '8px'}}>Subtotal</td>
                          <td style={{fontSize: '13px', color: '#1f2937', textAlign: 'right', paddingBottom: '8px'}}>{formatCurrency(subtotal)}</td>
                        </tr>
                        {Number(discount) > 0 && (
                          <tr>
                            <td style={{fontSize: '13px', color: '#6b7280', paddingBottom: '8px'}}>Discount</td>
                            <td style={{fontSize: '13px', color: '#dc2626', textAlign: 'right', paddingBottom: '8px'}}>-{formatCurrency(discount)}</td>
                          </tr>
                        )}
                        {gstEnabled && !interState && (
                          <>
                            <tr>
                              <td style={{fontSize: '13px', color: '#6b7280', paddingBottom: '8px'}}>CGST ({Number(gstRate)/2}%)</td>
                              <td style={{fontSize: '13px', color: '#1f2937', textAlign: 'right', paddingBottom: '8px'}}>{formatCurrency(gstData.cgst)}</td>
                            </tr>
                            <tr>
                              <td style={{fontSize: '13px', color: '#6b7280', paddingBottom: '8px'}}>SGST ({Number(gstRate)/2}%)</td>
                              <td style={{fontSize: '13px', color: '#1f2937', textAlign: 'right', paddingBottom: '8px'}}>{formatCurrency(gstData.sgst)}</td>
                            </tr>
                          </>
                        )}
                        {gstEnabled && interState && (
                          <tr>
                            <td style={{fontSize: '13px', color: '#6b7280', paddingBottom: '8px'}}>IGST ({gstRate}%)</td>
                            <td style={{fontSize: '13px', color: '#1f2937', textAlign: 'right', paddingBottom: '8px'}}>{formatCurrency(gstData.igst)}</td>
                          </tr>
                        )}
                        {rounded.diff !== 0 && (
                          <tr>
                            <td style={{fontSize: '13px', color: '#6b7280', paddingBottom: '8px'}}>Round off</td>
                            <td style={{fontSize: '13px', color: '#4b5563', textAlign: 'right', paddingBottom: '8px'}}>{rounded.diff > 0 ? '+' : ''}{rounded.diff.toFixed(2)}</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                    {/* Final total */}
                    <div style={{borderTop: '2px solid #111827', paddingTop: '8px', marginTop: '8px'}}>
                      <table style={{width: '100%', borderCollapse: 'collapse'}}>
                        <tbody>
                          <tr>
                            <td style={{fontSize: '15px', fontWeight: 'bold', color: '#111827'}}>TOTAL</td>
                            <td style={{fontSize: '15px', fontWeight: 'bold', color: '#111827', textAlign: 'right'}}>{formatCurrency(rounded.rounded)}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>

          {/* Make checks payable */}
          <p style={{fontSize: '11px', color: '#6b7280', marginBottom: '12px'}}>
            Make all checks payable to "<span style={{fontWeight: '600', color: '#374151'}}>{settings.companyName}</span>"
          </p>

          {/* Contact line */}
          <div style={{borderTop: '1px solid #f3f4f6', paddingTop: '16px', marginBottom: '24px'}}>
            <p style={{fontSize: '11px', color: '#9ca3af', textAlign: 'center', margin: 0}}>
              If you have any questions about this invoice, please contact{' '}
              <span style={{color: '#4b5563'}}>{settings.companyName}</span>,{' '}
              <span style={{color: '#4b5563'}}>{settings.phone}</span>
            </p>
          </div>

          {/* Thank You Footer */}
          <div style={{textAlign: 'center', padding: '16px 0', borderTop: '1px solid #e5e7eb'}}>
            <p style={{fontSize: '13px', fontWeight: '600', color: '#374151', letterSpacing: '0.05em', margin: 0}}>
              {settings.thankYouMessage || 'Thank You For Your Business!'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
