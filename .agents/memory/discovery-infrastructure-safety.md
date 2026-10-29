---
name: Discovery infrastructure safety
description: Safety boundary for crash, disconnect and future failover rehearsals.
---

Destructive discovery infrastructure rehearsals must create their own disposable
local database and use fictional, injected discovery traffic. Never accept an
existing database connection or enterprise endpoint as a rehearsal target.

**Why:** The user explicitly prohibits destructive infrastructure checks against
a live enterprise database or endpoint. An opt-in flag alone cannot establish
that a caller-provided connection is disposable.

**How to apply:** Keep database provisioning and ownership inside the rehearsal
runner, sanitize inherited connection/policy/credential configuration, and verify
the local cluster identity before stopping it. Extend this same boundary if
adding real standby promotion or provider-specific failover tests.
