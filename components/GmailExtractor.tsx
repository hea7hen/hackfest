"use client";

import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useGoogleLogin } from "@react-oauth/google";
import { toast } from "sonner";
import { GoogleLogo, FilePdf, WarningCircle } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { parseInvoicePdf } from "@/app/actions/pdfAction";
import type { ParsedPdfDocument } from "@/app/actions/pdfAction";
import { recomputeAllTaxSummaries } from "@/lib/db/tax-summary";
import {
  bestEffortUploadToChroma,
  normalizeInvoiceDate,
  persistGmailPdfToDexie,
} from "@/lib/gmailPersist";
import { db } from "@/lib/db/schema";
import type { GmailImportRecord } from "@/lib/types";

type GmailHeader = {
  name?: string;
  value?: string;
};

type GmailMessageSummary = {
  id: string;
  threadId?: string;
};

type GmailAttachmentBody = {
  attachmentId?: string;
  size?: number;
  data?: string;
};

type GmailMessagePart = {
  partId?: string;
  filename?: string;
  mimeType?: string;
  body?: GmailAttachmentBody;
  headers?: GmailHeader[];
  parts?: GmailMessagePart[];
};

type GmailMessageDetail = {
  id: string;
  threadId?: string;
  snippet?: string;
  internalDate?: string;
  payload?: GmailMessagePart;
};

type GmailMessagesListResponse = {
  messages?: GmailMessageSummary[];
};

type ParsedPdfAttachment = {
  filename: string;
  mimeType: string;
  attachmentId: string;
  size: number | null;
  base64Data: string;
  objectUrl?: string;
  parsedJson: ParsedPdfDocument;
};

type ParsedGmailDocument = {
  messageId: string;
  threadId: string | null;
  subject: string;
  from: string;
  snippet: string;
  receivedAt: string | null;
  attachments: ParsedPdfAttachment[];
};

const GMAIL_SELECTED_ATTACHMENT_KEY = "2ask:gmail-selected-attachment";

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Failed to extract PDF data";
}

function getHeaderValue(headers: GmailHeader[] | undefined, name: string) {
  return headers?.find((header) => header.name?.toLowerCase() === name.toLowerCase())?.value ?? null;
}

function getReceivedAt(internalDate: string | undefined) {
  if (!internalDate) {
    return null;
  }

  const timestamp = Number(internalDate);
  if (Number.isNaN(timestamp)) {
    return null;
  }

  return new Date(timestamp).toISOString();
}

function collectPdfParts(part: GmailMessagePart | undefined): GmailMessagePart[] {
  if (!part) {
    return [];
  }

  const currentIsPdf =
    part.mimeType === "application/pdf" &&
    Boolean(part.body?.attachmentId) &&
    Boolean(part.filename);

  const nestedParts = (part.parts ?? []).flatMap((child) => collectPdfParts(child));

  return currentIsPdf ? [part, ...nestedParts] : nestedParts;
}

function base64UrlToUint8Array(base64Data: string) {
  const normalized = base64Data.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
  const binary = window.atob(padded);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function createPdfObjectUrl(base64Data: string, mimeType: string) {
  const bytes = base64UrlToUint8Array(base64Data);
  const blob = new Blob([bytes], { type: mimeType });
  return URL.createObjectURL(blob);
}

function revokeDocumentUrls(documents: ParsedGmailDocument[]) {
  documents.forEach((document) => {
    document.attachments.forEach((attachment) => {
      if (attachment.objectUrl) {
        URL.revokeObjectURL(attachment.objectUrl);
      }
    });
  });
}

function serializeDocumentsForStorage(documents: ParsedGmailDocument[]): GmailImportRecord[] {
  return documents.map((document) => ({
    messageId: document.messageId,
    threadId: document.threadId,
    subject: document.subject,
    from: document.from,
    snippet: document.snippet,
    receivedAt: document.receivedAt,
    processedAt: new Date().toISOString(),
    attachments: document.attachments.map((attachment) => ({
      filename: attachment.filename,
      mimeType: attachment.mimeType,
      attachmentId: attachment.attachmentId,
      size: attachment.size,
      base64Data: attachment.base64Data,
      parsedJson: attachment.parsedJson,
    })),
  }));
}

function restoreStoredDocuments(records: GmailImportRecord[]): ParsedGmailDocument[] {
  return records.map((record) => ({
    messageId: record.messageId,
    threadId: record.threadId,
    subject: record.subject,
    from: record.from,
    snippet: record.snippet,
    receivedAt: record.receivedAt,
    attachments: record.attachments.map((attachment) => ({
      ...attachment,
      objectUrl: createPdfObjectUrl(attachment.base64Data, attachment.mimeType),
    })),
  }));
}

async function fetchJson<T>(url: string, accessToken: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    let details = "";

    try {
      const errorPayload = (await response.json()) as {
        error?: { message?: string; status?: string };
      };
      details = errorPayload.error?.message ?? errorPayload.error?.status ?? "";
    } catch {
      details = await response.text();
    }

    const urlPath = new URL(url).pathname;
    throw new Error(
      `Gmail API request failed (${response.status}) on ${urlPath}${details ? `: ${details}` : ""}`
    );
  }

  return (await response.json()) as T;
}

export default function GmailExtractor() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parseWarnings, setParseWarnings] = useState<string[]>([]);
  const [selectedAttachmentId, setSelectedAttachmentId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return window.sessionStorage.getItem(GMAIL_SELECTED_ATTACHMENT_KEY);
  });
  const persistedTransactions = useLiveQuery(
    () => db.transactions.where("source").equals("gmail").reverse().limit(20).toArray(),
    []
  );
  const persistedImports = useLiveQuery(
    () => db.gmailImports.orderBy("processedAt").reverse().toArray(),
    []
  );

  const documents = useMemo(
    () => restoreStoredDocuments(persistedImports ?? []),
    [persistedImports]
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (selectedAttachmentId) {
      window.sessionStorage.setItem(GMAIL_SELECTED_ATTACHMENT_KEY, selectedAttachmentId);
      return;
    }
    window.sessionStorage.removeItem(GMAIL_SELECTED_ATTACHMENT_KEY);
  }, [selectedAttachmentId]);

  const jsonOutput = useMemo(() => JSON.stringify(documents, null, 2), [documents]);
  const allAttachments = useMemo(
    () => documents.flatMap((document) => document.attachments),
    [documents]
  );
  const selectedAttachment = useMemo(() => {
    if (!allAttachments.length) {
      return null;
    }

    return (
      allAttachments.find((attachment) => attachment.attachmentId === selectedAttachmentId) ??
      allAttachments[0]
    );
  }, [allAttachments, selectedAttachmentId]);

  useEffect(() => {
    return () => {
      revokeDocumentUrls(documents);
    };
  }, [documents]);

  const login = useGoogleLogin({
    scope: "https://www.googleapis.com/auth/gmail.readonly",
    prompt: "consent",
    onSuccess: async (tokenResponse) => {
      setLoading(true);
      setError(null);
      setParseWarnings([]);

      try {
        const parseErrors: string[] = [];
        const messageList = await fetchJson<GmailMessagesListResponse>(
          "https://gmail.googleapis.com/gmail/v1/users/me/messages?q=has:attachment filename:pdf {invoice receipt bill payment order}&maxResults=10",
          tokenResponse.access_token
        );

        if (!messageList.messages?.length) {
          await db.gmailImports.clear();
          setSelectedAttachmentId(null);
          setError("No emails with PDF attachments were found in the fetched Gmail results.");
          return;
        }

        const extractedDocuments: ParsedGmailDocument[] = [];

        for (const message of messageList.messages) {
          const detail = await fetchJson<GmailMessageDetail>(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${message.id}`,
            tokenResponse.access_token
          );

          const pdfParts = collectPdfParts(detail.payload);
          if (!pdfParts.length) {
            continue;
          }

          const subject = getHeaderValue(detail.payload?.headers, "Subject") ?? "No Subject";
          const from = getHeaderValue(detail.payload?.headers, "From") ?? "Unknown Sender";
          const attachments: ParsedPdfAttachment[] = [];

          for (const pdfPart of pdfParts) {
            const attachmentId = pdfPart.body?.attachmentId;
            if (!attachmentId) {
              continue;
            }

            const attachment = await fetchJson<{ data?: string }>(
              `https://gmail.googleapis.com/gmail/v1/users/me/messages/${message.id}/attachments/${attachmentId}`,
              tokenResponse.access_token
            );

            if (!attachment.data) {
              continue;
            }

            const parsed = await parseInvoicePdf(attachment.data);
            if (!parsed.success || !parsed.document) {
              const name = pdfPart.filename ?? "attachment.pdf";
              const reason = parsed.error ?? "Unknown parse error";
              parseErrors.push(`${name}: ${reason}`);
              continue;
            }

            attachments.push({
              filename: pdfPart.filename ?? "attachment.pdf",
              mimeType: pdfPart.mimeType ?? "application/pdf",
              attachmentId,
              size: pdfPart.body?.size ?? null,
              base64Data: attachment.data,
              objectUrl: createPdfObjectUrl(
                attachment.data,
                pdfPart.mimeType ?? "application/pdf"
              ),
              parsedJson: parsed.document,
            });
          }

          if (!attachments.length) {
            continue;
          }

          extractedDocuments.push({
            messageId: detail.id,
            threadId: detail.threadId ?? null,
            subject,
            from,
            snippet: detail.snippet ?? "",
            receivedAt: getReceivedAt(detail.internalDate),
            attachments,
          });
        }

        const persistedSnapshot = serializeDocumentsForStorage(extractedDocuments);
        await db.transaction("rw", db.gmailImports, async () => {
          await db.gmailImports.clear();
          if (persistedSnapshot.length > 0) {
            await db.gmailImports.bulkPut(persistedSnapshot);
          }
        });

        let savedCount = 0;
        for (const doc of extractedDocuments) {
          for (const att of doc.attachments) {
            try {
              await persistGmailPdfToDexie({
                messageId: doc.messageId,
                attachmentId: att.attachmentId,
                filename: att.filename,
                subject: doc.subject,
                parsed: att.parsedJson,
              });
              const d = normalizeInvoiceDate(att.parsedJson.extractedFields.invoiceDate);
              void bestEffortUploadToChroma(att.parsedJson.fullText, att.filename, d);
              savedCount += 1;
            } catch (persistErr) {
              console.error(persistErr);
            }
          }
        }
        if (savedCount > 0) {
          await recomputeAllTaxSummaries();
          toast.success(
            `Saved ${savedCount} invoice${savedCount === 1 ? "" : "s"} locally — check Tax Passport & Ask 2ASK.`
          );
        }

        setParseWarnings(parseErrors);
        setSelectedAttachmentId(extractedDocuments[0]?.attachments[0]?.attachmentId ?? null);
        if (!extractedDocuments.length) {
          if (parseErrors.length) {
            setError(
              `No PDFs could be parsed. Common causes: password-protected PDFs, damaged files, or non-PDF data. Details:\n${parseErrors.slice(0, 5).join("\n")}${parseErrors.length > 5 ? `\n… and ${parseErrors.length - 5} more` : ""}`
            );
          } else {
            setError("PDF attachments were found in Gmail results, but none could be extracted.");
          }
        } else if (parseErrors.length) {
          toast.warning(
            `Skipped ${parseErrors.length} attachment${parseErrors.length === 1 ? "" : "s"} (corrupt, encrypted, or not parseable).`
          );
        }
      } catch (err: unknown) {
        console.error(err);
        setError(getErrorMessage(err));
      } finally {
        setLoading(false);
      }
    },
    onError: (loginError) => {
      console.error("Login Failed:", loginError);
      setError("Google login failed");
    },
  });

  const pdfCount = documents.reduce((sum, doc) => sum + doc.attachments.length, 0);

  return (
    <section id="gmail-json-extractor" className="scroll-mt-28 space-y-6">
      <div className="rounded-3xl border border-slate-100 bg-white p-6 md:p-8 shadow-sm hover:shadow-md transition-shadow">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-4 min-w-0">
            <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center border border-blue-100/50 shadow-sm shrink-0">
              <GoogleLogo weight="bold" size={24} className="text-blue-600" />
            </div>
            <div className="space-y-2 min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-600">
                Gmail import
              </p>
              <h2 className="text-2xl font-black tracking-tight text-slate-900">
                PDF invoices from your inbox
              </h2>
              <p className="text-sm text-slate-500 font-medium max-w-2xl leading-relaxed">
                We scan recent messages for PDF attachments, parse them on your device, and show
                extracted fields below—the same ledger flow as the rest of your dashboard.
              </p>
            </div>
          </div>

          <Button
            type="button"
            onClick={() => login()}
            disabled={loading}
            className="gap-2 rounded-2xl font-bold px-6 h-11 shadow-sm shrink-0"
          >
            <GoogleLogo weight="bold" size={18} className="text-primary-foreground" />
            {loading ? "Extracting…" : "Connect Gmail & import"}
          </Button>
        </div>

        {error && (
          <div className="mt-6 flex items-start gap-3 rounded-2xl bg-red-50/80 border border-red-200 p-4 shadow-sm">
            <WarningCircle weight="fill" size={20} className="text-red-500 mt-0.5 shrink-0" />
            <p className="text-sm text-red-900 font-medium whitespace-pre-wrap leading-relaxed">
              {error}
            </p>
          </div>
        )}

        {parseWarnings.length > 0 && documents.length > 0 && (
          <div className="mt-6 flex items-start gap-3 rounded-2xl bg-amber-50/50 border border-amber-200 p-4 shadow-sm">
            <WarningCircle weight="fill" size={20} className="text-amber-500 mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm text-slate-900 font-bold mb-2">Some attachments were skipped</p>
              <ul className="list-disc pl-5 space-y-1 text-xs text-slate-600 font-medium max-h-40 overflow-y-auto">
                {parseWarnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          </div>
        )}

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <div className="rounded-3xl border border-slate-100 bg-slate-50/50 p-5 md:p-6 flex flex-col min-h-[280px]">
            <div className="flex items-center justify-between mb-6 px-1">
              <div>
                <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 mb-1">
                  Inbox PDFs
                </h3>
                <p className="text-lg font-black tracking-tight text-slate-900">Extracted files</p>
              </div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-white px-3 py-1.5 rounded-xl border border-slate-100">
                {pdfCount} PDF{pdfCount === 1 ? "" : "s"}
              </span>
            </div>

            <div className="space-y-3 flex-1 overflow-y-auto no-scrollbar pr-1 max-h-[520px]">
              {!loading && !documents.length && !error && (
                <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white/80 p-8 text-center">
                  <FilePdf weight="duotone" size={36} className="text-slate-300 mx-auto mb-3" />
                  <p className="text-sm text-slate-900 font-bold">No imports yet</p>
                  <p className="text-xs text-slate-500 font-medium mt-1">
                    Connect Gmail to pull PDF attachments from your recent mail.
                  </p>
                </div>
              )}

              {documents.map((document) => (
                <div
                  key={document.messageId}
                  className="rounded-3xl border border-slate-100 bg-white p-4 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="space-y-1 mb-3">
                    <p className="text-sm font-bold text-slate-900 leading-snug line-clamp-2">
                      {document.subject}
                    </p>
                    <p className="text-xs text-slate-500 font-medium truncate">{document.from}</p>
                    {document.receivedAt && (
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                        {new Date(document.receivedAt).toLocaleString("en-IN")}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    {document.attachments.map((attachment) => {
                      const active =
                        selectedAttachment?.attachmentId === attachment.attachmentId;
                      return (
                        <div
                          key={attachment.attachmentId}
                          className={`rounded-2xl border px-3 py-3 text-xs transition-colors ${
                            active
                              ? "border-blue-200 bg-blue-50/60"
                              : "border-slate-100 bg-slate-50/80 hover:bg-slate-50"
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            <div className="w-8 h-8 rounded-xl bg-white border border-slate-100 flex items-center justify-center shrink-0">
                              <FilePdf weight="bold" size={16} className="text-blue-600" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="font-bold text-slate-900 truncate">{attachment.filename}</p>
                              <p className="text-[10px] text-slate-500 font-medium mt-0.5">
                                {attachment.parsedJson.pageCount} page
                                {attachment.parsedJson.pageCount === 1 ? "" : "s"}
                                {attachment.size ? ` · ${attachment.size.toLocaleString("en-IN")} B` : ""}
                              </p>
                            </div>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1">
                            <button
                              type="button"
                              onClick={() => setSelectedAttachmentId(attachment.attachmentId)}
                              className={`text-xs font-bold transition-colors ${
                                active ? "text-blue-700" : "text-blue-600 hover:text-blue-700"
                              }`}
                            >
                              Preview & JSON
                            </button>
                            {attachment.objectUrl && (
                              <>
                                <a
                                  href={attachment.objectUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-xs font-bold text-slate-500 hover:text-slate-800"
                                >
                                  Open
                                </a>
                                <a
                                  href={attachment.objectUrl}
                                  download={attachment.filename}
                                  className="text-xs font-bold text-slate-500 hover:text-slate-800"
                                >
                                  Download
                                </a>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-100 bg-slate-50/50 p-5 md:p-6 flex flex-col min-h-[280px]">
            <div className="flex items-center justify-between mb-6 px-1">
              <div>
                <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 mb-1">
                  Preview
                </h3>
                <p className="text-lg font-black tracking-tight text-slate-900">PDF & extracted data</p>
              </div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-white px-3 py-1.5 rounded-xl border border-slate-100">
                Local only
              </span>
            </div>

            {selectedAttachment ? (
              <div className="space-y-4 flex-1 flex flex-col min-h-0">
                <div className="rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-sm">
                  <p className="text-sm font-bold text-slate-900 truncate">{selectedAttachment.filename}</p>
                  <p className="text-[10px] text-slate-500 font-medium mt-1">
                    {selectedAttachment.parsedJson.pageCount} pages
                    {selectedAttachment.size
                      ? ` · ${selectedAttachment.size.toLocaleString("en-IN")} B`
                      : ""}
                  </p>
                </div>

                <iframe
                  title={selectedAttachment.filename}
                  src={selectedAttachment.objectUrl}
                  className="h-[min(480px,50vh)] w-full rounded-2xl border border-slate-200 bg-white shadow-inner shrink-0"
                />

                <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm flex-1 flex flex-col min-h-0">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                      Extracted JSON
                    </h4>
                    <span className="text-[10px] font-bold text-slate-400">From selection</span>
                  </div>
                  <pre className="flex-1 min-h-[120px] max-h-[220px] overflow-auto text-[11px] leading-relaxed whitespace-pre-wrap break-words font-mono text-slate-700 bg-slate-50 rounded-xl border border-slate-100 p-3">
                    {JSON.stringify(selectedAttachment.parsedJson, null, 2)}
                  </pre>
                </div>
              </div>
            ) : (
              <pre className="flex-1 min-h-[200px] max-h-[480px] overflow-auto rounded-2xl border border-slate-100 bg-white p-4 text-[11px] leading-relaxed whitespace-pre-wrap break-words font-mono text-slate-600 shadow-inner">
                {jsonOutput || "[]"}
              </pre>
            )}
          </div>
        </div>
      </div>

      {(persistedTransactions?.length ?? 0) > 0 && (
        <div className="rounded-3xl border border-slate-100 bg-white p-6 md:p-8 shadow-sm">
          <div className="flex items-center justify-between mb-6 px-1">
            <div>
              <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 mb-1">
                Ledger
              </h3>
              <p className="text-lg font-black tracking-tight text-slate-900">
                Previously imported from Gmail
              </p>
            </div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100">
              {persistedTransactions?.length ?? 0} items
            </span>
          </div>
          <div className="space-y-1">
            {persistedTransactions?.map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between py-4 px-4 rounded-2xl border border-transparent hover:bg-slate-50 hover:border-slate-100 transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-900 truncate">{t.vendor}</p>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    {t.date} · {t.category}
                  </p>
                </div>
                <p
                  className={`text-sm font-black tabular-nums shrink-0 ml-4 ${
                    t.amount > 0 ? "text-emerald-600" : "text-rose-600"
                  }`}
                >
                  {`${t.amount > 0 ? "+" : ""}\u20B9${Math.abs(t.amount).toLocaleString("en-IN")}`}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}