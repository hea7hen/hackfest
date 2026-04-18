"use client";

import { useState } from "react";
import { useGoogleLogin } from "@react-oauth/google";
import {
  ArrowClockwise,
  CalendarBlank,
  EnvelopeSimple,
  FilePdf,
  GoogleLogo,
  SpinnerGap,
  WarningCircle,
} from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";
const PDF_QUERY = "has:attachment filename:pdf";
const MAX_RESULTS = 10;

type GmailHeader = {
  name?: string;
  value?: string;
};

type GmailMessageSummary = {
  id: string;
  threadId?: string;
};

type GmailMessagePartBody = {
  attachmentId?: string;
  data?: string;
  size?: number;
};

type GmailMessagePart = {
  body?: GmailMessagePartBody;
  filename?: string;
  headers?: GmailHeader[];
  mimeType?: string;
  partId?: string;
  parts?: GmailMessagePart[];
};

type GmailMessageDetail = {
  id: string;
  internalDate?: string;
  payload?: GmailMessagePart;
  threadId?: string;
};

type GmailMessagesListResponse = {
  messages?: GmailMessageSummary[];
  resultSizeEstimate?: number;
};

type ExtractedPdf = {
  id: string;
  attachmentId: string | null;
  filename: string;
  from: string;
  messageId: string;
  receivedAt: string | null;
  size: number | null;
  subject: string;
};

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Something went wrong while talking to Gmail.";
}

function getHeaderValue(headers: GmailHeader[] | undefined, targetName: string) {
  return (
    headers?.find((header) => header.name?.toLowerCase() === targetName.toLowerCase())?.value ??
    null
  );
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

  const matchingPart = part.mimeType === "application/pdf" ? [part] : [];
  const nestedParts = (part.parts ?? []).flatMap((child) => collectPdfParts(child));

  return [...matchingPart, ...nestedParts];
}

function formatReceivedDate(value: string | null) {
  if (!value) {
    return "Date unavailable";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatFileSize(size: number | null) {
  if (!size || size <= 0) {
    return "Unknown size";
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(2)} MB`;
}

async function fetchGmailJson<T>(url: string, accessToken: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    let details = "";

    try {
      const errorPayload = (await response.json()) as {
        error?: {
          message?: string;
          status?: string;
        };
      };
      details = errorPayload.error?.message ?? errorPayload.error?.status ?? "";
    } catch {
      details = await response.text();
    }

    throw new Error(
      `Gmail API request failed (${response.status})${details ? `: ${details}` : ""}`
    );
  }

  return (await response.json()) as T;
}

async function fetchPdfMessages(accessToken: string) {
  const query = new URLSearchParams({
    maxResults: String(MAX_RESULTS),
    q: PDF_QUERY,
  });

  const listResponse = await fetchGmailJson<GmailMessagesListResponse>(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?${query.toString()}`,
    accessToken
  );

  const messages = listResponse.messages ?? [];
  const pdfs: ExtractedPdf[] = [];

  for (const message of messages) {
    const detail = await fetchGmailJson<GmailMessageDetail>(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${message.id}?format=full`,
      accessToken
    );

    const subject = getHeaderValue(detail.payload?.headers, "Subject") ?? "No subject";
    const from = getHeaderValue(detail.payload?.headers, "From") ?? "Unknown sender";
    const receivedAt = getReceivedAt(detail.internalDate);
    const pdfParts = collectPdfParts(detail.payload);

    for (const pdfPart of pdfParts) {
      pdfs.push({
        id: `${detail.id}-${pdfPart.partId ?? pdfPart.filename ?? crypto.randomUUID()}`,
        attachmentId: pdfPart.body?.attachmentId ?? null,
        filename: pdfPart.filename?.trim() || "unnamed-attachment.pdf",
        from,
        messageId: detail.id,
        receivedAt,
        size: pdfPart.body?.size ?? null,
        subject,
      });
    }
  }

  return {
    messageCount: messages.length,
    pdfs,
    resultSizeEstimate: listResponse.resultSizeEstimate ?? messages.length,
  };
}

function LoadingCards() {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <Card
          key={`gmail-loading-${index}`}
          className="overflow-hidden rounded-[1.75rem] border-white/70 bg-white/80 shadow-[0_24px_70px_-42px_rgba(26,24,20,0.38)] backdrop-blur"
        >
          <CardHeader className="space-y-3">
            <Skeleton className="h-5 w-28 rounded-full" />
            <Skeleton className="h-7 w-4/5" />
            <Skeleton className="h-5 w-2/3" />
          </CardHeader>
          <CardContent className="space-y-3 pb-5">
            <Skeleton className="h-24 w-full rounded-[1.25rem]" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-2/3" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function GmailPage() {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [matchedMessages, setMatchedMessages] = useState(0);
  const [pdfs, setPdfs] = useState<ExtractedPdf[]>([]);
  const [resultSizeEstimate, setResultSizeEstimate] = useState(0);

  async function loadMailbox(accessToken: string) {
    setIsLoading(true);
    setError(null);

    try {
      const result = await fetchPdfMessages(accessToken);
      setMatchedMessages(result.messageCount);
      setPdfs(result.pdfs);
      setResultSizeEstimate(result.resultSizeEstimate);
      setLastSyncedAt(new Date().toISOString());
    } catch (fetchError) {
      setMatchedMessages(0);
      setPdfs([]);
      setResultSizeEstimate(0);
      setError(getErrorMessage(fetchError));
    } finally {
      setIsLoading(false);
    }
  }

  const login = useGoogleLogin({
    scope: GMAIL_SCOPE,
    prompt: "consent",
    onSuccess: (tokenResponse) => {
      void loadMailbox(tokenResponse.access_token);
    },
    onError: (oauthError) => {
      const description =
        typeof oauthError === "object" &&
        oauthError !== null &&
        "error_description" in oauthError &&
        typeof oauthError.error_description === "string"
          ? oauthError.error_description
          : "Google sign-in was denied or could not be completed.";

      setError(description);
    },
    onNonOAuthError: (nonOAuthError) => {
      if (nonOAuthError.type === "popup_closed") {
        setError("The Google sign-in popup was closed before consent was completed.");
        return;
      }

      if (nonOAuthError.type === "popup_failed_to_open") {
        setError("Google sign-in could not open. Please allow popups and try again.");
        return;
      }

      setError("Google sign-in hit an unexpected client-side error.");
    },
  });

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[2rem] border border-white/70 bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(244,239,228,0.9)_55%,rgba(239,233,221,0.95))] p-6 shadow-[0_30px_90px_-48px_rgba(26,24,20,0.32)] sm:p-8">
        <div className="absolute inset-y-0 right-0 hidden w-1/2 bg-[radial-gradient(circle_at_top_right,rgba(160,112,16,0.18),transparent_58%)] lg:block" />
        <div className="relative flex flex-col gap-8 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl space-y-5">
            <Badge
              variant="outline"
              className="rounded-full border-[#d8c8ab] bg-white/70 px-3 py-1 font-financial uppercase tracking-[0.24em] text-[#8f6418]"
            >
              Gmail PDF Inbox
            </Badge>
            <div className="space-y-3">
              <p className="eyebrow">Targeted fetch for attachment-heavy workflows</p>
              <h1 className="max-w-2xl text-4xl leading-none font-semibold tracking-[-0.04em] text-[#16120d] sm:text-5xl">
                Pull the newest Gmail messages that contain PDF attachments.
              </h1>
              <p className="max-w-2xl text-base leading-7 text-[#58524b] sm:text-lg">
                This page authenticates with Google on the client, queries Gmail using
                <span className="mx-2 rounded-full bg-[#1a1814] px-2.5 py-1 font-financial text-xs text-[#f9f8f5]">
                  {PDF_QUERY}
                </span>
                and lists PDF attachments from the latest 10 matching messages.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row xl:flex-col xl:items-end">
            <Button
              type="button"
              size="lg"
              className="h-12 rounded-full bg-[#1a1814] px-5 text-sm font-semibold tracking-[0.18em] uppercase text-[#f9f8f5] hover:bg-[#8e6419]"
              onClick={() => login()}
              disabled={isLoading}
            >
              {isLoading ? (
                <SpinnerGap className="size-4 animate-spin" weight="bold" />
              ) : (
                <GoogleLogo className="size-4" weight="fill" />
              )}
              {isLoading ? "Fetching Gmail" : "Connect Gmail"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="h-12 rounded-full border-[#d8d0c2] bg-white/70 px-5 tracking-[0.12em] uppercase"
              onClick={() => login()}
              disabled={isLoading}
            >
              <ArrowClockwise className="size-4" weight="bold" />
              Refresh Results
            </Button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <Card className="rounded-[1.75rem] border-white/70 bg-white/80 shadow-[0_24px_70px_-42px_rgba(26,24,20,0.38)] backdrop-blur">
          <CardHeader>
            <CardDescription className="font-financial uppercase tracking-[0.22em] text-[#8b8378]">
              Messages scanned
            </CardDescription>
            <CardTitle className="text-3xl tracking-[-0.04em] text-[#17130f]">
              {matchedMessages}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className="rounded-[1.75rem] border-white/70 bg-white/80 shadow-[0_24px_70px_-42px_rgba(26,24,20,0.38)] backdrop-blur">
          <CardHeader>
            <CardDescription className="font-financial uppercase tracking-[0.22em] text-[#8b8378]">
              PDFs extracted
            </CardDescription>
            <CardTitle className="text-3xl tracking-[-0.04em] text-[#17130f]">
              {pdfs.length}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className="rounded-[1.75rem] border-white/70 bg-white/80 shadow-[0_24px_70px_-42px_rgba(26,24,20,0.38)] backdrop-blur">
          <CardHeader>
            <CardDescription className="font-financial uppercase tracking-[0.22em] text-[#8b8378]">
              Last synced
            </CardDescription>
            <CardTitle className="text-xl tracking-[-0.03em] text-[#17130f]">
              {lastSyncedAt ? formatReceivedDate(lastSyncedAt) : "Not fetched yet"}
            </CardTitle>
          </CardHeader>
        </Card>
      </section>

      {error ? (
        <section className="rounded-[1.75rem] border border-[#e8c2bb] bg-[#fff6f4] p-5 shadow-[0_18px_50px_-36px_rgba(146,55,35,0.35)]">
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-[#d94f2b]/12 p-2 text-[#c43d1a]">
              <WarningCircle className="size-5" weight="fill" />
            </div>
            <div className="space-y-1">
              <p className="font-semibold text-[#7f2f1a]">Unable to fetch Gmail PDFs</p>
              <p className="text-sm leading-6 text-[#9a4d38]">{error}</p>
            </div>
          </div>
        </section>
      ) : null}

      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="eyebrow">Attachment results</p>
            <h2 className="text-2xl tracking-[-0.04em] text-[#17130f]">
              PDF attachments from matching Gmail messages
            </h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge
              variant="outline"
              className="rounded-full border-[#ddd4c7] bg-white/70 px-3 py-1 font-financial text-[11px] uppercase tracking-[0.2em]"
            >
              Query: {PDF_QUERY}
            </Badge>
            <Badge
              variant="outline"
              className="rounded-full border-[#ddd4c7] bg-white/70 px-3 py-1 font-financial text-[11px] uppercase tracking-[0.2em]"
            >
              Result cap: {MAX_RESULTS}
            </Badge>
            <Badge
              variant="outline"
              className="rounded-full border-[#ddd4c7] bg-white/70 px-3 py-1 font-financial text-[11px] uppercase tracking-[0.2em]"
            >
              Estimate: {resultSizeEstimate}
            </Badge>
          </div>
        </div>

        {isLoading ? <LoadingCards /> : null}

        {!isLoading && pdfs.length === 0 && !error ? (
          <Card className="rounded-[1.75rem] border-dashed border-[#ddd4c7] bg-white/75 py-10 text-center shadow-[0_24px_70px_-42px_rgba(26,24,20,0.24)]">
            <CardContent className="flex flex-col items-center gap-4">
              <div className="rounded-full bg-[#efe4cf] p-4 text-[#8f6418]">
                <FilePdf className="size-8" weight="fill" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-semibold tracking-[-0.03em] text-[#17130f]">
                  No PDFs loaded yet
                </h3>
                <p className="max-w-xl text-sm leading-6 text-[#6a645d]">
                  Authenticate with Google to fetch the latest Gmail messages matching the PDF
                  attachment filter.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {!isLoading && pdfs.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {pdfs.map((pdf) => (
              <Card
                key={pdf.id}
                className="overflow-hidden rounded-[1.75rem] border-white/70 bg-white/80 shadow-[0_24px_70px_-42px_rgba(26,24,20,0.38)] backdrop-blur transition-transform duration-200 hover:-translate-y-1"
              >
                <CardHeader className="space-y-3 border-b border-[#f0ebe2] pb-5">
                  <div className="flex items-start justify-between gap-3">
                    <Badge className="rounded-full bg-[#1a1814] px-3 py-1 font-financial text-[11px] uppercase tracking-[0.2em] text-[#f9f8f5]">
                      PDF
                    </Badge>
                    <span className="font-financial text-xs uppercase tracking-[0.18em] text-[#9b9388]">
                      {formatFileSize(pdf.size)}
                    </span>
                  </div>
                  <div className="space-y-2">
                    <CardTitle className="line-clamp-2 text-xl tracking-[-0.035em] text-[#17130f]">
                      {pdf.subject}
                    </CardTitle>
                    <CardDescription className="line-clamp-2 text-sm leading-6 text-[#5d5750]">
                      {pdf.filename}
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 pt-5">
                  <div className="rounded-[1.25rem] border border-[#efe6da] bg-[#fbf8f2] p-4">
                    <div className="flex items-center gap-3">
                      <div className="rounded-full bg-[#d44d28]/10 p-2 text-[#c94a23]">
                        <FilePdf className="size-5" weight="fill" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-financial text-[11px] uppercase tracking-[0.22em] text-[#9c9386]">
                          Attachment
                        </p>
                        <p className="truncate text-sm font-medium text-[#17130f]">
                          {pdf.filename}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3 text-sm text-[#5d5750]">
                    <div className="flex items-start gap-3">
                      <EnvelopeSimple className="mt-0.5 size-4 text-[#8f6418]" weight="bold" />
                      <div>
                        <p className="font-financial text-[11px] uppercase tracking-[0.22em] text-[#9c9386]">
                          Sender
                        </p>
                        <p className="line-clamp-2">{pdf.from}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <CalendarBlank className="mt-0.5 size-4 text-[#8f6418]" weight="bold" />
                      <div>
                        <p className="font-financial text-[11px] uppercase tracking-[0.22em] text-[#9c9386]">
                          Received
                        </p>
                        <p>{formatReceivedDate(pdf.receivedAt)}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <ArrowClockwise className="mt-0.5 size-4 text-[#8f6418]" weight="bold" />
                      <div>
                        <p className="font-financial text-[11px] uppercase tracking-[0.22em] text-[#9c9386]">
                          Message ID
                        </p>
                        <p className="truncate font-financial text-xs">{pdf.messageId}</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}
