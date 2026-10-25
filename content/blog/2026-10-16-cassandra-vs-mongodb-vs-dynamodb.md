---
title: "Cassandra, MongoDB, and DynamoDB Walk Into a Bar"
date: 2026-10-16
draft: false
summary: "How Cassandra's ring and tunable consistency compare to MongoDB and DynamoDB — and a decision tree for picking one."
categories: ["personal"]
---

...and the bartender asks, "What's your consistency model?" Cassandra says "tunable," MongoDB says "eventually strong," and DynamoDB says "whatever you're willing to pay for." The bartender pours three different drinks. None of them are wrong.

If you've ever Googled "which NoSQL database should I use" and left more confused than when you started, welcome to the club. The answer, as with most things in distributed systems, is "it depends." But after this post, at least you'll know what it depends *on*.

---

## First, How Does Cassandra Actually Work?

Before comparing, let's understand Cassandra properly — because its design is genuinely elegant, and most people get it wrong.

### The Ring

Cassandra uses a **consistent hashing ring**. Every node in the cluster owns a range of hash values (called tokens). When you write data, Cassandra hashes the partition key, figures out which node owns that token range, and sends the data there. No master node. No single point of failure. Every node is equal.

This is fundamentally different from traditional databases where there's a "primary" that handles writes and "replicas" that copy from it. In Cassandra, *any* node can accept a write for *any* partition (it'll forward it to the right owner). Kill a node? The ring rebalances. Add a node? The ring rebalances. It's like a roundabout — traffic keeps flowing regardless of which exit is blocked.

### Replication

You configure a **replication factor** (RF). If RF=3, every piece of data lives on three different nodes. Cassandra walks clockwise around the ring from the owning node and places replicas on the next (RF-1) distinct nodes. With rack-aware or datacenter-aware placement strategies, it ensures replicas land on different racks or datacenters.

### Tunable Consistency

Here's where it gets interesting. For every read and write, you choose a **consistency level**:

- **ONE**: Acknowledge after one replica responds. Fast. Risky.
- **QUORUM**: Acknowledge after a majority (RF/2 + 1) respond. The sweet spot.
- **ALL**: Every replica must respond. Consistent. Slow. Fragile.

If your write consistency + read consistency > RF, you get strong consistency. So `QUORUM` writes + `QUORUM` reads with RF=3 gives you strong consistency (2 + 2 > 3) while tolerating one node failure. You're literally *tuning* the CAP theorem trade-off per query. That's powerful.

### The Write Path (Why Cassandra Is a Write Monster)

Writes in Cassandra are *append-only*:

1. Write hits the **commit log** (append-only, sequential I/O — fast)
2. Write goes into the **memtable** (in-memory sorted structure)
3. When the memtable fills up, it's flushed to an **SSTable** on disk (immutable, sorted file)

No random disk seeks for writes. No "find the row and update it in place." Just append, flush, done. This is why Cassandra can handle hundreds of thousands of writes per second on commodity hardware. The downside? Reads are more expensive because data might be spread across multiple SSTables, requiring compaction and bloom filters to stay efficient.

### The Data Model

Cassandra's data model looks like SQL if you squint — tables, columns, primary keys — but behaves entirely differently. The **partition key** determines which node stores the data. The **clustering columns** determine sort order *within* a partition. You model your tables around your *query patterns*, not your entity relationships.

This is the biggest mental shift for people coming from relational databases. In Cassandra, you don't normalize. You *denormalize aggressively*. One table per query pattern. Duplicate data across tables. Storage is cheap. Joins across partitions are not.

---

## Now, The Comparison

### Cassandra vs. MongoDB

| | Cassandra | MongoDB |
|---|---|---|
| **Data Model** | Wide-column (tables, partition keys, clustering keys) | Document (JSON-like BSON documents) |
| **Schema** | Schema-required (CQL) | Schema-flexible (schema validation optional) |
| **Scaling** | Masterless ring, linear horizontal scaling | Sharded cluster with config servers and mongos routers |
| **Write Performance** | Exceptional (append-only, no locking) | Good (WiredTiger with document-level locking) |
| **Read Performance** | Good for partition-key lookups, poor for ad-hoc queries | Excellent with secondary indexes, rich query language |
| **Consistency** | Tunable per query | Configurable read/write concern per operation |
| **Architecture** | Peer-to-peer, no single point of failure | Primary-secondary replication per shard |
| **Query Language** | CQL (SQL-like but limited — no joins, no subqueries) | MQL (rich — aggregation pipeline, $lookup, geospatial) |
| **Sweet Spot** | High write throughput, time-series, event logging | General purpose, rapid prototyping, flexible schemas |

**The honest take**: MongoDB is easier to start with. Its document model maps naturally to application objects, its query language is expressive, and you can add indexes after the fact. Cassandra requires you to think about your data model *upfront* — get the partition key wrong, and you'll hit hot partitions that bring your cluster to its knees.

But when you need to write millions of events per second across multiple datacenters with zero downtime? That's Cassandra's playground. MongoDB *can* do multi-datacenter replication, but its primary-secondary model means writes go through a single primary per shard. Cassandra's masterless design means every datacenter can accept writes independently.

### Cassandra vs. DynamoDB

| | Cassandra | DynamoDB |
|---|---|---|
| **Managed?** | Self-hosted (or DataStax Astra for managed) | Fully managed (AWS) |
| **Pricing** | Infrastructure cost (you manage nodes) | Pay-per-request or provisioned throughput |
| **Data Model** | Wide-column tables | Key-value / document (JSON) |
| **Partition Limits** | Practical limit ~100 MB per partition (soft) | 10 GB per partition (hard limit) |
| **Secondary Indexes** | Materialized views, SASI indexes (limited) | GSIs and LSIs (powerful but with throughput costs) |
| **Multi-Region** | Native (NetworkTopologyStrategy) | Global Tables (eventually consistent cross-region) |
| **Consistency** | Tunable per query | Eventually consistent or strongly consistent per read |
| **Vendor Lock-in** | None (open source) | Complete (AWS) |
| **Operational Burden** | High (you run the cluster) | Near zero (AWS runs everything) |

**The honest take**: DynamoDB is Cassandra's philosophy — partition-key-driven, horizontally scaled, high availability — packaged into a fully managed service. If you're already on AWS and your workload fits DynamoDB's model, the operational simplicity is hard to argue against. You're not managing nodes, compaction strategies, or gossip protocol tuning. You just... use it.

The trade-off is control and cost. DynamoDB's pricing can spike unpredictably with bursty workloads. Its 10 GB partition limit forces careful key design. And the moment you want to leave AWS, you're rewriting your data layer from scratch.

Cassandra gives you freedom at the cost of operational complexity. DynamoDB gives you simplicity at the cost of freedom. Pick your poison.

### MongoDB vs. DynamoDB

This one's simpler: if your queries are complex and ad-hoc (aggregations, text search, geospatial, graph-like traversals), MongoDB wins. If your access patterns are well-defined, partition-key-based lookups, and you want zero ops? DynamoDB.

---

## So Which One?

Here's my unfairly reductive but surprisingly accurate decision tree:

- **"I need to write a LOT of data, across multiple datacenters, and reads are mostly by partition key"** → Cassandra
- **"I need flexible queries, rich aggregations, and a schema I can iterate on fast"** → MongoDB
- **"I'm on AWS, my access patterns are simple, and I never want to manage infrastructure"** → DynamoDB
- **"I need all three at once"** → You need to rethink your architecture. Or get a bigger budget.

The dirty secret of database selection is that most applications would work fine with any of these three. The differences matter at scale. And when they matter, they *really* matter.

---

*Remember: a database is just a tool. The hard part was never choosing between Cassandra, MongoDB, and DynamoDB. The hard part is understanding your access patterns well enough to make the choice obvious. Once you know how your data moves, the database picks itself.*
