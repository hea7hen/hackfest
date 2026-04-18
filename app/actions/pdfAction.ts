"use server";

// Import implementation directly — `pdf-parse` main `index.js` runs a debug file read when
// `!module.parent` (true under Next.js bundling), causing ENOENT for ./test/data/05-versions-space.pdf
import pdfParse from "pdf-parse/lib/pdf-parse.js";

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Failed to parse PDF";
}

export type ParsedPdfFields = {
  invoiceNumber: string | null;
  invoiceDate: string | null;
  dueDate: string | null;
  amount: string | null;
  taxAmount: string | null;
  vendorName: string | null;
  gstin: string | null;
  pan: string | null;
  poNumber: string | null;
};

export type ParsedPdfDocument = {
  pageCount: number;
  fullText: string;
  lines: string[];
  extractedFields: ParsedPdfFields;
};

function cleanMatch(match: RegExpMatchArray | null, index = 1) {
  return match?.[index]?.trim() ?? null;
}

function extractPdfFields(text: string): ParsedPdfFields {
  const normalizedText = text.replace(/\r/g, "");
  const lines = normalizedText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const vendorName = lines[0] ?? null;

  const invoiceNumber =
    cleanMatch(normalizedText.match(/(?:Invoice(?:\s+No|\s+Number)?|Inv(?:oice)?|Bill(?:\s+No|\s+Number)?)[\s:._#-]*([A-Z0-9/-]+)/i)) ??
    cleanMatch(normalizedText.match(/\b(?:Ref(?:erence)?\s+No)[\s:._#-]*([A-Z0-9/-]+)/i));

  const invoiceDate =
    cleanMatch(normalizedText.match(/(?:Invoice\s+Date|Bill\s+Date|Date)[\s:._-]*([0-9]{1,2}[-/][0-9]{1,2}[-/][0-9]{2,4})/i)) ??
    cleanMatch(normalizedText.match(/(?:Invoice\s+Date|Bill\s+Date|Date)[\s:._-]*([0-9]{1,2}\s+[A-Za-z]{3,}\s+[0-9]{4})/i));

  const dueDate =
    cleanMatch(normalizedText.match(/(?:Due\s+Date|Payment\s+Due)[\s:._-]*([0-9]{1,2}[-/][0-9]{1,2}[-/][0-9]{2,4})/i)) ??
    cleanMatch(normalizedText.match(/(?:Due\s+Date|Payment\s+Due)[\s:._-]*([0-9]{1,2}\s+[A-Za-z]{3,}\s+[0-9]{4})/i));

  const amount =
    cleanMatch(normalizedText.match(/(?:Grand\s+Total|Total\s+Amount|Amount\s+Due|Net\s+Amount|Total)[\s:$RsINR,.]*([0-9][0-9,]*\.?[0-9]*)/i)) ??
    cleanMatch(normalizedText.match(/\bINR\s*([0-9][0-9,]*\.?[0-9]*)/i));

  const taxAmount =
    cleanMatch(normalizedText.match(/(?:GST|Tax(?:\s+Amount)?|CGST|SGST|IGST)[\s:$RsINR,.]*([0-9][0-9,]*\.?[0-9]*)/i));

  const gstin = cleanMatch(normalizedText.match(/\bGSTIN[\s:.-]*([0-9A-Z]{15})\b/i));
  const pan = cleanMatch(normalizedText.match(/\bPAN[\s:.-]*([A-Z]{5}[0-9]{4}[A-Z])\b/i));
  const poNumber = cleanMatch(normalizedText.match(/\b(?:PO\s+No|PO\s+Number|Purchase\s+Order)[\s:._#-]*([A-Z0-9/-]+)\b/i));

  return {
    invoiceNumber,
    invoiceDate,
    dueDate,
    amount,
    taxAmount,
    vendorName,
    gstin,
    pan,
    poNumber,
  };
}

export async function parseInvoicePdf(base64Data: string) {
  try {
    const base64 = base64Data.replace(/-/g, "+").replace(/_/g, "/");
    const buffer = Buffer.from(base64, "base64");
    
    // Natively extract using the rock-solid pdf-parse library
    // This avoids python subprocess issues and Next.js turbopack worker errors completely.
    const extracted = await pdfParse(buffer);
    const text = extracted.text.trim();
    
    const lines = text
      .split("\n")
      .map((line: string) => line.trim())
      .filter(Boolean);

    const document: ParsedPdfDocument = {
      pageCount: extracted.numpages,
      fullText: text,
      lines,
      extractedFields: extractPdfFields(text),
    };

    return {
      success: true,
      document,
      invoiceData: {
        invoiceNumber: document.extractedFields.invoiceNumber ?? "N/A",
        date: document.extractedFields.invoiceDate ?? "N/A",
        amount: document.extractedFields.amount ?? "N/A",
      },
    };
  } catch (err: unknown) {
    return { success: false, error: getErrorMessage(err) };
  }
}

