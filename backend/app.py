from pathlib import Path
import os

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware

from loader import Inbox
from classifier import classify_all
from pipeline import process_comparison, DEFAULT_RESULT

from dotenv import load_dotenv

# Load environment variables from .env
load_dotenv()
load_dotenv(".env") # Reads .env if present

app = FastAPI(title="Shipping Document Verifier API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://ms-sdoc-verifier.vercel.app", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

FOLDER = Path(__file__).parent
inbox = Inbox(str(FOLDER)) # local bundle: backend/inbox + backend/attachments

_results: dict = {} # email_id -> result entry
_run_status = {"running": False, "processed": 0, "total": 0}


def _supabase():
    from supabase import create_client
    return create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])


def _persist(email_id: str, category: str, result: dict):
    """Best-effort — a DB hiccup shouldn't kill an in-progress run."""
    client = _supabase()
    try:
        client.table("emails").update({
            "category": category,
            "category_decided_by": "llm",  # classify_all always uses Gemini, no rule path exists yet
        }).eq("id", email_id).execute()

        client.table("comparisons").upsert({
            "email_id": email_id,
            "status": result["status"],
            "review_reason": result.get("review_reason"),
            "mismatched_fields": result.get("defect_fields", []),
        }, on_conflict="email_id").execute()

        if result.get("notes"):
            client.table("audit_log").insert({
                "email_id": email_id,
                "actor": "system",
                "action": "comparison_result",
                "detail": {"notes": result["notes"]},
            }).execute()
    except Exception as exc:
        print(f"[warn] Supabase persist failed for {email_id}: {exc}")


def _run_pipeline(limit: int | None = None):
    _run_status.update(running=True, processed=0)
    emails = inbox.emails()
    if limit:
        emails = emails[:limit]
    _run_status["total"] = len(emails)

    to_classify = [e for e in emails if e["email_id"] not in _results]
    categories, errors = classify_all(to_classify) if to_classify else ({}, [])

    for email in to_classify:
        eid = email["email_id"]
        category = categories.get(eid, "GENERAL")
        result = process_comparison(inbox, email) if category == "BL_COMPARISON" else dict(DEFAULT_RESULT)
        _results[eid] = {"category": category, **result}
        _persist(eid, category, result)
        _run_status["processed"] += 1

    _run_status["running"] = False
    return {"processed": len(to_classify), "errors": errors}


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/api/emails")
def list_emails():
    return [{"email_id": e["email_id"], "subject": e.get("subject", "(No subject)")} for e in inbox.emails()]


@app.post("/api/run")
def start_run(background_tasks: BackgroundTasks, limit: int | None = None):
    if _run_status["running"]:
        raise HTTPException(409, "A pipeline run is already in progress.")
    background_tasks.add_task(_run_pipeline, limit)
    return {"started": True}


@app.get("/api/run/status")
def run_status():
    return _run_status


@app.get("/api/results")
def list_results():
    return [{"email_id": eid, **entry} for eid, entry in _results.items()]


@app.get("/api/results/{email_id}")
def get_result(email_id: str):
    entry = _results.get(email_id)
    if entry is None:
        raise HTTPException(404, "No result yet — has the pipeline run?")
    return {"email_id": email_id, **entry}


@app.get("/api/review-queue")
def review_queue():
    return [{"email_id": eid, **e} for eid, e in _results.items() if e["status"] == "NEEDS_REVIEW"]