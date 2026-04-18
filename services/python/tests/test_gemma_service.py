from services.gemma_service import GemmaService


def test_generate_returns_parsed_json(mocker):
    service = GemmaService(runtime="test")
    mocker.patch.object(
        service,
        "_raw_generate",
        return_value='{"answer":"Ready","why":"Grounded","supporting_items":[],"sources":[],"confidence":91,"redacted_items":[],"reasoning_steps":[]}',
    )

    result = service.generate_structured("prompt")

    assert result["answer"] == "Ready"
    assert result["confidence"] == 91


def test_generate_retries_once_for_invalid_json(mocker):
    service = GemmaService(runtime="test")
    mocker.patch.object(
        service,
        "_raw_generate",
        side_effect=[
            "not-json",
            '{"answer":"Recovered","why":"Retry worked","supporting_items":[],"sources":[],"confidence":74,"redacted_items":[],"reasoning_steps":[]}',
        ],
    )

    result = service.generate_structured("prompt")

    assert result["answer"] == "Recovered"
    assert result["confidence"] == 74


def test_generate_returns_fallback_after_second_invalid_response(mocker):
    service = GemmaService(runtime="test")
    mocker.patch.object(service, "_raw_generate", side_effect=["not-json", "still-not-json"])

    result = service.generate_structured("prompt")

    assert result["confidence"] == 0
    assert result["sources"] == []


def test_generate_returns_degraded_mode_when_runtime_unavailable():
    service = GemmaService(runtime="disabled")

    result = service.generate_structured("prompt")

    assert result["confidence"] == 0
    assert "unavailable" in result["why"].lower()


def test_lmstudio_falls_back_to_native_api(mocker):
    service = GemmaService(runtime="lmstudio", base_url="http://localhost:1234/v1", model="google/gemma-4-e2b")
    mocker.patch.object(
        service,
        "_post_json",
        side_effect=[
            RuntimeError("openai route unavailable"),
            {
                "output": [
                    {
                        "content": '{"answer":"Native","why":"Fallback","supporting_items":[],"sources":[],"confidence":80,"redacted_items":[],"reasoning_steps":[]}'
                    }
                ]
            },
        ],
    )

    result = service.generate_structured("prompt")

    assert result["answer"] == "Native"
    assert result["confidence"] == 80


def test_native_api_url_derives_from_v1_base():
    service = GemmaService(runtime="lmstudio", base_url="http://localhost:1234/v1")

    assert service._native_api_url() == "http://localhost:1234/api/v1/chat"


def test_extract_document_json_uses_heuristic_fallback_when_runtime_disabled():
    service = GemmaService(runtime="disabled")

    payload, meta = service.extract_document_json(
        file_name="invoice.pdf",
        document_type="invoice_pdf",
        text="""
        ACME DESIGN STUDIO
        Invoice No: INV-204
        Date: 18/04/2026
        GST: 18%
        Subtotal: Rs 12,000
        GST Amount: Rs 2,160
        Total: Rs 14,160
        """,
        document_hash="abc123",
    )

    assert payload["fields"]["invoice_number"] == "INV-204"
    assert payload["fields"]["total_amount"] == 14160.0
    assert meta["used_llm"] is False
    assert meta["fallback_mode"] == "heuristic_parser"


def test_resolved_runtime_promotes_to_lmstudio_when_server_is_available(mocker):
    service = GemmaService(runtime="disabled", base_url="http://localhost:1234/v1")
    mocker.patch.object(service, "is_lmstudio_available", return_value=True)

    assert service.resolved_runtime() == "lmstudio"


def test_ensure_lmstudio_server_returns_probe_when_already_available(mocker):
    service = GemmaService(runtime="disabled", base_url="http://localhost:1234/v1")
    mocker.patch.object(service, "is_lmstudio_available", return_value=True)

    result = service.ensure_lmstudio_server()

    assert result["available"] is True
    assert result["started"] is False
    assert result["method"] == "probe"
