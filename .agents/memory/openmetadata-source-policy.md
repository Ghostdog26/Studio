---
name: OpenMetadata source policy
description: Product intent and evidence expectations for future enterprise catalogue integration.
---

The user identified OpenMetadata as the enterprise catalogue that will supply data schemas,
live MCP server information and APIs, across runtimes. Product reference knowledge must not
be presented as an already connected customer instance.

**Why:** The request establishes product understanding and reusable integration standards,
not permission to connect to an enterprise or invoke catalogued tools.

**How to apply:** Preserve the distinction when extending this feature: require separate
instance/release evidence and authorization before using private metadata or live capabilities.

Discovery approval and invocation approval must stay separate, including when a live
server's inventory has been successfully verified.

**Why:** Discovery observes untrusted remote metadata; it neither establishes that tools
are safe nor grants the initiating user permission for their side effects.

**How to apply:** Never promote discovery results, catalogue descriptions or operator
discovery attestations into runtime execution authority. Add invocation authorization
only as a separately approved capability.
