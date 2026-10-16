# Contribution record

## AI assistance

Codex proposed the concept and authored the application, UI, tests and documentation with AI assistance. The October 16 upgrade added transitive graph paths, policy-scope watchers, a three-stage model/replay protocol, citation/revision validation, durable run receipts, a twelve-fixture comparison and updated submission materials. This should be disclosed in the hackathon submission.

## Participant work

- Requested a substantial visual redesign after reviewing the initial interface, and prioritized completing that redesign before connecting the database.
- Completed FalkorDB Cloud sign-in, explicitly approved the Free plan, set the database password and submitted the instance-creation form.
- Created and added an AI Gateway key to the ignored local configuration; selected replay mode when Vercel required payment-card setup.

Still pending: the participant’s own failure-case verification and explanations of the graph model, queries and architecture. Setup/review actions alone do not establish technical understanding. See docs/PARTICIPANT.md; record only work actually completed.

## Verification status

- Domain/local persistence tests: see the latest test output.
- FalkorDB integration: connected to FalkorDB Cloud Free; all 46 tests passed, including the real FALKORDB_TEST_URL integration test. Browser policy commit, customer comparison, history search, reviewed restoration, agent refresh and reload persistence were also verified.
- Live model workflow: implemented and SDK-tested. The participant configured an AI Gateway key locally. Vercel rejected live requests until payment-card setup is completed; the participant chose to finish with deterministic replay and leave live testing pending.
- Public repository, demo recording and final event submission: not created or published yet.

## Free local inference upgrade — October 16

At the participant’s request to implement the competition plan while staying free, Codex added scoped evidence reads, independent case histories, selective refresh, stale-draft blocking, structured review audits, an 18-fixture comparison and local Ollama integration. Codex downloaded and verified Qwen3:0.6b and exercised real local inference with FalkorDB. Local inference uses server-mandated tools, not autonomous model tool selection. These changes and checks are AI-assisted work; they do not substitute for the participant’s own understanding. Earlier Gateway-blocked status above is historical. No paid model service is required by the new main workflow.

Current artifacts: a clean source package was verified without credentials, and a narrated 3:01 working-app capture walkthrough was rendered with offline synthetic voice. Repository publication is still pending GitHub authorization. The participant has not yet recorded their own technical explanation or completed the worksheet.
