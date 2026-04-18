"""
agent.py
--------
LangGraph-powered RAG agent for 2ASK.
Three tools:
  1. tax_lookup   — searches the embedded GST/IT Act knowledge base
  2. doc_search   — searches user-uploaded receipts/documents
  3. db_query     — structured summary queries over transaction data

Flow:
  User question → Router (LLM decides tool) → Tool → Synthesizer (LLM answers)
"""

import json
import os
import re
from typing import Literal

import chromadb
from langgraph.graph import END, START, StateGraph
from openai import OpenAI
from typing_extensions import TypedDict

from project_env import load_project_dotenv

load_project_dotenv()

# ── Config ────────────────────────────────────────────────────────────────────
CHROMA_PATH    = "./chroma_db"
EMBED_MODEL    = os.getenv("EMBED_MODEL", "text-embedding-nomic-embed-text-v1.5")
LM_STUDIO_URL  = os.getenv("LM_STUDIO_URL",  "http://localhost:1234/v1")
REASON_MODEL   = os.getenv("LM_STUDIO_MODEL","mlx-community/gemma-3-4b-it-4bit")
COLLECTION_TAX = "tax_knowledge"
COLLECTION_DOC = "user_documents"
TOP_K          = 4

# ── LM Studio client (OpenAI-compatible) ──────────────────────────────────────
lm_client = OpenAI(
    base_url=LM_STUDIO_URL,
    api_key="lm-studio"    # LM Studio ignores this — any string works
)

# ── ChromaDB singleton ────────────────────────────────────────────────────────
_chroma_client = None

def get_chroma():
    global _chroma_client
    if _chroma_client is None:
        _chroma_client = chromadb.PersistentClient(path=CHROMA_PATH)
    return _chroma_client


def embed(text: str) -> list[float]:
    """Get embeddings via LM Studio (OpenAI-compatible)."""
    response = lm_client.embeddings.create(
        model=EMBED_MODEL,
        input=text
    )
    return response.data[0].embedding


# ── chat() — now uses LM Studio ─────────────────────────────────────────────
def chat(system: str, user: str, temperature: float = 0.1) -> str:
    """Single-turn chat via LM Studio running Gemma 4 2B MLX."""
    response = lm_client.chat.completions.create(
        model=REASON_MODEL,
        messages=[
            {"role": "system", "content": system},
            {"role": "user",   "content": user}
        ],
        temperature=temperature,
        max_tokens=1024,
    )
    return (response.choices[0].message.content or "").strip()


# ── State ─────────────────────────────────────────────────────────────────────
class AgentState(TypedDict):
    question:       str
    tool_choice:    str                  # "tax_lookup" | "doc_search" | "db_query" | "multi"
    tool_contexts:  list[dict]           # retrieved context chunks
    transactions:   list[dict]           # structured transaction data from frontend
    answer:         str


# ── Tool 1: tax_lookup ────────────────────────────────────────────────────────
def tax_lookup(state: AgentState) -> dict:
    """Vector search over the embedded GST/IT Act knowledge base."""
    query_vec = embed(state["question"])
    collection = get_chroma().get_collection(COLLECTION_TAX)

    results = collection.query(
        query_embeddings=[query_vec],
        n_results=TOP_K,
        include=["documents", "metadatas", "distances"]
    )

    contexts = []
    for doc, meta, dist in zip(
        results["documents"][0],
        results["metadatas"][0],
        results["distances"][0]
    ):
        contexts.append({
            "source": "GST/IT Knowledge Base",
            "section": meta.get("section", ""),
            "text": doc,
            "relevance": round(1 - dist, 3)
        })

    return {"tool_contexts": contexts}


# ── Tool 2: doc_search ────────────────────────────────────────────────────────
def doc_search(state: AgentState) -> dict:
    """Vector search over user-uploaded receipts and documents."""
    query_vec = embed(state["question"])
    collection = get_chroma().get_collection(COLLECTION_DOC)

    # Check if collection has any documents
    if collection.count() == 0:
        return {"tool_contexts": [{
            "source": "User Documents",
            "section": "No documents uploaded",
            "text": "No receipts or documents have been uploaded yet.",
            "relevance": 0
        }]}

    results = collection.query(
        query_embeddings=[query_vec],
        n_results=min(TOP_K, collection.count()),
        include=["documents", "metadatas", "distances"]
    )

    contexts = []
    for doc, meta, dist in zip(
        results["documents"][0],
        results["metadatas"][0],
        results["distances"][0]
    ):
        contexts.append({
            "source": f"Receipt: {meta.get('filename', 'Unknown')}",
            "section": meta.get("date", ""),
            "text": doc,
            "relevance": round(1 - dist, 3)
        })

    return {"tool_contexts": contexts}


# ── Tool 3: db_query ─────────────────────────────────────────────────────────
def db_query(state: AgentState) -> dict:
    """
    Structured analysis over the transactions list passed from the frontend.
    Handles: totals, category breakdowns, max/min, date filters, GST summaries.
    """
    txns = state.get("transactions", [])
    q    = state["question"].lower()

    if not txns:
        return {"tool_contexts": [{
            "source": "Transaction Database",
            "section": "Empty",
            "text": "No transactions found in the database.",
            "relevance": 1.0
        }]}

    # ── Helper: safe float ────────────────────────────────────────────────
    def to_float(v):
        try:
            return float(str(v).replace(",", "").replace("₹", "").strip())
        except (ValueError, TypeError):
            return 0.0

    # ── Category extraction ───────────────────────────────────────────────
    def get_category(t):
        return (t.get("category") or t.get("vendor_type") or "Other").strip()

    # ── Date filter (basic month/year keyword matching) ───────────────────
    months = {
        "january": "01", "february": "02", "march": "03", "april": "04",
        "may": "05", "june": "06", "july": "07", "august": "08",
        "september": "09", "october": "10", "november": "11", "december": "12"
    }
    filtered = txns
    for month_name, month_num in months.items():
        if month_name in q:
            filtered = [t for t in txns if month_num in str(t.get("date", ""))]
            break

    # ── GST-specific queries ──────────────────────────────────────────────
    if any(kw in q for kw in ["gst", "tax", "itc", "input credit"]):
        total_gst = sum(to_float(t.get("gst_amount", 0)) for t in filtered)
        gst_by_category: dict[str, float] = {}
        for t in filtered:
            cat = get_category(t)
            gst_by_category[cat] = gst_by_category.get(cat, 0) + to_float(t.get("gst_amount", 0))
        summary = (
            f"Total GST across {len(filtered)} transactions: ₹{total_gst:,.2f}\n"
            f"GST by category:\n" +
            "\n".join(f"  - {cat}: ₹{amt:,.2f}" for cat, amt in sorted(gst_by_category.items()))
        )
        return {"tool_contexts": [{"source": "Transaction DB", "section": "GST Summary", "text": summary, "relevance": 1.0}]}

    # ── Highest/lowest single transaction ─────────────────────────────────
    if any(kw in q for kw in ["highest", "largest", "most expensive", "biggest"]):
        top = max(filtered, key=lambda t: to_float(t.get("amount", 0)), default=None)
        if top:
            text = f"Highest transaction: {top.get('vendor', 'Unknown')} — ₹{to_float(top.get('amount', 0)):,.2f} on {top.get('date', 'N/A')} ({get_category(top)})"
            return {"tool_contexts": [{"source": "Transaction DB", "section": "Max Transaction", "text": text, "relevance": 1.0}]}

    if any(kw in q for kw in ["lowest", "cheapest", "smallest", "least"]):
        bot = min(filtered, key=lambda t: to_float(t.get("amount", 0)), default=None)
        if bot:
            text = f"Lowest transaction: {bot.get('vendor', 'Unknown')} — ₹{to_float(bot.get('amount', 0)):,.2f} on {bot.get('date', 'N/A')} ({get_category(bot)})"
            return {"tool_contexts": [{"source": "Transaction DB", "section": "Min Transaction", "text": text, "relevance": 1.0}]}

    # ── Category breakdown (default) ──────────────────────────────────────
    category_totals: dict[str, float] = {}
    category_counts: dict[str, int]   = {}
    for t in filtered:
        cat = get_category(t)
        amt = to_float(t.get("amount", 0))
        category_totals[cat] = category_totals.get(cat, 0) + amt
        category_counts[cat] = category_counts.get(cat, 0) + 1

    grand_total = sum(category_totals.values())
    lines = [f"Total across {len(filtered)} transactions: ₹{grand_total:,.2f}", ""]
    lines.append("Breakdown by category:")
    for cat, amt in sorted(category_totals.items(), key=lambda x: x[1], reverse=True):
        lines.append(f"  {cat}: ₹{amt:,.2f} ({category_counts[cat]} transactions)")

    return {"tool_contexts": [{"source": "Transaction DB", "section": "Summary", "text": "\n".join(lines), "relevance": 1.0}]}


# ── Router node ───────────────────────────────────────────────────────────────
def router(state: AgentState) -> dict:
    """
    LLM decides which tool(s) to call.
    Returns a JSON object like: {"tool": "tax_lookup"} or {"tool": "multi", "tools": [...]}
    """
    system = """You are a routing assistant for a freelancer tax management app.
Given a user question, output ONLY a JSON object (no explanation) selecting the best tool(s).

Tools available:
- "tax_lookup"  → Use for GST rates, TDS sections, advance tax rules, deductions (80C/80D/80G), Income Tax Act 2025, OIDAR, RCM, ITC eligibility
- "doc_search"  → Use for questions about specific uploaded receipts, invoices, or documents ("which receipt...", "find the AWS invoice")
- "db_query"    → Use for aggregated financial data: totals, category sums, highest spend, monthly breakdown

Output format:
Single tool:  {"tool": "tax_lookup"}
Multiple:     {"tool": "multi", "tools": ["doc_search", "db_query"]}

Examples:
Q: What is the GST rate on software development?     → {"tool": "tax_lookup"}
Q: Which receipt had the highest amount?             → {"tool": "doc_search"}
Q: How much did I spend on cloud services in March?  → {"tool": "db_query"}
Q: Is my AWS spend eligible for ITC?                 → {"tool": "multi", "tools": ["tax_lookup", "db_query"]}
"""
    user = f"Question: {state['question']}"

    raw = chat(system, user, temperature=0.0)

    # Extract JSON from response
    match = re.search(r'\{.*?\}', raw, re.DOTALL)
    if match:
        try:
            parsed = json.loads(match.group())
            tool = parsed.get("tool", "tax_lookup")
            return {"tool_choice": tool}
        except json.JSONDecodeError:
            pass

    # Fallback heuristic
    q = state["question"].lower()
    if any(kw in q for kw in ["receipt", "invoice", "upload", "document", "file"]):
        tool = "doc_search"
    elif any(kw in q for kw in ["total", "spent", "sum", "breakdown", "category", "month", "highest", "lowest", "gst amount"]):
        tool = "db_query"
    else:
        tool = "tax_lookup"

    return {"tool_choice": tool}


# ── Conditional router edge ───────────────────────────────────────────────────
def route_to_tool(state: AgentState) -> Literal["tax_lookup", "doc_search", "db_query", "multi_tool"]:
    tc = state.get("tool_choice", "tax_lookup")
    if tc == "multi":
        return "multi_tool"
    return tc  # type: ignore


# ── Multi-tool node (runs two tools, merges contexts) ─────────────────────────
def multi_tool(state: AgentState) -> dict:
    """Run doc_search + db_query (or any combo), merge results."""
    all_contexts = []
    # Always include tax_lookup for multi (most questions need tax context)
    all_contexts.extend(tax_lookup(state)["tool_contexts"])
    # Add db_query for financial data
    all_contexts.extend(db_query(state)["tool_contexts"])
    return {"tool_contexts": all_contexts}


# ── Synthesizer node ──────────────────────────────────────────────────────────
def synthesize(state: AgentState) -> dict:
    """Final LLM pass — combines retrieved context into a helpful answer."""
    contexts = state.get("tool_contexts", [])

    context_text = "\n\n---\n\n".join(
        f"[Source: {c['source']} | {c['section']}]\n{c['text']}"
        for c in contexts
    )

    system = """You are 2ASK, an intelligent tax and finance assistant for Indian freelancers.
You help with GST, TDS, advance tax, deductions, and expense management.
Answer concisely and precisely. Use ₹ for amounts. Cite section numbers when relevant.
If context is insufficient, say so honestly — never hallucinate tax rates or rules.
Format answers with clear structure when listing multiple points."""

    user = f"""User Question: {state['question']}

Retrieved Context:
{context_text}

Provide a clear, accurate answer based on the context above."""

    answer = chat(system, user, temperature=0.2)
    return {"answer": answer}


# ── Build the LangGraph ───────────────────────────────────────────────────────
def build_agent():
    graph = StateGraph(AgentState)

    # Nodes
    graph.add_node("router",     router)
    graph.add_node("tax_lookup", tax_lookup)
    graph.add_node("doc_search", doc_search)
    graph.add_node("db_query",   db_query)
    graph.add_node("multi_tool", multi_tool)
    graph.add_node("synthesize", synthesize)

    # Edges
    graph.add_edge(START, "router")
    graph.add_conditional_edges("router", route_to_tool, {
        "tax_lookup":  "tax_lookup",
        "doc_search":  "doc_search",
        "db_query":    "db_query",
        "multi_tool":  "multi_tool",
    })
    graph.add_edge("tax_lookup",  "synthesize")
    graph.add_edge("doc_search",  "synthesize")
    graph.add_edge("db_query",    "synthesize")
    graph.add_edge("multi_tool",  "synthesize")
    graph.add_edge("synthesize",  END)

    return graph.compile()


# ── Public interface ──────────────────────────────────────────────────────────
agent = build_agent()


def run_agent(question: str, transactions: list[dict] | None = None) -> dict:
    """
    Entry point called by FastAPI.
    Returns: {"answer": str, "tool_used": str, "contexts": list}
    """
    state = AgentState(
        question=question,
        tool_choice="",
        tool_contexts=[],
        transactions=transactions or [],
        answer=""
    )
    result = agent.invoke(state)
    return {
        "answer":    result["answer"],
        "tool_used": result.get("tool_choice", "unknown"),
        "contexts":  result.get("tool_contexts", [])
    }


def add_document_to_store(
    doc_id:   str,
    text:     str,
    filename: str,
    date:     str = "",
    doc_type: str = "receipt"
) -> bool:
    """
    Called by FastAPI when a user uploads a receipt/document.
    Chunks, embeds, and stores in the user_documents collection.
    """
    try:
        collection = get_chroma().get_collection(COLLECTION_DOC)
        embedding  = embed(text)

        # Simple chunking for documents (most receipts fit in one chunk)
        words = text.split()
        chunk_size = 400

        if len(words) <= chunk_size:
            collection.add(
                ids=[doc_id],
                embeddings=[embedding],
                documents=[text],
                metadatas=[{"filename": filename, "date": date, "type": doc_type}]
            )
        else:
            # Multi-chunk for long documents
            for i in range(0, len(words), chunk_size - 50):
                chunk_text = " ".join(words[i: i + chunk_size])
                chunk_id   = f"{doc_id}__chunk_{i}"
                chunk_emb  = embed(chunk_text)
                collection.add(
                    ids=[chunk_id],
                    embeddings=[chunk_emb],
                    documents=[chunk_text],
                    metadatas=[{"filename": filename, "date": date, "type": doc_type}]
                )
        return True
    except Exception as e:
        print(f"[add_document_to_store] Error: {e}")
        return False
