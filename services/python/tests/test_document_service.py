from services.document_service import parse_transactions_from_csv


def test_parse_transactions_from_csv_uses_word_boundaries_for_direction_inference():
    content = (
        b"date,description,amount\n"
        b"2026-04-01,Client payment received,50000\n"
        b"2026-04-02,Adobe subscription,2500\n"
    )

    transactions = parse_transactions_from_csv(content)

    assert transactions[0]["direction"] == "credit"
    assert transactions[1]["direction"] == "debit"
