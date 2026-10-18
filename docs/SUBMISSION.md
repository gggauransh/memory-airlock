# Memory Airlock

**Track: Agent Memory and Coordination**

**Tagline:** When shared knowledge changes, update the right agent answers.

An AI answer can depend on another agent’s conclusion. Changing the source fact does not automatically repair that downstream chain. Refreshing everything also wastes work and obscures what depended on the change.

Airlock previews a policy update, shows the graph paths to affected decisions, and preserves unrelated facts and workflows. Three stages research source-linked evidence, audit the findings and customer claims, and generate a draft. Independent cases have separate dependencies. A policy change blocks stale draft reuse until that workflow is refreshed. A newly supported destination also invalidates an earlier “unverified” answer because searched policy collections are graph dependencies.

FalkorDB is the central store in the demonstrated mode. It stores sources, facts, policy scopes, decisions, agents, runs and events with first-class edges. Actual Cypher traversal finds the downstream consequences. A revision check protects approvals and completed model runs. Disconnecting FalkorDB fails operations rather than switching storage.

## Real inference, no paid API

The free path uses local Ollama Qwen3, three real model generations, and server-mandated scoped evidence reads. Atlas independently derives an assessment from raw evidence, without precomputed answers in its prompt or schema. A deterministic audit checks the research; Sage receives the corrections and Echo drafts from verified conclusions. Wrong research and its correction remain visible in history. This is a controlled model workflow, not autonomous tool selection. Reviewed outcomes, citation IDs and memory revision are checked; natural-language prose can still be wrong. Deterministic replay is separately labelled.

Reusable replies are assembled from the verified policy facts actually read and saved case fields; model wording is retained separately for review. An incorrect sentence with valid structured fields cannot become the downloadable policy reply. The web app requires FalkorDB and stops if its configuration is missing; the local reference adapter is reserved for isolated checks.

## Measured evidence

- 18 isolated synthetic FalkorDB fixtures: 44 affected classifications found, zero missed and zero unnecessary refreshes.
- Full in-memory traversal also succeeds; direct-only misses 30 affected classifications and refresh-all adds 80 unnecessary invalidations. This is dependency correctness evidence, not superiority over competitors.
- Functional and SDK tests cover preservation, stale approvals, source-role gates, handoffs, absent knowledge, independent cases, draft blocking, selective refresh, inference races and wrong structured review outcomes.
- A real local-model/FalkorDB proof created two independent cases, changed refund policy, rejected stale reuse, refreshed only the return workflow, and reloaded the retained runs. Raw synthetic proof is in docs/live-proof.json.
- Fresh October 18 GitHub verification passed 56/56 tests and 18/18 graph fixtures against a real FalkorDB service after a clean install: https://github.com/gggauransh/memory-airlock/actions/runs/39118219567. Updated independent local reasoning was separately exercised and its mistakes/corrections retained in docs/local-proof-20261018.json.
- Final October 18 Cloud verification passed 58/58 tests and 18/18 graph fixtures after resuming the existing Free instance. Real local model/Cloud proofs, including a prompt that attempts to override verified policy, are retained in docs/cloud-proof-20261018.json and docs/adversarial-proof-20261018.json. The verified reusable reply remained correct under the supported typed rules; this is not a general security guarantee.

## Scope and disclosure

One synthetic shop; three typed policy relations. Case topics and fields define the task. Source roles are locally selected, not verified identities. Recovery examples simulate cache clearing. No production-scale or high-concurrency claim. Full graph snapshots need retention and compaction. Loopback-only application; replies are unsent drafts.

Codex assisted with concept, implementation, UI, tests and documentation. Participant contribution and understanding must be truthfully documented in CONTRIBUTIONS.md.

## Submission links

Public repository: https://github.com/gggauransh/memory-airlock
Demo video: https://github.com/gggauransh/memory-airlock/releases/tag/v0.1.0-demo — a 3:01 narrated walkthrough of October 16 working-app captures with offline synthetic voice narration. It is an edited capture sequence, not an uninterrupted recording. The latest reasoning changes and fresh verification are documented on main.
Live deployment: complete local setup in README.md; free local inference requires Ollama on the judge’s machine.
Participant understanding: participant must complete their own verification/explanation record.
