---
title: "Vector Databases Are Just Indexes (And That's Fine)"
date: 2026-10-24
draft: false
summary: "Why HNSW, IVF, and PQ are indexing primitives, when pgvector is all you need, and when a dedicated vector store actually earns its keep."
categories: ["personal"]
---

Somewhere in 2023, the tech industry collectively decided that you can't build an AI application without a "vector database." Venture capital poured into Pinecone, Weaviate, Qdrant, Chroma, Milvus, and a dozen others. LinkedIn feeds overflowed with "How I Built a RAG Pipeline with [Vector DB du Jour]." And every startup's architecture diagram suddenly had a shiny new box labeled "Vector Store" sitting between the embeddings and the LLM.

Here's the thing nobody in those LinkedIn posts mentioned: a vector database is, at its core, an **index**. A specialized, optimized, very good index, but an index nonetheless. And if you already have a database, you might already have everything you need.

## What a Vector Database Actually Does

Strip away the marketing and a vector database does three things:

1. **Stores vectors:** arrays of floating-point numbers (embeddings), typically 384 to 1536 dimensions.
2. **Builds an index** over those vectors for fast approximate nearest neighbor (ANN) search.
3. **Retrieves the top-K most similar vectors** to a query vector, using a distance metric (cosine similarity, Euclidean distance, dot product).

That's it. The rest (metadata filtering, hybrid search, multi-tenancy, access control) are features built *around* the core index, not fundamental to it.

The core algorithmic magic is the ANN index. And there are really only a few approaches that matter:

### HNSW (Hierarchical Navigable Small World)

The most popular ANN algorithm. Imagine a graph where each vector is a node connected to its nearest neighbors. Instead of one flat graph, HNSW builds *layers*: a coarse top layer with few connections (for fast long-range jumps) and progressively denser layers below (for accurate local search). Querying starts at the top and "zooms in" through layers.

Think of it like finding a restaurant in a foreign city. You start with a map of the country (top layer), zoom to the city (middle layer), then walk the neighborhood (bottom layer). You don't compare against every restaurant on the planet.

HNSW gives excellent recall (95%+ with good parameters) and fast queries. The trade-off: it uses significant memory because the entire graph needs to fit in RAM.

### IVF (Inverted File Index)

Partition vectors into clusters using k-means. At query time, find the nearest cluster centers, then search only within those clusters. Faster than brute force, less memory than HNSW, but lower recall unless you search enough clusters.

### Product Quantization (PQ)

Compress vectors by splitting them into sub-vectors and quantizing each one. Dramatically reduces memory (8x-16x compression is common) at the cost of some accuracy. Often combined with IVF (IVF-PQ) for large-scale deployments.

### FAISS (Facebook AI Similarity Search)

Not a database, a *library*. FAISS implements HNSW, IVF, PQ, and various combinations. It's the engine inside many vector databases. If your use case is "embed some vectors, search them, done," FAISS in a Python script might be all you need. No server. No infrastructure. Just a library call.

## The pgvector Moment

Here's where it gets interesting. PostgreSQL, the database you probably already run, has an extension called `pgvector` that adds vector column types, HNSW indexes, and cosine/Euclidean/dot-product distance operators.

This means you can do:

```sql
CREATE TABLE chunks (
    id SERIAL PRIMARY KEY,
    content TEXT,
    source TEXT,
    embedding VECTOR(384)
);

CREATE INDEX ON chunks USING hnsw (embedding vector_cosine_ops);

SELECT content, source, 1 - (embedding <=> query_vector) AS similarity
FROM chunks
ORDER BY embedding <=> query_vector
LIMIT 5;
```

That's vector search. In PostgreSQL. With standard SQL. Alongside your regular tables, your full-text search indexes (`tsvector`), your relational joins, your ACID transactions, your backup tooling, your monitoring, and your existing operational knowledge.

When I built my [RAG pipeline](https://github.com/kartikmadaan/personal-rag-mcp), I used pgvector for dense vector search *and* PostgreSQL's native full-text search for BM25-style keyword matching. Both indexes live in the same database, on the same rows. Hybrid retrieval becomes a SQL query, not a cross-system orchestration problem.

No additional infrastructure. No new operational runbook. No second billing line item. Just Postgres doing what Postgres does: being quietly excellent at everything.

## When pgvector Is Enough (Spoiler: Usually)

Let me be specific about the scale where pgvector works fine:

- **Thousands to low millions of vectors:** Sub-10ms query times with HNSW. This covers the vast majority of RAG use cases, recommendation systems, and semantic search applications.
- **Metadata filtering:** Standard `WHERE` clauses. Want vectors only from a specific user, category, or time range? It's just SQL.
- **Hybrid search:** Combine vector similarity with full-text search, geospatial queries, or any other PostgreSQL capability in a single query.
- **Transactional guarantees:** Your vectors are updated atomically with your other data. No "vectors say the document exists but the metadata table disagrees" inconsistency.
- **Operational simplicity:** One database to back up, monitor, scale, and debug. One connection pool. One set of credentials.

If your dataset fits in this range (and most do), pgvector isn't a compromise. It's the right choice.

## When You Actually Need a Dedicated Vector DB

Dedicated vector databases earn their keep when:

- **Billions of vectors:** You need sharded, distributed ANN search across a cluster. pgvector runs on a single node. Pinecone, Milvus, and Qdrant handle horizontal scaling natively.
- **Sub-millisecond latency at scale:** When your p99 query latency budget is under 5ms across 100M+ vectors, purpose-built systems with optimized memory layouts and GPU acceleration matter.
- **Memory constraints with large datasets:** PQ and disk-based indexes in systems like Milvus or Qdrant let you search billions of vectors without fitting everything in RAM. pgvector's HNSW is memory-resident.
- **Real-time streaming ingestion:** Purpose-built vector DBs often handle continuous high-throughput inserts better while maintaining index quality.
- **Multi-tenancy at scale:** If you're building a SaaS where each customer has their own embedding space, dedicated vector DBs have better isolation and resource management primitives.

Notice the common theme? The word "scale." If your dataset isn't big enough to make you nervous, you probably don't need a dedicated vector DB.

## The Comparison

| | pgvector | Pinecone | Qdrant | Milvus | FAISS |
|---|---|---|---|---|---|
| **Type** | Postgres extension | Managed SaaS | OSS / Cloud | OSS / Cloud | Library |
| **Max practical scale** | Low millions | Billions | Billions | Billions | Billions (single node) |
| **Index types** | HNSW, IVFFlat | Proprietary | HNSW | HNSW, IVF, DiskANN | HNSW, IVF, PQ, many |
| **Hybrid search** | Native (SQL + FTS) | Metadata filters | Payload filters + FTS | Scalar + FTS | None (bring your own) |
| **Transactions** | Full ACID | No | No | No | N/A |
| **Operational cost** | Zero (it's Postgres) | Managed ($$) | Moderate | High (complex deploy) | Zero (it's a library) |
| **Vendor lock-in** | None | Complete | Low | Low | None |
| **Best for** | Existing Postgres users, RAG, small-medium scale | Serverless, zero-ops | Self-hosted, good perf | Enterprise, large scale | Prototyping, offline search |

## The Hype Problem

The vector database space has a hype problem. Not because the technology is bad. HNSW is genuinely elegant, and purpose-built vector search engines are serious engineering achievements. The hype problem is that the marketing suggests *everyone* needs one, when the reality is:

- If you have < 1M vectors and already run Postgres: **pgvector**
- If you have < 100K vectors and just need search in a script: **FAISS**
- If you have > 10M vectors, need managed infrastructure, and have budget: **Pinecone / Qdrant Cloud**
- If you have > 100M vectors and want full control: **Milvus / Qdrant self-hosted**

The decision tree isn't complicated. Still, "just add pgvector to your existing Postgres" doesn't make for a compelling Series B pitch deck.

*A vector database is an index. A very good index, doing very important work. Even so, an index doesn't need its own server, its own billing page, and its own "getting started" tutorial unless your data demands it. For the rest of us, the database we already have is doing just fine.*
