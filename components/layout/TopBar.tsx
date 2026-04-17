'use client';

import { Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useGoogleLogin } from '@react-oauth/google';
import { useState } from 'react';
import { parseInvoicePdf } from '@/app/actions/pdfAction';

interface TopBarProps {
  modelLoading?: boolean;
  modelProgress?: number;
}

export default function TopBar({ modelLoading, modelProgress }: TopBarProps) {
  const [isSyncing, setIsSyncing] = useState(false);

  const login = useGoogleLogin({
    scope: "https://www.googleapis.com/auth/gmail.readonly",
    onSuccess: async (tokenResponse) => {
      setIsSyncing(true);
      try {
        // 1. Query Gmail for messages with PDF attachments
        const response = await fetch(
          "https://gmail.googleapis.com/gmail/v1/users/me/messages?q=has:attachment filename:pdf&maxResults=5",
          {
            headers: {
              Authorization: `Bearer ${tokenResponse.access_token}`,
            },
          }
        );
        const data = await response.json();
        
        if (!data.messages || data.messages.length === 0) {
          alert("No PDF invoices found in your recent emails.");
          return;
        }

        // 2. Fetch the first message details to find the attachment ID
        const msgId = data.messages[0].id;
        const msgRes = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msgId}`,
          { headers: { Authorization: `Bearer ${tokenResponse.access_token}` } }
        );
        const msgData = await msgRes.json();
        
        // Find the PDF attachment part
        let attachmentId = null;
        if (msgData.payload.parts) {
          for (const part of msgData.payload.parts) {
            if (part.mimeType === "application/pdf" && part.body && part.body.attachmentId) {
              attachmentId = part.body.attachmentId;
              break;
            }
          }
        }
        
        if (!attachmentId) {
          alert("Could not find a PDF attachment in the latest matching email.");
          return;
        }

        // 3. Fetch the actual base64 attachment 
        const attachRes = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msgId}/attachments/${attachmentId}`,
          { headers: { Authorization: `Bearer ${tokenResponse.access_token}` } }
        );
        const attachData = await attachRes.json();
        
        // 4. Process PDF via our Next.js Server Action
        const parseResult = await parseInvoicePdf(attachData.data);
        
        if (!parseResult.success) {
          throw new Error(parseResult.error || "Failed to parse PDF");
        }
        
        // 5. Build the simple CSV Content
        const invoice = parseResult.invoiceData;
        const csvContent = [
          "Invoice Number,Date,Amount",
          `"${invoice.invoiceNumber}","${invoice.date}","${invoice.amount}"`
        ].join("\n");
        
        // 6. Trigger download in the browser
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `extracted-invoice.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        alert("Successfully extracted PDF invoice data and downloaded as CSV!");
      } catch (err) {
        console.error(err);
        alert("Failed to fetch or process PDF email");
      } finally {
        setIsSyncing(false);
      }
    },
    onError: (error) => {
      console.error("Login Failed:", error);
    },
  });

  return (
    <header
      className="sticky top-0 z-30 h-16 flex items-center justify-between px-6"
      style={{
        background: 'rgba(10,15,30,0.8)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      <div>
        <h1 className="text-lg font-semibold" style={{ color: '#F0F4FF' }}>
          2ASK
        </h1>
        <p className="text-xs" style={{ color: '#8899AA' }}>
          AI Personal Finance Agent
        </p>
      </div>

      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => login()}
          disabled={isSyncing}
          style={{
            background: 'rgba(59,130,246,0.1)',
            borderColor: 'rgba(59,130,246,0.3)',
            color: '#3B82F6',
          }}
        >
          <Mail size={14} />
          {isSyncing ? "Syncing..." : "Sync Gmail"}
        </Button>
      </div>

      {/* Model loading progress bar */}
      {modelLoading && (
        <div
          className="absolute bottom-0 left-0 h-0.5 transition-all duration-300"
          style={{
            width: `${modelProgress || 0}%`,
            background: 'linear-gradient(90deg, #3B82F6, #8B5CF6)',
          }}
        />
      )}
    </header>
  );
}
