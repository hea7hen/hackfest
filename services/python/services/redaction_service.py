from __future__ import annotations

import re

REDACTION_VERSION = "v1"
REDACTION_TOKEN = "[REDACTED]"

PATTERNS: tuple[tuple[str, re.Pattern[str]], ...] = (
    ("gstin", re.compile(r"\b\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]\b")),
    ("pan", re.compile(r"\b[A-Z]{5}\d{4}[A-Z]\b")),
    ("account", re.compile(r"\b\d{9,18}\b")),
    ("phone", re.compile(r"\b[6-9]\d{9}\b")),
)


def collect_redactions(text: str) -> list[str]:
    if not text:
        return []

    found: list[str] = []
    for label, pattern in PATTERNS:
        matches = pattern.findall(text)
        for match in matches:
            found.append(f"{label}:{match}")
    return found


def redact_sensitive(text: str) -> str:
    if not text:
        return ""
    if REDACTION_TOKEN in text and not collect_redactions(text):
        return text

    redacted = text
    for _, pattern in PATTERNS:
        redacted = pattern.sub(REDACTION_TOKEN, redacted)
    return redacted
