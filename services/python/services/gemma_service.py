from __future__ import annotations

import json
import os
import re
import subprocess
from typing import Any
from urllib import error
from urllib import request


DEFAULT_GEMMA_RUNTIME = os.getenv("GEMMA_RUNTIME", "disabled")
DEFAULT_GEMMA_MODEL = os.getenv("GEMMA_MODEL", "gemma-4-local")
DEFAULT_LM_STUDIO_BASE_URL = os.getenv("LM_STUDIO_BASE_URL", "http://localhost:1234/v1")


class GemmaService:
    def __init__(
        self,
        runtime: str | None = None,
        model: str | None = None,
        base_url: str | None = None,
    ):
        self.runtime = runtime or DEFAULT_GEMMA_RUNTIME
        self.model = model or DEFAULT_GEMMA_MODEL
        self.base_url = base_url or DEFAULT_LM_STUDIO_BASE_URL

    def resolved_runtime(self) -> str:
        if self.runtime == "lmstudio":
            return "lmstudio"
        return "lmstudio" if self.is_lmstudio_available() else self.runtime

    def is_lmstudio_available(self) -> bool:
        try:
            data = self._get_json(f"{self.base_url.rstrip('/')}/models", timeout=5)
            return isinstance(data.get("data"), list)
        except Exception:
            return False

    def list_models(self) -> list[dict[str, Any]]:
        data = self._get_json(f"{self.base_url.rstrip('/')}/models", timeout=5)
        return data.get("data", []) if isinstance(data, dict) else []

    def ensure_lmstudio_server(self) -> dict[str, Any]:
        if self.is_lmstudio_available():
            return {"started": False, "available": True, "method": "probe"}

        lms_path = os.path.expanduser("~/.lmstudio/bin/lms")
        candidates = [lms_path, "lms"]
        last_error = None

        for candidate in candidates:
            try:
                subprocess.run(
                    [candidate, "server", "start"],
                    check=False,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    text=True,
                    timeout=20,
                )
                if self.is_lmstudio_available():
                    return {"started": True, "available": True, "method": candidate}
            except Exception as exc:
                last_error = exc

        return {
            "started": False,
            "available": self.is_lmstudio_available(),
            "method": None,
            "error": str(last_error) if last_error else "Unable to start LM Studio server.",
        }

    def generate_structured(self, prompt: str) -> dict[str, Any]:
        if self.resolved_runtime() == "disabled":
            return self._fallback("Finance Copilot generation runtime is unavailable.")

        full_prompt = (
            f"{prompt}\n\n"
            "Output ONLY valid JSON with keys: "
            "answer, why, supporting_items, sources, confidence, "
            "redacted_items, reasoning_steps."
        )

        for attempt in range(2):
            try:
                raw_text = self._raw_generate(full_prompt, attempt=attempt)
                return self._parse_response(raw_text)
            except Exception:
                continue
        return self._fallback("Finance Copilot could not produce valid structured output.")

    def extract_document_json(
        self,
        *,
        file_name: str,
        document_type: str,
        text: str,
        document_hash: str | None = None,
    ) -> tuple[dict[str, Any], dict[str, Any]]:
        redacted_text = (text or "").strip()
        if not redacted_text:
            return (
                {
                    "document_type": document_type,
                    "file_name": file_name,
                    "summary": "No extractable text was available for structured parsing.",
                    "fields": {},
                    "line_items": [],
                },
                {
                    "runtime": self.runtime,
                    "model": self.model,
                    "used_llm": False,
                    "fallback_mode": "empty_text",
                },
            )

        if self.resolved_runtime() == "lmstudio":
            prompt = (
                "Extract the financial document into strict JSON.\n"
                "Use only the provided text. Never invent values.\n"
                "Return keys: document_type, file_name, summary, fields, line_items.\n"
                "Inside fields include any available values such as invoice_number, vendor_name, "
                "client_name, total_amount, subtotal, gst_amount, gst_percent, issue_date, due_date, "
                "currency, payment_terms, bank_reference.\n"
                "line_items must be an array of objects when available.\n\n"
                f"FILE NAME: {file_name}\n"
                f"DOCUMENT TYPE: {document_type}\n"
                f"DOCUMENT HASH: {document_hash or ''}\n"
                "DOCUMENT TEXT:\n"
                f"{redacted_text[:12000]}"
            )
            try:
                raw_text = self._raw_generate(f"{prompt}\n\nOutput ONLY valid JSON.")
                parsed = json.loads(raw_text.strip())
                normalized = {
                    "document_type": parsed.get("document_type") or document_type,
                    "file_name": parsed.get("file_name") or file_name,
                    "summary": parsed.get("summary") or "Structured extraction completed.",
                    "fields": parsed.get("fields") if isinstance(parsed.get("fields"), dict) else {},
                    "line_items": parsed.get("line_items") if isinstance(parsed.get("line_items"), list) else [],
                }
                return (
                    normalized,
                    {
                        "runtime": self.runtime,
                        "model": self.model,
                        "used_llm": True,
                        "fallback_mode": None,
                    },
                )
            except Exception:
                pass

        return self._heuristic_extract_document_json(
            file_name=file_name,
            document_type=document_type,
            text=redacted_text,
            document_hash=document_hash,
        )

    def _parse_response(self, raw_text: str) -> dict[str, Any]:
        parsed = json.loads(raw_text.strip())
        normalized = {
            "answer": parsed.get("answer", ""),
            "why": parsed.get("why", ""),
            "supporting_items": parsed.get("supporting_items", []),
            "sources": parsed.get("sources", []),
            "confidence": int(parsed.get("confidence", 0) or 0),
            "redacted_items": parsed.get("redacted_items", []),
            "reasoning_steps": parsed.get("reasoning_steps", []),
        }
        required = ("answer", "why", "supporting_items", "sources")
        if not all(key in normalized for key in required):
            raise ValueError("Missing required JSON keys")
        return normalized

    def _raw_generate(self, prompt: str, attempt: int = 0) -> str:
        runtime = self.resolved_runtime()
        if runtime == "test":
            raise RuntimeError("Test runtime requires a patched _raw_generate")
        if runtime == "mlx":
            raise RuntimeError("MLX runtime is not configured yet")
        if runtime == "lmstudio":
            errors: list[str] = []

            # Preferred path: OpenAI-compatible API exposed by LM Studio.
            try:
                data = self._post_json(
                    f"{self.base_url}/chat/completions",
                    {
                        "model": self.model,
                        "messages": [{"role": "user", "content": prompt}],
                        "temperature": 0.0,
                    },
                )
                return data["choices"][0]["message"]["content"]
            except Exception as exc:
                errors.append(f"openai-compatible failed: {exc}")

            # Fallback path: LM Studio native API.
            try:
                data = self._post_json(
                    self._native_api_url(),
                    {
                        "model": self.model,
                        "input": prompt,
                        "system_prompt": "Respond with valid JSON only.",
                    },
                )
                return data["output"][0]["content"]
            except Exception as exc:
                errors.append(f"native failed: {exc}")
                raise RuntimeError("; ".join(errors)) from exc
        raise RuntimeError(f"Unsupported Gemma runtime: {runtime}")

    def _native_api_url(self) -> str:
        base = self.base_url.rstrip("/")
        if base.endswith("/v1"):
            base = base[:-3]
        return f"{base}/api/v1/chat"

    def _post_json(self, url: str, payload: dict[str, Any]) -> dict[str, Any]:
        request_payload = json.dumps(payload).encode("utf-8")
        req = request.Request(
            url,
            data=request_payload,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            with request.urlopen(req, timeout=60) as response:
                return json.loads(response.read().decode("utf-8"))
        except error.HTTPError as exc:
            body = ""
            try:
                body = exc.read().decode("utf-8")
            except Exception:
                body = ""
            raise RuntimeError(f"HTTP {exc.code} from {url}: {body[:200]}") from exc
        except error.URLError as exc:
            raise RuntimeError(f"Could not reach {url}: {exc.reason}") from exc

    def _get_json(self, url: str, timeout: int = 10) -> dict[str, Any]:
        req = request.Request(url, method="GET")
        try:
            with request.urlopen(req, timeout=timeout) as response:
                return json.loads(response.read().decode("utf-8"))
        except error.HTTPError as exc:
            body = ""
            try:
                body = exc.read().decode("utf-8")
            except Exception:
                body = ""
            raise RuntimeError(f"HTTP {exc.code} from {url}: {body[:200]}") from exc
        except error.URLError as exc:
            raise RuntimeError(f"Could not reach {url}: {exc.reason}") from exc

    def _fallback(self, why: str) -> dict[str, Any]:
        return {
            "answer": "I encountered an issue processing your request.",
            "why": why,
            "supporting_items": [],
            "sources": [],
            "confidence": 0,
            "redacted_items": [],
            "reasoning_steps": ["Returned a safe fallback response."],
        }

    def _heuristic_extract_document_json(
        self,
        *,
        file_name: str,
        document_type: str,
        text: str,
        document_hash: str | None = None,
    ) -> tuple[dict[str, Any], dict[str, Any]]:
        invoice_number = self._search_first(
            text,
            [
                r"invoice\s*(?:no|number|#)?\s*[:\-]?\s*([A-Z0-9\-\/]+)",
                r"bill\s*(?:no|number|#)?\s*[:\-]?\s*([A-Z0-9\-\/]+)",
            ],
        )
        total_amount = self._search_amount(
            text,
            [
                r"\btotal\b(?:\s+amount)?\s*[:\-]?\s*(?:rs\.?|inr|₹)?\s*([\d,]+(?:\.\d{1,2})?)",
                r"grand\s+total\s*[:\-]?\s*(?:rs\.?|inr|₹)?\s*([\d,]+(?:\.\d{1,2})?)",
            ],
        )
        subtotal = self._search_amount(
            text,
            [r"subtotal\s*[:\-]?\s*(?:rs\.?|inr|₹)?\s*([\d,]+(?:\.\d{1,2})?)"],
        )
        gst_amount = self._search_amount(
            text,
            [
                r"gst(?:\s+amount)?\s*[:\-]?\s*(?:rs\.?|inr|₹)?\s*([\d,]+(?:\.\d{1,2})?)",
                r"tax(?:\s+amount)?\s*[:\-]?\s*(?:rs\.?|inr|₹)?\s*([\d,]+(?:\.\d{1,2})?)",
            ],
        )
        gst_percent = self._search_first(
            text,
            [r"gst\s*[:\-]?\s*(\d{1,2}(?:\.\d+)?)\s*%"],
        )
        issue_date = self._search_first(
            text,
            [r"(?:issue\s+date|date)\s*[:\-]?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})"],
        )
        due_date = self._search_first(
            text,
            [r"due\s+date\s*[:\-]?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})"],
        )
        vendor_name = self._guess_party_name(text)
        line_items = self._extract_line_items(text)
        summary_bits = [
            f"Type: {document_type}",
            f"Invoice number: {invoice_number}" if invoice_number else None,
            f"Total: Rs {total_amount}" if total_amount is not None else None,
            f"GST: Rs {gst_amount}" if gst_amount is not None else None,
            f"Detected {len(line_items)} possible line items" if line_items else None,
        ]

        return (
            {
                "document_type": document_type,
                "file_name": file_name,
                "summary": ". ".join(bit for bit in summary_bits if bit),
                "fields": {
                    "invoice_number": invoice_number,
                    "vendor_name": vendor_name,
                    "client_name": None,
                    "subtotal": subtotal,
                    "gst_amount": gst_amount,
                    "gst_percent": self._safe_float(gst_percent),
                    "total_amount": total_amount,
                    "issue_date": issue_date,
                    "due_date": due_date,
                    "currency": "INR" if "₹" in text or "inr" in text.lower() or "rs" in text.lower() else None,
                    "document_hash": document_hash,
                },
                "line_items": line_items,
            },
            {
                "runtime": self.runtime,
                "model": self.model,
                "used_llm": False,
                "fallback_mode": "heuristic_parser",
            },
        )

    def _search_first(self, text: str, patterns: list[str]) -> str | None:
        for pattern in patterns:
            match = re.search(pattern, text, flags=re.IGNORECASE)
            if match:
                return match.group(1).strip()
        return None

    def _search_amount(self, text: str, patterns: list[str]) -> float | None:
        value = self._search_first(text, patterns)
        return self._safe_float(value)

    def _safe_float(self, value: Any) -> float | None:
        if value in (None, ""):
            return None
        try:
            return float(str(value).replace(",", ""))
        except Exception:
            return None

    def _guess_party_name(self, text: str) -> str | None:
        lines = [line.strip() for line in text.splitlines() if line.strip()]
        for line in lines[:8]:
            cleaned = line.strip(":").strip()
            if len(cleaned.split()) >= 2 and not any(char.isdigit() for char in cleaned):
                return cleaned[:120]
        return None

    def _extract_line_items(self, text: str) -> list[dict[str, Any]]:
        items: list[dict[str, Any]] = []
        for raw_line in text.splitlines():
            line = raw_line.strip()
            if not line or len(line) < 8:
                continue
            amount_match = re.search(r"(?:rs\.?|inr|₹)?\s*([\d,]+(?:\.\d{1,2})?)\s*$", line, flags=re.IGNORECASE)
            if not amount_match:
                continue
            amount = self._safe_float(amount_match.group(1))
            if amount is None:
                continue
            label = line[:amount_match.start()].strip(" -:")
            if len(label) < 3:
                continue
            items.append({"label": label[:160], "amount": amount})
            if len(items) >= 8:
                break
        return items
