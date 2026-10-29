---
name: Discovery operations channel
description: Rationale for credential-safe discovery monitoring through the existing structured API log.
---

Discovery protection uses the API's existing Pino operations log for fixed-label
metric and alert events, rather than adding a public metrics endpoint or silently
assuming an external monitoring provider.

**Why:** No external monitoring destination was configured when instrumentation
was introduced. Outbound paging requires an operator-selected destination; an
error log must not be represented as an already connected paging service.

**How to apply:** Keep operational event payloads independent of request log
context and sensitive errors. If adding a collector or notification integration,
aggregate fixed signal/operation labels only and explicitly verify delivery.
