import os
import time
from dotenv import load_dotenv
from google import genai

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

if not GEMINI_API_KEY:
    raise RuntimeError("GEMINI_API_KEY is missing from .env")

client = genai.Client(api_key=GEMINI_API_KEY)

print("Creating Gemini File Search store...")

store = client.file_search_stores.create(
    config={
        "display_name": "AI Food Recall Knowledge Base",
        "embedding_model": "models/gemini-embedding-2"
    }
)

print()
print("File Search Store created:")
print(store.name)

print()
print("Uploading knowledge_base.txt...")

operation = client.file_search_stores.upload_to_file_search_store(
    file="knowledge_base.txt",
    file_search_store_name=store.name,
    config={
        "display_name": "Food Recall Knowledge Base"
    }
)

print()
print("Indexing knowledge base...")

while not operation.done:
    print("Still indexing...")
    time.sleep(5)
    operation = client.operations.get(operation)

print()
print("======================================")
print("RAG SETUP COMPLETE")
print("======================================")
print()
print("Store name:")
print(store.name)
print()
print("Add this line to your .env:")
print()
print(f"GEMINI_FILE_SEARCH_STORE={store.name}")
print()