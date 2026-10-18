# Memory Airlock

An original memory-update review layer for shared agent knowledge. Built during Graph Hacks, October 2026.

## Scope

The prototype models one synthetic shop. It supports three explicitly typed relations: shipping destinations (a set), standard refund days (one active value), and support email (one active value). Source roles are chosen by the local judge for demonstrations. They are not cryptographically verified identities. There is no production user authentication, arbitrary document ingestion, natural-language fact extraction, historical order eligibility engine, or claim to solve all semantic contradictions.

## Data flow

Browser form → Zod validation → deterministic update plan → graph dependency lookup → reviewed preview → revision check → durable commit → affected decisions flagged → workers re-read shared memory.

Preview IDs are stored server-side for 15 minutes, tied to a workspace revision, and cannot be altered by editing a client payload. A serialized mutation queue prevents local lost updates. The FalkorDB adapter uses a compare-and-swap revision predicate in a single graph write for distributed conflict rejection.

## Why the graph matters

Source SUPPORTS Fact. Decision DEPENDS_ON Fact, earlier Decision, or policy Scope. Scope nodes watch additions as well as retirements. Agent MADE Decision. New Fact SUPERSEDES old Fact. Restored Fact RESTORES historical Fact. Events TOUCH facts. An update only invalidates decisions connected to the facts being retired. Mentioning the same subject is never enough to invalidate another relation. In FalkorDB mode the impact lookup is a Cypher query over actual stored relationships; failed database access fails the operation, with no local fallback.

Facts and decisions are stored as versioned AirlockNode nodes with a small JSON property for their own typed attributes. They are connected by LINK edges whose kind identifies the relation. AirlockWorkspace selects the current revision. This deliberately simple schema makes each complete snapshot independently inspectable. It costs extra space, so a production implementation needs retention, indexing and snapshot compaction. The running impact query follows DEPENDS_ON paths up to sixteen hops and returns a shortest evidence path per affected decision. Live FalkorDB tests exercise three-hop handoffs; the comparison exercises six hops. These are small correctness checks, not production-scale performance evidence.

## Runtime modes and honest claims

The Policy sandbox accepts a typed return-age or shipping-destination case. It reads the current database snapshot and optionally a server-stored preview, rejects stale/expired previews, and projects the update into an isolated copy using the same application rules. It performs no store writes or worker refresh. Proposed evidence receives an explicit `proposed:` identifier and is labeled unsaved. Unknown destinations require confirmation; absence from the graph does not establish a shipping prohibition. These deterministic cases cover current standard policy, not historical order entitlements or arbitrary customer questions.

Policy history searches the loaded graph facts and displays their evidence and lifecycle status. Restoring a retired fact requires new evidence and a selected source role. The normal source-authority and revision checks still apply; restoration never reactivates an old node in place. A committed restoration creates a new fact with both a `SUPERSEDES` link to the replaced current value and a `RESTORES` link to the historical original. Editing the source/evidence of a staged restoration preserves its historical origin while the value and relation still match.

- Application storage requires FalkorDB, by default and explicitly. Missing FALKORDB_URL or selecting local storage stops startup. The local reference adapter remains available only to isolated tests, comparison code and the explicit verification CLI --local-store option; it cannot back the submitted web app.
- `MEMORY_STORE=falkordb`: official FalkorDB client, actual graph nodes/edges, Cypher impact lookup, optimistic graph writes. No storage fallback. The October 18 Cloud run passed all 58 tests after resuming the existing Free instance.
- Three support workers: deterministic, explicit policy examples. Worker restarts clear their cached fact IDs, not the shared graph. This simulates agent-process recovery; it does not kill the server process.
- Agent mission: independent cases have their own worker identities and saved structured requests. Research reads only selected policy topics, receives raw evidence without precomputed answers, and chooses among topic-appropriate outcomes. Every consulted fact and searched collection is tracked, including empty reads. A deterministic audit compares research outcomes and customer claims with verified policy checks; review receives those corrections and a typed handoff without unverified research prose. The writer produces a draft from verified conclusions. The free path performs three real Ollama generations after server-mandated evidence reads, not autonomous tool selection. An optional explicitly configured Gateway path retains AI SDK model tool loops. All stages must succeed against one unchanged revision before a single run is saved. Citation ID and outcome checks do not prove prose correctness.
- Deterministic replay: the same scoped evidence, handoff, audit and persistence protocol with template text; explicitly no model inference. Refresh affected workflows reruns only stale latest cases, preserving each case identity and linking its replacement run. Old decisions remain in history. The draft route rejects stale and superseded runs. Each refreshed case is atomic; a multi-case batch can finish an earlier case before a later case fails. The original demo-worker refresh cannot refresh mission answers.
- Optional AI SDK ToolLoopAgent: read-only model reviewer. It must call the verified-memory tool; answers are rejected if the workspace changes during generation. The deterministic update planner remains the only write path.
- eve agent: filesystem-authored reviewer with read-memory and preview tools. It requires the local API running on port 4317. The default eve runtime includes its normal built-in tools, so do not deploy it with sensitive local data without narrowing its capabilities.

The application is loopback-only and rejects foreign Host/Origin headers and writes without a per-process token. These protections are for a single-user local demo, not a replacement for production authorization. Do not expose this server publicly as-is.

The current-draft endpoint checks latest-case membership and all decision statuses, then constructs a policy-verified reply from active facts actually consulted for the selected topics and the saved typed request. It returns generatedText separately for audit; model prose is never the reusable policy text. A missing policy produces a confirmation request without borrowing unrelated facts or citations. The UI labels generated wording and verified text separately and disables download while verification is pending or the workflow is stale. A reply is current at its returned revision and must be checked again after updates.

## Functional proof

`node --test tests/*.test.ts` runs domain and persistence checks. An optional live test runs only when FALKORDB_TEST_URL is set. The in-app proof page runs eleven isolated deterministic checks. These are measured assertions against this implementation, not LLM benchmarks or a comparison against Graphiti. Issue reports motivated the problem; this application does not claim to fix or reproduce every upstream bug.
