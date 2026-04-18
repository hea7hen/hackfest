from services.redaction_service import redact_sensitive


def test_redact_gstin():
    text = "Client GSTIN is 22AAAAA0000A1Z5."
    assert "[REDACTED]" in redact_sensitive(text)


def test_redact_pan_like_value():
    text = "PAN AAAAA1234A is on file."
    assert "[REDACTED]" in redact_sensitive(text)


def test_redact_bank_account_like_number():
    text = "Account number 12345678901234 was credited."
    assert "[REDACTED]" in redact_sensitive(text)


def test_redact_phone_like_number():
    text = "Call me at 9876543210."
    assert "[REDACTED]" in redact_sensitive(text)


def test_redaction_is_idempotent():
    text = "GSTIN [REDACTED] and account [REDACTED]"
    assert redact_sensitive(text) == text
