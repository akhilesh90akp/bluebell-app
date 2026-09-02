/**
 * Helpers - Utility functions
 *
 * Pure utility functions used across the application for formatting,
 * calculations, link generation, and ID creation.
 */

// ============================================================
// FORMATTING
// ============================================================

/**
 * Formats a number as Indian Rupee currency.
 * @param {number} amt - Amount to format
 * @returns {string} Formatted currency string (e.g., "₹1,234.56")
 */
export const formatCurrency = (amt) => {
  if (!amt && amt !== 0) return '₹0.00';
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(amt);
};

/**
 * Formats a date string as DD-MM-YY.
 * @param {string} d - ISO date string
 * @returns {string} Formatted date or empty string
 */
export const formatDate = (d) => {
  if (!d) return '';
  const dt = new Date(d);
  return `${String(dt.getDate()).padStart(2,'0')}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getFullYear()).slice(2)}`;
};

/**
 * Formats a date in a human-readable format (e.g., "15 Jan 2025").
 * @param {string} d - ISO date string
 * @returns {string} Readable date or empty string
 */
export const formatDateReadable = (d) => {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

/**
 * Calculates the number of days until a given date.
 * @param {string} d - ISO date string for the target date
 * @returns {number|null} Days remaining (negative if past), or null if no date
 */
export const daysUntil = (d) => {
  if (!d) return null;
  const ev = new Date(d); ev.setHours(0,0,0,0);
  const now = new Date(); now.setHours(0,0,0,0);
  // 86400000 ms = 1 day
  return Math.ceil((ev - now) / 86400000);
};

// ============================================================
// CALCULATIONS
// ============================================================

/**
 * Calculates GST breakdown (CGST/SGST or IGST for inter-state).
 * @param {number} subtotal - Base amount before tax
 * @param {number} rate - GST percentage (default 18)
 * @param {boolean} interState - If true, returns IGST instead of split CGST/SGST
 * @returns {object} Object with cgst, sgst, igst, tax, and total fields
 */
export const calcGST = (subtotal, rate = 18, interState = false) => {
  if (!rate) return { cgst: 0, sgst: 0, igst: 0, tax: 0, total: subtotal };
  const tax = (subtotal * rate) / 100;
  if (interState) return { cgst: 0, sgst: 0, igst: tax, tax, total: subtotal + tax };
  return { cgst: tax/2, sgst: tax/2, igst: 0, tax, total: subtotal + tax };
};

/**
 * Rounds an amount to the nearest integer and returns the difference.
 * @param {number} amt - Amount to round
 * @returns {object} Object with rounded value and diff (rounding adjustment)
 */
export const roundOff = (amt) => {
  const r = Math.round(amt);
  return { rounded: r, diff: +(r - amt).toFixed(2) };
};

// ============================================================
// ID & LINK GENERATION
// ============================================================

/**
 * Generates a unique ID using timestamp + random string.
 * @returns {string} Unique identifier
 */
export const genId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 9);

/**
 * Generates a WhatsApp deep link for sending a message.
 * @param {string} phone - Phone number (auto-prefixes with 91 if needed)
 * @param {string} msg - Pre-filled message text
 * @returns {string} WhatsApp URL
 */
export const waLink = (phone, msg = '') => {
  const p = phone.replace(/\D/g, '');
  return `https://wa.me/${p.startsWith('91') ? p : '91'+p}?text=${encodeURIComponent(msg)}`;
};

/**
 * Generates a tel: link for phone calls.
 * @param {string} phone - Phone number
 * @returns {string} Telephone URL
 */
export const telLink = (phone) => `tel:+91${phone.replace(/\D/g, '')}`;

/**
 * Generates a formatted invoice number based on financial year.
 * Format: PREFIX-B2CYY(YY+1)-NNN (e.g., BB-B2C2526-001)
 * @param {string} prefix - Invoice prefix (default "BB")
 * @param {number} existingCount - Number of existing invoices for sequential numbering
 * @returns {string} Formatted invoice number
 */
export const genInvoiceNo = (prefix = 'BB', existingCount = 0) => {
  const now = new Date();
  // Financial year starts in April (month index 3)
  const fy1 = now.getMonth() >= 3 ? now.getFullYear().toString().slice(2) : (now.getFullYear()-1).toString().slice(2);
  const fy2 = (parseInt(fy1)+1).toString();
  return `${prefix}-B2C${fy1}${fy2}-${String(existingCount+1).padStart(3,'0')}`;
};

// ============================================================
// EVENT DATE HELPERS
// ============================================================

/**
 * Gets all dates from an event (main + sub-events) with labels.
 * Returns array sorted by date ascending: [{ date, label, isPast }]
 * @param {object} ev - Event object
 * @returns {Array} Array of date objects with metadata
 */
export const getAllEventDates = (ev) => {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const dates = [];

  if (ev.mainEvent?.date) {
    const d = new Date(ev.mainEvent.date);
    d.setHours(0, 0, 0, 0);
    dates.push({
      date: ev.mainEvent.date,
      label: ev.mainEvent.name || 'Main Event',
      isPast: d < now,
      isMain: true,
    });
  } else if (ev.date) {
    const d = new Date(ev.date);
    d.setHours(0, 0, 0, 0);
    dates.push({
      date: ev.date,
      label: ev.eventType || 'Event',
      isPast: d < now,
      isMain: true,
    });
  }

  if (ev.subEvents) {
    ev.subEvents.forEach(s => {
      if (s.date) {
        const d = new Date(s.date);
        d.setHours(0, 0, 0, 0);
        dates.push({
          date: s.date,
          label: s.name || 'Sub Event',
          isPast: d < now,
          isMain: false,
        });
      }
    });
  }

  // Sort by date ascending
  dates.sort((a, b) => new Date(a.date) - new Date(b.date));
  return dates;
};

/**
 * Gets the "active" date for sorting — the next upcoming date (sub or main).
 * If all dates are past, returns the most recent (latest) past date.
 * @param {object} ev - Event object
 * @returns {string} The active date string for sorting
 */
export const getActiveDate = (ev) => {
  const dates = getAllEventDates(ev);
  if (dates.length === 0) return ev.createdAt || '';

  // Find first upcoming date (not past)
  const upcoming = dates.find(d => !d.isPast);
  if (upcoming) return upcoming.date;

  // All past — return the most recent one (last in sorted array)
  return dates[dates.length - 1].date;
};

/**
 * Sorts events by active date: upcoming soonest first, then past most recent first.
 * Draft/Confirmed tabs: nearest upcoming date rises to the top (e.g. Sep 3
 * before Sep 4), with overdue events grouped afterward, most recently
 * overdue first. Completed tab is normally all-past dates, so this same
 * rule naturally shows "most recently completed" at the top there too.
 * @param {Array} events - Array of event objects
 * @returns {Array} Sorted events array
 */
export const sortByActiveDate = (events) => {
  const now = Date.now();
  return [...events].sort((a, b) => {
    const dateA = new Date(getActiveDate(a));
    const dateB = new Date(getActiveDate(b));
    const diffA = dateA - now;
    const diffB = dateB - now;
    // Both upcoming: soonest first
    if (diffA >= 0 && diffB >= 0) return diffA - diffB;
    // Both past: most recent first
    if (diffA < 0 && diffB < 0) return diffB - diffA;
    // One upcoming, one past: upcoming always ranks above past
    return diffA >= 0 ? -1 : 1;
  });
};
