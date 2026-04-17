"use client";

import React, { useState } from "react";
import { useGoogleLogin } from "@react-oauth/google";

export default function GmailExtractor() {
  const [emails, setEmails] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const login = useGoogleLogin({
    scope: "https://www.googleapis.com/auth/gmail.readonly",
    onSuccess: async (tokenResponse) => {
      try {
        setLoading(true);
        setError(null);
        
        // 1. Fetch the list of messages
        const response = await fetch(
          "https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=5",
          {
            headers: {
              Authorization: `Bearer ${tokenResponse.access_token}`,
            },
          }
        );

        if (!response.ok) {
          throw new Error("Failed to fetch messages list");
        }

        const data = await response.json();
        
        if (!data.messages) {
          setEmails([]);
          setLoading(false);
          return;
        }

        // 2. Fetch the details for each message
        const messageDetailsPromises = data.messages.map((msg: any) =>
          fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}`, {
            headers: {
              Authorization: `Bearer ${tokenResponse.access_token}`,
            },
          }).then((res) => res.json())
        );

        const messages = await Promise.all(messageDetailsPromises);
        
        // Parse basic details like Subject and Snippet
        const formattedEmails = messages.map((msg: any) => {
          const subjectHeader = msg.payload?.headers?.find(
            (h: any) => h.name === "Subject"
          );
          const fromHeader = msg.payload?.headers?.find(
            (h: any) => h.name === "From"
          );
          return {
            id: msg.id,
            subject: subjectHeader ? subjectHeader.value : "No Subject",
            from: fromHeader ? fromHeader.value : "Unknown Sender",
            snippet: msg.snippet,
          };
        });

        setEmails(formattedEmails);
      } catch (err: any) {
        console.error(err);
        setError(err.message || "Failed to fetch emails");
      } finally {
        setLoading(false);
      }
    },
    onError: (error) => {
      console.error("Login Failed:", error);
      setError("Login Failed");
    },
  });

  return (
    <div className="p-6 max-w-2xl mx-auto border rounded-2xl shadow-sm bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
          Gmail Extractor
        </h2>
        <button
          onClick={() => login()}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
        >
          {loading ? "Fetching..." : "Connect Gmail"}
        </button>
      </div>

      {error && (
        <div className="p-4 mb-4 text-sm text-red-800 rounded-lg bg-red-50 dark:bg-gray-800 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="space-y-4">
        {emails.length === 0 && !loading && !error && (
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            Click target above to load your 5 most recent emails.
          </p>
        )}
        
        {emails.map((email) => (
          <div
            key={email.id}
            className="p-4 border rounded-lg border-gray-100 dark:border-gray-800"
          >
            <div className="font-semibold text-gray-900 dark:text-white mb-1">
              {email.subject}
            </div>
            <div className="text-sm text-gray-500 mb-2">From: {email.from}</div>
            <div className="text-sm text-gray-700 dark:text-gray-300 line-clamp-2">
              {email.snippet}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
