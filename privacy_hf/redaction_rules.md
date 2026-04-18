# 2ASK Redaction Rules
# Local Gemma 4 Privacy Gateway
# Version 1.0 | For use with Gmail and financial document processing
#
# PURPOSE: These rules define what Gemma 4 must redact from any retrieved
# data BEFORE it is sent to an external cloud model (Claude/GPT-4).
# When in doubt → REDACT. Never under-redact.

---

## PHILOSOPHY

The guiding principle is **minimum necessary information**.
The cloud model receives only what it needs to complete the task.
Everything else is replaced with a structured placeholder token.

Placeholder format: [REDACTED:TYPE] where TYPE describes what was removed.
This lets the cloud model understand the data shape without seeing the value.

Example:
  Original:  "Invoice from Rahul Sharma, rahul@email.com, +91-98765-43210"
  Redacted:  "Invoice from [REDACTED:PERSON_NAME], [REDACTED:EMAIL], [REDACTED:PHONE]"

---

## CATEGORY A — ALWAYS REDACT (Hard Block)
### These are NEVER sent to the cloud model under any circumstance.

### A1: Personal Identity
- Full legal name of any individual person
  - Examples: "Rahul Sharma", "Priya Menon", "John D'Souza"
  - Exception: Public company names (AWS, Google, Infosys) are NOT redacted
  - Placeholder: [REDACTED:PERSON_NAME]
- Aadhaar number (12-digit) → [REDACTED:AADHAAR]
- PAN number (format: ABCDE1234F) → [REDACTED:PAN]
- Passport number → [REDACTED:PASSPORT]
- Voter ID / EPIC number → [REDACTED:VOTER_ID]
- Driver's license number → [REDACTED:DL_NUMBER]
- Date of birth → [REDACTED:DOB]

### A2: Contact Information
- Personal email addresses
  - Exception: Business domain emails of public companies (billing@aws.amazon.com) are NOT redacted
  - Personal heuristic: gmail.com, yahoo.com, hotmail.com, protonmail.com, outlook personal → REDACT
  - Placeholder: [REDACTED:EMAIL]
- Phone numbers (any format: +91, 0091, 10-digit mobile, landline) → [REDACTED:PHONE]
- Personal WhatsApp numbers → [REDACTED:PHONE]
- Home address, residential address → [REDACTED:HOME_ADDRESS]
- Personal GPS coordinates → [REDACTED:LOCATION]

### A3: Financial Secrets
- Bank account numbers → [REDACTED:BANK_ACCOUNT]
- IFSC codes (when paired with account number) → [REDACTED:IFSC]
- Credit/debit card numbers (full or partial like XXXX-1234) → [REDACTED:CARD_NUMBER]
- CVV / expiry date → [REDACTED:CARD_SECRET]
- UPI IDs (format: name@upi or phone@bank) → [REDACTED:UPI_ID]
- Net banking username/password → [REDACTED:CREDENTIALS]
- OTP, PIN, MPIN → [REDACTED:OTP_PIN]
- Loan account numbers → [REDACTED:LOAN_ACCOUNT]
- Fixed deposit certificate numbers → [REDACTED:FD_NUMBER]

### A4: Authentication Secrets
- Passwords (any context) → [REDACTED:PASSWORD]
- API keys, secret keys, tokens → [REDACTED:API_KEY]
- Private SSH/SSL keys → [REDACTED:PRIVATE_KEY]
- Security questions and answers → [REDACTED:SECURITY_QA]
- 2FA backup codes → [REDACTED:2FA_CODE]

### A5: Medical and Legal
- Medical diagnoses, prescriptions, test results → [REDACTED:MEDICAL_INFO]
- Mental health information → [REDACTED:MEDICAL_INFO]
- Legal case numbers, FIR numbers → [REDACTED:LEGAL_CASE]
- Attorney-client communications → [REDACTED:LEGAL_PRIVILEGED]
- Insurance claim details with personal identifiers → [REDACTED:INSURANCE_CLAIM]

### A6: Third-Party Personal Data
- Names, contacts, or financial details of clients of the freelancer
  - Context: If a Gmail thread contains a client's personal bank details, redact them
  - Client company name: Keep if it's a registered business entity
  - Individual client's personal email/phone: Redact
  - Placeholder: [REDACTED:CLIENT_PERSONAL_DATA]
- Employee data (if freelancer manages any staff) → [REDACTED:EMPLOYEE_DATA]
- Personal data of family members mentioned in emails → [REDACTED:PERSON_NAME] / [REDACTED:EMAIL]

---

## CATEGORY B — CONDITIONALLY REDACT (Context-Dependent)
### Redact these if they appear in a personal/sensitive context. Keep if purely business.

### B1: Business Email Addresses
- KEEP if: sender/recipient is a known business domain for a public company
  - billing@aws.amazon.com → KEEP (it's a vendor, not a person)
  - noreply@razorpay.com → KEEP
  - invoices@zoom.us → KEEP
- REDACT if: it's clearly a personal business email of an individual
  - rahul@rahulconsulting.in → [REDACTED:EMAIL] (individual professional)
  - priya.menon@freelancer.com → [REDACTED:EMAIL]

### B2: Transaction Reference Numbers
- KEEP if: reference numbers are needed for task context (e.g., "track invoice INV-2025-0034")
  - Invoice numbers (INV-XXXX) → KEEP
  - GST invoice reference numbers → KEEP
  - UTR (bank transaction reference) → [REDACTED:UTR] (contains no personal info but is traceable)
- Rule: If the reference number alone cannot identify a person, keep it.

### B3: Geographic Location
- City and State → KEEP (needed for GST jurisdiction, place of supply)
  - "Mumbai, Maharashtra" → KEEP
  - "Bengaluru, Karnataka" → KEEP
- Pincode → KEEP if standalone (non-personal)
- Full street address of a business → KEEP (it's public information)
- Home/residential address → REDACT (Category A)

### B4: Salary and Personal Income
- Exact salary figures in personal context → [REDACTED:SALARY]
- Income from personal investments not related to the task → [REDACTED:PERSONAL_INCOME]
- Exact professional income amounts: KEEP (needed for tax calculations)
  - "₹1,50,000 received from Acme Corp for software development" → KEEP amount and company

### B5: Email Subject Lines and Body Text
- Subject lines containing personal names → redact the name, keep the subject structure
  - "Invoice from Rahul" → "Invoice from [REDACTED:PERSON_NAME]"
  - "AWS Invoice - March 2026" → KEEP (no personal info)
- Email body: apply all Category A rules to the body text
- Attachments: treat attachment content with same rules as email body

---

## CATEGORY C — ALWAYS KEEP (Non-Sensitive, Task-Relevant)
### These are safe to send to the cloud model.

### C1: Vendor and Business Information
- Public company names (AWS, Google, Microsoft, Razorpay, Zoho, Infosys, etc.)
- Registered business entity names (Acme Pvt Ltd, XYZ Solutions LLP)
- Vendor GST registration numbers (GSTIN) — these are public business identifiers
- Official business addresses of vendors

### C2: Transaction Financial Data
- Invoice amounts (₹ values)
- GST amounts and GST rates (5%, 18%, etc.)
- TDS amounts deducted
- Total payable / total received
- Currency and conversion rates (USD, EUR to INR)
- Payment dates
- Service descriptions (what was purchased/sold)

### C3: Tax and Compliance Data
- SAC codes and HSN codes
- TDS section references (Section 393, 194J, etc.)
- GST invoice numbers (B2B invoices)
- GSTIN of vendors (public registry data)
- Tax Year and financial period references
- Advance tax installment amounts
- Deduction categories (80C, 80D instruments — without personal account numbers)

### C4: Dates and Time References
- Invoice dates
- Payment dates
- Due dates
- Financial year periods (Q1 FY2026-27, etc.)
- Subscription renewal dates

### C5: Service and Product Descriptions
- Description of services rendered or received
- Product categories
- Subscription plan names (AWS EC2, Google Workspace Business Standard)
- Project names (keep generic; redact if they reveal client identity)

### C6: Aggregate Statistics (when no individual is identifiable)
- Total spend by category
- Monthly expense summaries
- GST paid year-to-date
- Number of invoices processed

---

## REDACTION RULES FOR GMAIL SPECIFICALLY

### Email Headers
| Field | Action |
|-------|--------|
| From (personal email) | [REDACTED:EMAIL] |
| From (vendor/business) | KEEP |
| To (personal) | [REDACTED:EMAIL] |
| To (business) | KEEP |
| CC / BCC | [REDACTED:EMAIL] for all |
| Subject | Apply inline redaction |
| Date / Time | KEEP |
| Message-ID | [REDACTED:MSG_ID] |

### Email Body
- Apply all Category A rules line by line
- Keep financial figures, dates, vendor names
- Redact signatures (contain personal name, phone, personal email)
  - Full signature block → [REDACTED:EMAIL_SIGNATURE]
- Thread history: apply same rules to all quoted replies

### Attachments (PDFs, Images)
- If extracted as text, apply same rules
- If the attachment is a GST invoice from a vendor → mostly safe (C1-C4)
- If the attachment is a personal bank statement → heavy redaction (A1-A3)

---

## REDACTION OUTPUT FORMAT FOR GEMMA 4

When Gemma 4 processes a document, it should output:

```json
{
  "original_length": 1240,
  "redacted_length": 890,
  "redaction_count": 7,
  "redaction_log": [
    {"type": "EMAIL", "position": "line 3", "replacement": "[REDACTED:EMAIL]"},
    {"type": "PHONE", "position": "line 3", "replacement": "[REDACTED:PHONE]"},
    {"type": "PERSON_NAME", "position": "line 1", "replacement": "[REDACTED:PERSON_NAME]"}
  ],
  "sensitivity_score": 0.72,
  "safe_to_send": true,
  "redacted_text": "... the cleaned text ..."
}
```

sensitivity_score: 0.0 (no PII) to 1.0 (heavy PII)
safe_to_send: true if all Category A items have been redacted

---

## EDGE CASES AND DECISION TREE

### "Is this a person or a company?"
1. Does the name appear in a GST invoice as a registered entity? → Company → KEEP
2. Is it a single personal name format (First Last)? → Person → REDACT
3. Is it followed by "Pvt Ltd", "LLP", "Inc", "Corp"? → Company → KEEP
4. Is it associated with a personal email? → Person → REDACT

### "Is this email address safe?"
1. Domain is amazon.com, google.com, microsoft.com, razorpay.com, etc.? → KEEP
2. Domain is gmail.com, yahoo.com, hotmail.com? → REDACT
3. Domain is a small business (rahuldesigns.in)? → REDACT (individual professional)
4. Noreply / automated sender from known platform? → KEEP

### "Is this financial data safe?"
1. Is it an invoice amount between freelancer and a named business? → KEEP
2. Is it a personal bank account balance? → REDACT
3. Is it a salary slip with personal details? → Redact personal fields, keep amounts if task-relevant
4. Is it a client's payment details? → REDACT all (A6: third-party data)

---

## SYSTEM PROMPT TEMPLATE FOR GEMMA 4 REDACTION

Use this exact system prompt when calling Gemma 4 for redaction:

```
You are a privacy redaction engine. Your only job is to remove personally 
identifiable information (PII) and sensitive data from text before it is 
sent to an external AI model.

REDACT (replace with placeholder tokens):
- Personal names of individuals → [REDACTED:PERSON_NAME]
- Personal email addresses (gmail, yahoo, hotmail, personal domains) → [REDACTED:EMAIL]
- Phone numbers → [REDACTED:PHONE]
- Home/residential addresses → [REDACTED:HOME_ADDRESS]
- Bank account numbers, card numbers, UPI IDs → [REDACTED:BANK_ACCOUNT] / [REDACTED:CARD_NUMBER] / [REDACTED:UPI_ID]
- Aadhaar, PAN, Passport numbers → [REDACTED:AADHAAR] / [REDACTED:PAN] / [REDACTED:PASSPORT]
- OTPs, passwords, API keys → [REDACTED:OTP_PIN] / [REDACTED:PASSWORD] / [REDACTED:API_KEY]
- Email signatures → [REDACTED:EMAIL_SIGNATURE]

KEEP (do not redact):
- Public company names (AWS, Google, Razorpay, Infosys)
- Invoice amounts, GST amounts, TDS amounts
- Vendor GSTIN numbers (public business identifiers)
- Service descriptions and SAC codes
- Dates, financial periods, tax year references
- Business email addresses of known vendors (billing@aws.amazon.com)

Output ONLY the redacted text. Do not explain. Do not add commentary.
Preserve all formatting, line breaks, and structure of the original text.
```
