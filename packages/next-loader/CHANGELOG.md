# @h1y/next-loader

## 2.0.0

### Major Changes

- [#57](https://github.com/h1ylabs/next-loader/pull/57) [`69f601c`](https://github.com/h1ylabs/next-loader/commit/69f601caadd682b91db1d5804456b8751047c79e) Thanks [@cutehammond772](https://github.com/cutehammond772)! - Major architectural overhaul with enterprise-grade features:
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

## 1.0.1

### Patch Changes

- [#15](https://github.com/h1ylabs/next-loader/pull/15) [`0d2f0eb`](https://github.com/h1ylabs/next-loader/commit/0d2f0eb85c0be4be55660ea819ad235c8b84fe34) Thanks [@cutehammond772](https://github.com/cutehammond772)! - support universal environment (node.js, browser), request optimizations using promise.

## 1.0.0

### Major Changes

- [#11](https://github.com/h1ylabs/next-loader/pull/11) [`76ebcf8`](https://github.com/h1ylabs/next-loader/commit/76ebcf8d80e1764a9af6546b31d5b1b393d2cec2) Thanks [@cutehammond772](https://github.com/cutehammond772)! - initial release
