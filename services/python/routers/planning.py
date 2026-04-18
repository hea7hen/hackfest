from fastapi import APIRouter

from services.workspace_service import list_calendar_events

router = APIRouter(prefix="/planning", tags=["Planning"])


@router.get("/events")
def get_planning_events():
    return list_calendar_events()
