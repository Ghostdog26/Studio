---
name: Zod schema compatibility
description: Runtime schema composition must use the same Zod major API as generated validators.
---

When composing a validator around generated API schemas, use the same Zod API version the generator imports. Do not mix `zod/v4` object wrappers with v3 schemas imported through `zod`.

**Why:** Type checking can pass while runtime parsing rejects a mixed schema as an invalid element. Only exercising the actual response parse reveals the incompatibility.

**How to apply:** Inspect the generated import before composing schemas, and exercise composed validators through a focused route or parsing test. Do not change generator versions merely to fix a local wrapper.
