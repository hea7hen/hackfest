"""Load environment: repo-root `.env` first, then optional `agent_knowledge/.env`."""
from pathlib import Path

from dotenv import load_dotenv


def load_project_dotenv() -> None:
    repo_root = Path(__file__).resolve().parent.parent
    agent_dir = Path(__file__).resolve().parent
    load_dotenv(repo_root / ".env")
    load_dotenv(agent_dir / ".env")
