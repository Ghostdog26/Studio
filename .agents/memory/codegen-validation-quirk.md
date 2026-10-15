---
name: Generated validation constants
description: Why API generation includes a numeric-constant normalization step.
---

Orval can place numeric validation constants after a union that evaluates them during module
initialization. A generation command completing does not establish that validators can load.

**Why:** The inherited generated enterprise union used a workspace length constant before its
declaration, breaking both TypeScript checking and potential module initialization. Generator
output also uses single-quoted imports, so text normalization must not assume double quotes.

**How to apply:** Keep numeric-literal normalization in the codegen pipeline until the upstream
generator issue is no longer reproducible. Do not hand-patch generated files as the durable fix.
After changing the generator, regenerate and typecheck rather than relying on file generation alone.
