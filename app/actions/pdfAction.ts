"use server";

import pdfParse from "pdf-parse";

export async function parseInvoicePdf(base64Data: string) {
  try {
    // Gmail returns base64url format
    const base64 = base64Data.replace(/-/g, '+').replace(/_/g, '/');
    const buffer = Buffer.from(base64, 'base64');
    
    // Parse the PDF
    const data = await pdfParse(buffer);
    const text = data.text;
    
    // Attempt basic pattern extraction for structured CSV fields
    const amountMatch = text.match(/(?:Total|Amount Due|Amount|Total Amount)[:$\s]+([0-9,.]+)/i);
    const dateMatch = text.match(/(?:Date)[:\s]+([0-9]{2,4}[-/][0-9]{2,4}[-/][0-9]{2,4})/i) 
      || text.match(/([0-9]{1,2}\s+[A-Za-z]{3,}\s+[0-9]{4})/); 
    const invoiceMatch = text.match(/(?:Invoice|Inv|#|Invoice No)[:\s.#]*([a-zA-Z0-9-]+)/i);
    
    return {
      success: true,
      text: text,
      invoiceData: {
        invoiceNumber: invoiceMatch ? invoiceMatch[1].trim() : 'N/A',
        date: dateMatch ? dateMatch[1].trim() : 'N/A',
        amount: amountMatch ? amountMatch[1].trim() : 'N/A'
      }
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
