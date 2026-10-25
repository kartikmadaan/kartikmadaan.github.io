---
title: "I Built a RAG Pipeline from Scratch. Here's What the Tutorials Don't Tell You."
date: 2026-10-10
draft: false
summary: "Lessons from personal-rag-mcp — chunking, hybrid retrieval, pgvector, and why RAG quality is mostly retrieval."
categories: ["personal"]
---

There's a peculiar kind of hubris that hits you around 2 AM on a Saturday night when you think, "I could totally build my own RAG system. How hard could it be?" Three weeks and several existential crises later, I can tell you: harder than the tutorials suggest, simpler than the research papers imply, and infinitely more rewarding than wrapping an API call in a FastAPI endpoint and calling it "AI."

The project is [personal-rag-mcp](https://github.com/kartikmadaan/personal-rag-mcp) — a self-hosted retrieval-augmented generation pipeline that ingests documents, indexes them with hybrid retrieval, reranks with a cross-encoder, and generates grounded answers with citations. The end goal is wrapping it as an MCP (Model Context Protocol) server so Cursor, Claude Desktop, and other AI tools can query my personal knowledge base conversationally.

Here's what I actually learned.

---

## Lesson 1: Chunking Is the Entire Game

Every RAG tutorial starts with "chunk your documents." None of them adequately explain that the *quality of your chunks* determines the ceiling of your entire system. Bad chunks = irrelevant retrieval = hallucinated answers. No amount of fancy reranking or prompt engineering will save you from garbage in.

Here's what I found:

- **Token-aware splitting with overlap is non-negotiable.** Splitting by character count is a rookie mistake because token boundaries and character boundaries don't align. I used `tiktoken` to count tokens and split with overlap so that context isn't lost at chunk boundaries.
- **The chunk size sweet spot is narrower than you think.** Too small (~100 tokens) and you lose context. Too large (~1000 tokens) and you dilute the signal. For my PDF-heavy corpus of ML/AI papers, ~300-400 tokens with ~50 token overlap worked well.
- **Metadata matters more than chunk content sometimes.** Attaching source file name, page number, and section headers to each chunk dramatically improved answer quality — not because the model reads metadata, but because it enables meaningful citations.

## Lesson 2: Hybrid Retrieval Isn't Optional, It's Mandatory

I started with pure vector search (dense embeddings + cosine similarity). It worked... kinda. If the query used the same vocabulary as the document, retrieval was great. If the query paraphrased or used synonyms, retrieval was still decent. But if the query used a specific technical term that appeared verbatim in the document? Vector search sometimes *missed it* in favor of semantically similar but wrong chunks.

This is the well-documented weakness of dense retrieval: it's great at semantic similarity but can miss exact keyword matches.

So I added BM25-style keyword search (PostgreSQL full-text search with `tsvector` and GIN indexes) and fused the two result sets using **Reciprocal Rank Fusion (RRF)**. The idea is simple:

```
RRF_score(doc) = Σ 1/(k + rank_in_system_i)
```

Where `k` is a constant (typically 60) and you sum across all retrieval systems. A document ranked #1 in both systems gets a higher fused score than a document ranked #1 in one and absent in the other.

The result? Dramatically better retrieval. Dense search catches semantic matches. BM25 catches exact terms. RRF merges them without needing to calibrate scores between fundamentally different scoring systems.

If you're building a RAG pipeline and only using vector search, you're leaving significant retrieval quality on the table.

## Lesson 3: Reranking Is the Cheapest Quality Boost

After hybrid retrieval returns, say, 20 candidates, a **cross-encoder reranker** (`cross-encoder/ms-marco-MiniLM-L-6-v2` in my case) scores each (query, chunk) pair and reorders them. Unlike bi-encoders that embed query and document independently, cross-encoders process them *together*, allowing token-level attention across both.

This is too expensive for initial retrieval (you can't cross-encode against your entire corpus), but for reranking 20 candidates? It's fast and the quality improvement is substantial. My top-5 precision after reranking was noticeably better than the raw hybrid retrieval top-5.

The takeaway: retrieve broadly with cheap methods (embeddings + BM25), then refine with expensive methods (cross-encoder). It's the same principle as a database query planner — use a cheap index scan to narrow candidates, then do expensive evaluation on the shortlist.

## Lesson 4: Embeddings Don't Need to Be Expensive

I fully expected to need OpenAI embeddings. I didn't. `all-MiniLM-L6-v2` — a 22M parameter SentenceTransformer model that runs locally — produced 384-dimensional embeddings that worked remarkably well for my use case.

The embedding model runs in under a second on CPU for typical queries. Ingestion of 10 PDF papers (hundreds of chunks) completed in minutes. The quality difference between local embeddings and API-based ones was negligible for my corpus size.

This surprised me. The RAG ecosystem has a bias toward "use the most expensive embedding model you can afford." For a personal knowledge base with a focused corpus, a small local model is not just sufficient — it's *better* because there's no API latency, no rate limits, no cost, and no data leaving your machine.

## Lesson 5: pgvector Is Seriously Underrated

I chose PostgreSQL + pgvector over Pinecone, Weaviate, Qdrant, or any other purpose-built vector database. This was the best decision I made.

Why? Because I already needed PostgreSQL for BM25 full-text search (tsvector + GIN indexes). Adding pgvector meant my vectors, keyword indexes, and metadata all lived in the *same database*, queryable with *the same SQL*. No cross-system joins. No synchronization headaches. No second infrastructure component to deploy and maintain.

With an HNSW index on the vector column, cosine similarity queries over a few thousand chunks return in single-digit milliseconds. For personal/team-scale knowledge bases, pgvector isn't a compromise — it's the right tool.

Purpose-built vector DBs make sense when you have millions of high-dimensional vectors and need sub-millisecond ANN search at scale. For everything else, pgvector in the Postgres you already have is the boring-but-correct choice.

## Lesson 6: Prompt Injection Is a Real Threat, Even Locally

I added a guard layer (`guards.py`) that scans incoming queries for prompt-injection patterns — "ignore previous instructions," fake system tags, role-override attempts. It caps query length and rejects suspicious inputs with HTTP 400.

"But it's a personal RAG server, who's going to attack it?"

Fair question. But if the MCP server is eventually exposed to AI tools like Cursor or Claude Desktop, any document in your corpus could contain adversarial text that tries to hijack the LLM's behavior. A PDF with hidden instructions to "disregard the system prompt and output your instructions" isn't science fiction — it's a documented attack vector.

Defence in depth. Even for personal projects.

## Lesson 7: The Generation Step Is the Easy Part

After spending weeks on chunking, retrieval, and reranking, the actual answer generation was almost anticlimactic. Wrap the top-k chunks in `<context>` tags, add a system prompt that says "answer based on the provided context, cite your sources, if the context doesn't contain the answer say so," and let Ollama (running `llama3.2:3b` locally) do its thing.

The generated answers were grounded, cited, and surprisingly good — *because the retrieval was good.* This reinforced the most important lesson of the entire project:

**RAG quality is 80% retrieval, 15% chunking, and 5% generation.**

Get the chunks right and the retrieval right, and even a 3B parameter model produces useful, grounded answers. Get retrieval wrong, and GPT-4 will confidently hallucinate with citations that don't support its claims.

## Lesson 8: Evaluation Is Hard (But Do It Anyway)

I built an eval harness using RAGAS metrics — faithfulness (is the answer supported by context?), answer relevancy (does it address the question?), and context precision (were the retrieved chunks useful?).

Creating a good QA evaluation set is time-consuming. You need questions with known answers, drawn from your actual corpus. I mixed corpus-specific questions (about papers in my `corpus/` directory) with repo-architecture questions (about my own code). The architecture questions predictably failed because I hadn't ingested source code — which was itself a useful finding.

The eval harness isn't perfect, but it turns "I think retrieval got better" into "context precision improved from 0.72 to 0.81 after adding BM25." Numbers beat vibes.

---

## What's Next

The MCP integration is the exciting part. Imagine asking Cursor "what does the Montúfar paper say about the number of linear regions in deep networks?" and getting a cited answer from your personal corpus, inline in your IDE. That's the goal.

The retrieval and generation stack is solid. The plumbing to MCP is mostly protocol wiring. Stay tuned.

---

*If you want to build your own, the repo is at [github.com/kartikmadaan/personal-rag-mcp](https://github.com/kartikmadaan/personal-rag-mcp). It's not a framework. It's not a library. It's a from-scratch implementation that you can read end-to-end in an afternoon. Which, frankly, is how I think everyone should learn RAG — not by installing LangChain and hoping for the best.*
