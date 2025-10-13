# @h1ylabs/loader-core

**Latest version: v0.6.0**

A Promise AOP-based resilient async operations library with built-in retry, timeout, and backoff strategies. Built on [@h1ylabs/promise-aop](https://github.com/h1ylabs/next-loader/tree/main/packages/promise-aop), providing production-grade error recovery and middleware support.

## Installation

```bash
# npm
npm install @h1ylabs/loader-core

# yarn
yarn add @h1ylabs/loader-core

# pnpm
pnpm add @h1ylabs/loader-core
```

## Documentation

- [한국어 문서 (Korean Documentation)](./docs/README-ko.md)

## Core Architecture

### Promise AOP Foundation

loader-core is built on the Promise AOP library, leveraging three core aspects:

1. **Backoff Aspect**: Manages delay strategies between retry attempts
2. **Retry Aspect**: Handles retry logic and fallback selection
3. **Timeout Aspect**: Enforces time limits on operations

These aspects are composed using the dependency chain: `Retry → Timeout → Backoff`, ensuring proper execution order and consistent behavior.

### Signal-Based Control Flow

The library uses a priority-based signal system for precise error handling:

```typescript
// Signal priorities (higher value = higher priority)
MIDDLEWARE_INVALID_SIGNAL_PRIORITY = 0b1000_0000_0000_0000; // 32768
TIMEOUT_SIGNAL_PRIORITY = 0b0100_0000_0000_0000; // 16384
RETRY_EXCEEDED_SIGNAL_PRIORITY = 0b0010_0000_0000_0000; // 8192
RETRY_SIGNAL_PRIORITY = 0b0001_0000_0000_0000; // 4096
ERROR_PRIORITY = 0b0000_0000_0000_0000; // 0
```

Signals enable:

- **Deterministic error handling**: Higher-priority signals always take precedence
- **Internal control flow**: Retry and timeout mechanisms communicate via signals
- **User-level extensibility**: Application errors can be handled via custom callbacks

### Context Isolation

Each loader execution maintains isolated contexts:

- **Loader Context**: `{ __core__retry, __core__timeout, __core__backoff }`
- **Middleware Contexts**: Each middleware gets its own isolated context
- **Metadata Context**: Tracks loader hierarchy for propagation strategies

## Quick Start

```typescript
import { loader, EXPONENTIAL_BACKOFF } from "@h1ylabs/loader-core";

// Create reusable loader with configuration
const { execute, retryImmediately, retryFallback } =
  loader<ApiResponse>().withOptions({
    input: {
      retry: { maxCount: 3, canRetryOnError: true },
      timeout: { delay: 5000 },
      backoff: { strategy: EXPONENTIAL_BACKOFF(2), initialDelay: 100 },
    },
    propagateRetry: false,
    middlewares: [],
  });

// Execute with target - loader is reusable
const data = await execute(async () => {
  // ⚠️ retryFallback must be called inside execute (React Hooks pattern)
  retryFallback({
    when: (error) => error.status === 503,
    fallback: () => () => async () => getCachedData(),
  });

  const response = await fetch("/api/data");
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
});
```

## API Reference

### loader\<Result\>()

Creates a loader factory for building configured loader instances.

#### .withOptions(props)

Creates a loader instance with retry, timeout, and middleware capabilities.

**Type Signature:**

```typescript
function withOptions<
  const Middlewares extends readonly LoaderMiddleware<
    Result,
    unknown,
    string
  >[],
>(props: {
  readonly input: LoaderCoreInput<Result>;
  readonly onDetermineError?: (errors: unknown[]) => Promise<unknown>;
  readonly onHandleError?: (error: unknown) => Promise<Result>;
  readonly propagateRetry: LoaderRetryPropagation;
  readonly middlewares: Middlewares;
}): {
  execute: <T extends Result>(target: Target<T>) => Promise<T>;
  middlewareOptions: () => MiddlewareOptions<Middlewares>;
  loaderOptions: () => LoaderCoreOptions;
  retryImmediately: (fallback?: TargetWrapper<Result>) => never;
  retryFallback: <T>(matcher: {
    readonly when: (error: T) => boolean;
    readonly fallback: (error: T) => TargetWrapper<Result>;
  }) => void;
};
```

**LoaderCoreInput:**

```typescript
interface LoaderCoreInput<Result> {
  retry: {
    maxCount: number;
    canRetryOnError: boolean | ((error: unknown) => boolean);
    fallback?: TargetWrapper<Result>;
    onRetryEach?: () => void;
    onRetryExceeded?: () => void;
  };
  timeout: {
    delay: number;
    onTimeout?: () => void;
  };
  backoff?: {
    strategy: Backoff;
    initialDelay: number;
  };
}
```

**LoaderRetryPropagation:**

```typescript
type LoaderRetryPropagation =
  | boolean // Always propagate (true) or never (false)
  | "HAS_OUTER_CONTEXT" // Propagate if any outer loader exists
  | "HAS_SAME_OUTER_CONTEXT"; // Propagate only to same loader instance
```

**Returns:**

- `execute(target)`: Executes target with retry/timeout/middleware protection
- `loaderOptions()`: Access current loader state (retry count, elapsed time, etc.)
- `middlewareOptions()`: Access middleware contexts by name
- `retryImmediately(fallback?)`: Trigger immediate retry (1st priority fallback)
- `retryFallback(matcher)`: Register conditional fallback (2nd priority)

**Context Requirements:**

⚠️ `retryImmediately` and `retryFallback` can **only** be called within `execute` callback. They depend on internal `AsyncContext` and will throw if called outside execution scope.

**Example:**

```typescript
const { execute, retryImmediately, retryFallback } = loader().withOptions({
  input: {
    retry: { maxCount: 3, canRetryOnError: true },
    timeout: { delay: 5000 },
  },
  propagateRetry: false,
  middlewares: [],
});

// ❌ INCORRECT: Outside execute context
retryFallback({ when: (e) => true, fallback: () => () => async () => "fail" });

// ✅ CORRECT: Inside execute callback
await execute(async () => {
  retryFallback({ when: (e) => true, fallback: () => () => async () => "ok" });

  return await apiCall();
});
```

#### .withDefaultOptions()

Creates a loader with default settings: no retries, infinite timeout, no middlewares.

```typescript
function withDefaultOptions(): LoaderReturn<Result>;
```

Equivalent to:

```typescript
loader<Result>().withOptions({
  input: {
    retry: { maxCount: 0, canRetryOnError: false },
    timeout: { delay: Infinity },
  },
  middlewares: [],
  propagateRetry: false,
});
```

### middleware\<Result\>()

Creates a middleware factory for building middleware instances with lifecycle hooks.

#### .withOptions(props)

Creates a middleware with before/complete/failure/cleanup hooks.

**Type Signature:**

```typescript
function withOptions<Context, MiddlewareName extends string>(props: {
  name: MiddlewareName;
  contextGenerator: () => Context;
  before?: (context: Context) => Promise<void>;
  complete?: (context: Context, result: Result) => Promise<void>;
  failure?: (context: Context, error: unknown) => Promise<void>;
  cleanup?: (context: Context) => Promise<void>;
}): LoaderMiddleware<Result, Context, MiddlewareName>;
```

**Lifecycle Execution Order:**

1. `before`: Before target execution
2. Target execution
3. `complete`: On successful completion (OR)
4. `failure`: On error/signal thrown
5. `cleanup`: Always runs last

**Example:**

```typescript
const loggingMiddleware = middleware<ApiResponse>().withOptions({
  name: "logging",
  contextGenerator: () => ({ startTime: 0, duration: 0 }),
  before: async (context) => {
    context.startTime = Date.now();
  },
  complete: async (context, result) => {
    context.duration = Date.now() - context.startTime;
    console.log(`Success in ${context.duration}ms:`, result);
  },
  failure: async (context, error) => {
    console.error(`Failed after ${Date.now() - context.startTime}ms:`, error);
  },
  cleanup: async (context) => {
    // Always called regardless of success/failure
    console.log(`Cleanup after ${Date.now() - context.startTime}ms`);
  },
});
```

### Signals

#### RetrySignal

Indicates a retry attempt is needed.

```typescript
class RetrySignal extends Signal {
  readonly errorReason: unknown;
  readonly propagated: boolean;
  readonly priority: 4096;
}
```

#### TimeoutSignal

Indicates operation timeout.

```typescript
class TimeoutSignal extends Signal {
  readonly delay: number;
  readonly priority: 16384;
}
```

#### RetryExceededSignal

Indicates all retry attempts exhausted.

```typescript
class RetryExceededSignal extends Signal {
  readonly maxRetry: number;
  readonly priority: 8192;
}
```

#### MiddlewareInvalidContextSignal

Indicates middleware context corruption.

```typescript
class MiddlewareInvalidContextSignal extends Signal {
  readonly middlewareName: string;
  readonly priority: 32768;
}
```

### Backoff Strategies

```typescript
import {
  createBackoff,
  FIXED_BACKOFF,
  LINEAR_BACKOFF,
  EXPONENTIAL_BACKOFF,
} from "@h1ylabs/loader-core";

// Fixed delay: always same delay
const fixed = FIXED_BACKOFF;
fixed.next(100); // → 100
fixed.next(100); // → 100

// Linear growth: delay + add
const linear = LINEAR_BACKOFF(50);
linear.next(100); // → 150
linear.next(150); // → 200

// Exponential growth: delay * factor
const exponential = EXPONENTIAL_BACKOFF(2);
exponential.next(100); // → 200
exponential.next(200); // → 400

// Custom strategy
const custom = createBackoff("custom", (delay) => Math.min(delay * 1.5, 10000));
```

**Backoff Type:**

```typescript
interface Backoff<T extends string = string> {
  type: T;
  next: (delay: number) => number;
}
```

## Advanced Features

### Fallback Priority System

Three-tier fallback selection determines retry behavior:

**Priority Order:**

1. **Immediate Fallback** (highest): Set via `retryImmediately(fallback)` at runtime
2. **Conditional Fallback**: Registered via `retryFallback(matcher)` during execution
3. **Initial Fallback** (lowest): Configured in `input.retry.fallback` during creation

**Internal Selection Logic:**

```typescript
// From createRetryAspect.ts before advice
retry.fallback.target =
  retry.fallback.immediate ?? // 1st: retryImmediately() fallback
  retry.fallback.conditional ?? // 2nd: retryFallback() matched fallback
  retry.fallback.initial; // 3rd: loader configuration fallback
```

**Example:**

```typescript
const { execute, retryImmediately, retryFallback } = loader().withOptions({
  input: {
    retry: {
      maxCount: 3,
      canRetryOnError: true,
      fallback: () => async () => "default-fallback", // 3rd priority
    },
    timeout: { delay: 5000 },
  },
  propagateRetry: false,
  middlewares: [],
});

await execute(async () => {
  // 2nd priority: conditional fallbacks
  retryFallback({
    when: (error) => error.status === 503,
    fallback: () => () => async () => getReadReplica(),
  });

  // 1st priority: immediate fallback for critical errors
  retryFallback({
    when: (error) => error.code === "CRITICAL",
    fallback: () => () => async () => getBackupData(),
  });

  return await primaryApiCall();
});
```

### Retry Propagation Strategies

Controls how `RetrySignal` is handled in nested loader executions.

#### `propagateRetry: false` (Default)

All retry signals handled locally, never propagated.

```typescript
const child = loader().withOptions({
  input: {
    retry: { maxCount: 2, canRetryOnError: true },
    timeout: { delay: 1000 },
  },
  propagateRetry: false,
  middlewares: [],
});

const parent = loader().withOptions({
  input: {
    retry: { maxCount: 1, canRetryOnError: true },
    timeout: { delay: 5000 },
  },
  propagateRetry: false,
  middlewares: [],
});

// Child retries up to 2 times independently
await parent.execute(async () => {
  return await child.execute(async () => {
    throw new Error("Retries at child level only");
  });
});
```

#### `propagateRetry: true`

All retry signals propagated to parent without local handling.

```typescript
const child = loader().withOptions({
  input: {
    retry: { maxCount: 2, canRetryOnError: true },
    timeout: { delay: 1000 },
  },
  propagateRetry: true, // Propagate all signals upward
  middlewares: [],
});

const parent = loader().withOptions({
  input: {
    retry: { maxCount: 3, canRetryOnError: true },
    timeout: { delay: 5000 },
  },
  propagateRetry: false, // Handle propagated signals
  middlewares: [],
});

// Child errors trigger retries at parent level (up to 3 times)
await parent.execute(async () => {
  return await child.execute(async () => {
    throw new Error("Retries at parent level");
  });
});
```

#### `propagateRetry: "HAS_OUTER_CONTEXT"`

Propagate only when outer loader context exists.

```typescript
const child = loader().withOptions({
  input: { retry: { maxCount: 2, canRetryOnError: true }, timeout: { delay: 1000 } },
  propagateRetry: "HAS_OUTER_CONTEXT",
  middlewares: [],
});

// With outer context → propagates
await parent.execute(async () => child.execute(async () => { ... }));

// Without outer context → handles locally
await child.execute(async () => { ... });
```

#### `propagateRetry: "HAS_SAME_OUTER_CONTEXT"`

Propagate only when outer loader is the same instance.

**Implementation:** Each loader instance receives a unique ID via `generateID("loader")`. The system tracks loader hierarchy in `LoaderMetadata.context().hierarchy` and compares IDs to determine propagation.

```typescript
const loaderA = loader().withOptions({
  input: {
    retry: { maxCount: 2, canRetryOnError: true },
    timeout: { delay: 1000 },
  },
  propagateRetry: "HAS_SAME_OUTER_CONTEXT",
  middlewares: [],
});

const loaderB = loader().withOptions({
  input: {
    retry: { maxCount: 3, canRetryOnError: true },
    timeout: { delay: 2000 },
  },
  propagateRetry: false,
  middlewares: [],
});

// Same instance → propagates
await loaderA.execute(async () => {
  return await loaderA.execute(async () => {
    throw new Error("Propagates to outer loaderA");
  });
});

// Different instance → handles locally
await loaderB.execute(async () => {
  return await loaderA.execute(async () => {
    throw new Error("Handled locally");
  });
});
```

### Loader Reusability

Loaders are designed for reusability: create once, execute multiple times with different targets.

**Benefits:**

- **Performance**: One-time setup cost for configuration and aspect composition
- **Memory Efficiency**: Reduced allocations from shared loader instances
- **Architectural Clarity**: Separation of configuration from execution logic

**Example:**

```typescript
// Configure once
const { execute } = loader().withOptions({
  input: {
    retry: { maxCount: 3, canRetryOnError: true },
    timeout: { delay: 5000 },
    backoff: { strategy: EXPONENTIAL_BACKOFF(2), initialDelay: 100 },
  },
  propagateRetry: false,
  middlewares: [loggingMiddleware, metricsMiddleware],
});

// Reuse for different endpoints
const users = await execute(() => fetch("/api/users").then((r) => r.json()));
const posts = await execute(() => fetch("/api/posts").then((r) => r.json()));
const comments = await execute(() =>
  fetch("/api/comments").then((r) => r.json()),
);
```

### Runtime State Access

Access loader state during execution via `loaderOptions()`.

```typescript
const { execute, loaderOptions } = loader().withOptions({
  input: {
    retry: { maxCount: 3, canRetryOnError: true },
    timeout: { delay: 5000 },
  },
  propagateRetry: false,
  middlewares: [],
});

await execute(async () => {
  const options = loaderOptions();

  // Read state
  console.log(`Retry: ${options.retry.count}/${options.retry.maxCount}`);
  console.log(`Elapsed: ${options.timeout.elapsedTime}ms`);

  // Mutate state
  if (options.retry.count > 2) {
    options.retry.resetRetryCount();
  }

  if (options.timeout.elapsedTime > 3000) {
    options.timeout.resetTimeout();
  }

  return await performOperation();
});
```

**LoaderCoreOptions:**

```typescript
interface LoaderCoreOptions {
  readonly retry: {
    readonly count: number;
    readonly maxCount: number;
    readonly resetRetryCount: () => void;
  };
  readonly timeout: {
    readonly delay: number;
    readonly elapsedTime: number;
    readonly resetTimeout: () => void;
  };
}
```

### Middleware Context Access

Access middleware contexts during execution via `middlewareOptions()`.

```typescript
const trackingMiddleware = middleware().withOptions({
  name: "tracking",
  contextGenerator: () => ({ requests: 0, errors: 0 }),
  before: async (context) => {
    context.requests++;
  },
  failure: async (context) => {
    context.errors++;
  },
});

const { execute, middlewareOptions } = loader().withOptions({
  input: {
    retry: { maxCount: 2, canRetryOnError: true },
    timeout: { delay: 5000 },
  },
  propagateRetry: false,
  middlewares: [trackingMiddleware],
});

await execute(async () => {
  const options = middlewareOptions();
  const tracking = options.tracking();

  console.log(`Requests: ${tracking.requests}`);
  console.log(`Errors: ${tracking.errors}`);

  return await performOperation();
});
```

**MiddlewareOptions:**

```typescript
type MiddlewareOptions<
  Middlewares extends readonly LoaderMiddleware<any, unknown, string>[],
> = {
  readonly [K in Middlewares[number] as K["name"]]: () => ReturnType<
    K["contextGenerator"]
  >;
};
```

## Types Reference

### Core Exports

```typescript
// Main functions
export { loader, middleware };

// Signals
export {
  MiddlewareInvalidContextSignal,
  RetryExceededSignal,
  RetrySignal,
  TimeoutSignal,
};

// Backoff strategies
export { createBackoff, FIXED_BACKOFF, LINEAR_BACKOFF, EXPONENTIAL_BACKOFF };

// Type exports
export type { BackoffContextInput };
export type { LoaderCoreInput };
export type { LoaderMiddleware, MiddlewareContext, MiddlewareOptions };
export type { LoaderCoreOptions };
export type { RetryContextInput };
export type { TimeoutContextInput };
```

### Type Definitions

```typescript
// Backoff
type Backoff<T extends string = string> = {
  type: T;
  next: (delay: number) => number;
};

type BackoffContextInput = {
  readonly strategy: Backoff;
  readonly initialDelay: number;
};

// Retry
type RetryContextInput<Result> = {
  readonly maxCount: number;
  readonly canRetryOnError: boolean | ((error: unknown) => boolean);
  readonly fallback?: TargetWrapper<Result>;
  readonly onRetryEach?: () => void;
  readonly onRetryExceeded?: () => void;
};

// Timeout
type TimeoutContextInput = {
  readonly delay: number;
  readonly onTimeout?: () => void;
};

// Middleware
type LoaderMiddleware<Result, Context, MiddlewareName extends string> = {
  readonly name: MiddlewareName;
  readonly contextGenerator: () => Context;
  readonly aspect: Aspect<Result, any>;
};

type MiddlewareContext<
  Middlewares extends readonly LoaderMiddleware<any, unknown, string>[],
> = {
  readonly [K in Middlewares[number] as K["name"]]: K extends LoaderMiddleware<
    any,
    infer Context,
    any
  >
    ? Context
    : never;
};
```

## Implementation Details

### Internal Aspect Composition

The loader internally creates a composed AOP process from three aspects:

```typescript
// From loader.ts line 89-100
const process: Process<Result, LoaderContext> = createProcess({
  aspects: [
    createBackoffAspect<Result>(), // Manages delay between retries
    createRetryAspect<Result>(), // Handles retry logic
    createTimeoutAspect<Result>(), // Enforces time limits
    ...middlewares.map(({ aspect }) => aspect), // User-defined middlewares
  ],
  buildOptions: {
    advice: {
      afterThrowing: {
        error: {
          runtime: { afterThrow: "halt" }, // Signals overwrite target errors
        },
      },
    },
  },
  processOptions: {
    /* custom error handling */
  },
});
```

**Aspect Dependencies:**

- `LOADER_RETRY_ASPECT` depends on `LOADER_TIMEOUT_ASPECT`
- `LOADER_TIMEOUT_ASPECT` depends on `LOADER_BACKOFF_ASPECT`
- This ensures proper execution order: Backoff → Timeout → Retry

### Error Determination Logic

When multiple errors occur concurrently, the loader prioritizes them:

```typescript
// From loader.ts line 115-139
async determineError({ errors }) {
  if (errors.length === 0) {
    throw new Error("no error to determine");
  }

  // Sort by priority (signals first, then by priority value)
  const [, error] = errors
    .map((error) =>
      Signal.isSignal(error)
        ? ([error.priority, error] as const)
        : ([ERROR_PRIORITY, error] as const),
    )
    .sort(([priorityA], [priorityB]) => priorityB - priorityA)
    .at(0)!;

  // If highest priority error is a Signal, use it directly
  if (Signal.isSignal(error)) {
    return error;
  }

  // Otherwise, delegate to user-provided onDetermineError or return first error
  return onDetermineError ? onDetermineError(errors) : error;
}
```

**Behavior:**

- Signals always take precedence over regular errors
- Among signals, higher priority wins (Middleware > Timeout > RetryExceeded > Retry)
- For non-signal errors, `onDetermineError` allows custom selection logic
- Default behavior returns the first error in the array

### Error Handling Logic

After error determination, the loader attempts recovery:

```typescript
// From loader.ts line 142-171
async handleError({ exit, error, currentTarget, context }) {
  // Non-signal errors: delegate to user handler or rethrow
  if (!Signal.isSignal(error)) {
    if (onHandleError) {
      return onHandleError(error);
    }
    throw error;
  }

  // RetrySignal: attempt retry or propagate
  if (error instanceof RetrySignal) {
    if (canPropagateRetry(loaderID, propagateRetry)) {
      throw new RetrySignal({ ...error, propagated: true });
    }

    // Retry locally: run process again with updated context
    const nextContext = context();
    return exit(async () => {
      return runProcessWith({
        process,
        context: loaderContext,
        contextGenerator: () => nextContext,
        target: currentTarget,
      });
    });
  }

  // Other signals: rethrow
  throw error;
}
```

### Metadata Tracking

Loader hierarchy is tracked for propagation strategies.

```typescript
// From withLoaderMetadata.ts
export function withLoaderMetadata<T>(id: string, fn: () => Promise<T>) {
  const metadata: LoaderMetadata = { hierarchy: [] };

  try {
    const currentContext = LoaderMetadata.context();
    metadata.hierarchy = [...currentContext.hierarchy];
  } catch {
    /* no outer context */
  }

  metadata.hierarchy = [...metadata.hierarchy, id];

  return async () =>
    LoaderMetadata.exit(async () =>
      AsyncContext.executeWith(LoaderMetadata, () => metadata, fn),
    );
}
```

**Hierarchy Example:**

```typescript
// loaderA.execute() → hierarchy: ["id:loader:uuid-1"]
//   loaderA.execute() → hierarchy: ["id:loader:uuid-1", "id:loader:uuid-1"]
//   loaderB.execute() → hierarchy: ["id:loader:uuid-1", "id:loader:uuid-2"]
```

The `canPropagateRetry()` function uses this hierarchy to determine whether to propagate `RetrySignal` based on the `propagateRetry` strategy.

### canRetryOnError Scope

**Critical:** `canRetryOnError` **only** evaluates errors from the target function, **not** middleware errors.

```typescript
// From createRetryAspect.ts afterThrowing advice
  async advice({ __core__retry: retry }, error) {
  // Exclude non-retry signals
    if (Signal.isSignal(error) && !(error instanceof RetrySignal)) {
    return;
    }

  // ONLY evaluate non-signal errors (from target function)
    if (!Signal.isSignal(error)) {
      const { canRetryOnError } = retry;
      const isRetryable =
        canRetryOnError === true ||
        (typeof canRetryOnError === "function" && canRetryOnError(error));

      if (!isRetryable) {
      return; // Don't retry
      }
    }

  // Check max count and proceed with retry
    if (retry.maxCount < retry.count + 1) {
      retry.onRetryExceeded?.();
      throw new RetryExceededSignal({ maxRetry: retry.maxCount });
    }

    retry.count += 1;
  throw new RetrySignal({ errorReason: error });
}
```

**Implication:** Middleware errors fail immediately without retry evaluation. Only target function errors are subject to `canRetryOnError` logic.

## Advanced Patterns

### Type-Safe Middleware Composition

Loader and all middlewares must share the same `Result` type parameter.

```typescript
// ✅ CORRECT: Matching types
interface ApiResponse {
  data: string;
  status: number;
}

const middleware1 = middleware<ApiResponse>().withOptions({
  name: "m1",
  contextGenerator: () => ({}),
  complete: async (context, result) => {
    console.log(result.data, result.status); // Type-safe
  },
});

const { execute } = loader<ApiResponse>().withOptions({
  input: {
    retry: { maxCount: 3, canRetryOnError: true },
    timeout: { delay: 5000 },
  },
  propagateRetry: false,
  middlewares: [middleware1], // Type compatible
});

// ❌ INCORRECT: Mismatched types
interface DifferentResponse {
  message: string;
}

const badMiddleware = middleware<DifferentResponse>().withOptions({
  name: "bad",
  contextGenerator: () => ({}),
});

const { execute: badExecute } = loader<ApiResponse>().withOptions({
  input: {
    retry: { maxCount: 3, canRetryOnError: true },
    timeout: { delay: 5000 },
  },
  propagateRetry: false,
  middlewares: [badMiddleware], // ❌ TypeScript error: Type mismatch
});
```

### Nested Loader Execution

```typescript
const childLoader = loader().withOptions({
  input: {
    retry: { maxCount: 2, canRetryOnError: true },
    timeout: { delay: 1000 },
  },
  propagateRetry: false,
  middlewares: [],
});

const parentLoader = loader().withOptions({
  input: {
    retry: { maxCount: 1, canRetryOnError: true },
    timeout: { delay: 10000 },
  },
  propagateRetry: false,
  middlewares: [],
});

const results = await parentLoader.execute(async () => {
  const ids = await fetchIds();
  return Promise.all(ids.map((id) => childLoader.execute(() => fetchById(id))));
});
```

### BFF Data Aggregation

```typescript
interface UserData {
  id: string;
  name: string;
  avatar: string;
}

interface PostsData {
  posts: Array<{ id: string; title: string }>;
  total: number;
}

const userApiLoader = loader<UserData>().withOptions({
  input: {
    retry: { maxCount: 3, canRetryOnError: (e) => e.status >= 500 },
    timeout: { delay: 3000 },
  },
  propagateRetry: false,
  middlewares: [],
});

const postsApiLoader = loader<PostsData>().withOptions({
  input: {
    retry: { maxCount: 2, canRetryOnError: true },
    timeout: { delay: 2000 },
    backoff: { strategy: EXPONENTIAL_BACKOFF(2), initialDelay: 100 },
  },
  propagateRetry: false,
  middlewares: [],
});

// BFF endpoint aggregating multiple API calls
async function getProfilePage(userId: string) {
  const [userData, postsData] = await Promise.allSettled([
    userApiLoader.execute(() => {
      userApiLoader.retryFallback({
        when: (e) => e.status === 503,
        fallback: () => () => async () => ({
          id: userId,
          name: "Guest",
          avatar: "/default-avatar.png",
        }),
      });
      return fetch(`/api/users/${userId}`).then((r) => r.json());
    }),

    postsApiLoader.execute(() => {
      postsApiLoader.retryFallback({
        when: (e) => e.status === 429,
        fallback: () => () => async () => ({ posts: [], total: 0 }),
      });
      return fetch(`/api/users/${userId}/posts`).then((r) => r.json());
    }),
  ]);

  return {
    user: userData.status === "fulfilled" ? userData.value : null,
    posts: postsData.status === "fulfilled" ? postsData.value : null,
  };
}
```

### SSR with CDN Fallback

```typescript
interface PageData {
  content: string;
  metadata: { title: string; description: string };
  timestamp: number;
}

class CDNHealthMonitor {
  private failureCount = 0;
  private lastFailure = 0;
  private readonly threshold = 3;
  private readonly cooldownMs = 60000;

  shouldUseCDN(): boolean {
    if (this.failureCount < this.threshold) return true;
    return Date.now() - this.lastFailure > this.cooldownMs;
  }

  recordFailure() {
    this.failureCount++;
    this.lastFailure = Date.now();
  }

  recordSuccess() {
    this.failureCount = 0;
  }
}

const cdnMonitor = new CDNHealthMonitor();

const {
  execute: fetchPage,
  retryImmediately,
  retryFallback,
} = loader<PageData>().withOptions({
  input: {
    retry: { maxCount: 2, canRetryOnError: true },
    timeout: { delay: 3000 },
  },
  propagateRetry: false,
  middlewares: [],
});

// SSR page data fetching with CDN fallback
export async function getServerSideProps(slug: string) {
  return fetchPage(async () => {
    // Fallback to origin if CDN is unhealthy
    retryFallback({
      when: () => !cdnMonitor.shouldUseCDN(),
      fallback: () => () => async () => {
        const data = await fetchFromOrigin(slug);
        cdnMonitor.recordSuccess();
        return data;
      },
    });

    // Default: try CDN first
    const data = await fetchFromCDN(slug)
      .then((result) => {
        cdnMonitor.recordSuccess();
        return result;
      })
      .catch((error) => {
        cdnMonitor.recordFailure();
        throw error;
      });

    return data;
  });
}
```

### Client-Side Data Fetching with Cache

```typescript
interface CachedData<T> {
  data: T;
  cachedAt: number;
}

// IndexedDB cache layer
async function getCached<T>(key: string): Promise<T | null> {
  const cached = await indexedDB.get<CachedData<T>>(key);
  if (!cached) return null;
  if (Date.now() - cached.cachedAt > 300000) return null; // 5min TTL
  return cached.data;
}

async function setCached<T>(key: string, data: T): Promise<void> {
  await indexedDB.set(key, { data, cachedAt: Date.now() });
}

const { execute: fetchWithCache, retryFallback } =
  loader<UserData>().withOptions({
    input: {
      retry: {
        maxCount: 2,
        canRetryOnError: (error) => error.status >= 500 || error.status === 429,
      },
      timeout: { delay: 5000 },
      backoff: { strategy: LINEAR_BACKOFF(1000), initialDelay: 500 },
    },
    propagateRetry: false,
    middlewares: [],
  });

async function getUserData(userId: string): Promise<UserData> {
  return fetchWithCache(async () => {
    retryFallback({
      when: (error) => error.status === 503,
      fallback: () => () => async () => {
        const cached = await getCached<UserData>(`user:${userId}`);
        if (cached) return cached;
        throw error; // No cache available
      },
    });

    retryFallback({
      when: (error) => error.status === 429,
      fallback: () => () => async () => {
        console.warn("Rate limited, using stale cache");
        return (await getCached<UserData>(`user:${userId}`))!;
      },
    });

    const response = await fetch(`/api/users/${userId}`);
    if (!response.ok) throw { status: response.status };

    const data = await response.json();
    await setCached(`user:${userId}`, data);

    return data;
  });
}
```

## Related Packages

- [@h1ylabs/promise-aop](https://github.com/h1ylabs/next-loader/tree/main/packages/promise-aop) - Underlying Promise AOP library
- [@h1ylabs/next-loader](https://github.com/h1ylabs/next-loader/tree/main/packages/next-loader) - Next.js-specific loader implementation

## License

MIT
