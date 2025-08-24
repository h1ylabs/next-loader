---
"@h1y/next-loader": major
---

Major architectural overhaul with enterprise-grade features:

- Middleware System: Added AOP-based middleware for loaders
  and components
- Dual Loader Architecture: Introduced createLoader() for
  data fetching and createComponentLoader() for component
  resilience
- Resource Builder Pattern: Declarative resource definitions
  with dependency management
- Hierarchical Cache Tags: Advanced cache invalidation with
  hierarchyTag()
- Backoff Strategies: Multiple retry strategies (fixed,
  linear, exponential)
- Deep Next.js Integration: Native ISR support with
  NextJSAdapter
- Enhanced Type Safety: Full TypeScript inference for
  resources and middleware
