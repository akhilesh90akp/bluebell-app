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
      <div ref={pdfRef} className="print-doc" style={{backgroundColor: 'white', color: '#1f2937', fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif', maxWidth: '800px', margin: '0 auto', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'}}>
        <table style={{width: '100%', borderCollapse: 'collapse', padding: '0', margin: '0'}}>
          <tbody>
            {/* Row 1: Title */}
            <tr>
              <td colSpan="6" style={{textAlign: 'center', padding: '24px 24px 12px'}}>
                <span style={{fontSize: '20px', fontWeight: '800', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#652D90'}}>INVOICE</span>
                <div style={{height: '3px', width: '80px', margin: '8px auto 0', backgroundColor: '#652D90', borderRadius: '2px'}} />
              </td>
            </tr>

            {/* Row 2: Company address left, Logo + Bill Date + Invoice # right */}
            <tr>
              <td colSpan="3" style={{verticalAlign: 'top', padding: '12px 24px', fontSize: '11px', color: '#4b5563', lineHeight: '1.7'}}>
                <span style={{fontWeight: '700', fontSize: '13px', color: '#1f2937'}}>BLUE BELL</span><span style={{color: '#4b5563'}}> — Event Planners LLP</span><br/>
                297/6, Keerikkattil, Karukappilly PO,<br/>
                Kolenchery, Ernakulam, Kerala, 682311<br/>
                Ph: {settings.phone} | GSTIN: {settings.gstin}
              </td>
              <td colSpan="3" style={{verticalAlign: 'top', textAlign: 'right', padding: '12px 24px'}}>
                <img src={import.meta.env.BASE_URL + "logo-purple-horizontal.svg"} alt="Bluebell" style={{height: '40px', width: 'auto', marginLeft: 'auto', display: 'block'}} /><br/>
                <span style={{fontSize: '11px', color: '#4b5563', lineHeight: '2'}}>Bill Date: {formatDateReadable(invoiceDate)}</span><br/>
                <span style={{fontSize: '11px', color: '#4b5563'}}>Invoice #: {invoiceNo}</span>
              </td>
            </tr>

            {/* Row 3: Thin gray separator */}
            <tr>
              <td colSpan="6" style={{padding: '0 24px'}}>
                <div style={{height: '1px', backgroundColor: '#e5e7eb'}} />
              </td>
            </tr>

            {/* Row 4: Two boxes with purple top border */}
            <tr>
              <td style={{verticalAlign: 'top', padding: '16px 24px 12px', width: '60%'}} colSpan="3">
                <div style={{borderTop: '3px solid #652D90', padding: '12px 0 0'}}>
                  <span style={{fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#652D90'}}>BILL TO/ CLIENT</span><br/>
                  <span style={{fontSize: '14px', fontWeight: '700', color: '#1f2937', lineHeight: '2'}}>{billToName}</span><br/>
                  {event.clientPhone && <span style={{fontSize: '11px', color: '#6b7280'}}>Phone: {event.clientPhone}</span>}
                  {billToAddress && <><br/><span style={{fontSize: '11px', color: '#6b7280'}}>{billToAddress}</span></>}
                </div>
              </td>
              <td style={{verticalAlign: 'top', padding: '16px 24px 12px', width: '40%'}} colSpan="3">
                <div style={{borderTop: '3px solid #652D90', padding: '12px 0 0', fontSize: '11px', color: '#4b5563', lineHeight: '1.9'}}>
                  <span style={{fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#652D90'}}>EVENT DETAILS</span><br/>
                  {event.eventType && <>Event: {event.eventType}<br/></>}
                  {(event.mainEvent?.date || event.date) && <>Date: {formatDateReadable(event.mainEvent?.date || event.date)}<br/></>}
                  {(event.mainEvent?.location || event.eventLocation) && <>Venue: {event.mainEvent?.location || event.eventLocation}</>}
                </div>
              </td>
            </tr>

            {/* Row 5: Spacer */}
            <tr><td colSpan="6" style={{padding: '6px 0'}} /></tr>

            {/* Items grouped by Event */}
            {eventGroups.map((group) => {
              let slNo = 0;
              const groupSubtotal = group.items.reduce((sum, item) => {
                const key = `${group.id}::${item}`;
                const p = storedPrices[key] || storedPrices[item] || { qty: 1, rate: 0 };
                return sum + (p.qty * p.rate);
              }, 0);

              return (
                <React.Fragment key={group.id}>
                  {/* Event group header (only if multiple groups) */}
                  {eventGroups.length > 1 && (
                    <tr>
                      <td colSpan="6" style={{padding: '12px 24px 6px'}}>
                        <span style={{fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#652D90'}}>
                          {group.name}{group.date ? ` — ${formatDateReadable(group.date)}` : ''}{group.location ? `, ${group.location}` : ''}
                        </span>
                        <div style={{height: '2px', marginTop: '6px', backgroundColor: '#652D90', opacity: 0.3, borderRadius: '1px'}} />
                      </td>
                    </tr>
                  )}

                  {/* Row 6: Table headers */}
                  <tr style={{backgroundColor: '#f5f0fa'}}>
                    <th style={{padding: '8px 8px 8px 24px', textAlign: 'left', fontWeight: '600', color: '#4b5563', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em', width: '40px'}}>No.</th>
                    <th style={{padding: '8px 8px', textAlign: 'left', fontWeight: '600', color: '#4b5563', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em', width: '90px'}}>SAC CODE</th>
                    <th style={{padding: '8px 8px', textAlign: 'left', fontWeight: '600', color: '#4b5563', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em'}}>DESCRIPTION</th>
                    <th style={{padding: '8px 8px', textAlign: 'center', fontWeight: '600', color: '#4b5563', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em', width: '50px'}}>QTY</th>
                    <th style={{padding: '8px 8px', textAlign: 'right', fontWeight: '600', color: '#4b5563', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em', width: '90px'}}>PRICE</th>
                    <th style={{padding: '8px 8px 8px 8px', textAlign: 'right', fontWeight: '600', color: '#4b5563', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em', width: '100px', paddingRight: '24px'}}>AMOUNT</th>
                  </tr>

                  {/* Item rows */}
                  {group.items.map((item) => {
                    slNo++;
                    const key = `${group.id}::${item}`;
                    const p = storedPrices[key] || storedPrices[item] || { qty: 1, rate: 0 };
                    return (
                      <tr key={item} style={{borderBottom: '1px solid #f0f0f0'}}>
                        <td style={{padding: '10px 8px 10px 24px', color: '#6b7280', fontSize: '12px'}}>{slNo}</td>
                        <td style={{padding: '10px 8px', color: '#6b7280', fontFamily: 'monospace', fontSize: '11px'}}>{DEFAULT_SAC_CODE}</td>
                        <td style={{padding: '10px 8px', color: '#1f2937', fontSize: '12px'}}>{item}</td>
                        <td style={{padding: '10px 8px', textAlign: 'center', color: '#4b5563', fontSize: '12px'}}>{p.qty}</td>
                        <td style={{padding: '10px 8px', textAlign: 'right', color: '#4b5563', fontSize: '12px'}}>{formatCurrency(p.rate)}</td>
                        <td style={{padding: '10px 8px', textAlign: 'right', fontWeight: '600', color: '#1f2937', fontSize: '12px', paddingRight: '24px'}}>{formatCurrency(p.qty * p.rate)}</td>
                      </tr>
                    );
                  })}

                  {/* Group subtotal (only if multiple groups) */}
                  {eventGroups.length > 1 && (
                    <tr>
                      <td colSpan="6" style={{textAlign: 'right', padding: '10px 24px 16px'}}>
                        <span style={{fontSize: '11px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', marginRight: '16px'}}>Subtotal</span>
                        <span style={{fontSize: '14px', fontWeight: '700', color: '#1f2937'}}>{formatCurrency(groupSubtotal)}</span>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}

            {/* Spacer before summary */}
            <tr><td colSpan="6" style={{padding: '8px 0'}} /></tr>

            {/* Summary Box */}
            <tr>
              <td colSpan="6" style={{padding: '0 24px'}}>
                <table style={{width: '100%', borderCollapse: 'collapse', border: '1px solid #e5e7eb', borderRadius: '6px', overflow: 'hidden'}}>
                  <tbody>
                    <tr style={{backgroundColor: '#f5f0fa'}}>
                      <td colSpan="2" style={{padding: '8px 16px', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#652D90'}}>SUMMARY</td>
                    </tr>
                    {eventGroups.map((group) => {
                      const groupTotal = group.items.reduce((sum, item) => {
                        const key = `${group.id}::${item}`;
                        const p = storedPrices[key] || storedPrices[item] || { qty: 1, rate: 0 };
                        return sum + (p.qty * p.rate);
                      }, 0);
                      return (
                        <tr key={group.id} style={{borderBottom: '1px solid #f3f4f6'}}>
                          <td style={{fontSize: '12px', color: '#4b5563', padding: '8px 16px'}}>{group.name}</td>
                          <td style={{fontSize: '12px', color: '#1f2937', fontWeight: '500', textAlign: 'right', padding: '8px 16px'}}>{formatCurrency(groupTotal)}</td>
                        </tr>
                      );
                    })}
                    <tr style={{borderTop: '1px solid #e5e7eb'}}>
                      <td style={{fontSize: '12px', color: '#6b7280', padding: '8px 16px'}}>Sub Total</td>
                      <td style={{fontSize: '12px', color: '#1f2937', fontWeight: '500', textAlign: 'right', padding: '8px 16px'}}>{formatCurrency(subtotal)}</td>
                    </tr>
                    {Number(discount) > 0 && (
                      <tr style={{borderTop: '1px solid #f3f4f6'}}>
                        <td style={{fontSize: '12px', color: '#6b7280', padding: '6px 16px'}}>Discount</td>
                        <td style={{fontSize: '12px', color: '#dc2626', textAlign: 'right', padding: '6px 16px'}}>-{formatCurrency(discount)}</td>
                      </tr>
                    )}
                    {gstEnabled && !interState && (
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
                    {gstEnabled && interState && (
                      <tr style={{borderTop: '1px solid #f3f4f6'}}>
                        <td style={{fontSize: '12px', color: '#6b7280', padding: '6px 16px'}}>IGST ({gstRate}%)</td>
                        <td style={{fontSize: '12px', color: '#1f2937', textAlign: 'right', padding: '6px 16px'}}>{formatCurrency(gstData.igst)}</td>
                      </tr>
                    )}
                    <tr style={{borderTop: '2px solid #652D90'}}>
                      <td style={{fontSize: '16px', fontWeight: '700', color: '#1f2937', padding: '12px 16px'}}>GRAND TOTAL</td>
                      <td style={{fontSize: '16px', fontWeight: '700', color: '#652D90', textAlign: 'right', padding: '12px 16px'}}>{formatCurrency(rounded.rounded)}</td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>

            {/* Spacer */}
            <tr><td colSpan="6" style={{padding: '8px 0'}} /></tr>

            {/* Bank + Terms side by side */}
            <tr>
              <td colSpan="3" style={{verticalAlign: 'top', padding: '0 12px 0 24px', width: '50%'}}>
                <div style={{backgroundColor: '#f3f4f6', borderRadius: '4px', overflow: 'hidden'}}>
                  <div style={{padding: '6px 12px', backgroundColor: '#e5e7eb'}}>
                    <span style={{fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#4b5563'}}>BANK ACCOUNT DETAILS</span>
                  </div>
                  <div style={{padding: '10px 12px', fontSize: '11px', color: '#4b5563', lineHeight: '1.9'}}>
                    Account Name: <strong>{settings.bankDetails?.accountName}</strong><br/>
                    A/C No: <strong style={{fontFamily: 'monospace'}}>{settings.bankDetails?.accountNo}</strong><br/>
                    Bank: {settings.bankDetails?.bankName}<br/>
                    Branch: {settings.bankDetails?.branch}<br/>
                    IFSC: <strong style={{fontFamily: 'monospace'}}>{settings.bankDetails?.ifscCode}</strong>
                  </div>
                </div>
              </td>
              <td colSpan="3" style={{verticalAlign: 'top', padding: '0 24px 0 12px', width: '50%'}}>
                <div style={{backgroundColor: '#f3f4f6', borderRadius: '4px', overflow: 'hidden'}}>
                  <div style={{padding: '6px 12px', backgroundColor: '#e5e7eb'}}>
                    <span style={{fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#4b5563'}}>TERMS & CONDITIONS</span>
                  </div>
                  <div style={{padding: '10px 12px', fontSize: '11px', color: '#4b5563', lineHeight: '1.6'}}>
                    {settings.termsAndConditions?.map((t, i) => (
                      <div key={i} style={{padding: '2px 0'}}>{i + 1}. {t}</div>
                    ))}
                  </div>
                </div>
              </td>
            </tr>

            {/* Spacer */}
            <tr><td colSpan="6" style={{padding: '8px 0'}} /></tr>

            {/* Make checks payable */}
            <tr>
              <td colSpan="6" style={{padding: '12px 24px 2px', fontSize: '11px', color: '#6b7280', borderTop: '1px solid #e5e7eb', textAlign: 'center'}}>
                Make all checks payable to "<span style={{fontWeight: '600', color: '#1f2937'}}>{settings.companyName}</span>"
              </td>
            </tr>

            {/* Contact line */}
            <tr>
              <td colSpan="6" style={{padding: '2px 24px 12px', textAlign: 'center'}}>
                <span style={{fontSize: '11px', color: '#6b7280'}}>
                  If you have any questions about this invoice, please contact{' '}
                  <span style={{color: '#4b5563'}}>{settings.companyName}</span>,{' '}
                  <span style={{color: '#4b5563'}}>{settings.phone}</span>
                </span>
              </td>
            </tr>

            {/* Thank You Footer */}
            <tr>
              <td colSpan="6" style={{textAlign: 'center', padding: '16px 24px 24px', borderTop: '1px solid #e5e7eb'}}>
                <span style={{fontSize: '14px', fontWeight: '700', color: '#1f2937', letterSpacing: '0.05em'}}>
                  {settings.thankYouMessage || 'Thank You For Your Business!'}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
