import os
from dotenv import load_dotenv
from google import genai

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

if not GEMINI_API_KEY:
    raise RuntimeError("GEMINI_API_KEY is missing from .env")

client = genai.Client(
    api_key=GEMINI_API_KEY
)

print("Testing Gemini API...")

response = client.models.generate_content(
    model="gemini-3.5-flash-lite",
    contents="Reply with exactly: GEMINI_OK"
)

print()
print("Gemini response:")
print(response.text)
print()
print("Gemini API connection is working.")