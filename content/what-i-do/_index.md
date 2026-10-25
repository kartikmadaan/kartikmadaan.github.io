---
title: "What I do"
summary: "Public-facing snapshot of the kind of systems work I focus on at Nutanix."
---

These are high-level themes from my day job—sanitized for a public site. No customer names, cluster details, or internal hostnames.

<div class="card-grid">

<article class="card work-card">
<h2>Disaster recovery orchestration</h2>
<p>Recovering workloads across sites means separating <em>plans</em> from <em>execution</em>: what should happen, what actually ran, and how operators debug the gap.</p>
<details>
<summary>More</summary>
<p>Automation and UIs both depend on stable, predictable APIs. When recovery is stressful, breaking existing scripts is the last thing you want—so public contracts and backward-compatible behavior matter as much as the orchestration engine itself.</p>
</details>
</article>

<article class="card work-card">
<h2>API evolution</h2>
<p>Versioned APIs and keeping older clients working while a newer model rolls out—think “legacy vs current API” without leaking product internals.</p>
<details>
<summary>More</summary>
<p>A lot of the work is translation and consistency: the same entity should look coherent whether you list, get, or mutate it. That often means explicit sync paths rather than hoping callers adapt overnight.</p>
</details>
</article>

<article class="card work-card">
<h2>Caching and entity resolution</h2>
<p>IDs vs display names, stale caches, and why list/get paths sometimes hydrate human-readable fields at read time.</p>
<details>
<summary>More</summary>
<p>Caches speed things up until they lie. Debugging usually means tracing which layer last wrote a name, and whether invalidation kept pace with updates.</p>
</details>
</article>

<article class="card work-card">
<h2>Go services</h2>
<p>HTTP and gRPC services, tests, structured errors, and logging you can grep when production gets interesting.</p>
<details>
<summary>More</summary>
<p>I care about small, reviewable changes: clear boundaries between handlers and domain logic, table-driven tests for edge cases, and logs that include correlation without dumping secrets.</p>
</details>
</article>

</div>
