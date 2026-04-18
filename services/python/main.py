import os
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import auth, audit, cfo, dashboard, documents, finance, invoices, onboarding, planning, tax_passport, verification
from services.rag_service import backfill_existing_records
from services.storage import initialize_database

load_dotenv()


@asynccontextmanager
async def lifespan(_: FastAPI):
    initialize_database()
    try:
        backfill_existing_records()
    except Exception:
        pass
    yield


app = FastAPI(
    title="2ASK Ledger API",
    description="AI CFO agent backend for freelancers with verifiable financial trails",
    version="2.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("ALLOWED_ORIGINS", "http://localhost:3000,http://localhost:3005").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(onboarding.router)
app.include_router(documents.router)
app.include_router(finance.router)
app.include_router(invoices.router)
app.include_router(dashboard.router)
app.include_router(audit.router)
app.include_router(verification.router)
app.include_router(cfo.router)
app.include_router(tax_passport.router)
app.include_router(planning.router)


@app.get("/health", tags=["Health"])
def health_check():
    return {"status": "ok", "product": "2ASK Ledger v2.1"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
