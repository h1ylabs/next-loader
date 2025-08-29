# @h1y/loader-core

**Latest version: v6.0.0**

A robust, Promise AOP-based loader library with built-in retry, timeout, and backoff strategies. Built on top of [@h1y/promise-aop](https://github.com/h1ylabs/next-loader/tree/main/packages/promise-aop), this core library provides the foundation for creating resilient async operations with middleware support.

## Installation

```bash
npm install @h1y/loader-core
# or
yarn add @h1y/loader-core
# or
pnpm add @h1y/loader-core
```

## Documentation

- [한국어 문서 (Korean Documentation)](./docs/README-ko.md)

## Quick Start

```typescript
import { loader, EXPONENTIAL_BACKOFF } from "@h1y/loader-core";

// Create a reusable loader configuration
const { execute, retryImmediately, retryFallback } = loader().withOptions({
  input: {
    retry: { maxCount: 3, canRetryOnError: true },
    timeout: { delay: 5000 },
    backoff: { strategy: EXPONENTIAL_BACKOFF(2), initialDelay: 100 },
  },
  propagateRetry: false,
  middlewares: [],
});

// Execute with target - loader can be reused with different targets
const result = await execute(async () => {
  // ⚠️ IMPORTANT: retryFallback must be called inside execute (like React Hooks)
  // These are re-registered on every retry attempt
  retryFallback({
    when: (error) => error.status === 503,
    fallback: (error) => () => async () => {
      console.log("Service unavailable, using cached data");
      return getCachedData();
    },
  });

  try {
    const response = await fetch("/api/data");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  } catch (error) {
    // retryImmediately can also only be used inside execute
    if (error.message.includes("CRITICAL")) {
      retryImmediately(() => async () => {
        return await getBackupData();
      });
    }
    throw error;
  }
});

// Reuse the same loader with different targets
const userData = await execute(async () => {
  // Each execution can have its own fallback strategy
  retryFallback({
    when: (error) => error.status >= 500,
    fallback: () => () => async () => {
      return getDefaultUserData();
    },
  });

  const response = await fetch("/api/user");
  return response.json();
});
```

## Core Concepts

Built on [@h1y/promise-aop](https://github.com/h1ylabs/next-loader/tree/main/packages/promise-aop), this library provides:

- **Reusable Loaders**: Create once, execute with different targets for optimal performance
- **Signal-based Error Handling**: `RetrySignal`, `TimeoutSignal` for precise control
- **Middleware System**: Lifecycle hooks for observing, validating, and side effects
- **Context Isolation**: Each execution maintains isolated contexts for safety

## Context Requirements

### Execution Context Limitations

⚠️ **Critical Constraint**: The `retryImmediately` and `retryFallback` functions can **only** be called from within the `execute` callback function. They depend on the internal loader context and will not work if called outside the execution scope.

```typescript
const { execute, retryImmediately, retryFallback } = loader().withOptions({
  input: {
    retry: { maxCount: 3, canRetryOnError: true },
    timeout: { delay: 5000 },
  },
  propagateRetry: false,
  middlewares: [],
});

// ❌ INCORRECT: Will not work
retryFallback({
  when: (error) => error.status === 500,
  fallback: () => () => async () => "fallback",
});

const result = await execute(async () => {
  // ✅ CORRECT: Inside execute callback
  retryFallback({
    when: (error) => error.status === 500,
    fallback: () => () => async () => "fallback",
  });

  try {
    return await apiCall();
  } catch (error) {
    // ✅ CORRECT: Inside execute callback
    if (shouldRetry) retryImmediately();
    throw error;
  }
});
```

### React Hooks-like Behavior

`retryFallback` behaves similarly to React Hooks:

- **Re-executed on every call**: Like `useEffect` or `useState`, `retryFallback` calls must be made on every execution/retry
- **Call order matters**: Place `retryFallback` calls at the **top** of your execute callback
- **Automatic cleanup**: Fallback matchers are cleared before each retry, ensuring fresh registration

```typescript
await execute(async () => {
  // ✅ CORRECT: React Hooks pattern - always at the top
  retryFallback({ when: (error) => error.type === "A", fallback: fallbackA });
  retryFallback({ when: (error) => error.type === "B", fallback: fallbackB });

  // Don't put these inside conditions
  if (someCondition) {
    // ❌ INCORRECT: Conditional fallback registration
    retryFallback({ when: (error) => error.type === "C", fallback: fallbackC });
  }

  // Actual logic comes after fallback registration
  return await performOperation();
});
```

### Why This Design?

This constraint ensures:

1. **Context Safety**: Functions can only access valid loader context during execution
2. **Predictable Behavior**: Fallbacks are re-registered consistently on each retry
3. **Memory Safety**: Prevents memory leaks from lingering references outside execution scope
4. **Clear Boundaries**: Maintains separation between loader configuration and execution logic

## Loader Reusability

The API design prioritizes **loader reusability** - create once, execute many times with different targets. This pattern offers significant performance and architectural benefits:

### Key Benefits

#### Performance Optimization

- **One-time Setup Cost**: Loader configuration, middleware initialization, and aspect composition happen once
- **Reduced Memory Allocation**: Same loader instance handles multiple operations without re-creating contexts
- **Efficient Resource Usage**: Particularly beneficial in high-frequency scenarios

#### Architectural Advantages

- **Separation of Concerns**: Configuration is separate from execution logic
- **Template Pattern**: Define retry/timeout/middleware behavior once, apply to multiple operations
- **Cleaner Nested Patterns**: Child loaders can be defined once and reused across parent executions

### Usage Patterns

#### Single Loader, Multiple Targets

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

// Reuse for different API endpoints
const users = await execute(() => fetch("/api/users").then((r) => r.json()));
const posts = await execute(() => fetch("/api/posts").then((r) => r.json()));
const comments = await execute(() =>
  fetch("/api/comments").then((r) => r.json()),
);
```

#### Template-based Configuration

```typescript
// Create loader templates for different scenarios
const { execute: fastExecute } = loader().withOptions({
  input: {
    retry: { maxCount: 2, canRetryOnError: true },
    timeout: { delay: 1000 },
  },
  propagateRetry: false,
  middlewares: [],
});

const { execute: robustExecute } = loader().withOptions({
  input: {
    retry: { maxCount: 5, canRetryOnError: true },
    timeout: { delay: 10000 },
    backoff: { strategy: EXPONENTIAL_BACKOFF(2), initialDelay: 200 },
  },
  propagateRetry: false,
  middlewares: [retryLoggingMiddleware, circuitBreakerMiddleware],
});

// Use appropriate loader based on operation criticality
const quickData = await fastExecute(() => getCacheableData());
const criticalData = await robustExecute(() => getBusinessCriticalData());
```

#### Efficient Batch Operations

```typescript
const { execute } = loader().withOptions({
  input: {
    retry: { maxCount: 2, canRetryOnError: true },
    timeout: { delay: 2000 },
  },
  propagateRetry: false,
  middlewares: [progressMiddleware],
});

// Process large datasets efficiently
const results = await Promise.all(
  largeDataArray.map((item) => execute(() => processItem(item))),
);
```

## Error Handling Internals

### Signal Priority System

The loader uses a sophisticated priority-based error handling system to manage multiple concurrent failures. When multiple aspects (retry, timeout, middlewares) encounter errors simultaneously, the system prioritizes signals based on their urgency and importance.

#### Priority Hierarchy

The following priorities are used internally (higher values = higher priority):

```typescript
// Signal priorities (binary representation for clarity)
const MIDDLEWARE_INVALID_SIGNAL_PRIORITY = 0b1000_0000_0000_0000; // 32768
const TIMEOUT_SIGNAL_PRIORITY = 0b0100_0000_0000_0000; // 16384
const RETRY_EXCEEDED_SIGNAL_PRIORITY = 0b0010_0000_0000_0000; // 8192
const RETRY_SIGNAL_PRIORITY = 0b0001_0000_0000_0000; // 4096
const ERROR_PRIORITY = 0b0000_0000_0000_0000; // 0
```

**Priority Order (highest to lowest):**

1. **`MiddlewareInvalidContextSignal`** - Critical system error, middleware context corruption
2. **`TimeoutSignal`** - Operation timeout, time-sensitive failure
3. **`RetryExceededSignal`** - All retry attempts exhausted
4. **`RetrySignal`** - Retry attempt request
5. **Regular `Error`** - Application-level errors

#### Error Determination Process

When multiple errors occur, the `determineError` logic follows this process:

```typescript
// Simplified internal logic
async determineError({ errors }) {
  if (errors.length === 0) {
    throw new Error("No errors to determine");
  }

  // Sort errors by priority (signals first, then by priority value)
  const prioritizedErrors = errors
    .map((error) =>
      Signal.isSignal(error)
        ? [error.priority, error]  // Use signal's priority
        : [ERROR_PRIORITY, error]  // Regular errors get lowest priority
    )
    .sort(([priorityA], [priorityB]) => priorityB - priorityA) // Descending order
    .map(([, error]) => error);

  const highestPriorityError = prioritizedErrors[0];

  // If highest priority error is a Signal, use it directly
  if (Signal.isSignal(highestPriorityError)) {
    return highestPriorityError;
  }

  // If no signals present, delegate to user-provided onDetermineError
  // or default to first error
  return onDetermineError
    ? await onDetermineError(errors)
    : highestPriorityError;
}
```

#### Signal vs Error Handling

The system treats **Signals** and regular **Errors** differently:

**Signals** (handled internally):

- Have built-in priorities and special handling logic
- `RetrySignal`: Triggers automatic retry mechanism
- `TimeoutSignal`: Indicates timeout occurred
- `RetryExceededSignal`: Indicates all retries exhausted
- `MiddlewareInvalidContextSignal`: Critical middleware state error

**Regular Errors** (user-controlled):

- Always have the lowest priority (0)
- Subject to `canRetryOnError` evaluation
- Can be customized via `onDetermineError` and `onHandleError`

#### Example: Multiple Concurrent Failures

```typescript
import { loader, TimeoutSignal } from "@h1y/loader-core";

const { execute } = loader().withOptions({
  input: {
    retry: { maxCount: 2, canRetryOnError: true },
    timeout: { delay: 100 }, // Very short timeout
  },
  propagateRetry: false,
  middlewares: [],

  onDetermineError: async (errors) => {
    console.log(
      "Multiple errors occurred:",
      errors.map((e) => e.constructor.name),
    );
    // This function only gets called if NO signals are present
    return errors[0];
  },

  onHandleError: async (error) => {
    console.log("Handling final error:", error.constructor.name);
    if (error instanceof TimeoutSignal) {
      return "timeout-fallback";
    }
    throw error;
  },
});

const result = await execute(async () => {
  // This will cause both a timeout AND throw an error
  await new Promise((resolve) => setTimeout(resolve, 200)); // Exceeds 100ms timeout
  throw new Error("Business logic error");
});

// Output will show TimeoutSignal takes priority over the Error
// Result: "timeout-fallback"
```

This priority system ensures that critical system-level issues (like timeouts) are handled before application-level errors, providing predictable and reliable error handling behavior.

## Advanced Retry Strategies

The loader provides a sophisticated three-tier fallback selection system that determines which fallback to use when retries occur. Understanding this priority system is crucial for implementing robust error handling and recovery strategies.

### Fallback Priority System

When a retry occurs, the system evaluates fallbacks in the following priority order:

#### 1st Priority: Immediate Fallback

- **Source**: Set via `retryImmediately(fallback)` within the target function
- **Use case**: Dynamic, context-aware fallbacks determined at runtime
- **Scope**: Single retry attempt only

```typescript
const { execute, retryImmediately } = loader().withOptions({
  input: {
    retry: { maxCount: 3, canRetryOnError: true },
    timeout: { delay: 5000 },
  },
  propagateRetry: false,
  middlewares: [],
});

const result = await execute(async () => {
  const isMaintenanceMode = await checkMaintenanceStatus();

  if (isMaintenanceMode) {
    // Highest priority: immediate fallback for this specific condition
    retryImmediately(() => async () => {
      console.log("Maintenance mode detected, using cached response");
      return await getCachedResponse();
    });
  }

  return await primaryApiCall();
});
```

#### 2nd Priority: Conditional Fallback

- **Source**: Registered via `retryFallback(matcher)` within execution
- **Use case**: Error type-specific fallbacks with predefined conditions
- **Scope**: Applies to current execution and all its retries

```typescript
const { execute, retryFallback } = loader().withOptions({
  input: {
    retry: { maxCount: 3, canRetryOnError: true },
    timeout: { delay: 5000 },
  },
  propagateRetry: false,
  middlewares: [],
});

const result = await execute(async () => {
  // ✅ CORRECT: Register fallbacks inside execute (re-executed on every retry)
  retryFallback({
    when: (error) => error.status === 503,
    fallback: (error) => () => async () => {
      console.log("Service unavailable, using read replica");
      return await readReplicaCall();
    },
  });

  retryFallback({
    when: (error) => error.status >= 500,
    fallback: (error) => () => async () => {
      console.log("Server error, degraded service mode");
      return await degradedServiceCall();
    },
  });

  return await primaryApiCall(); // Conditional fallbacks apply automatically
});
```

#### 3rd Priority: Initial Fallback

- **Source**: Set in loader configuration during creation
- **Use case**: Default fallback for all unmatched retry scenarios
- **Scope**: Applies throughout the loader's lifetime

```typescript
const { execute } = loader().withOptions({
  input: {
    retry: {
      maxCount: 3,
      canRetryOnError: true,
      // Lowest priority: initial fallback as last resort
      fallback: () => async () => {
        console.log("Using default fallback");
        return getDefaultResponse();
      },
    },
    timeout: { delay: 5000 },
  },
  propagateRetry: false,
  middlewares: [],
});

const result = await execute(async () => {
  return await primaryApiCall();
});
```

### Fallback Selection Logic

The internal fallback selection follows this decision tree:

```typescript
// Simplified internal logic from createRetryAspect
function selectFallback(retry) {
  return (
    retry.fallback.immediate || // 1st: retryImmediately() fallback
    retry.fallback.conditional || // 2nd: retryFallback() matched fallback
    retry.fallback.initial // 3rd: loader configuration fallback
  );
}
```

### Practical Usage Patterns

#### Pattern 1: Hierarchical Fallback Strategy

```typescript
const { execute, retryImmediately, retryFallback } = loader().withOptions({
  input: {
    retry: {
      maxCount: 3,
      canRetryOnError: true,
      fallback: () => async () => "ultimate-fallback", // 3rd priority
    },
    timeout: { delay: 5000 },
  },
  propagateRetry: false,
  middlewares: [],
});

const result = await execute(async () => {
  // ✅ CORRECT: Register fallbacks inside execute
  // 2nd priority: handle different error types
  retryFallback({
    when: (error) => error.type === "RATE_LIMITED",
    fallback: () => () => async () => {
      await waitForRateLimit();
      return await primaryApiCall();
    },
  });

  try {
    return await primaryApiCall();
  } catch (error) {
    if (error.type === "CRITICAL_DATA_LOSS") {
      // 1st priority: immediate critical error handling
      retryImmediately(() => async () => {
        await notifyOperations(error);
        return await recoverFromBackup();
      });
    }
    throw error;
  }
});
```

#### Pattern 2: Dynamic Fallback Selection

```typescript
const { execute, retryImmediately } = loader().withOptions({
  input: {
    retry: { maxCount: 3, canRetryOnError: true },
    timeout: { delay: 5000 },
  },
  propagateRetry: false,
  middlewares: [],
});

const result = await execute(async () => {
  try {
    return await primaryApiCall();
  } catch (error) {
    // Choose fallback strategy based on current system state
    const systemHealth = await checkSystemHealth();

    if (systemHealth.cpuUsage > 0.9) {
      retryImmediately(() => async () => {
        // Use lightweight fallback under high load
        return await lightweightApiCall();
      });
    } else if (systemHealth.networkLatency > 1000) {
      retryImmediately(() => async () => {
        // Use local cache under high latency
        return await localCacheCall();
      });
    }

    throw error; // Let other fallback strategies handle it
  }
});
```

This layered approach ensures that you always have appropriate fallback strategies available, from immediate context-aware decisions to broad default behaviors, providing maximum flexibility and reliability in error recovery scenarios.

## Retry Propagation Strategies

The `propagateRetry` option controls how `RetrySignal`s are handled when they bubble up from nested operations. This is particularly important in scenarios with nested loader executions or when you want to control retry behavior across different layers of your application.

### Understanding Retry Propagation

When a `RetrySignal` is thrown (either manually via `retry()` or automatically by the retry mechanism), the `propagateRetry` setting determines whether that signal should be:

- **Handled locally** (converted to a retry attempt at the current level)
- **Propagated upward** (passed to parent/calling context as-is)

### Propagation Options

#### `propagateRetry: false` (Default)

All retry signals are handled locally and never propagated to parent contexts.

```typescript
const { execute: childExecute } = loader().withOptions({
  input: {
    retry: { maxCount: 2, canRetryOnError: true },
    timeout: { delay: 1000 },
  },
  propagateRetry: false, // Retry signals handled locally
  middlewares: [],
});

const { execute: parentExecute } = loader().withOptions({
  input: {
    retry: { maxCount: 1, canRetryOnError: true },
    timeout: { delay: 5000 },
  },
  propagateRetry: false,
  middlewares: [],
});

await parentExecute(async () => {
  // Child retry signals will NOT affect parent retry logic
  return await childExecute(async () => {
    throw new Error("This might retry 2 times at child level");
  });
});
```

#### `propagateRetry: true`

All retry signals are propagated to parent contexts without local handling.

```typescript
const { execute: childExecute } = loader().withOptions({
  input: {
    retry: { maxCount: 2, canRetryOnError: true },
    timeout: { delay: 1000 },
  },
  propagateRetry: true, // All retry signals propagated upward
  middlewares: [],
});

const { execute: parentExecute } = loader().withOptions({
  input: {
    retry: { maxCount: 3, canRetryOnError: true },
    timeout: { delay: 5000 },
  },
  propagateRetry: false, // Handle propagated signals from children
  middlewares: [],
});

await parentExecute(async () => {
  // Child errors will trigger retries at PARENT level (up to 3 times)
  // Child's maxCount: 2 is ignored since signals are propagated
  return await childExecute(async () => {
    throw new Error("This will retry at parent level");
  });
});
```

#### `propagateRetry: "HAS_OUTER_CONTEXT"`

Propagate retry signals only when there is an outer loader context.

```typescript
const { execute: childExecute } = loader().withOptions({
  input: {
    retry: { maxCount: 2, canRetryOnError: true },
    timeout: { delay: 1000 },
  },
  propagateRetry: "HAS_OUTER_CONTEXT", // Propagate only if parent loader exists
  middlewares: [],
});

const { execute: parentExecute } = loader().withOptions({
  input: {
    retry: { maxCount: 3, canRetryOnError: true },
    timeout: { delay: 5000 },
  },
  propagateRetry: false, // Handle propagated signals locally
  middlewares: [],
});

// With parent context - signals propagate
await parentExecute(async () => {
  return await childExecute(async () => {
    throw new Error("This will retry at parent level (3 times max)");
  });
});

// Without parent context - signals handled locally
await childExecute(async () => {
  throw new Error("This will retry locally (2 times max)");
});
```

#### `propagateRetry: "HAS_SAME_OUTER_CONTEXT"`

Propagate retry signals only when the outer loader is the same instance (same `execute` function).

**Loader Instance Identification System**: Each loader instance is assigned a unique UUID-based identifier when created using `generateID("loader")`. This ID is used internally to track loader hierarchies and determine propagation behavior. The system maintains a hierarchy of loader IDs in the metadata context, enabling precise control over retry propagation in nested scenarios.

```typescript
// Create a reusable loader instance
const { execute: reusableExecute } = loader().withOptions({
  input: {
    retry: { maxCount: 2, canRetryOnError: true },
    timeout: { delay: 1000 },
  },
  propagateRetry: "HAS_SAME_OUTER_CONTEXT", // Propagate only to same loader instance
  middlewares: [],
});

// Create a different loader instance
const { execute: differentExecute } = loader().withOptions({
  input: {
    retry: { maxCount: 3, canRetryOnError: true },
    timeout: { delay: 2000 },
  },
  propagateRetry: false,
  middlewares: [],
});

// Same loader instance - signals propagate
await reusableExecute(async () => {
  return await reusableExecute(async () => {
    // Same execute function
    throw new Error("Propagates to outer reusableExecute");
  });
});

// Different loader instance - signals handled locally
await differentExecute(async () => {
  return await reusableExecute(async () => {
    // Different execute function
    throw new Error("Handled locally, no propagation");
  });
});

// Practical use case: Recursive operations with the same loader
async function processNestedData(data: any[], depth = 0): Promise<any[]> {
  return reusableExecute(async () => {
    if (depth > 5) throw new Error("Max depth reached");

    return Promise.all(
      data.map(async (item) => {
        if (Array.isArray(item)) {
          // Recursive call uses same loader - retries propagate up
          return processNestedData(item, depth + 1);
        }
        return processItem(item);
      }),
    );
  });
}
```

**Internal Hierarchy Tracking**: The system internally tracks loader execution hierarchy like this:

```typescript
// Example of internal loader hierarchy tracking
// (This is for understanding - not part of the public API)

// First loader instance: id:loader:uuid-1
const loaderA = loader().withOptions({...});

// Second loader instance: id:loader:uuid-2
const loaderB = loader().withOptions({...});

// When executed:
await loaderA.execute(async () => {
  // Current hierarchy: ["id:loader:uuid-1"]

  await loaderA.execute(async () => {
    // Current hierarchy: ["id:loader:uuid-1", "id:loader:uuid-1"]
    // Same outer context detected -> propagation allowed
    throw new Error("Will propagate with HAS_SAME_OUTER_CONTEXT");
  });

  await loaderB.execute(async () => {
    // Current hierarchy: ["id:loader:uuid-1", "id:loader:uuid-2"]
    // Different outer context -> no propagation
    throw new Error("Handled locally");
  });
});
```

This identification system enables sophisticated retry propagation strategies while maintaining clear boundaries between different loader instances, ensuring predictable behavior in complex nested scenarios.

### Use Cases and Best Practices

#### Use Case 1: Independent Operation Retry

```typescript
// API calls that should retry independently
const { execute: apiCall } = loader().withOptions({
  input: {
    retry: { maxCount: 3, canRetryOnError: (e) => e.status >= 500 },
    timeout: { delay: 2000 },
  },
  propagateRetry: false, // Each API call retries independently
  middlewares: [],
});

const { execute: batchProcess } = loader().withOptions({
  input: {
    retry: { maxCount: 1, canRetryOnError: true },
    timeout: { delay: 30000 },
  },
  propagateRetry: false,
  middlewares: [],
});

// Each API call retries independently; batch doesn't retry individual failures
await batchProcess(async () => {
  return await Promise.allSettled([
    apiCall(() => fetch("/api/users")),
    apiCall(() => fetch("/api/posts")),
    apiCall(() => fetch("/api/comments")),
  ]);
});
```

#### Use Case 2: Hierarchical Retry Strategy

```typescript
// Complex operation with fallback hierarchy
const { execute: primaryOperation } = loader().withOptions({
  input: {
    retry: { maxCount: 2, canRetryOnError: true },
    timeout: { delay: 1000 },
  },
  propagateRetry: true, // Propagate failures upward
  middlewares: [],
});

const { execute: operationWithFallback } = loader().withOptions({
  input: {
    retry: { maxCount: 1, canRetryOnError: true },
    timeout: { delay: 5000 },
  },
  propagateRetry: false, // Handle all retries at this level
  middlewares: [],
});

await operationWithFallback(async () => {
  try {
    // Try primary operation first
    return await primaryOperation(async () => performPrimaryTask());
  } catch (error) {
    // Primary failed after propagating retries, try fallback
    return await performFallbackTask();
  }
});
```

#### Use Case 3: Conditional Propagation

```typescript
const { execute } = loader().withOptions({
  input: {
    retry: { maxCount: 3, canRetryOnError: true },
    timeout: { delay: 2000 },
  },
  propagateRetry: false,
  middlewares: [],

  onHandleError: async (error) => {
    // Custom logic: only propagate certain types of errors
    if (error.type === "SYSTEM_ERROR") {
      throw error; // Propagate system errors
    }
    // Handle application errors locally
    return getDefaultValue();
  },
});
```

### Performance Considerations

- **`propagateRetry: false`**: Better for independent operations, more predictable resource usage
- **`propagateRetry: true`**: Better for hierarchical error handling, but may lead to unexpected retry patterns
- **Mixed strategies**: Use different settings at different levels based on operation importance and error recovery strategies

### Common Pitfalls

1. **Unintended Retry Multiplication**: Setting `propagateRetry: false` at all levels when you need coordinated retry behavior
2. **Resource Exhaustion**: Using `propagateRetry: true` without considering the cumulative effect of retries across layers
3. **Lost Error Context**: Propagating retries without preserving original error information for debugging

Choose your propagation strategy based on whether you want localized, independent retry behavior (`false`) or coordinated, hierarchical retry behavior (`true`).

## API Reference

### Type Compatibility Requirements

#### Critical: Matching Result Types

**Essential Requirement**: When creating a loader with middlewares, both the loader and all middlewares **must** use the same `Result` generic type parameter. Mismatched types will cause TypeScript compilation errors and runtime issues.

**Correct Type Declaration:**

```typescript
// ✅ CORRECT: All components use the same Result type
type ApiResponse = { data: string; status: number };

const loggingMiddleware = middleware<ApiResponse>().withOptions({
  name: "logging",
  contextGenerator: () => ({ startTime: 0 }),
  complete: async (context, result) => {
    // result is correctly typed as ApiResponse
    console.log("API Response:", result.data, result.status);
  },
});

const { execute } = loader<ApiResponse>().withOptions({
  input: {
    retry: { maxCount: 3, canRetryOnError: true },
    timeout: { delay: 5000 },
  },
  propagateRetry: false,
  middlewares: [loggingMiddleware], // Type compatibility ensured
});

const result = await execute(async (): Promise<ApiResponse> => {
  return { data: "success", status: 200 };
});
```

**Incorrect Type Declaration (Will Cause Errors):**

```typescript
// ❌ INCORRECT: Mismatched Result types
type ApiResponse = { data: string; status: number };
type DifferentResponse = { message: string; code: number };

const loggingMiddleware = middleware<DifferentResponse>().withOptions({
  name: "logging",
  contextGenerator: () => ({ startTime: 0 }),
  complete: async (context, result) => {
    // result is typed as DifferentResponse, but loader expects ApiResponse
    console.log(result.message); // This will cause type errors
  },
});

const { execute } = loader<ApiResponse>().withOptions({
  input: {
    retry: { maxCount: 3, canRetryOnError: true },
    timeout: { delay: 5000 },
  },
  propagateRetry: false,
  middlewares: [loggingMiddleware], // ❌ TypeScript error: Type mismatch
});
```

#### Type Safety Enforcement

The TypeScript compiler will enforce type compatibility:

```typescript
// Compilation error example
interface UserData {
  id: number;
  name: string;
}
interface ProductData {
  id: string;
  title: string;
  price: number;
}

const userMiddleware = middleware<UserData>().withOptions({
  name: "user-logging",
  contextGenerator: () => ({}),
});

const { execute } = loader<ProductData>().withOptions({
  input: {
    retry: { maxCount: 1, canRetryOnError: false },
    timeout: { delay: 1000 },
  },
  propagateRetry: false,
  middlewares: [userMiddleware], // ❌ Compiler Error:
  // Type 'LoaderMiddleware<UserData, {}, "user-logging">' is not assignable to
  // type 'LoaderMiddleware<ProductData, any, any>'
});
```

#### Best Practices for Type Management

**1. Define Result Type Early:**

```typescript
// Define your Result type first
interface MyApiResult {
  success: boolean;
  data?: any;
  error?: string;
}

// Use consistently across all components
const middleware1 = middleware<MyApiResult>().withOptions({...});
const middleware2 = middleware<MyApiResult>().withOptions({...});
const { execute } = loader<MyApiResult>().withOptions({
  middlewares: [middleware1, middleware2]
});
```

**2. Use Generic Constraints for Flexible Types:**

```typescript
// Create reusable middleware for any type extending base interface
interface BaseResponse {
  status: number;
}

function createStatusMiddleware<T extends BaseResponse>() {
  return middleware<T>().withOptions({
    name: "status-logger",
    contextGenerator: () => ({}),
    complete: async (context, result) => {
      console.log("Status:", result.status); // Safe to access .status
    },
  });
}

// Use with specific types
type ApiResult = BaseResponse & { data: string };
const statusMiddleware = createStatusMiddleware<ApiResult>();
const { execute } = loader<ApiResult>().withOptions({
  middlewares: [statusMiddleware], // Types match perfectly
});
```

**3. Avoid Type Assertions:**

```typescript
// ❌ DON'T: Force type compatibility with assertions
const badMiddleware = middleware<any>().withOptions({
  complete: async (context, result) => {
    const typed = result as MySpecificType; // Unsafe, avoid this
  },
});

// ✅ DO: Use proper generic typing
const goodMiddleware = middleware<MySpecificType>().withOptions({
  complete: async (context, result) => {
    // result is already correctly typed as MySpecificType
    console.log(result.specificProperty);
  },
});
```

This type safety ensures that your middleware can safely access and validate the results produced by your target functions, preventing runtime type errors and improving code maintainability.

### loader\<Result\>()

Creates a loader factory that provides methods to create configured loader instances.

#### Methods

##### .withOptions(props)

Creates a loader instance with retry, timeout, and middleware capabilities.

**Parameters:**

```typescript
interface LoaderProps<Result> {
  // Core configuration
  input: LoaderCoreInput<Result>; // Retry, timeout, backoff settings

  // Error handling
  onDetermineError?: (errors: unknown[]) => Promise<unknown>;
  onHandleError?: (error: unknown) => Promise<Result>;

  // Options
  propagateRetry: boolean | "HAS_OUTER_CONTEXT" | "HAS_SAME_OUTER_CONTEXT"; // Whether to propagate RetrySignal
  middlewares: readonly LoaderMiddleware<Result, any, any>[];
}
```

**Input Configuration:**

```typescript
interface LoaderCoreInput<Result> {
  retry: {
    maxCount: number; // Maximum retry attempts
    canRetryOnError: boolean | ((error: unknown) => boolean);
    fallback?: TargetWrapper<Result>; // Fallback function
    onRetryEach?: () => void; // Called on each retry
    onRetryExceeded?: () => void; // Called when retries exceeded
  };
  timeout: {
    delay: number; // Timeout in milliseconds
    onTimeout?: () => void; // Called on timeout
  };
  backoff?: {
    strategy: Backoff; // Backoff strategy
    initialDelay: number; // Initial delay in milliseconds
  };
}
```

**Returns:**

```typescript
interface LoaderReturn<Result> {
  execute: (target: Target<Result>) => Promise<Result>; // Execute with target
  retryImmediately: (fallback?: TargetWrapper<Result>) => never; // Manual retry (target context only)
  retryFallback: <T>(matcher: {
    readonly when: (error: T) => boolean;
    readonly fallback: (error: T) => TargetWrapper<Result>;
  }) => void; // Register conditional fallback
  loaderOptions: () => LoaderCoreOptions<Result>; // Current state access
  middlewareOptions: () => MiddlewareOptions<Middlewares>; // Middleware contexts access
}
```

##### .withDefaultOptions()

Creates a loader instance with default configuration settings (no retries, no timeout limits, no middlewares).

**Example:**

```typescript
import { loader } from "@h1y/loader-core";

// Create with custom options
const {
  execute,
  retryImmediately,
  retryFallback,
  loaderOptions,
  middlewareOptions,
} = loader<MyResult>().withOptions({
  input: {
    retry: { maxCount: 3, canRetryOnError: true },
    timeout: { delay: 5000 },
  },
  propagateRetry: false,
  middlewares: [loggingMiddleware],
  onDetermineError: async (errors) => errors[0],
  onHandleError: async (error) => defaultResult,
});

// Or create with default options
const defaultLoader = loader<MyResult>().withDefaultOptions();

const result = await execute(myAsyncFunction);
```

**Important**: The `retryImmediately` function can only be called from within the `target` function context:

```typescript
const { execute, retryImmediately } = loader().withOptions({
  input: {
    retry: { maxCount: 3, canRetryOnError: true },
    timeout: { delay: 5000 },
  },
  propagateRetry: false,
  middlewares: [],
});

// Execute with target - retry can be called within target
const result = await execute(async () => {
  try {
    return await apiCall();
  } catch (error) {
    // ✅ Correct: retryImmediately within target context
    if (shouldRetry(error)) {
      retryImmediately();
    }
    throw error;
  }
});

// ❌ Incorrect: retryImmediately outside target context
// retryImmediately(); // This will not work as expected
```

##### retryImmediately(fallback?: TargetWrapper\<Result\>)

Manually triggers an immediate retry from within the target function context. This has the highest priority among all fallback strategies.

**⚠️ Context Requirement**: This function can **only** be called from within the `execute` callback function. Calling it outside the execution context will not work.

**Parameters:**

- `fallback` (optional): A fallback function to execute on the retry. If provided, this becomes the immediate fallback with highest priority.

**Example:**

```typescript
const { execute, retryImmediately } = loader().withOptions({
  input: {
    retry: { maxCount: 3, canRetryOnError: true },
    timeout: { delay: 5000 },
  },
  propagateRetry: false,
  middlewares: [],
});

const result = await execute(async () => {
  try {
    return await riskyApiCall();
  } catch (error) {
    if (error.code === "TEMPORARY_ERROR") {
      // Retry immediately with a fallback
      retryImmediately(() => async () => {
        console.log("Using fallback after temporary error");
        return await safeApiCall();
      });
    }
    throw error;
  }
});
```

##### retryFallback\<T\>(matcher)

Registers a conditional fallback that will be used when the specified error condition is met. This has medium priority in the fallback selection process.

**⚠️ Context Requirement**: This function can **only** be called from within the `execute` callback function. It cannot be called outside the execution context.

**⚠️ Re-execution Behavior**: Like React Hooks, `retryFallback` calls are **re-executed on every retry attempt**. The fallback matchers are cleared before each retry, so you must call `retryFallback` on every execution. Place these calls at the **top** of your execute callback.

**Parameters:**

- `matcher.when: (error: T) => boolean` - Predicate function to determine if this fallback applies
- `matcher.fallback: (error: T) => TargetWrapper<Result>` - Fallback factory function that receives the error

**Example:**

```typescript
const { execute, retryFallback } = loader().withOptions({
  input: {
    retry: { maxCount: 3, canRetryOnError: true },
    timeout: { delay: 5000 },
  },
  propagateRetry: false,
  middlewares: [],
});

const result = await execute(async () => {
  // ✅ CORRECT: Register fallbacks inside execute (like React Hooks)
  // These must be called on every execution/retry
  retryFallback({
    when: (error) => error.status === 503,
    fallback: (error) => () => async () => {
      console.log("Service unavailable, using cached data");
      return getCachedData();
    },
  });

  retryFallback({
    when: (error) => error.status >= 500,
    fallback: (error) => () => async () => {
      console.log("Server error, trying alternative endpoint");
      return await alternativeApiCall();
    },
  });

  // Actual operation after registering fallbacks
  return await apiCall();
});
```

### middleware\<Result\>()

Creates a middleware factory that provides methods to create configured middleware instances.

#### Methods

##### .withOptions(props)

Creates a middleware with lifecycle hooks for cross-cutting concerns.

**Parameters:**

```typescript
interface MiddlewareProps<Result, Context, Name extends string> {
  name: Name; // Unique middleware identifier
  contextGenerator: () => Context; // Initial context factory

  // Lifecycle hooks (all optional)
  before?: (context: Context) => Promise<void>;
  complete?: (context: Context, result: Result) => Promise<void>;
  failure?: (context: Context, error: unknown) => Promise<void>;
  cleanup?: (context: Context) => Promise<void>;
}
```

**Example:**

```typescript
import { middleware } from "@h1y/loader-core";

const loggingMiddleware = middleware<MyResult>().withOptions({
  name: "logging",
  contextGenerator: () => ({ startTime: 0 }),
  before: async (context) => {
    context.startTime = Date.now();
    console.log("Loader execution started.");
  },
  complete: async (context, result) => {
    const duration = Date.now() - context.startTime;
    console.log(`Loader execution finished in ${duration}ms. Result:`, result);
  },
  failure: async (context, error) => {
    console.error("Loader execution failed:", error);
  },
});
```

#### Execution Order

1. **before**: Called before target execution
2. **complete**: Called after successful target execution
3. **failure**: Called when target throws an error
4. **cleanup**: Always called last, regardless of success/failure

#### Context Isolation

Each middleware maintains completely isolated contexts:

```typescript
const cacheMiddleware = middleware().withOptions({
  name: "cache",
  contextGenerator: () => ({ cached: false, data: null }),
  // This context is isolated from other middlewares
});

const metricsMiddleware = middleware().withOptions({
  name: "metrics",
  contextGenerator: () => ({ startTime: 0, duration: 0 }),
  // This context is completely separate
});
```

### Backoff Strategies

```typescript
import {
  FIXED_BACKOFF,
  LINEAR_BACKOFF,
  EXPONENTIAL_BACKOFF,
} from "@h1y/loader-core";

// Fixed delay
const fixed = FIXED_BACKOFF; // Always same delay

// Linear increase
const linear = LINEAR_BACKOFF(100); // delay + 100ms each time

// Exponential growth
const exponential = EXPONENTIAL_BACKOFF(2); // delay * 2 each time
```

## API Documentation

### Loader State Access

Access loader state within target execution using `loaderOptions()`:

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

  // Monitor state
  console.log(`Retries: ${options.retry.count}/${options.retry.maxCount}`);
  console.log(`Elapsed: ${options.timeout.elapsedTime}ms`);

  // Control behavior
  options.retry.resetRetryCount();
  options.timeout.resetTimeout();
  options.retry.useFallbackOnNextRetry(async () => getDefaultData());

  return await performOperation();
});
```

## Usage Examples

### Basic Retry with Timeout

```typescript
const { execute } = loader().withOptions({
  input: {
    retry: { maxCount: 3, canRetryOnError: true },
    timeout: { delay: 5000 },
  },
  propagateRetry: false,
  middlewares: [],
});

const result = await execute(async () => {
  const response = await fetch("/api/data");
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
});
```

#### Important: canRetryOnError Scope Limitations

**Critical Distinction**: The `canRetryOnError` option **only** evaluates errors thrown from the **target function**. It does **not** apply to errors thrown from middleware advice functions (`before`, `complete`, `failure`, `cleanup`).

**What `canRetryOnError` evaluates:**

- ✅ Errors thrown directly by your target function
- ✅ Errors propagated through your target function from nested calls
- ❌ **NOT** errors thrown in middleware's `before` advice
- ❌ **NOT** errors thrown in middleware's `complete` advice
- ❌ **NOT** errors thrown in middleware's `failure` advice
- ❌ **NOT** errors thrown in middleware's `cleanup` advice

**Internal Implementation Logic:**

```typescript
// Simplified logic from createRetryAspect
afterThrowing: createAdvice({
  use: ["__core__retry"],
  async advice({ __core__retry: retry }, error) {
    // Signals that are not RetrySignals are excluded from retries
    if (Signal.isSignal(error) && !(error instanceof RetrySignal)) {
      return; // Skip retry evaluation for other signals
    }

    // ONLY non-signal errors (i.e., regular errors from target) are evaluated
    if (!Signal.isSignal(error)) {
      const { canRetryOnError } = retry;

      const isRetryable =
        canRetryOnError === true ||
        (typeof canRetryOnError === "function" && canRetryOnError(error));

      if (!isRetryable) {
        return; // Don't retry if condition not met
      }
    }

    // Proceed with retry logic...
    if (retry.maxCount < retry.count + 1) {
      retry.onRetryExceeded?.();
      throw new RetryExceededSignal({ maxRetry: retry.maxCount });
    }

    retry.count += 1;
    throw new RetrySignal();
  },
});
```

**Example: Middleware Errors Are Not Retried**

```typescript
const validationMiddleware = middleware().withOptions({
  name: "validation",
  contextGenerator: () => ({}),
  before: async () => {
    // This error will NOT be subject to canRetryOnError evaluation
    if (Math.random() > 0.5) {
      throw new Error("Validation failed in middleware");
    }
  },
});

const { execute } = loader().withOptions({
  input: {
    retry: {
      maxCount: 3,
      canRetryOnError: (error) => {
        console.log("Evaluating error for retry:", error.message);
        return true; // This function will NEVER be called for middleware errors
      },
    },
    timeout: { delay: 5000 },
  },
  propagateRetry: false,
  middlewares: [validationMiddleware],
});

await execute(async () => {
  // This error WILL be subject to canRetryOnError evaluation
  throw new Error("Target function error");
});

// If middleware throws: No retry evaluation, immediate failure
// If target throws: canRetryOnError function gets called
```

This design ensures that retry logic only applies to business logic errors from your target function, while middleware errors (which typically indicate system or configuration issues) fail immediately without retry attempts.

### Middleware Composition

```typescript
const loggingMiddleware = middleware().withOptions({
  name: "logging",
  contextGenerator: () => ({ startTime: Date.now() }),
  complete: async (context, result) => {
    const duration = Date.now() - context.startTime;
    console.log(`Operation completed in ${duration}ms`);
  },
});

const { execute } = loader().withOptions({
  input: {
    retry: { maxCount: 3, canRetryOnError: true },
    timeout: { delay: 5000 },
  },
  propagateRetry: false,
  middlewares: [loggingMiddleware],
});

const result = await execute(async () => fetchData());
```

### Accessing Loader State

```typescript
const { execute, loaderOptions } = loader().withOptions({
  input: {
    retry: { maxCount: 3, canRetryOnError: true },
    timeout: { delay: 5000 },
  },
  propagateRetry: false,
  middlewares: [],
});

const result = await execute(async () => {
  // Access loader state within target context
  const options = loaderOptions();
  console.log(`Retry count: ${options.retry.count}/${options.retry.maxCount}`);
  console.log(`Elapsed time: ${options.timeout.elapsedTime}ms`);

  // Reset retry count programmatically
  if (options.retry.count > 2) {
    options.retry.resetRetryCount();
  }

  // Set fallback for next retry
  options.retry.useFallbackOnNextRetry(async () => getDefaultData());

  return await performOperation();
});
```

### Error Handling with Fallbacks

```typescript
import { loader, TimeoutSignal } from "@h1y/loader-core";

const { execute } = loader().withOptions({
  input: {
    retry: { maxCount: 2, canRetryOnError: false },
    timeout: { delay: 500 },
  },
  propagateRetry: false,
  middlewares: [],

  onHandleError: async (error) => {
    if (error instanceof TimeoutSignal) {
      return { data: "fallback-data" };
    }
    throw error;
  },
});

const result = await execute(async () => {
  await new Promise((resolve) => setTimeout(resolve, 1000));
  return { data: "real-data" };
});
```

## Advanced Patterns

### Nested Loader Execution

```typescript
const { execute: childExecute } = loader().withOptions({
  input: {
    retry: { maxCount: 2, canRetryOnError: true },
    timeout: { delay: 1000 },
  },
  propagateRetry: false,
  middlewares: [],
});

const { execute: parentExecute } = loader().withOptions({
  input: {
    retry: { maxCount: 1, canRetryOnError: true },
    timeout: { delay: 10000 },
  },
  propagateRetry: false,
  middlewares: [],
});

const results = await parentExecute(async () => {
  const ids = await fetchIds();
  return Promise.all(ids.map((id) => childExecute(() => fetchDataById(id))));
});
```

### Multi-Service API Integration with Conditional Fallbacks

```typescript
// Different error handling strategies for different services
const { execute: userServiceLoader, retryFallback: userFallback } =
  loader().withOptions({
    input: {
      retry: { maxCount: 3, canRetryOnError: (error) => error.status >= 500 },
      timeout: { delay: 5000 },
    },
    propagateRetry: false,
    middlewares: [],
  });

const { execute: paymentServiceLoader, retryFallback: paymentFallback } =
  loader().withOptions({
    input: {
      retry: { maxCount: 5, canRetryOnError: true },
      timeout: { delay: 2000 },
    },
    propagateRetry: false,
    middlewares: [],
  });

// Orchestrate multiple services with different error handling
async function processUserCheckout(userId: string, paymentInfo: any) {
  const [userData, paymentResult] = await Promise.allSettled([
    userServiceLoader(() => {
      // ✅ CORRECT: Configure service-specific fallback strategies inside execute
      userFallback({
        when: (error) => error.status === 503,
        fallback: () => () => async () => {
          console.log("User service degraded, using cached profile");
          return await getCachedUserProfile();
        },
      });

      return fetchUser(userId);
    }),

    paymentServiceLoader(() => {
      // ✅ CORRECT: Configure service-specific fallback strategies inside execute
      paymentFallback({
        when: (error) => error.message.includes("RATE_LIMIT"),
        fallback: () => () => async () => {
          console.log("Payment service rate limited, queuing for later");
          return await queuePaymentForLater();
        },
      });

      return processPayment(paymentInfo);
    }),
  ]);

  return {
    user: userData.status === "fulfilled" ? userData.value : null,
    payment: paymentResult.status === "fulfilled" ? paymentResult.value : null,
  };
}
```

### Circuit Breaker Pattern with Dynamic Fallbacks

```typescript
class ServiceHealthMonitor {
  private failureCount = 0;
  private lastFailure = 0;
  private readonly threshold = 5;
  private readonly cooldownMs = 30000;

  isHealthy(): boolean {
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

const healthMonitor = new ServiceHealthMonitor();
const { execute, retryImmediately, retryFallback } = loader().withOptions({
  input: {
    retry: { maxCount: 3, canRetryOnError: true },
    timeout: { delay: 5000 },
  },
  propagateRetry: false,
  middlewares: [],
});

const result = await execute(async () => {
  // ✅ CORRECT: Configure circuit breaker fallback inside execute
  retryFallback({
    when: (error) => !healthMonitor.isHealthy(),
    fallback: () => () => async () => {
      console.log("Circuit breaker open, using fallback service");
      return await fallbackServiceCall();
    },
  });

  try {
    if (!healthMonitor.isHealthy()) {
      // Circuit breaker is open, trigger fallback immediately
      retryImmediately(() => async () => {
        return await fallbackServiceCall();
      });
    }

    const result = await primaryServiceCall();
    healthMonitor.recordSuccess();
    return result;
  } catch (error) {
    healthMonitor.recordFailure();
    throw error;
  }
});
```

### Database Connection with Cache Fallback

```typescript
const { execute: dbLoader, retryFallback: dbFallback } = loader().withOptions({
  input: {
    retry: {
      maxCount: 2,
      canRetryOnError: (error) => error.code !== "PERMISSION_DENIED",
    },
    timeout: { delay: 3000 },
    backoff: { strategy: EXPONENTIAL_BACKOFF(2), initialDelay: 500 },
  },
  propagateRetry: false,
  middlewares: [],
});

async function getUserData(userId: string) {
  return dbLoader(async () => {
    // ✅ CORRECT: Configure fallback strategies inside execute
    dbFallback({
      when: (error) => error.code === "CONNECTION_TIMEOUT",
      fallback: () => () => async () => {
        console.log("Database timeout, using read replica");
        return await queryReadReplica();
      },
    });

    dbFallback({
      when: (error) => error.code === "MAX_CONNECTIONS",
      fallback: () => () => async () => {
        console.log("Database overloaded, using cache");
        return await getCachedData();
      },
    });

    try {
      // Try primary database
      const result = await db.query("SELECT * FROM users WHERE id = ?", [
        userId,
      ]);

      if (!result.length) {
        // No data found, but connection is healthy
        throw new Error("USER_NOT_FOUND");
      }

      return result[0];
    } catch (error) {
      // Log for monitoring
      console.error("Database query failed:", error);
      throw error;
    }
  });
}
```

### Real-Time Data Processing with Graceful Degradation

```typescript
const {
  execute: realtimeLoader,
  retryImmediately,
  retryFallback,
} = loader().withOptions({
  input: {
    retry: { maxCount: 2, canRetryOnError: true },
    timeout: { delay: 1000 }, // Short timeout for real-time
  },
  propagateRetry: false,
  middlewares: [],
});

async function getRealtimeData(dataId: string) {
  return realtimeLoader(async () => {
    // ✅ CORRECT: Configure degradation strategies inside execute
    retryFallback({
      when: (error) => error.type === "WEBSOCKET_DISCONNECTED",
      fallback: () => () => async () => {
        console.log("WebSocket down, polling REST API");
        return await pollRestApi();
      },
    });

    retryFallback({
      when: (error) => error.type === "RATE_LIMITED",
      fallback: () => () => async () => {
        console.log("Rate limited, using cached data");
        return await getLastKnownData();
      },
    });

    // Check system load first
    const systemLoad = await getSystemLoad();

    if (systemLoad > 0.8) {
      // System overloaded, use cached data immediately
      retryImmediately(() => async () => {
        console.log("System overloaded, serving cached data");
        return await getCachedRealtimeData(dataId);
      });
    }

    // Try real-time data source
    return await fetchRealtimeData(dataId);
  });
}
```

These patterns demonstrate how the advanced retry and fallback features can be used to build resilient systems that gracefully handle various failure scenarios while maintaining optimal performance and user experience.

## Related Packages

- [@h1y/promise-aop](https://github.com/h1ylabs/next-loader/tree/main/packages/promise-aop) - The underlying Promise AOP library
- [@h1y/next-loader](https://github.com/h1ylabs/next-loader) - Next.js-specific loader implementation

## License

MIT
