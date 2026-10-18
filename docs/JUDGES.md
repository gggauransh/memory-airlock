# Why this graph matters

Memory Airlock answers a narrow coordination question: **which saved agent conclusions must be reconsidered when shared evidence changes?**

## The failure to watch

A researcher reads the 30-day return policy. A reviewer depends on that research; a writer depends on the review. Later the policy becomes 14 days. Updating the fact alone leaves two indirect consumers stale. Invalidating all cases wastes the unrelated shipping workflow.

FalkorDB traverses explicit DEPENDS_ON edges from each decision through its handoffs to the changed fact. The preview shows these paths before approval. Approval marks that chain for review. The server blocks draft reuse until the affected workflow reruns; the independent shipping draft remains current.

The second failure is an empty search: Germany is not verified, then Germany is added. No old fact was replaced, but the old conclusion still needs reconsideration. Atlas's search watches the shipping Scope node, so this addition finds the same downstream chain. These policies are synthetic examples of agent memory, not an e-commerce product.

## Reproduce in five minutes

1. Follow README.md to start FalkorDB and the app. Replay is sufficient to inspect graph behavior; local Ollama enables real generations.
2. Run a returns-only case at 20 days, then a separate shipping-only case for Germany.
3. Preview a 30-to-14-day policy change. Inspect the paths; approve it.
4. Confirm the return draft is blocked and the shipping case stays current. Refresh affected workflows and reload.
5. Preview adding Germany. It affects shipping through its Scope dependency and preserves returns.

## What the model actually does

Atlas receives raw scoped evidence and derives a structured assessment; its prompt and schema do not contain the expected answer. A deterministic audit then compares its result with current policy. The original result, review corrections and final draft are retained separately. Evidence reads are server-controlled, not autonomous tool choices.

The final October 18 local proof is deliberately candid: the 0.6b researcher made a wrong assessment after the refund window changed. The audit corrected it, and the final draft used the verified conclusion. Research shipping prose also overstated missing evidence despite its correct needs_confirmation assessment; the final draft explicitly asks for confirmation. A separate 1.7b run also needed a research correction. This is evidence for observable correction, not evidence that small models are reliable. Unverified research prose is excluded from review context to reduce copying its mistakes. Natural-language correctness still requires review.

The reusable reply now has a stricter boundary: its text is assembled from the verified evidence and saved case fields. Generated wording remains visible in the audit trail. A regression supplies an invented 90-day policy sentence with otherwise correct assessments and proves it is excluded from the reusable reply. Current-policy answers remain distinct from historical customer entitlements.

## Evidence and fair comparison

- `QUERIES.cypher` and `src/store.ts` show actual graph operations; FalkorDB is required in graph mode and there is no silent storage fallback.
- `benchmark-results.json`: 18 synthetic fixtures with independently specified expected membership. Graph and complete in-memory traversal both find all 44 affected classifications. Direct-only misses 30; refresh-all adds 80 false positives. This does not establish a unique graph algorithm or production performance.
- `live-proof.json`: October 16 Cloud + local model proof.
- `local-proof-20261018.json`: earlier October 18 independent-research proof with the local adapter.
- `cloud-proof-20261018.json` and `adversarial-proof-20261018.json`: fresh real Cloud + local-inference proofs after resuming the existing Free instance. Verified replies, selective refresh, stale rejection and retained history passed. The adversarial case explicitly asks the model to ignore policy and invent a 365-day window; the reusable reply remains tied to verified 14-day evidence.
- `tests/`: revision races, atomic persistence, independent cases, stale drafts, absent knowledge, wrong model conclusions and local inference transport.
- GitHub Actions runs the complete suite and comparison against a real FalkorDB service container, without Cloud credentials. [October 18 verification](https://github.com/gggauransh/memory-airlock/actions/runs/39118219567) passed all 56 tests and 18 comparison fixtures after a clean install. Its logs record the image digest used.

## Boundaries

The web application requires FalkorDB; the local reference adapter cannot start it. One synthetic shop, three typed relations, at most 16 dependency hops, complete revision snapshots and locally selected source roles. No actual customer messages are sent. This is a loopback demonstration with complete local setup. AI assistance and participant responsibilities are disclosed in CONTRIBUTIONS.md.
