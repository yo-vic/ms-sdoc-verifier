import json
from pathlib import Path
import streamlit as st

st.set_page_config(page_title="Shipping Document Verifier", layout="wide")

folder = Path(__file__).parent
st.title("Shipping Document Verifier")
st.caption("Saved comparison • email_004 • No live AI call on this page")

result_path = folder / "comparison_result.json"
if not result_path.exists():
    st.warning("Run compare_one.py first to save a comparison.")
    st.stop()

data = json.loads(result_path.read_text(encoding="utf-8"))

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
        st.text((folder / "attachments/email_004_SI.txt").read_text(
            encoding="utf-8"
        ))
    with right:
        st.subheader("Draft Bill of Lading")
        st.text((folder / "attachments/email_004_BL.txt").read_text(
            encoding="utf-8"
        ))