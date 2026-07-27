/**
 * BillGenerator - Invoice/bill document builder
 *
 * Generates a professional GST-compliant invoice for completed events.
 * Supports configurable invoice number, discount, GST (intra/inter-state),
 * and round-off. Includes print and WhatsApp sharing capabilities.
 */
import React, { useState, useMemo } from 'react';
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

  const items = event?.items || [];
  const itemPrices = event?.itemPrices || {};

  // Calculate subtotal from all item prices
  const subtotal = useMemo(() =>
    items.reduce((s, item) => {
      const p = itemPrices[item] || { qty: 1, rate: 0 };
      return s + (p.qty * p.rate);
    }, 0)
  , [items, itemPrices]);

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

  /** Triggers the browser print dialog */
  const handlePrint = () => window.print();

  /** Generates a formatted WhatsApp message with invoice details */
  const generateWhatsAppMsg = () => {
    let msg = `*INVOICE #${invoiceNo}*\n`;
    msg += `Date: ${formatDateReadable(invoiceDate)}\n`;
    msg += `From: ${settings.companyName}\n`;
    msg += `To: ${billToName}\n\n`;
    msg += `*Items:*\n`;
    items.forEach((item, i) => {
      const p = itemPrices[item] || { qty: 1, rate: 0 };
      msg += `${i + 1}. ${item} - ₹${(p.qty * p.rate).toLocaleString('en-IN')}\n`;
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
      <div className="bg-white rounded-xl shadow-lg text-gray-800 overflow-hidden print-a4" style={{minWidth: "700px"}}>
        <div className="p-8 sm:p-10">

          {/* INVOICE title at top center */}
          <div className="text-center mb-6">
            <h1 className="text-2xl font-extrabold tracking-[0.15em] uppercase text-gray-900">INVOICE</h1>
            <div className="h-[2px] w-20 mx-auto mt-2 bg-gray-800" />
          </div>

          {/* Logo (left) | Company Address (right) */}
          <div className="flex items-start justify-between mb-8">
            <div className="flex-shrink-0">
              <img src="/logo-purple-horizontal.svg" alt="Bluebell Event Planners" className="h-12 sm:h-14 w-auto object-contain" />
            </div>
            <div className="text-right text-xs text-gray-700 leading-[1.6]">
              <p className="font-bold text-sm text-gray-900">BLUE BELL</p>
              <p>Event Planners LLP</p>
              <p>297/6, Keerikkattil, Karukappilly PO,</p>
              <p>Kolenchery, Ernakulam, Kerala, 682311</p>
              <p>Ph: {settings.phone}</p>
              {settings.gstin && <p>GSTIN/UIN: {settings.gstin}</p>}
            </div>
          </div>

          {/* Thin separator */}
          <div className="border-t border-gray-200 mb-6" />

          {/* Invoice details row */}
          <div className="flex justify-between items-start mb-8">
            {/* Bill To */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Bill To</p>
              <p className="text-base font-semibold text-gray-900">{billToName}</p>
              {billToAddress && <p className="text-sm text-gray-600 whitespace-pre-line mt-0.5">{billToAddress}</p>}
            </div>
            {/* Date & Invoice # */}
            <div className="text-right space-y-1">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Date</p>
                <p className="text-sm font-medium text-gray-800">{formatDateReadable(invoiceDate)}</p>
              </div>
              <div className="mt-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Invoice #</p>
                <p className="text-sm font-medium text-gray-800">{invoiceNo}</p>
              </div>
            </div>
          </div>

          {/* Items Table */}
          <div className="mb-8">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-gray-900">
                  <th className="py-3 px-2 text-left font-semibold text-gray-700 w-10">No.</th>
                  <th className="py-3 px-2 text-left font-semibold text-gray-700 w-24">SAC CODE</th>
                  <th className="py-3 px-2 text-left font-semibold text-gray-700">DESCRIPTION</th>
                  <th className="py-3 px-2 text-center font-semibold text-gray-700 w-14">QTY</th>
                  <th className="py-3 px-2 text-right font-semibold text-gray-700 w-24">PRICE</th>
                  <th className="py-3 px-2 text-right font-semibold text-gray-700 w-28">AMOUNT</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => {
                  const p = itemPrices[item] || { qty: 1, rate: 0 };
                  return (
                    <tr key={item} className="border-b border-gray-100 hover:bg-gray-50/50">
                      <td className="py-3 px-2 text-gray-500">{i + 1}</td>
                      <td className="py-3 px-2 text-gray-500 font-mono text-xs">{DEFAULT_SAC_CODE}</td>
                      <td className="py-3 px-2 text-gray-800">{item}</td>
                      <td className="py-3 px-2 text-center text-gray-700">{p.qty}</td>
                      <td className="py-3 px-2 text-right text-gray-700">{formatCurrency(p.rate)}</td>
                      <td className="py-3 px-2 text-right font-medium text-gray-900">{formatCurrency(p.qty * p.rate)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Totals + Bank/Terms section */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 mb-8">
            {/* Bank Details - Left */}
            <div className="md:col-span-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Bank Account Details</p>
              <div className="text-xs text-gray-600 space-y-1 leading-relaxed">
                <p><span className="text-gray-500">Account Name:</span> <span className="text-gray-800">{settings.bankDetails?.accountName}</span></p>
                <p><span className="text-gray-500">A/C No:</span> <span className="text-gray-800 font-mono">{settings.bankDetails?.accountNo}</span></p>
                <p><span className="text-gray-500">Bank:</span> <span className="text-gray-800">{settings.bankDetails?.bankName}</span></p>
                <p><span className="text-gray-500">Branch:</span> <span className="text-gray-800">{settings.bankDetails?.branch}</span></p>
                <p><span className="text-gray-500">IFSC Code:</span> <span className="text-gray-800 font-mono">{settings.bankDetails?.ifscCode}</span></p>
              </div>
            </div>

            {/* Terms - Center */}
            <div className="md:col-span-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Terms & Conditions</p>
              <ol className="text-xs text-gray-600 space-y-1 list-decimal pl-4 leading-relaxed">
                {settings.termsAndConditions?.map((t, i) => <li key={i}>{t}</li>)}
              </ol>
            </div>

            {/* Totals - Right */}
            <div className="md:col-span-4">
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Subtotal</span>
                  <span className="text-gray-800">{formatCurrency(subtotal)}</span>
                </div>
                {Number(discount) > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Discount</span>
                    <span className="text-red-600">-{formatCurrency(discount)}</span>
                  </div>
                )}
                {gstEnabled && !interState && (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">CGST ({Number(gstRate)/2}%)</span>
                      <span className="text-gray-800">{formatCurrency(gstData.cgst)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">SGST ({Number(gstRate)/2}%)</span>
                      <span className="text-gray-800">{formatCurrency(gstData.sgst)}</span>
                    </div>
                  </>
                )}
                {gstEnabled && interState && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">IGST ({gstRate}%)</span>
                    <span className="text-gray-800">{formatCurrency(gstData.igst)}</span>
                  </div>
                )}
                {rounded.diff !== 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Round off</span>
                    <span className="text-gray-600">{rounded.diff > 0 ? '+' : ''}{rounded.diff.toFixed(2)}</span>
                  </div>
                )}
                {/* Final total */}
                <div className="border-t-2 border-gray-900 pt-2 mt-2">
                  <div className="flex justify-between">
                    <span className="text-base font-bold text-gray-900">TOTAL</span>
                    <span className="text-base font-bold text-gray-900">{formatCurrency(rounded.rounded)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Make checks payable */}
          <p className="text-xs text-gray-500 mb-3">
            Make all checks payable to "<span className="font-semibold text-gray-700">{settings.companyName}</span>"
          </p>

          {/* Contact line */}
          <div className="border-t border-gray-100 pt-4 mb-6">
            <p className="text-xs text-gray-400 text-center">
              If you have any questions about this invoice, please contact{' '}
              <span className="text-gray-600">{settings.companyName}</span>,{' '}
              <span className="text-gray-600">{settings.phone}</span>
            </p>
          </div>

          {/* Thank You Footer */}
          <div className="text-center py-4 border-t border-gray-200">
            <p className="text-sm font-semibold text-gray-700 tracking-wide">
              {settings.thankYouMessage || 'Thank You For Your Business!'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
