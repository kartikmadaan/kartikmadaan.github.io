---
title: "What I do"
summary: "Tech Lead building distributed disaster recovery systems, backward-compatible APIs, and C++ replication engines."
---

For the last four years at Nutanix, I've worked on the systems that replicate data and recover enterprise workloads when a site goes down. Today I'm a Tech Lead on our Go and gRPC disaster recovery platform. I'll keep it concise and to the point. Here is what I actually build and own.

<div class="card-grid">

<article class="card work-card">
<h2>1. Disaster Recovery at Scale</h2>
<p>I lead the Go and gRPC microservices platform that orchestrates failover across thousands of customer clusters under strict zero-data-loss (0 RPO) and sub-minute recovery (RTO) targets.</p>
<details>
<summary>Under the hood</summary>
<p>The hardest bugs only show up when 1,000+ virtual machines and storage volumes fail over at the exact same time. A big part of my job is hardening the control plane against timeout cascades, RPC fan-out bottlenecks, and cache stampedes.</p>
</details>
</article>

<article class="card work-card">
<h2>2. Zero-Breakage API Evolution</h2>
<p>Shipping a clean new API is easy. Shipping it while 50+ downstream consumers still depend on your decade-old endpoints is the real job. I designed and own the translation layer that bridges our new OpenAPI-based v4 services with our legacy intent-based v3 APIs.</p>
<details>
<summary>Under the hood</summary>
<p>You cannot ask customers to rewrite their automation scripts overnight. A resource has to look identical whether a caller creates it on the new stack, lists it on the legacy one, or updates it mid-migration. I built bidirectional state mapping and reconciliation paths so both stacks run side by side with zero customer-visible breakage.</p>
</details>
</article>

<article class="card work-card">
<h2>3. Storage Replication & C++ Internals</h2>
<p>Before moving into the control plane, I built synchronous block-storage replication in our C++ engine, delivering 0 RPO protection for latency-sensitive databases and improving cluster storage utilization by 9%.</p>
<details>
<summary>Under the hood</summary>
<p>When you replicate across sites, partial failures can leave behind orphaned snapshots that evade garbage collection and quietly fill up a cluster's disks. I redesigned our cross-site replication flow to ship the metadata control block to the remote site before the disk data, gated behind a capability check so older clusters could upgrade safely without leaking storage.</p>
</details>
</article>

<article class="card work-card">
<h2>4. Proactive Reliability & AI Debugging Tooling</h2>
<p>Waiting for a customer ticket is the worst way to find out replication stalled. I build automated cluster health checks that catch silent replication anomalies early, and MCP-based agent tooling that speeds up root-cause analysis when incidents do happen.</p>
<details>
<summary>Under the hood</summary>
<p>On the prevention side, I shipped proactive monitors for stalled replication, dropped volume attachments, and split-brain conditions. On the triage side, I extended our internal Model Context Protocol (MCP) debugging co-pilot with Go and Python log parsers, triage playbooks, and architecture docs so an AI agent in Cursor can query logs, metrics, and traces directly during on-call escalations.</p>
</details>
</article>

</div>


