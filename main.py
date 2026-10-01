from pydantic import BaseModel
from google import genai
from fastapi import FastAPI, Query, HTTPException
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
from pathlib import Path
import os
import httpx
import re


# ==========================================
# LOAD ENVIRONMENT VARIABLES
# ==========================================

load_dotenv()

FDA_API_KEY = os.getenv("FDA_API_KEY")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_FILE_SEARCH_STORE = os.getenv("GEMINI_FILE_SEARCH_STORE")

if not GEMINI_API_KEY:
    raise RuntimeError("GEMINI_API_KEY is missing from .env")

if not GEMINI_FILE_SEARCH_STORE:
    raise RuntimeError("GEMINI_FILE_SEARCH_STORE is missing from .env")

gemini_client = genai.Client(
    api_key=GEMINI_API_KEY
)

if not FDA_API_KEY:
    raise RuntimeError("FDA_API_KEY is missing from .env")


# ==========================================
# PATHS
# ==========================================

BASE_DIR = Path(__file__).resolve().parent

FRONTEND_DIR = BASE_DIR.parent / "frontend"

if not FRONTEND_DIR.exists():
    raise RuntimeError(
        f"Frontend folder not found: {FRONTEND_DIR}"
    )


# ==========================================
# FASTAPI APP
# ==========================================

app = FastAPI(
    title="AI Food Recall Assistant API",
    description="FastAPI backend using FDA Food Enforcement API",
    version="1.0.0"
)


# ==========================================
# HOME / HEALTH CHECK
# ==========================================

@app.get("/api")
def api_home():

    return {
        "message": "AI Food Recall FastAPI is working!"
    }


# ==========================================
# FDA RECALL SEARCH
# ==========================================

@app.get("/api/recall/search")
async def search_recall(
    keyword: str = Query(..., min_length=1)
):

    url = "https://api.fda.gov/food/enforcement.json"

    params = {
        "api_key": FDA_API_KEY,
        "search": keyword,
        "limit": 10
    }

    try:

        async with httpx.AsyncClient(timeout=30.0) as client:

            response = await client.get(
                url,
                params=params
            )

        if response.status_code == 404:

            return {
                "keyword": keyword,
                "count": 0,
                "results": []
            }

        if response.status_code != 200:

            raise HTTPException(
                status_code=response.status_code,
                detail="FDA API request failed"
            )

        data = response.json()

        return {
            "keyword": keyword,
            "count": len(data.get("results", [])),
            "results": data.get("results", [])
        }

    except httpx.RequestError as e:

        raise HTTPException(
            status_code=500,
            detail=f"FDA connection failed: {str(e)}"
        )


# ==========================================
# AI RAG REQUEST MODEL
# ==========================================

class RAGRequest(BaseModel):

    question: str
    recall: dict | None = None


# ==========================================
# CLEAN GENERAL RAG ANSWER
# ==========================================

def clean_general_rag_answer(answer: str) -> str:

    if not answer:
        return answer

    # --------------------------------------
    # Remove FDA Recall Facts section
    # --------------------------------------

    patterns = [
        r"(?is)\n*#{0,3}\s*FDA\s+Recall\s+Record\s+Facts\b.*$",
        r"(?is)\n*#{0,3}\s*FDA\s+Recall\s+Facts\b.*$",
        r"(?is)\n*#{0,3}\s*Recall\s+Record\s+Facts\b.*$",
        r"(?is)\n*#{0,3}\s*Recall\s+Facts\b.*$",
    ]

    for pattern in patterns:

        answer = re.sub(
            pattern,
            "",
            answer
        )

    # --------------------------------------
    # Remove unavailable recall sentence
    # --------------------------------------

    answer = re.sub(
        r"(?is)\n*The specific details for this recall are currently unavailable:.*$",
        "",
        answer
    )

    # --------------------------------------
    # Remove lines such as:
    # Product: Not available
    # Reason for Recall: Not available
    # --------------------------------------

    lines = answer.splitlines()

    cleaned_lines = []

    for line in lines:

        stripped = line.strip()

        unwanted_line = re.match(
            r"^(\*+\s*)?\*\*?(Product|Reason for Recall|Recall Number|Classification|Status|Recalling Firm|Recall Date|Quantity|Batch\s*/\s*Code|Distribution)\s*:?\s*\**\s*Not available\s*\**$",
            stripped,
            flags=re.IGNORECASE
        )

        if unwanted_line:
            continue

        cleaned_lines.append(line)

    answer = "\n".join(cleaned_lines)

    # --------------------------------------
    # Remove excessive empty lines
    # --------------------------------------

    answer = re.sub(
        r"\n{3,}",
        "\n\n",
        answer
    )

    return answer.strip()


# ==========================================
# AI RAG ANSWER
# ==========================================

@app.post("/api/rag/answer")
def rag_answer(request: RAGRequest):

    recall = request.recall or {}

    # =========================================================
    # GENERAL RAG
    # =========================================================

    if not recall:

        prompt = f"""
You are an AI Food Recall Assistant.

Answer the user's question using the food recall knowledge
base through File Search.

USER QUESTION:
{request.question}

IMPORTANT:

This is a GENERAL KNOWLEDGE question.

Do NOT create an FDA recall record.

Do NOT mention unavailable FDA recall details.

Do NOT create sections such as:
- FDA Recall Record Facts
- FDA Recall Facts
- Recall Record
- Recall Facts

Do not list Product, Recall Number, Classification,
Status, Quantity, Batch, or Distribution as "Not available".

Answer ONLY the user's question using relevant
food-safety knowledge retrieved from the knowledge base.

Instructions:

1. Answer clearly and simply.
2. Use relevant retrieved knowledge.
3. Do not invent facts.
4. Do not add unrelated recall information.
5. Do not mention missing FDA information.
6. Final recall decisions require human review.
"""

    # =========================================================
    # RECALL-SPECIFIC RAG
    # =========================================================

    else:

        recall_context = f"""
FDA RECALL RECORD

Product:
{recall.get("product_description", "Not available")}

Reason for Recall:
{recall.get("reason_for_recall", "Not available")}

Recall Number:
{recall.get("recall_number", "Not available")}

Classification:
{recall.get("classification", "Not available")}

Status:
{recall.get("status", "Not available")}

Recalling Firm:
{recall.get("recalling_firm", "Not available")}

Recall Date:
{recall.get("recall_initiation_date", "Not available")}

Quantity:
{recall.get("product_quantity", "Not available")}

Batch / Code:
{recall.get("code_info", "Not available")}

Distribution:
{recall.get("distribution_pattern", "Not available")}
"""

        prompt = f"""
You are an AI Food Recall Assistant.

Use:

1. The food recall knowledge base through File Search.
2. The FDA recall record provided below.

USER QUESTION:
{request.question}

{recall_context}

Instructions:

1. Answer the user's question clearly.
2. Use relevant information from the RAG knowledge base.
3. Use the FDA record for recall-specific facts.
4. Do not invent information.
5. Clearly separate general food-safety guidance from FDA recall facts.
6. Include only FDA information that is actually available.
7. Keep the answer useful and concise.
8. Final recall decisions require human review.
"""

    try:

        interaction = gemini_client.interactions.create(
            model="gemini-3.5-flash-lite",
            input=prompt,
            tools=[
                {
                    "type": "file_search",
                    "file_search_store_names": [
                        GEMINI_FILE_SEARCH_STORE
                    ]
                }
            ]
        )

        answer = interaction.output_text

        # =====================================================
        # CLEAN GENERAL RAG RESPONSE
        # =====================================================

        if not recall:

            answer = clean_general_rag_answer(answer)

        return {
            "question": request.question,
            "answer": answer
        }

    except Exception as e:

        raise HTTPException(
            status_code=500,
            detail=f"Gemini RAG failed: {str(e)}"
        )


# ==========================================
# SERVE FRONTEND
# ==========================================

app.mount(
    "/",
    StaticFiles(
        directory=FRONTEND_DIR,
        html=True
    ),
    name="frontend"
)