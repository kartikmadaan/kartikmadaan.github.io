---
name: kartik-voice
description: Writing style, voice, anti-AI-tell guardrails, and public-sanitization rules for Kartik Madaan's portfolio, blog posts, TILs, and outreach.
---

# Kartik Madaan's Writing Voice & Anti-AI-Tell Skill

Write as Kartik wrote it. Match the voice of his Medium article (*Basic spells for your defense against the dark arts*) and his cover letters (`cover_letter_emergent.md`, `cover_letter_ema.md`). Never sound like an LLM cleaned it up.

## 1. Hard Bans (Zero Tolerance for AI Tells)

### Punctuation Bans
- **NEVER use an em dash (`—`) or `--` / `---` as a clause break in prose.**
- **NEVER use an en dash (`–`) mid-sentence as a pause.** (Date or number ranges like `2021-2026` or `300-400 tokens` are fine with a standard hyphen).
- **Use instead:** a period (two short sentences), a comma, a colon, or parentheses.

```markdown
<!-- BAD (AI tell) -->
Caches speed things up—right until they lie to you—and debugging means tracing every layer.

<!-- GOOD (Kartik's voice) -->
Caches are great right up until they lie to you. Debugging means tracing which service actually owns the source of truth.
```

### Vocabulary & Cadence Bans
- **Banned stock openers:** "In today's rapidly evolving...", "I am excited to share...", "Let's delve into..."
- **Banned filler words:** `passionate about`, `proven track record`, `leverage`, `synergies`, `robust`, `seamless`, `cutting-edge`, `delve`, `landscape`, `testament to`, `tapestry`, `unwavering`, `spearheaded`.
- **Banned structures:**
  - Corporate triad stacking ("scalable, reliable, and maintainable architectures").
  - "It's not just X, it's Y" contrast clichés.
  - Over-polished, evenly measured paragraph rhythms where every sentence is 18 words long.
  - Inline bolding of random tech buzzwords or adjectives (if bolding inside lists, bold only the numbered principle header or a specific quantitative outcome).

---

## 2. Positive Style Indicators (What Kartik Prefers)

1. **Promise brevity and deliver it**
   - Open directly with the premise. No throat-clearing.
   - Characteristic hook: *"I'll keep it concise and to the point."*
2. **Concrete scenario first, sharp takeaway second**
   - Start with the real failure mode or human problem in 1-2 sentences (*"The hardest bugs only show up when 1,000+ virtual machines fail over at the exact same time"*), then state how you solve it.
3. **Varied sentence rhythm**
   - Alternate a short punchy sentence with a longer, concrete technical sentence.
   - Example: *"Shipping a clean new API is easy. Shipping it while 50+ downstream consumers still depend on your decade-old endpoints is the real job."*
4. **Numbered, scannable principles**
   - When explaining multiple concepts or work pillars, use numbered items (`1.`, `2.`, `3.`) with clear, direct titles so recruiters, hiring managers, or readers can scan in 10 seconds.
5. **Conversational, wry, grounded tone**
   - Use occasional parenthetical asides that tell the real truth.
   - Treat AI as a practical engineering tool that has to earn its place in production, never with breathless hype.
   - Prefer specific numbers and mechanisms over adjectives: `0 RPO`, `under a minute RTO`, `50+ downstream consumers`, `1,000+ concurrent failovers`, `9% storage utilization improvement`.

---

## 3. Public Portfolio Translation Rules (No Internal Lingo)

When writing about Nutanix work on this public site, always translate internal terms into clear, universally understood distributed-systems terminology that recruiters and hiring managers at FAANG, Rubrik, Cohesity, Databricks, or AI startups immediately recognize:

| Internal / Nutanix Lingo (DO NOT USE) | Public Industry Term (USE THIS) |
|---|---|
| Cerebro / Stargate / Pithos / IDF / Polaris / Magneto / Aplos / Kanon | C++ replication engine / storage layer / Go & gRPC disaster recovery platform |
| Prism Central (PC) | Cluster management plane / control plane |
| Protection Domain (PD) / Consistency Group (CG) | Protection policy / replication group |
| EC Stretch / SCB (`SnapshotControlBlock`) | Cross-site synchronous replication / metadata control block |
| TOD (`tod.eng.nutanix.com`) | Internal Model Context Protocol (MCP) debugging co-pilot (never call TOD "RAG" or claim pgvector/LangChain for it) |
| `ENG-xxxxxx` / Sourcegraph / Artifactory URLs | Never include internal ticket IDs or internal URLs |

---

## 4. Pre-Flight Checklist Before Showing Any Content Change

- [ ] `rg "—|--" content/` returns **zero** prose clause-break matches in edited files.
- [ ] Zero banned AI buzzwords (`delve`, `seamless`, `robust`, `leverage`, `passionate`).
- [ ] Every technical claim matches verified ground truth (e.g., TOD = MCP debugging extension, personal-rag-mcp = local Ollama + pgvector + hybrid RRF + cross-encoder reranker).
- [ ] No Nutanix internal component names (`Cerebro`, `Stargate`, `Magneto`, `Prism Central`, `Pithos`, `TOD`) appear in public-facing copy unless explicitly requested.
