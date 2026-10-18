# Verified reusable replies

**Goal:** Prevent an unsupported model sentence from becoming the reusable reply even when its structured assessment passed validation.

**Architecture:** Keep all generated decisions as an audit trail. The existing current-draft endpoint derives its reusable text from source-linked facts actually read for that case and the saved typed request. It returns model wording separately and preserves stale/superseded rejection. The mission shows both roles clearly and downloads the verified reply.

**Scope:** Existing three typed relations and current-policy semantics. No paid models, new providers, authentication changes or autonomous tool-selection claims. Preserve dependencies and independent-case behavior.

- [x] Add a failing local inference contract assertion: a hallucinated writer sentence must not be returned as reusable policy text; retain that wording separately.
- [x] Implement verified reply assembly in readCurrentDraft; check missing-evidence and stale-reply behavior with literal expected text.
- [x] Label generated wording and verified reply in the existing mission UI; verify download, stale block and refresh in the browser. Hide irrelevant form fields by selected topic.
- [x] Resume the existing stopped Free instance; real local inference and adversarial proofs passed with Cloud. All 58 tests and 18 comparison fixtures passed. Add observed-failing startup checks and require FalkorDB for the app, retaining the reference adapter only for isolated checks.
- [ ] Publish current source, evidence and download, then verify public access and source equality.
