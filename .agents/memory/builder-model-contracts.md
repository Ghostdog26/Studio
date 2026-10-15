---
name: Builder model output contracts
description: JSON-only model responses are not guaranteed to match the builder's typed output contract.
---

Give planning models an explicit output shape and field limits, then validate the returned contract before displaying or saving it. Do not equate JSON response mode with schema-constrained output.

**Why:** Real planning responses failed typed validation despite JSON response mode; an explicit schema-shaped output instruction resolved the failure. Official SDK reference material does not guarantee the model will return the application's expected shape.

**How to apply:** Preserve fail-closed validation and unsaved-draft review when changing models or planning prompts. Log validation paths and codes, not raw model content or user requirements. A passing response-shape check still does not establish implementation correctness or protocol compatibility.
