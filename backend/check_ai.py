from pathlib import Path
from dotenv import dotenv_values
from google import genai

settings = dotenv_values(Path(__file__).with_name(".env"))
key = settings.get("GEMINI_API_KEY")

if not key or key == "replace_this_with_your_actual_key":
    raise SystemExit("Add your actual Gemini key to .env first.")

client = genai.Client(api_key=key)

print("Checking connection...")
for model in client.models.list():
    if "flash" in (model.name or "").lower():
        print(model.name)

print("Connection successful.")

response = client.models.generate_content(
    model="gemini-3.1-flash-lite",
    contents="Reply with exactly: Shipping verifier AI is ready."
)

print(response.text)