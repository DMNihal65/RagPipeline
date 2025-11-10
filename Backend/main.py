from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from rag import extract_text_from_pdf, store_chunks, search_chunks
from dotenv import load_dotenv
from groq import Groq
import os, json

load_dotenv()

# Use Groq client
client = Groq(api_key=os.getenv("GROQ_API_KEY"))

app = FastAPI()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allow all methods
    allow_headers=["*"],  # Allow all headers
)

LLM_MODEL = "openai/gpt-oss-120b"  # You can change to mixtral-8x7b or other Groq models

@app.post("/ingest")
async def ingest(file: UploadFile = File(...)):
    pdf_bytes = await file.read()
    pages = extract_text_from_pdf(pdf_bytes)
    store_chunks(pages)
    return {"status": "stored", "pages": len(pages)}


@app.post("/query")
async def query(question: str):
    top_chunks = search_chunks(question, k=5)

    context = "\n\n".join([f"(Page {c['page']}): {c['text']}" for c in top_chunks])

    prompt = f"""
You are a RAG assistant. Answer only from the context below.
If info is missing, say "Not found in document".

Context:
{context}

Question: {question}

Return JSON only in this format:

{{
 "answer": "...",
 "citations":[{{"page":1,"snippet":"..."}}]
}}
"""

    response = client.chat.completions.create(
        model=LLM_MODEL,
        messages=[{"role": "user", "content": prompt}]
    )

    raw_output = response.choices[0].message.content

    # parse JSON - (sometimes we wrap in ```json blocks)
    try:
        data = json.loads(raw_output)
    except:
        cleaned = raw_output.replace("```json", "").replace("```", "").strip()
        data = json.loads(cleaned)

    return {
        "response": data,
        "chunks_used": top_chunks
    }
