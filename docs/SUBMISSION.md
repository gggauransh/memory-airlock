# Memory Airlock

**Track: Agent Memory and Coordination**

**Tagline:** When shared knowledge changes, update the right agent answers.

An AI answer can depend on another agent’s conclusion. Changing the source fact does not automatically repair that downstream chain. Refreshing everything also wastes work and obscures what depended on the change.

Airlock previews a policy update, shows the graph paths to affected decisions, and preserves unrelated facts and workflows. Three stages research source-linked evidence, audit the findings and customer claims, and generate a draft. Independent cases have separate dependencies. A policy change blocks stale draft reuse until that workflow is refreshed. A newly supported destination also invalidates an earlier “unverified” answer because searched policy collections are graph dependencies.

FalkorDB is the central store in the demonstrated mode. It stores sources, facts, policy scopes, decisions, agents, runs and events with first-class edges. Actual Cypher traversal finds the downstream consequences. A revision check protects approvals and completed model runs. Disconnecting FalkorDB fails operations rather than switching storage.

## Real inference, no paid API

The free path uses local Ollama Qwen3, three real model generations, and server-mandated scoped evidence reads. This is a controlled model workflow, not a claim of autonomous tool selection. Structured policy outcomes, citation IDs and memory revision are checked; natural-language prose can still be wrong. Deterministic replay is separately labelled.

## Measured evidence

- 18 isolated synthetic FalkorDB fixtures: 44 affected classifications found, zero missed and zero unnecessary refreshes.
- Full in-memory traversal also succeeds; direct-only misses 30 affected classifications and refresh-all adds 80 unnecessary invalidations. This is dependency correctness evidence, not superiority over competitors.
- Functional and SDK tests cover preservation, stale approvals, source-role gates, handoffs, absent knowledge, independent cases, draft blocking, selective refresh, inference races and wrong structured review outcomes.
- A real local-model/FalkorDB proof created two independent cases, changed refund policy, rejected stale reuse, refreshed only the return workflow, and reloaded the retained runs. Raw synthetic proof is in docs/live-proof.json.

## Scope and disclosure

One synthetic shop; three typed policy relations. Case topics and fields define the task. Source roles are locally selected, not verified identities. Recovery examples simulate cache clearing. No production-scale or high-concurrency claim. Full graph snapshots need retention and compaction. Loopback-only application; replies are unsent drafts.

Codex assisted with concept, implementation, UI, tests and documentation. Participant contribution and understanding must be truthfully documented in CONTRIBUTIONS.md.

## Submission links

Public repository: https://github.com/gggauransh/memory-airlock
Demo video: deliverables/memory-airlock-demo.mp4, a 3:01 narrated walkthrough of working-app captures with offline synthetic voice narration. Upload it and provide a judge-accessible link. It is an edited capture sequence, not an uninterrupted recording.
Live deployment: complete local setup in README.md; free local inference requires Ollama on the judge’s machine.
Participant understanding: participant must complete their own verification/explanation record.
