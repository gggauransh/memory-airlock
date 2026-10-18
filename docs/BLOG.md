# The Policy Changed. Three AI Agents Still Remembered the Old Answer.

*Building Memory Airlock for Graph Hacks: Context for AI Agents, powered by FalkorDB.*

A customer bought something 20 days ago. The return policy says 30 days. A research agent checks the policy, a reviewer checks the research, and a writer produces a reply.

Then the policy changes to 14 days.

Updating the policy record is easy. Finding every saved conclusion that relied on it is the interesting part.

That is the problem behind **Memory Airlock**: before shared knowledge changes, show which agent answers need to change with it.

[Watch the working-app demo](https://www.youtube.com/shorts/co0Fag47tVk) · [Explore the source](https://github.com/gggauransh/memory-airlock)

## Remembering more creates another problem

Persistent memory helps agents avoid starting over. It also lets an outdated conclusion survive long after its source changes.

An answer can depend on another answer. In Airlock, Atlas researches policy evidence, Sage reviews the findings, and Echo drafts the response. Echo's output depends on Sage's decision, which depends on Atlas's research, which depends on the policy.

Checking only direct consumers misses part of that chain. Refreshing every workflow catches it, but also discards work that had nothing to do with the update.

The goal became precise: follow the dependencies, show the consequences, and refresh the affected workflows while preserving independent cases.

## Make the dependency chain part of memory

FalkorDB is Airlock's primary persistent store. Sources, facts, decisions, agents, runs, events, and watched policy scopes are graph nodes. Typed relationships record how they connect.

The central path looks like this:

```text
Echo draft → Sage review → Atlas research → return-policy fact
                   DEPENDS_ON
```

The arrows point toward dependencies. To find consequences, the application follows the paths back from the changed evidence to the decisions that rely on it. FalkorDB executes this bounded traversal through Cypher; the graph is part of the behavior, not just a picture on the screen.

The [actual query definitions](https://github.com/gggauransh/memory-airlock/blob/main/docs/QUERIES.cypher) and [architecture notes](https://github.com/gggauransh/memory-airlock/blob/main/docs/ARCHITECTURE.md) are public.

## The moment the demo turns

Start with two independent cases: a return question and a shipping question. Both have saved evidence trails.

Preview changing the return window from 30 to 14 days. Airlock shows the affected research, review, and draft before approval. Once the change is approved, the return workflow needs review. Reusing its stale reply is blocked by the server, not merely discouraged by a badge.

The shipping workflow stays current.

Refreshing affected workflows reruns the return case against the updated evidence. Its replacement run is linked to the earlier run, and reloading preserves the history.

This prototype answers questions about the current supported policy. It does not determine a customer's historical legal entitlement from a policy change.

## An empty search needs a dependency too

One subtle case changed the design: what if the original answer found nothing?

Suppose shipping to Germany is unverified. Later, a source adds Germany to the supported destinations. There is no old Germany fact to replace, so tracking only the facts that were found cannot invalidate the earlier answer.

Airlock also records the policy collection that was searched. A Scope node represents that watched collection, including an empty search. Adding relevant knowledge changes the scope and exposes the downstream shipping decisions that need reconsideration.

The return case remains independent. Missing knowledge has become an explicit dependency instead of an invisible assumption.

## The small model was wrong—and the history keeps it

The free inference path uses local Ollama with Qwen3:0.6b. Each workflow makes three real model generations after server-mandated evidence reads. This is a controlled workflow, not autonomous model-selected tool use. A separately labelled replay mode performs no inference.

In retained local-model verification, Atlas misclassified the 20-day return case after the window became 14 days. A deterministic policy audit corrected the assessment before the final draft. The mistaken research and its correction remain visible.

Another failure was more revealing: correct structured fields and valid citations did not guarantee correct prose. Research wording could still overstate the evidence.

That led to a stricter output boundary. The reusable policy reply is assembled from verified source-linked facts and saved case fields. Generated wording remains separately available for review. A regression supplies an invented 90-day policy sentence alongside otherwise correct assessments and checks that it cannot become the reusable reply.

This supports consistency with the prototype's typed rules. It does not prove source authenticity, general model reliability, or unrestricted prompt-injection safety.

## What the checks actually establish

The retained October 18 verification reports **58 passing tests against FalkorDB Cloud** and **18 passing synthetic graph fixtures**.

Across those fixtures, traversal found all **44 affected classifications**, with zero missed classifications and zero unnecessary invalidations. A direct-only baseline missed 30; a refresh-everything baseline added 80 unnecessary invalidations.

The full in-memory traversal also passed. These results demonstrate dependency correctness on the chosen fixtures; they do not establish that FalkorDB uniquely solves the problem, outperforms another database, or delivers the same results at production scale.

The [raw comparison](https://github.com/gggauransh/memory-airlock/blob/main/docs/benchmark-results.json), [verification history](https://github.com/gggauransh/memory-airlock/blob/main/docs/VERIFICATION.md), and [Cloud model proof](https://github.com/gggauransh/memory-airlock/blob/main/docs/cloud-proof-20261018.json) let readers inspect the evidence and its limits.

## What remains deliberately small

Airlock currently models one synthetic shop and three typed policy relations. Source roles are local selections rather than authenticated identities. Traversal is bounded to 16 hops, snapshot storage needs retention and compaction, and no production-scale concurrency claim is made. The application runs on loopback; replies are unsent drafts.

A larger version would need authenticated source ownership, better storage lifecycle management, and broader evaluation before it could carry production decisions.

The lesson from this build is practical: saving an answer is only half of agent memory. Saving what that answer depends on makes later correction possible.

**Memory should help an agent know when to reconsider.**

---

Built for **Graph Hacks: Context for AI Agents**, in the **Agent Memory and Coordination** track. [Event](https://www.wemakedevs.org/hackathons/falkordb) · [Repository and local setup](https://github.com/gggauransh/memory-airlock) · [Demo](https://www.youtube.com/shorts/co0Fag47tVk)

**AI assistance disclosure:** Codex assisted with the concept, implementation, interface, tests, documentation, video production, and drafting this article. The linked evidence describes the prototype's actual scope; participant contributions and technical understanding must be represented truthfully.
