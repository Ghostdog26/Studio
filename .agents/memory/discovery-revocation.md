---
name: Discovery revocation
description: Why discovery uses monotonic authorization invalidation rather than permission-content equality alone.
---

Revoking and restoring identical permissions must still require new, explicitly requested discovery. Do not replace monotonic invalidation with hashes of current permission rows alone.

**Why:** Permission rows can be deleted/reinserted or disabled/re-enabled with identical values while a replica is idle or network discovery is in progress. Content equality would resurrect earlier evidence and miss the intervening revocation.

**How to apply:** Preserve transactional invalidation for all permission-write paths, including operator SQL, and check it before using cached results and before publishing network results. A conservative, installation-wide invalidation is intentional until a narrower invalidation mechanism provides the same guarantees. Coordinate operator policy revocations across replicas; independently managed policy files are not a shared authorization authority.

Apply this same monotonic boundary to OAuth authorization state and credentials, not just
inventory. Unrelated permission/document mutations may therefore require fresh OAuth consent.

**Why:** Keeping OAuth attached only to a hash of current permissions would allow a
revoke/restore cycle to revive a credential even though its discovery evidence was invalidated.
The conservative loss of consent is preferable to retaining access across an unseen revocation.

**How to apply:** Keep state, callback, token use, refresh and revocation bound to the
same shared invalidation epoch and policy-file revision as discovery.
