import os
import sys
from pathlib import Path

import pytest


BACKEND_ROOT = Path(__file__).resolve().parents[1]

if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

import services.storage as storage


@pytest.fixture(autouse=True)
def _test_runtime_paths(tmp_path, monkeypatch):
    data_dir = tmp_path / "data"
    upload_dir = tmp_path / "uploads"
    generated_dir = tmp_path / "generated"
    db_path = data_dir / "ledger.db"

    monkeypatch.setenv("LANCEDB_URI", str(tmp_path / "lancedb"))
    monkeypatch.setenv("GEMMA_RUNTIME", "disabled")
    monkeypatch.setenv("FINANCE_COPILOT_TEST_MODE", "1")
    monkeypatch.setattr(storage, "DATA_DIR", data_dir)
    monkeypatch.setattr(storage, "UPLOAD_DIR", upload_dir)
    monkeypatch.setattr(storage, "GENERATED_DIR", generated_dir)
    monkeypatch.setattr(storage, "DB_PATH", db_path)
    monkeypatch.chdir(BACKEND_ROOT)
    yield


@pytest.fixture
def backend_root():
    return BACKEND_ROOT
