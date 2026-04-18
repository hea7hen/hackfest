# 2ASK Backend — Setup & Run Guide
## Hackathon Quick-Start (do this in order)

---

## Step 0: Prerequisites

Make sure you have:
- Python 3.11+
- [Ollama](https://ollama.ai) installed and running

---

## Step 1: Pull Ollama Models

```bash
# The embedding model (274 MB — fast, purpose-built for retrieval)
ollama pull nomic-embed-text

# The reasoning model — pick ONE based on your machine
ollama pull gemma3:9b        # Recommended (better Indian tax reasoning)
# OR
ollama pull llama3.1:8b     # Alternative if gemma3:9b is slow on your GPU
```

---

## Step 2: Install Python Dependencies

```bash
cd 2ask/backend
pip install -r requirements.txt
```

---

## Step 3: Embed the Knowledge Base (Run ONCE)

This reads `knowledge/gst_rules.md`, chunks it, embeds each chunk with
`nomic-embed-text`, and stores vectors in ChromaDB locally.

```bash
python embed_knowledge.py
```

Expected output:
```
✅ Ollama is running.
✅ nomic-embed-text working. Embedding dim: 768
✂️  Created 28 chunks from knowledge base.
  Embedding chunk 1/28: SECTION 1: GST 2.0 SLAB STRUCTURE...
  ...
✅ Tax knowledge base ready: 28 chunks in 'tax_knowledge'
✅ Created empty 'user_documents' collection.
🎉 Done! Run: uvicorn main:app --reload
```

---

## Step 4: Start the API Server

```bash
uvicorn main:app --reload --port 8000
```

API is now live at: `http://localhost:8000`
Swagger docs at:   `http://localhost:8000/docs`

---

## Step 5: Verify Everything Works

```bash
# Health check
curl http://localhost:8000/health

# Test a tax question
curl -X POST http://localhost:8000/ask \
  -H "Content-Type: application/json" \
  -d '{"question": "What is the GST rate for software development services?", "transactions": []}'

# Test with transaction data
curl -X POST http://localhost:8000/ask \
  -H "Content-Type: application/json" \
  -d '{
    "question": "How much GST did I pay in total?",
    "transactions": [
      {"vendor": "AWS", "amount": 5000, "gst_amount": 900, "date": "2026-03-15", "category": "Cloud Services"},
      {"vendor": "Zoom", "amount": 1500, "gst_amount": 270, "date": "2026-03-20", "category": "Software"}
    ]
  }'
```

---

## Project Structure

```
2ask/
├── knowledge/
│   └── gst_rules.md          ← GST + IT Act 2025 knowledge base (your RAG source)
│
└── backend/
    ├── agent.py              ← LangGraph agent (3 tools: tax_lookup, doc_search, db_query)
    ├── main.py               ← FastAPI app (routes: /ask, /upload-document, /analyze-receipt)
    ├── embed_knowledge.py    ← One-time script to embed gst_rules.md into ChromaDB
    ├── requirements.txt
    ├── SETUP.md              ← This file
    └── chroma_db/            ← Auto-created by embed_knowledge.py (don't commit to git)
        ├── tax_knowledge/    ← Embedded GST rules (static, never changes)
        └── user_documents/   ← User-uploaded receipts (dynamic, per session)
```

---

## API Endpoints

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/health` | Check Ollama + ChromaDB status |
| POST | `/ask` | Main Q&A: question + transactions → grounded answer |
| POST | `/upload-document` | Embed a receipt text file into user_documents |
| POST | `/analyze-receipt` | Extract structured JSON from receipt text (no RAG) |
| POST | `/batch-analyze` | Analyze multiple receipts at once |

---

## How the Agent Works (for the demo pitch)

```
User Question
     │
     ▼
  [Router]  ← LLM decides which tool(s) to call
     │
     ├── "tax_lookup"  → Searches embedded gst_rules.md (GST rates, TDS, deductions)
     ├── "doc_search"  → Searches user-uploaded receipts in ChromaDB
     ├── "db_query"    → Aggregates transaction data (totals, categories, GST sums)
     └── "multi"       → Runs two tools and merges context
     │
     ▼
  [Synthesizer]  ← LLM generates answer using retrieved context
     │
     ▼
  Final Answer (grounded, not hallucinated)
```

**Key pitch point:** A 9B model with 4 retrieved chunks of exact GST rule text
will outperform a 70B model guessing from parametric memory. RAG IS the feature.

---

## If You Change gst_rules.md

Just re-run the embedder:
```bash
python embed_knowledge.py
```
It deletes and recreates the `tax_knowledge` collection automatically.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `ConnectionRefusedError` on Ollama | Run `ollama serve` in a separate terminal |
| `model not found` error | Run `ollama pull gemma3:9b` |
| ChromaDB import error | `pip install chromadb` |
| Slow responses | Switch to `llama3.1:8b` in agent.py line `REASON_MODEL` |
| Empty answer on tax question | Re-run `embed_knowledge.py` — collection may be missing |
