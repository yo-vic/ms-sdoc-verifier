"""
pipeline.py — end to end: inbox -> submission.json

    python3 pipeline.py                 # full run over the local bundle
    python3 pipeline.py --limit 20      # quick smoke test on the first 20 emails
    python3 pipeline.py --resume        # skip emails already in the cache

Requires a Gemini key in .env (GEMINI_API_KEY=...) next to this file.

What it does, per email:
  1. Classify (batched, see classifier.py) into one of the 5 categories.
  2. If category != BL_COMPARISON: write category with status "OK" and no
     defect info (nothing to compare) — matches the sample_submission shape.
  3. If category == BL_COMPARISON:
       a. Find the SI/BL attachments by filename suffix.
          -> missing either one => NEEDS_REVIEW / missing_attachment
       b. Read both attachments (readers.py, any format).
          -> read failure => NEEDS_REVIEW / unreadable
       c. Cheap keyword check for a wrong document type (comparator.py).
          -> triggered => NEEDS_REVIEW / wrong_doc_type
       d. Extract fields with Gemini, compare them.
          -> missing/placeholder field on either side => NEEDS_REVIEW / missing_value
          -> any field differs => MISMATCH (+ defect_fields)
          -> otherwise => OK

Every decision is cached incrementally to run_cache.json, keyed by email_id,
so a crash or rate limit partway through doesn't lose earlier work — re-run
with --resume to pick up where it left off. A human-readable review queue
(review_queue.json) is written alongside submission.json listing every
NEEDS_REVIEW case with the evidence a reviewer needs.
"""
import argparse
import json
import sys
from pathlib import Path

from loader import Inbox
from readers import read_attachment, ReaderError
from comparator import extract_pair, compare_extracted, detect_wrong_doc_type
from classifier import classify_all

FOLDER = Path(__file__).parent
CACHE_PATH = FOLDER / "run_cache.json"
SUBMISSION_PATH = FOLDER / "submission.json"
REVIEW_QUEUE_PATH = FOLDER / "review_queue.json"
ERRORS_PATH = FOLDER / "classification_errors.json"

DEFAULT_RESULT = {
    "status": "OK",
    "review_reason": None,
    "has_defect": False,
    "defect_fields": [],
}


def find_si_bl(email):
    si = bl = None
    for att in email.get("attachments", []):
        stem = Path(att).stem.upper()
        if stem.endswith("_SI"):
            si = att
        elif stem.endswith("_BL"):
            bl = att
    return si, bl


def needs_review(reason, notes=None):
    out = {
        "status": "NEEDS_REVIEW",
        "review_reason": reason,
        "has_defect": False,
        "defect_fields": [],
    }
    if notes:
        out["notes"] = notes
    return out


def process_comparison(inbox, email):
    si_path, bl_path = find_si_bl(email)
    if not si_path or not bl_path:
        missing_side = "SI" if not si_path else "BL"
        return needs_review("missing_attachment", f"{missing_side} attachment not found in email.")

    try:
        si_text = read_attachment(inbox, si_path)
    except ReaderError as exc:
        return needs_review("unreadable", f"SI attachment ({si_path}): {exc.detail}")

    try:
        bl_text = read_attachment(inbox, bl_path)
    except ReaderError as exc:
        return needs_review("unreadable", f"BL attachment ({bl_path}): {exc.detail}")

    si_marker = detect_wrong_doc_type(si_text, "SI")
    bl_marker = detect_wrong_doc_type(bl_text, "BL")
    if si_marker or bl_marker:
        bad_side = "SI" if si_marker else "BL"
        marker = si_marker or bl_marker
        return needs_review("wrong_doc_type", f"{bad_side} attachment looks like a {marker}, not a shipping document.")

    try:
        data = extract_pair(si_text, bl_text)
    except Exception as exc:
        return needs_review("unreadable", f"extraction failed: {exc}")

    result = compare_extracted(data)
    return {k: v for k, v in result.items() if k != "notes"} | (
        {"notes": result["notes"]} if result.get("notes") else {}
    )


def load_cache():
    if CACHE_PATH.exists():
        return json.loads(CACHE_PATH.read_text())
    return {}


def save_cache(cache):
    CACHE_PATH.write_text(json.dumps(cache, indent=2))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=None, help="only process the first N emails (smoke test)")
    parser.add_argument("--resume", action="store_true", help="skip email_ids already present in run_cache.json")
    parser.add_argument("--data", default=str(FOLDER), help="bundle folder or http://host:port server")
    args = parser.parse_args()

    inbox = Inbox(args.data)
    emails = inbox.emails()
    if args.limit:
        emails = emails[: args.limit]

    cache = load_cache() if args.resume else {}

    to_classify = [e for e in emails if e["email_id"] not in cache]
    print(f"{len(emails)} emails total, {len(to_classify)} need classification.")

    if to_classify:
        def progress(i, n):
            print(f"  classifying batch {i}/{n}...", file=sys.stderr)

        categories, errors = classify_all(to_classify, on_progress=progress)
        if errors:
            ERRORS_PATH.write_text(json.dumps(errors, indent=2))
            print(f"  {len(errors)} classification batch(es) failed and fell back to GENERAL "
                  f"(see {ERRORS_PATH.name}).")
    else:
        categories, errors = {}, []

    by_id = {e["email_id"]: e for e in emails}
    for i, email in enumerate(to_classify, start=1):
        eid = email["email_id"]
        category = categories.get(eid, "GENERAL")

        if category == "BL_COMPARISON":
            result = process_comparison(inbox, email)
        else:
            result = dict(DEFAULT_RESULT)

        cache[eid] = {"category": category, **result}

        if i % 25 == 0 or i == len(to_classify):
            print(f"  processed {i}/{len(to_classify)}", file=sys.stderr)
            save_cache(cache)

    save_cache(cache)

    # Build submission.json in the exact required shape.
    submission = {}
    for email in emails:
        eid = email["email_id"]
        entry = cache[eid]
        submission[eid] = {
            "category": entry["category"],
            "status": entry["status"],
            "review_reason": entry.get("review_reason"),
            "has_defect": entry.get("has_defect", False),
            "defect_fields": entry.get("defect_fields", []),
        }
    SUBMISSION_PATH.write_text(json.dumps(submission, indent=2))

    # Human review queue: every NEEDS_REVIEW case with its evidence.
    review_queue = [
        {"email_id": eid, **{k: v for k, v in cache[eid].items()}}
        for eid in submission
        if submission[eid]["status"] == "NEEDS_REVIEW"
    ]
    REVIEW_QUEUE_PATH.write_text(json.dumps(review_queue, indent=2))

    # Summary.
    from collections import Counter
    cat_counts = Counter(v["category"] for v in submission.values())
    status_counts = Counter(v["status"] for v in submission.values())
    reason_counts = Counter(v["review_reason"] for v in submission.values() if v["review_reason"])

    print("\n=== Summary ===")
    print("By category:", dict(cat_counts))
    print("By status:  ", dict(status_counts))
    print("Review reasons:", dict(reason_counts))
    print(f"\nWrote {SUBMISSION_PATH.name}, {REVIEW_QUEUE_PATH.name}, {CACHE_PATH.name}")


if __name__ == "__main__":
    main()
