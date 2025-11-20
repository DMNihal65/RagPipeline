from fastapi import FastAPI, UploadFile, File, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from rag import extract_text_from_pdf, store_chunks, search_chunks
from dotenv import load_dotenv
from groq import Groq
import os, json
from auth import init_db, create_user, get_user, verify_password, create_access_token, get_current_user, Token, ACCESS_TOKEN_EXPIRE_MINUTES, create_document, get_user_documents, get_document_owner, DB_NAME
from datetime import timedelta
from typing import Optional
from fastapi.responses import FileResponse
import shutil
import sqlite3

load_dotenv()

# Initialize User DB
init_db()

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

@app.post("/register")
async def register(form_data: OAuth2PasswordRequestForm = Depends()):
    if create_user(form_data.username, form_data.password):
        return {"message": "User created successfully"}
    else:
        raise HTTPException(status_code=400, detail="Username already registered")

@app.post("/token", response_model=Token)
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends()):
    user = get_user(form_data.username)
    if not user or not verify_password(form_data.password, user["hashed_password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user["username"]}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

from fastapi.responses import FileResponse
import shutil

# ... imports ...

UPLOAD_DIR = "uploads"
if not os.path.exists(UPLOAD_DIR):
    os.makedirs(UPLOAD_DIR)

# ... app setup ...

@app.post("/ingest")
async def ingest(file: UploadFile = File(...), current_user: dict = Depends(get_current_user)):
    # Create document record first to get ID
    doc_id = create_document(current_user["id"], file.filename)
    
    # Save file to disk
    file_path = os.path.join(UPLOAD_DIR, f"{doc_id}_{file.filename}")
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    # Reset file pointer for reading
    file.file.seek(0)
    pdf_bytes = await file.read()
    
    pages = extract_text_from_pdf(pdf_bytes)
    store_chunks(pages, user_id=current_user["id"], doc_id=doc_id)
    return {"status": "stored", "pages": len(pages), "doc_id": doc_id, "filename": file.filename}

@app.get("/documents/{doc_id}/file")
async def get_document_file(doc_id: int, current_user: dict = Depends(get_current_user)):
    owner_id = get_document_owner(doc_id)
    if owner_id != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # We need to find the filename to construct the path. 
    # Ideally get_document_owner should return the doc object or we fetch it again.
    # For now let's just fetch the doc details.
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute("SELECT filename FROM documents WHERE id = ?", (doc_id,))
    row = c.fetchone()
    conn.close()
    
    if not row:
        raise HTTPException(status_code=404, detail="Document not found")
        
    filename = row[0]
    file_path = os.path.join(UPLOAD_DIR, f"{doc_id}_{filename}")
    
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found on server")
        
    return FileResponse(file_path, media_type="application/pdf", filename=filename)

@app.get("/documents")
async def get_documents(current_user: dict = Depends(get_current_user)):
    return get_user_documents(current_user["id"])

@app.post("/query")
async def query(question: str, doc_id: Optional[int] = None, current_user: dict = Depends(get_current_user)):
    # If doc_id is provided, verify ownership
    if doc_id:
        owner_id = get_document_owner(doc_id)
        if owner_id != current_user["id"]:
             raise HTTPException(status_code=403, detail="Not authorized to access this document")

    top_chunks = search_chunks(question, user_id=current_user["id"], doc_id=doc_id, k=5)

    if not top_chunks:
        return {
            "response": {"answer": "No relevant information found in the selected document(s).", "citations": []},
            "chunks_used": []
        }

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
