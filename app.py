import json
from pathlib import Path
import streamlit as st

from comparator import extract_pair

st.set_page_config(page_title="Shipping Document Verifier", layout="wide")

folder = Path(__file__).parent
st.title("Shipping Document Verifier")
email_files = sorted((folder / "inbox").glob("email_*.json"))
emails = [
    json.loads(path.read_text(encoding="utf-8"))
    for path in email_files
]

if not emails:
    st.warning("No emails found in the inbox folder.")
    st.stop()

emails_by_id = {email["email_id"]: email for email in emails}
email_ids = list(emails_by_id)

selected_id = st.selectbox(
    "Select an email",
    options=email_ids,
    index=email_ids.index("email_004") if "email_004" in email_ids else 0,
    format_func=lambda eid: (
        f"{eid} — {emails_by_id[eid].get('subject', '(No subject)')}"
    ),
)

selected_email = emails_by_id[selected_id]

with st.expander("Read selected email"):
    st.write("From:", selected_email.get("from", "Unknown"))
    st.text(selected_email.get("body", ""))
    st.write("Attachments:", selected_email.get("attachments", []))

attachments = selected_email.get("attachments", [])

si_files = [
    name for name in attachments
    if Path(name).stem.upper().endswith("_SI")
]
bl_files = [
    name for name in attachments
    if Path(name).stem.upper().endswith("_BL")
]

if len(si_files) != 1 or len(bl_files) != 1:
    st.info("This email does not have exactly one SI and one BL attachment.")
    st.stop()

si_path = folder / si_files[0]
bl_path = folder / bl_files[0]

if si_path.suffix.lower() != ".txt" or bl_path.suffix.lower() != ".txt":
    st.info("This version supports TXT documents. Other formats come next.")
    st.stop()

if not si_path.is_file() or not bl_path.is_file():
    st.warning("Needs review: an attachment file is missing.")
    st.stop()

si_text = si_path.read_text(encoding="utf-8")
bl_text = bl_path.read_text(encoding="utf-8")

if not si_text.strip() or not bl_text.strip():
    st.warning("Needs review: a document is empty.")
    st.stop()

# Include document contents so changed files cannot reuse an old result.
cache_key = (selected_id, si_text, bl_text)

if "comparisons" not in st.session_state:
    st.session_state.comparisons = {}

saved = cache_key in st.session_state.comparisons

if st.button("Check documents", disabled=saved):
    try:
        with st.spinner("Extracting shipment fields with Gemini..."):
            result = extract_pair(si_text, bl_text)
        st.session_state.comparisons[cache_key] = result
    except Exception:
        st.error(
            "Processing failed. Check your API access or quota, "
            "then try again. No comparison result was saved."
        )

if cache_key not in st.session_state.comparisons:
    st.info("Click Check documents to process this pair using one AI request.")
    st.stop()

data = st.session_state.comparisons[cache_key]
st.caption("Result retained for this browser session; no repeated AI call.")

fields = [
    "shipper", "consignee", "notify_party",
    "port_of_loading", "port_of_discharge",
    "container_count", "gross_weight_kg",
]

def normalise(value):
    if isinstance(value, str):
        return " ".join(value.casefold().split())
    return value

rows = []
for field in fields:
    si = data["si"].get(field)
    bl = data["bl"].get(field)

    if si is None or bl is None:
        status = "Needs review"
    elif normalise(si) == normalise(bl):
        status = "Match"
    else:
        status = "Difference"

    rows.append({
        "Field": field.replace("_", " ").title(),
        "SI — reference": str(si) if si is not None else "Missing",
        "BL — draft": str(bl) if bl is not None else "Missing",
        "Result": status,
    })

differences = sum(row["Result"] == "Difference" for row in rows)
reviews = sum(row["Result"] == "Needs review" for row in rows)

if reviews:
    st.warning(f"{reviews} field(s) need review; {differences} difference(s) found.")
elif differences:
    st.error(f"{differences} field(s) differ.")
else:
    st.success("No mismatch detected.")

st.dataframe(rows, hide_index=True, use_container_width=True)

with st.expander("Check the original documents"):
    left, right = st.columns(2)
    with left:
        st.subheader("Shipping Instruction")
        st.text(si_text)
    with right:
        st.subheader("Draft Bill of Lading")
        st.text(bl_text)