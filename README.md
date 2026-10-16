# Memory Airlock

**Before shared knowledge changes, see which agent answers need to change.**

Built for Graph Hacks: Context for AI Agents, **Agent Memory and Coordination**.

Public source: [https://github.com/gggauransh/memory-airlock](https://github.com/gggauransh/memory-airlock).

Airlock connects policy evidence to research, review and draft responses. Preview a policy change, inspect the multi-hop consequences, approve it, and refresh the affected workflows while independent cases stay current. New knowledge matters too: adding Germany invalidates a previous “shipping unverified” answer.

## Free setup

Requires Node.js 24 and pnpm. Replay needs no model, account or key.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Open http://127.0.0.1:4317. Without configuration this is a clearly labelled local reference demo, not FalkorDB integration proof.

For the competition, start FalkorDB using Docker Compose or use FalkorDB Cloud Free. Copy .env.example to .env and configure:

```dotenv
MEMORY_STORE=falkordb
FALKORDB_URL=redis://127.0.0.1:6379
FALKORDB_TEST_URL=redis://127.0.0.1:6379
AIRLOCK_WORKSPACE=my-synthetic-demo
```

```sh
docker compose up -d
pnpm dev
```

Use the actual endpoint and TLS setting supplied by your instance. Failures never silently fall back to local storage. Use synthetic data. Cloud Free availability and retention depend on the provider; keep an export. Compose currently uses the upstream latest image: record the tested digest when using Docker. The measured Cloud run does not establish Docker verification.

## Real model inference with no API charges

Install [Ollama](https://ollama.com/download), then download the small model:

```sh
ollama pull qwen3:0.6b
```

Set these values in .env, start Ollama and restart Airlock:

```dotenv
AIRLOCK_ENABLE_AI=true
AIRLOCK_AI_PROVIDER=ollama
OLLAMA_MODEL=qwen3:0.6b
OLLAMA_BASE_URL=http://127.0.0.1:11434/v1
```

No payment card or API key is needed. Inference uses your computer; download, hardware, electricity and internet are your resources. The model runs locally and the database may be local or Cloud Free. A stronger compatible local model can be selected if your machine has capacity.

Local mode uses **three real model generations with server-mandated evidence reads**. It does not claim autonomous model-selected tool use. Atlas receives scoped graph evidence; Sage audits structured findings and customer claims; Echo generates a draft from the reviewed handoff. The server checks topic coverage, outcomes, citation IDs and revision consistency. Correct IDs and structured outcomes do not prove prose is correct. Replay is explicitly labelled and performs no inference.

## The judge’s first minute

1. Run a **returns-only** case for a 20-day purchase, using Live model agents.
2. Run a separate **shipping-only** case for Germany. Both stay current.
3. Review a refund update from 30 to 14 days. Inspect the path through Atlas → Sage → Echo, then approve.
4. Return to Agent mission. The return case needs review; shipping stays current. Stale draft download is disabled and rejected by the server.
5. Choose **Refresh affected workflows**. Only the return case reruns; the new draft uses 14 days. Reload to confirm persistence.
6. Run comparison for measured dependency results.

## Graph model and queries

Source SUPPORTS Fact. Fact SUPERSEDES or RESTORES an earlier Fact. Decision DEPENDS_ON Fact, earlier Decision or policy Scope. Agent MADE Decision. Run PRODUCED Decision. Event TOUCHED Fact.

A Scope watches a policy collection, including an empty search. Each case reads only its selected topics; consulted facts and searched collections are recorded regardless of model citations. Independent cases have separate worker identities. Refresh retains the case identity and links the replacement run to its predecessor.

These are first-class nodes and LINK edges with a typed kind property, partitioned by workspace and immutable revision. A compare-and-swap pointer commits complete snapshots. FalkorDB executes the bounded dependency-path query. See [queries](docs/QUERIES.cypher) and [architecture](docs/ARCHITECTURE.md).

## Verification

```sh
pnpm typecheck
pnpm test
pnpm benchmark
pnpm verify:live
```

The live proof creates an isolated synthetic FalkorDB workspace and forces **local Ollama**, so it cannot spend Gateway credits. It checks two real model cases, selective invalidation, stale-draft rejection, selective refresh and reloaded persistence. Add --local-store when running the source script to exercise only the local adapter. Tests skip three live database cases if FALKORDB_TEST_URL is absent.

October 16 verification: **56 tests passed, no failures or skips** against FalkorDB Cloud. **18/18 synthetic comparison fixtures passed**. The full in-memory traversal also passed: this comparison demonstrates dependency correctness, not unique database capability or superiority over competitors. Raw results: [comparison](docs/benchmark-results.json), [local inference proof](docs/live-proof.json).

## Scope and disclosure

One synthetic shop, three typed policy relations. Selected topics and typed case fields define the supported task; free text does not expand it. Source roles are local selections, not authenticated policy-owner identities. Worker recovery simulates cache clearing. Snapshot storage needs compaction for production. Queries are bounded to 16 hops. No large-scale, high-concurrency or production performance claim is made. The server is loopback-only. Drafts are never sent.

Codex assisted with concept, code, tests, interface and documentation. [Contributions](CONTRIBUTIONS.md) must reflect actual participant work and understanding. [Attribution](docs/ATTRIBUTION.md) lists dependencies. Participant technical understanding and event submission remain the participant’s responsibility.

[Demo walkthrough](docs/DEMO.md) · [Submission text](docs/SUBMISSION.md) · [Participant preparation](docs/PARTICIPANT.md) · [Verification](docs/VERIFICATION.md)
