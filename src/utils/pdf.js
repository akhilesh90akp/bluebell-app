/**
 * PDF Generator utility
 * Uses html2pdf.js to generate proper A4 PDFs from any element
 * Works on both mobile and desktop without print dialog issues
 */
import html2pdf from 'html2pdf.js';

/**
 * Generate and download a PDF from an HTML element
 * @param {HTMLElement} element - The DOM element to convert
 * @param {string} filename - Output filename (without .pdf)
 */
export const generatePDF = (element, filename = 'document') => {
  if (!element) return;

  const opt = {
    margin: [10, 8, 10, 8], // top, left, bottom, right in mm
    filename: `${filename}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: {
      scale: 2,
      useCORS: true,
      letterRendering: true,
      width: 794, // A4 width at 96dpi
    },
    jsPDF: {
      unit: 'mm',
      format: 'a4',
      orientation: 'portrait',
    },
    pagebreak: { mode: ['avoid-all', 'css', 'legacy'] },
  };

  html2pdf().set(opt).from(element).save();
};
