from fastapi.testclient import TestClient

from main import app
from services.storage import initialize_database


def test_verification_response_includes_semantic_fields():
    initialize_database()
    client = TestClient(app)

    response = client.post(
        "/verification/document",
        files={"file": ("sample.txt", b"tampered content", "text/plain")},
    )

    assert response.status_code == 200
    payload = response.json()
    assert "verified" in payload
    assert "document_hash" in payload
    assert "proof_record" in payload
    assert "message" in payload
    assert "semantic_tamper_status" in payload
    assert "semantic_confidence" in payload
    assert "tamper_signals" in payload
