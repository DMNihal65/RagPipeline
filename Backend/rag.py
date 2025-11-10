import fitz  # PyMuPDF
import chromadb
from sentence_transformers import SentenceTransformer

# ----- Embedding model -----
embed_model = SentenceTransformer("all-MiniLM-L6-v2")

def embed(texts):
    return embed_model.encode(texts).tolist()

# ----- Chroma In-Memory DB -----
chroma_client = chromadb.Client()
collection = chroma_client.create_collection(
    name="pdf_chunks",
    metadata={"hnsw:space": "cosine"}
)

def extract_text_from_pdf(pdf_bytes):
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    pages = []

    for i, page in enumerate(doc):
        text = page.get_text()
        pages.append({"page": i + 1, "text": text})

    return pages

def chunk_text(text, chunk_size=800):
    words = text.split()
    for i in range(0, len(words), chunk_size):
        yield " ".join(words[i:i + chunk_size])

def store_chunks(pages):
    ids = []
    docs = []
    embeddings = []
    metadata = []

    counter = 0
    for p in pages:
        for chunk in chunk_text(p["text"]):
            ids.append(f"id_{counter}")
            docs.append(chunk)
            metadata.append({"page": p["page"]})
            counter += 1

    embeddings = embed(docs)

    collection.add(
        ids=ids,
        documents=docs,
        embeddings=embeddings,
        metadatas=metadata
    )

def search_chunks(query, k=5):
    query_embedding = embed([query])
    results = collection.query(
        query_embeddings=query_embedding,
        n_results=k
    )

    chunks = []
    for t, m in zip(results["documents"][0], results["metadatas"][0]):
        chunks.append({"text": t, "page": m["page"]})

    return chunks
