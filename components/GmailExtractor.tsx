"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useGoogleLogin } from "@react-oauth/google";
import { parseInvoicePdf } from "@/app/actions/pdfAction";
import type { ParsedPdfDocument } from "@/app/actions/pdfAction";

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
  const [documents, setDocuments] = useState<ParsedGmailDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedAttachmentId, setSelectedAttachmentId] = useState<string | null>(null);

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
      documents.forEach((document) => {
        document.attachments.forEach((attachment) => {
          if (attachment.objectUrl) {
            URL.revokeObjectURL(attachment.objectUrl);
          }
        });
      });
    };
  }, [documents]);

  const login = useGoogleLogin({
    scope: "https://www.googleapis.com/auth/gmail.readonly",
    prompt: "consent",
    onSuccess: async (tokenResponse) => {
      setLoading(true);
      setError(null);

      try {
        const messageList = await fetchJson<GmailMessagesListResponse>(
          "https://gmail.googleapis.com/gmail/v1/users/me/messages?q=has:attachment filename:pdf&maxResults=10",
          tokenResponse.access_token
        );

        if (!messageList.messages?.length) {
          setDocuments([]);
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
              throw new Error(parsed.error || `Failed to parse ${pdfPart.filename ?? "PDF attachment"}`);
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

        setDocuments(extractedDocuments);
        setSelectedAttachmentId(extractedDocuments[0]?.attachments[0]?.attachmentId ?? null);
        if (!extractedDocuments.length) {
          setError("PDF attachments were found in Gmail results, but none could be extracted.");
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

  return (
    <section
      id="gmail-json-extractor"
      className="rounded-3xl border p-6 shadow-sm"
      style={{
        background: "linear-gradient(180deg, rgba(19,25,41,0.98), rgba(12,17,30,0.98))",
        borderColor: "rgba(255,255,255,0.08)",
      }}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.24em]" style={{ color: "#3B82F6" }}>
            Gmail PDF Extraction
          </p>
          <h2 className="text-2xl font-semibold" style={{ color: "#F0F4FF" }}>
            Extract PDF data from email and display it locally as JSON
          </h2>
          <p className="max-w-3xl text-sm" style={{ color: "#8899AA" }}>
            This reads Gmail messages with PDF attachments, parses each PDF on your local app session,
            and renders the extracted result below as JSON.
          </p>
        </div>

        <button
          onClick={() => login()}
          disabled={loading}
          className="rounded-xl px-4 py-2 text-sm font-medium transition-colors"
          style={{
            background: loading ? "rgba(59,130,246,0.35)" : "#2563EB",
            color: "#FFFFFF",
          }}
        >
          {loading ? "Extracting PDFs..." : "Connect Gmail and Extract JSON"}
        </button>
      </div>

      {error && (
        <div
          className="mt-4 rounded-2xl border px-4 py-3 text-sm"
          style={{
            background: "rgba(244,63,94,0.08)",
            borderColor: "rgba(244,63,94,0.25)",
            color: "#FCA5A5",
          }}
        >
          {error}
        </div>
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div
          className="rounded-2xl border p-4"
          style={{
            background: "rgba(255,255,255,0.02)",
            borderColor: "rgba(255,255,255,0.06)",
          }}
        >
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold" style={{ color: "#F0F4FF" }}>
              Extracted Files
            </h3>
            <span className="text-xs" style={{ color: "#8899AA" }}>
              {documents.reduce((sum, doc) => sum + doc.attachments.length, 0)} PDFs
            </span>
          </div>

          <div className="space-y-3">
            {!loading && !documents.length && !error && (
              <p className="text-sm" style={{ color: "#8899AA" }}>
                No extracted JSON yet. Connect Gmail to load PDF attachments from your inbox.
              </p>
            )}

            {documents.map((document) => (
              <div
                key={document.messageId}
                className="rounded-2xl border p-4"
                style={{
                  background: "rgba(30,42,58,0.5)",
                  borderColor: "rgba(255,255,255,0.06)",
                }}
              >
                <div className="space-y-1">
                  <div className="text-sm font-semibold" style={{ color: "#F0F4FF" }}>
                    {document.subject}
                  </div>
                  <div className="text-xs" style={{ color: "#8899AA" }}>
                    {document.from}
                  </div>
                  {document.receivedAt && (
                    <div className="text-xs" style={{ color: "#8899AA" }}>
                      {new Date(document.receivedAt).toLocaleString("en-IN")}
                    </div>
                  )}
                </div>

                <div className="mt-3 space-y-2">
                  {document.attachments.map((attachment) => (
                    <div
                      key={attachment.attachmentId}
                      className="rounded-xl border px-3 py-2 text-xs"
                      style={{
                        background: "rgba(10,15,30,0.65)",
                        borderColor: "rgba(59,130,246,0.18)",
                        color: "#CBD5E1",
                      }}
                    >
                      <div>{attachment.filename}</div>
                      <div style={{ color: "#8899AA" }}>
                        {attachment.parsedJson.pageCount} pages
                        {attachment.size ? ` • ${attachment.size} bytes` : ""}
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedAttachmentId(attachment.attachmentId)}
                        className="mt-2 inline-block text-left text-xs"
                        style={{
                          color:
                            selectedAttachment?.attachmentId === attachment.attachmentId ? "#93C5FD" : "#60A5FA",
                        }}
                      >
                        Show PDF locally
                      </button>
                      {attachment.objectUrl && (
                        <a
                          href={attachment.objectUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-2 ml-3 inline-block text-xs"
                          style={{ color: "#60A5FA" }}
                        >
                          Open PDF in new tab
                        </a>
                      )}
                      <a
                        href={attachment.objectUrl}
                        download={attachment.filename}
                        className="mt-2 ml-3 inline-block text-xs"
                        style={{ color: "#60A5FA" }}
                      >
                        Download PDF locally
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div
          className="rounded-2xl border p-4"
          style={{
            background: "rgba(255,255,255,0.02)",
            borderColor: "rgba(255,255,255,0.06)",
          }}
        >
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold" style={{ color: "#F0F4FF" }}>
              Local PDF Preview
            </h3>
            <span className="text-xs" style={{ color: "#8899AA" }}>
              Rendered in browser only
            </span>
          </div>

          {selectedAttachment ? (
            <div className="space-y-4">
              <div
                className="rounded-2xl border px-4 py-3 text-xs"
                style={{
                  background: "#0A0F1E",
                  borderColor: "rgba(255,255,255,0.06)",
                  color: "#D6E4FF",
                }}
              >
                <div className="font-semibold">{selectedAttachment.filename}</div>
                <div style={{ color: "#8899AA" }}>
                  {selectedAttachment.parsedJson.pageCount} pages
                  {selectedAttachment.size ? ` • ${selectedAttachment.size} bytes` : ""}
                </div>
              </div>

              <iframe
                title={selectedAttachment.filename}
                src={selectedAttachment.objectUrl}
                className="h-[560px] w-full rounded-2xl border"
                style={{
                  background: "#FFFFFF",
                  borderColor: "rgba(255,255,255,0.06)",
                }}
              />

              <div
                className="rounded-2xl border p-4"
                style={{
                  background: "#0A0F1E",
                  borderColor: "rgba(255,255,255,0.06)",
                }}
              >
                <div className="mb-3 flex items-center justify-between">
                  <h4 className="text-sm font-semibold" style={{ color: "#F0F4FF" }}>
                    Extracted JSON Output
                  </h4>
                  <span className="text-xs" style={{ color: "#8899AA" }}>
                    Parsed from selected PDF
                  </span>
                </div>
                <pre
                  className="max-h-[260px] overflow-auto text-xs leading-6 whitespace-pre-wrap break-words"
                  style={{ color: "#D6E4FF" }}
                >
                  {JSON.stringify(selectedAttachment.parsedJson, null, 2)}
                </pre>
              </div>
            </div>
          ) : (
            <pre
              className="max-h-[560px] overflow-auto rounded-2xl border p-4 text-xs leading-6 whitespace-pre-wrap break-words"
              style={{
                background: "#0A0F1E",
                borderColor: "rgba(255,255,255,0.06)",
                color: "#D6E4FF",
              }}
            >
              {jsonOutput || "[]"}
            </pre>
          )}
        </div>
      </div>
    </section>
  );
}
