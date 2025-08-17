---
"@h1y/promise-aop": patch
---

fixed async advice execution by adding explicit await to ensure afterThrowing completes before error propagation.
