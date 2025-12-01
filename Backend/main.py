from fastapi import FastAPI, UploadFile, File, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.responses import FileResponse
from dotenv import load_dotenv
from groq import Groq
import os
import json
import shutil
import sqlite3
from datetime import timedelta
from typing import Optional
# import logging

from rag_docling import process_document, search_chunks, detect_format
from auth import (
    init_db, create_user, get_user, verify_password, create_access_token,
    get_current_user, Token, ACCESS_TOKEN_EXPIRE_MINUTES, create_document,
    get_user_documents, get_document_owner, DB_NAME
)
from web_search import process_web_search, find_relevant_chunks

load_dotenv()

# Initialize User DB
init_db()


# Use Groq client
client = Groq(api_key=os.getenv("GROQ_API_KEY"))

app = FastAPI()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

LLM_MODEL = "openai/gpt-oss-120b"

UPLOAD_DIR = "uploads"
if not os.path.exists(UPLOAD_DIR):
    os.makedirs(UPLOAD_DIR)

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

@app.post("/ingest")
async def ingest(file: UploadFile = File(...), current_user: dict = Depends(get_current_user)):
    """
    Ingest documents using Docling.
    
    Supports multiple formats:
    - PDF (with OCR for scanned documents)
    - Word (DOCX)
    - PowerPoint (PPTX)
    - Excel (XLSX)
    - Images (PNG, JPEG, TIFF, etc.)
    - HTML
    
    Features:
    - Advanced layout understanding
    - Table structure extraction
    - Image classification
    - Intelligent chunking
    - Rich metadata extraction
    """
    try:
        # Detect format
        file_format = detect_format(file.filename)
        
        # Create document record
        doc_id = create_document(current_user["id"], file.filename)
        
        # Save file to disk (required for Docling)
        file_path = os.path.join(UPLOAD_DIR, f"{doc_id}_{file.filename}")
        with open(file_path, "wb") as f:
            shutil.copyfileobj(file.file, f)
        
        # Process with Docling using file path
        stats = process_document(
            file_path=file_path,  # Pass file path instead of bytes
            filename=file.filename,
            user_id=current_user["id"],
            doc_id=doc_id
        )
        
        return {
            "status": "success",
            "message": f"Document processed successfully using Docling",
            "doc_id": doc_id,
            "filename": file.filename,
            "format": file_format,
            "stats": stats
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error processing document: {str(e)}"
        )

@app.get("/documents/{doc_id}/file")
async def get_document_file(doc_id: int, current_user: dict = Depends(get_current_user)):
    """Download original document file"""
    owner_id = get_document_owner(doc_id)
    if owner_id != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
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
    
    # Detect media type
    ext = filename.lower().split('.')[-1]
    media_types = {
        'pdf': 'application/pdf',
        'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'png': 'image/png',
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
    }
    media_type = media_types.get(ext, 'application/octet-stream')
    
    return FileResponse(file_path, media_type=media_type, filename=filename)

@app.get("/documents")
async def get_documents(current_user: dict = Depends(get_current_user)):
    """List all documents for current user"""
    return get_user_documents(current_user["id"])

@app.post("/query")
async def query(question: str, doc_id: Optional[int] = None, current_user: dict = Depends(get_current_user)):
    """
    Query documents using RAG with Docling-processed content.
    
    Enhanced with:
    - Richer context from better document understanding
    - Metadata like page numbers, sections, and content types
    - Better handling of tables, images, and complex layouts
    """
    # Verify document ownership if doc_id provided
    if doc_id:
        owner_id = get_document_owner(doc_id)
        if owner_id != current_user["id"]:
            raise HTTPException(status_code=403, detail="Not authorized to access this document")
    
    # Search for relevant chunks
    top_chunks = search_chunks(
        query=question,
        user_id=current_user["id"],
        doc_id=doc_id,
        k=5
    )
    
    if not top_chunks:
        return {
            "response": {
                "answer": "No relevant information found in the selected document(s).",
                "citations": []
            },
            "chunks_used": []
        }
    
    # Build context with enhanced metadata
    context_parts = []
    for chunk in top_chunks:
        section_info = f" [{chunk['section']}]" if chunk['section'] else ""
        page_info = f"Page {chunk['page']}"
        context_parts.append(f"{page_info}{section_info}:\n{chunk['text']}")
    
    context = "\n\n---\n\n".join(context_parts)
    
    # Enhanced prompt with metadata awareness
    prompt = f"""You are a RAG assistant with access to document content that has been carefully extracted and structured.

The context below includes page numbers and section headings for precise citations.

Context:
{context}

Question: {question}

Instructions:
1. Answer the question based ONLY on the provided context
2. If the answer is not in the context, say "Not found in document"
3. Include specific page numbers and sections when citing information
4. For tables or structured data, preserve the structure in your answer

Return your response as JSON in this exact format:
{{
  "answer": "your detailed answer here",
  "citations": [
    {{"page": 1, "section": "Introduction", "snippet": "relevant text"}},
    {{"page": 3, "section": "Methods", "snippet": "relevant text"}}
  ]
}}
"""
    
    try:
        response = client.chat.completions.create(
            model=LLM_MODEL,
            messages=[{"role": "user", "content": prompt}]
        )
        
        raw_output = response.choices[0].message.content
        
        # Parse JSON response
        try:
            data = json.loads(raw_output)
        except:
            # Clean up markdown code blocks
            cleaned = raw_output.replace("```json", "").replace("```", "").strip()
            data = json.loads(cleaned)
        
        return {
            "response": data,
            "chunks_used": top_chunks,
            "metadata": {
                "model": LLM_MODEL,
                "chunks_retrieved": len(top_chunks),
                "document_specific": doc_id is not None
            }
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error generating response: {str(e)}"
        )





        

@app.post("/web-query")
async def web_query(question: str, current_user: dict = Depends(get_current_user)):
    """
    Query the web using DuckDuckGo search with intelligent scraping.
    Returns structured response with citations similar to Perplexity.
    
    Features:
    - Free web search via DuckDuckGo (no API key required)
    - Reliable web scraping with quality filtering
    - Semantic search for relevant content
    - Structured citations with URLs
    """
    try:
        # Step 1: Search web and extract content
        web_data = await process_web_search(query=question, num_results=6)
        
        if 'error' in web_data or not web_data['chunks']:
            return {
                "response": {
                    "answer": "I couldn't find relevant information on the web for your query. This might be because:\n- The search didn't return accessible results\n- Websites blocked scraping\n- The query might be too specific or misspelled\n\nPlease try rephrasing your question.",
                    "citations": []
                },
                "sources_used": 0,
                "metadata": {
                    "error": web_data.get('error', 'Unknown error')
                }
            }
        
        # Step 2: Find most relevant chunks
        relevant_chunks = find_relevant_chunks(
            query=question,
            chunks=web_data['chunks'],
            sources=web_data['sources'],
            embeddings=web_data['embeddings'],
            k=8  # Get more chunks for better context
        )
        
        if not relevant_chunks:
            return {
                "response": {
                    "answer": "No relevant information found in the scraped content.",
                    "citations": []
                },
                "sources_used": 0
            }
        
        # Step 3: Build context for LLM
        context_parts = []
        sources_map = {}
        
        for i, chunk_data in enumerate(relevant_chunks):
            source = chunk_data['source']
            url = source['url']
            
            # Track unique sources
            if url not in sources_map:
                snippet = source.get('snippet') or chunk_data['text'][:200]
                sources_map[url] = {
                    'url': url,
                    'title': source['title'],
                    'domain': source['domain'],
                    'snippet': snippet
                }
            
            # Add context with source reference
            context_parts.append(
                f"[Source {i+1}] {source['title']} ({source['domain']}):\n{chunk_data['text']}\n"
            )
        
        context = "\n---\n\n".join(context_parts)
        
        # Step 4: Generate response with LLM
        prompt = f"""You are a helpful AI search assistant. Answer the user's question based on the web search results provided below.

USER QUESTION:
{question}

WEB SEARCH RESULTS:
{context}

INSTRUCTIONS:
1. Provide a comprehensive, well-structured answer based on the search results
2. Synthesize information from multiple sources when possible
3. Be accurate and cite your sources naturally in the text
4. If the search results don't fully answer the question, acknowledge this
5. Use clear, concise language
6. Structure your response with paragraphs for readability

Return ONLY a JSON object with this EXACT structure (no markdown, no code blocks):
{{
  "answer": "Your detailed answer here. Reference sources like 'According to [source title]...' naturally in your text.",
  "key_sources": [
    {{"url": "https://example.com", "title": "Page Title", "relevance": "Brief note on what this source contributed"}}
  ]
}}"""
        
        response = client.chat.completions.create(
            model=LLM_MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3  # Lower temperature for more factual responses
        )
        
        raw_output = response.choices[0].message.content.strip()
        
        # Parse JSON response
        try:
            # Remove markdown code blocks if present
            if raw_output.startswith('```'):
                raw_output = raw_output.split('```')[1]
                if raw_output.startswith('json'):
                    raw_output = raw_output[4:]
                raw_output = raw_output.strip()
            
            data = json.loads(raw_output)
        except json.JSONDecodeError as e:
            print(f"JSON parse error: {e}\nRaw output: {raw_output}")
            # Fallback: return raw text
            return {
                "response": {
                    "answer": raw_output,
                    "citations": list(sources_map.values())[:3]
                },
                "sources_used": len(sources_map),
                "metadata": {
                    "warning": "LLM returned non-JSON response"
                }
            }
        
        # Enrich citations
        key_sources = data.get('key_sources', [])
        enriched_citations = []
        
        for citation in key_sources[:5]:  # Limit to top 5 sources
            url = citation.get('url', '')
            if url in sources_map:
                enriched_citations.append({
                    **sources_map[url],
                    'relevance': citation.get('relevance', '')
                })
        
        # If no key sources, use top 3 from sources_map
        if not enriched_citations:
            enriched_citations = list(sources_map.values())[:3]
        
        return {
            "response": {
                "answer": data.get('answer', ''),
                "citations": enriched_citations
            },
            "sources_used": len(sources_map),
            "chunks_analyzed": len(relevant_chunks),
            "metadata": {
                "model": LLM_MODEL,
                "search_engine": "DuckDuckGo",
                "total_sources_found": web_data.get('total_sources', 0),
                "successful_crawls": web_data.get('successful_crawls', 0)
            }
        }
        
    except Exception as e:
        print(f"Web query error: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Error processing web query: {str(e)}"
        )