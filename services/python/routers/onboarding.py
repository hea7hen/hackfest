from datetime import datetime

from fastapi import APIRouter

from models.schemas import UserProfile, UserProfileUpdate
from services.audit_service import create_audit_event
from services.storage import execute, fetch_one, row_to_dict

router = APIRouter(prefix="/user", tags=["User"])


@router.get("/profile", response_model=UserProfile | None)
def get_profile():
    return row_to_dict(fetch_one("SELECT * FROM users WHERE id = 1"))


@router.post("/profile", response_model=UserProfile)
def update_profile(payload: UserProfileUpdate):
    existing = fetch_one("SELECT id FROM users WHERE id = 1")
    if existing:
        execute(
            """
            UPDATE users
            SET name = ?, email = ?, profession = ?, gst_registered = ?, preferred_currency = ?, wallet_address = ?
            WHERE id = 1
            """,
            (
                payload.name,
                payload.email,
                payload.profession,
                int(payload.gst_registered),
                payload.preferred_currency,
                payload.wallet_address,
            ),
        )
    else:
        execute(
            """
            INSERT INTO users (id, name, email, profession, gst_registered, preferred_currency, wallet_address, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                1,
                payload.name,
                payload.email,
                payload.profession,
                int(payload.gst_registered),
                payload.preferred_currency,
                payload.wallet_address,
                datetime.utcnow().isoformat(),
            ),
        )

    create_audit_event(1, "profile", "1", "freelancer_onboarded", payload.model_dump())
    return row_to_dict(fetch_one("SELECT * FROM users WHERE id = 1"))
