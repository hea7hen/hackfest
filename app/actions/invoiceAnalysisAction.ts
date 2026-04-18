"use server";

export interface ExtractedInvoiceData {
  vendor?: string;
  amount?: number;
  discount?: number;
  gst_amount?: number;
  gst_rate?: number;
  tax_amount?: number;
  category?: string;
  date?: string;
  description?: string;
  invoice_number?: string;
  itc_eligible?: boolean;
  sac_code?: string;
  [key: string]: any;
}

function extractAmount(text: string, pattern: RegExp): number | undefined {
  const match = text.match(pattern);
  if (match && match[1]) {
    const numStr = match[1].replace(/[^0-9.]/g, '');
    return parseFloat(numStr) || undefined;
  }
  return undefined;
}

function extractString(text: string, pattern: RegExp): string | undefined {
  const match = text.match(pattern);
  return match ? match[1]?.trim() : undefined;
}

export async function analyzeInvoiceSimple(text: string, fileName: string): Promise<ExtractedInvoiceData> {
  const normalizedText = text.replace(/\r/g, '');
  const lines = normalizedText
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const extracted: ExtractedInvoiceData = {};

  // Extract vendor/company name (usually first significant line)
  const firstLine = lines.find(l => l.length > 3 && !l.match(/^\d+/) && l.match(/[A-Za-z]/));
  if (firstLine) {
    extracted.vendor = firstLine;
  }

  // Extract invoice number
  extracted.invoice_number = extractString(
    normalizedText,
    /(?:Invoice(?:\s+No|\s+Number)?|Inv(?:oice)?|Bill(?:\s+No|\s+Number)?|Reference|Ref\s+No)[\s:._#\-]*([A-Z0-9\-\/]+)/i
  );

  // Extract invoice date
  const datePattern = /(?:Invoice\s+Date|Bill\s+Date|Date|Dated)[\s:._\-]*([0-9]{1,2}[-\/][0-9]{1,2}[-\/][0-9]{2,4}|[0-9]{1,2}\s+[A-Za-z]{3,}\s+[0-9]{4})/i;
  extracted.date = extractString(normalizedText, datePattern);

  // Extract total amount
  extracted.amount = extractAmount(
    normalizedText,
    /(?:Grand\s+Total|Total\s+Amount|Amount\s+Due|Net\s+Amount|Total|Amount)[\s:$₹RsINR,.]*([0-9][0-9,]*\.?[0-9]*)/i
  );

  // Extract GST amount
  extracted.gst_amount = extractAmount(
    normalizedText,
    /(?:GST\s+Amount|CGST|SGST|IGST|Total\s+GST|GST)[\s:$₹RsINR,.]*([0-9][0-9,]*\.?[0-9]*)/i
  );

  // Extract GST rate
  extracted.gst_rate = extractAmount(
    normalizedText,
    /(?:GST\s+Rate|SGST\s+Rate|CGST\s+Rate|Tax\s+Rate)[\s:@%]*([0-9]+(?:\.[0-9]{1,2})?)/i
  );

  // Extract discount
  extracted.discount = extractAmount(
    normalizedText,
    /(?:Discount|Discount\s+Amount)[\s:$₹RsINR,.]*([0-9][0-9,]*\.?[0-9]*)/i
  );

  // Extract other tax amounts
  extracted.tax_amount = extractAmount(
    normalizedText,
    /(?:Tax\s+Amount|Tax|VAT|VATE|Service\s+Tax)[\s:$₹RsINR,.]*([0-9][0-9,]*\.?[0-9]*)/i
  );

  // Detect category from vendor name or description
  const vendorLower = (extracted.vendor || fileName).toLowerCase();
  if (vendorLower.includes('amazon') || vendorLower.includes('flipkart') || vendorLower.includes('store') || vendorLower.includes('retail')) {
    extracted.category = 'shopping';
  } else if (vendorLower.includes('aws') || vendorLower.includes('cloud') || vendorLower.includes('software') || vendorLower.includes('saas')) {
    extracted.category = 'business';
  } else if (vendorLower.includes('hotel') || vendorLower.includes('restaurant') || vendorLower.includes('food')) {
    extracted.category = 'food';
  } else if (vendorLower.includes('fuel') || vendorLower.includes('petrol') || vendorLower.includes('uber') || vendorLower.includes('taxi')) {
    extracted.category = 'transport';
  } else if (vendorLower.includes('hospital') || vendorLower.includes('medical') || vendorLower.includes('pharmacy')) {
    extracted.category = 'medical';
  } else if (vendorLower.includes('electricity') || vendorLower.includes('water') || vendorLower.includes('gas')) {
    extracted.category = 'utilities';
  } else if (vendorLower.includes('rent') || vendorLower.includes('landlord')) {
    extracted.category = 'rent';
  } else {
    extracted.category = 'other';
  }

  // Check for GST eligibility (Indian tax deduction)
  const hasGstin = /GSTIN[\s:.-]*([0-9A-Z]{15})/i.test(normalizedText);
  const hasGst = !!(extracted.gst_amount || extracted.gst_rate);
  extracted.itc_eligible = hasGstin || hasGst;

  // Extract GSTIN if present
  const gstinMatch = normalizedText.match(/GSTIN[\s:.-]*([0-9A-Z]{15})/i);
  if (gstinMatch) {
    extracted.sac_code = gstinMatch[1];
  }

  // Set description from vendor name
  extracted.description = extracted.vendor || fileName;

  return extracted;
}
