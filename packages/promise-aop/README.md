# Promise-AOP

A TypeScript-first AOP (Aspect-Oriented Programming) framework for asynchronous JavaScript. It provides type-safe shared context with section locking, flexible wrapper composition via around advice, configurable error handling (halt/continue with aggregation), and dependency-based execution ordering.

[한국어 문서 (Korean Documentation)](./docs/README-ko.md)

---

## 🚀 TL;DR — Quick Start

```typescript
import { createAspect, createProcess, runProcess } from "@h1y/promise-aop";

// Minimal logging aspect
const Logging = createAspect<string, { log: Console }>((createAdvice) => ({
  name: "logging",
  before: createAdvice({
    use: ["log"],
    advice: async ({ log }) => log.info("start"),
  }),
  after: createAdvice({
    use: ["log"],
    advice: async ({ log }) => log.info("done"),
  }),
}));

const process = createProcess<string, { log: Console }>({ aspects: [Logging] });
const result = await runProcess({
  process,
  context: () => ({ log: console }),
  target: async () => "Hello AOP!",
});
```

When the chain halts, the result can be `TARGET_FALLBACK`:

```ts
import { TARGET_FALLBACK } from "@h1y/promise-aop";
const output = await runProcess({ process, context, target });
if (output === TARGET_FALLBACK) {
  // handle fallback path
}
```

---

## 📦 Installation

```bash
# npm
npm install @h1y/promise-aop

# yarn
yarn add @h1y/promise-aop

# pnpm
pnpm add @h1y/promise-aop
```

---

## 💡 Why Promise-AOP?

- Cross‑cutting concerns without tangling core logic: logging, metrics, auth, caching
- Safe parallelism with section‑level locking on shared context
- Predictable error handling: halt/continue policies with aggregation
- Dependency‑driven ordering via `dependsOn`
- Zero runtime dependencies, full TypeScript support

---

## 🧠 Core Concepts

### Advice types

| Type             | When it runs       | Parameters                                      | Typical use case                                     |
| ---------------- | ------------------ | ----------------------------------------------- | ---------------------------------------------------- |
| `before`         | Before target      | `(context)`                                     | Validation, setup, auth                              |
| `around`         | Wraps the target   | `(context, { attachToResult, attachToTarget })` | Caching, retry, timing; flexible wrapper composition |
| `afterReturning` | After success      | `(context)`                                     | Success logging/cleanup                              |
| `afterThrowing`  | After an exception | `(context, error)`                              | Error logging/notification                           |
| `after`          | Always last        | `(context)`                                     | Cleanup, metrics                                     |

### Aspects, process, and context

- An `Aspect<Result, Context>` groups advice under a name.
- A `Process<Result, Context>` composes aspects into an executable chain.
- The shared `Context` is immutable at the top level and split into named sections.
- Each advice declares what it can access via `use: ["section", ...]`. Accessing undeclared sections throws.

Minimal context example:

```ts
type Ctx = {
  db: { query: (sql: string) => Promise<unknown> };
  logger: Console;
};

const DbLogging = createAspect<unknown, Ctx>((createAdvice) => ({
  name: "db-logging",
  before: createAdvice({
    use: ["db", "logger"],
    advice: async ({ db, logger }) => {
      const rows = await db.query("SELECT 1");
      logger.info("rows:", rows);
    },
  }),
}));
```

### Execution order and dependencies

- Use `dependsOn: ["AspectName", ...]` to enforce ordering among advice of the same phase.
- The dependency graph is topologically sorted; cycles are detected and reported.

### Error handling and fallback

- Per‑advice runtime policy: `halt` or `continue` via `buildOptions.advice[advice].error.runtime.afterThrow`.
- When the target throws, `afterThrowing` runs and the chain halts. The final result is decided by `resolveHaltRejection` (commonly returns `TARGET_FALLBACK`).
- Non‑critical errors under `continue` are aggregated and passed to `resolveContinuousRejection`.

---

## ⚙️ Configuration & Defaults

| Advice           | execution    | error.aggregation | error.runtime.afterThrow |
| ---------------- | ------------ | ----------------- | ------------------------ |
| `before`         | `parallel`   | `unit`            | `halt`                   |
| `around`         | `sequential` | `unit`            | `halt`                   |
| `after`          | `parallel`   | `all`             | `continue`               |
| `afterReturning` | `parallel`   | `all`             | `continue`               |
| `afterThrowing`  | `parallel`   | `all`             | `continue`               |

Override per advice via `buildOptions.advice[advice]`. Configure final resolution via `processOptions`:

```ts
const process = createProcess({
  aspects,
  buildOptions: {
    advice: {
      before: {
        execution: "sequential",
        error: { aggregation: "unit", runtime: { afterThrow: "halt" } },
      },
      after: {
        execution: "parallel",
        error: { aggregation: "all", runtime: { afterThrow: "continue" } },
      },
    },
  },
  processOptions: {
    resolveHaltRejection: async (haltError) => ({ fallback: true }),
    resolveContinuousRejection: (errors) =>
      console.warn("Non‑critical:", errors),
  },
});
```

---

## 🧩 Common patterns

### Caching with flexible wrapper composition

```ts
type Data = { value: string };
type Ctx = {
  cache: {
    get: (k: string) => Promise<Data | null>;
    set: (k: string, v: Data) => Promise<void>;
  };
};

const key = "some-key";

const Cache = createAspect<Data, Ctx>((createAdvice) => ({
  name: "cache",
  around: createAdvice({
    use: ["cache"],
    advice: async ({ cache }, { attachToTarget }) => {
      // attachToTarget: Applied directly to the original target function
      attachToTarget((target) => async () => {
        const cached = await cache.get(key);
        if (cached) return cached;
        const out = await target();
        await cache.set(key, out);
        return out;
      });
    },
  }),
}));
```

### Authentication

```ts
const Auth = createAspect<
  ApiResponse,
  {
    user: { isAuthenticated: () => boolean };
    permissions: { canAccess: (r: unknown) => boolean };
    resource: unknown;
  }
>((createAdvice) => ({
  name: "auth",
  before: createAdvice({
    use: ["user", "permissions", "resource"],
    advice: async ({ user, permissions, resource }) => {
      if (!user.isAuthenticated()) throw new Error("Unauthorized");
      if (!permissions.canAccess(resource)) throw new Error("Forbidden");
    },
  }),
}));
```

### Metrics

```ts
const Metrics = createAspect<
  any,
  {
    metrics: { startTimer: (k: string) => void; endTimer: (k: string) => void };
  }
>((createAdvice) => ({
  name: "metrics",
  before: createAdvice({
    use: ["metrics"],
    advice: async ({ metrics }) => metrics.startTimer("op"),
  }),
  after: createAdvice({
    use: ["metrics"],
    advice: async ({ metrics }) => metrics.endTimer("op"),
  }),
}));
```

### Dependency ordering

```ts
const A = createAspect<string, { log: Console }>((createAdvice) => ({
  name: "A",
  before: createAdvice({
    use: ["log"],
    advice: async ({ log }) => log.info("A.before"),
  }),
}));

const B = createAspect<string, { log: Console }>((createAdvice) => ({
  name: "B",
  before: createAdvice({
    use: ["log"],
    dependsOn: ["A"],
    advice: async ({ log }) => log.info("B.before"),
  }),
}));
```

### Advanced Around Advice: Flexible Wrapper Composition

The v2 around advice provides two distinct attachment points for maximum flexibility:

```ts
const AdvancedAround = createAspect<number, { log: Console }>(
  (createAdvice) => ({
    name: "advanced-around",
    around: createAdvice({
      use: ["log"],
      advice: async ({ log }, { attachToResult, attachToTarget }) => {
        // attachToTarget: Applied to the original target function
        // Executes innermost, closest to the actual target
        attachToTarget((target) => async () => {
          log.info("target-wrapper: before");
          const result = await target();
          log.info("target-wrapper: after");
          return result + 10;
        });

        // attachToResult: Applied to the final composed result
        // Executes outermost, wrapping the entire chain
        attachToResult((target) => async () => {
          log.info("result-wrapper: before");
          const result = await target();
          log.info("result-wrapper: after");
          return result * 2;
        });
      },
    }),
  }),
);

// Execution order for target value 5:
// result-wrapper: before
// target-wrapper: before
// [original target executes: 5]
// target-wrapper: after  → 5 + 10 = 15
// result-wrapper: after  → 15 * 2 = 30
```

#### Key differences

- **`attachToTarget`**: Wraps the original target function directly. Multiple target wrappers compose in reverse order (last attached executes outermost among target wrappers).
- **`attachToResult`**: Wraps the entire execution chain after all target wrappers are applied. Result wrappers also compose in reverse order.
- **Execution order**: `resultWrapper(nextChain(targetWrapper(target)))`

This design enables sophisticated scenarios like:

- Caching at the target level while adding metrics at the result level
- Input validation/transformation via target wrappers, output formatting via result wrappers
- Multiple layers of error handling and retry logic

---

## 📚 API Reference

### Core functions

| Function                                 | Description                                           | Returns                                     |
| ---------------------------------------- | ----------------------------------------------------- | ------------------------------------------- |
| `createAspect<Result, Context>(helper)`  | Create an Aspect that declares cross‑cutting concerns | `Aspect<Result, Context>`                   |
| `createProcess<Result, Context>(config)` | Compose aspects into an executable advice chain       | `Process<Result, Context>`                  |
| `runProcess<Result, Context>(props)`     | Execute a process with context and target             | `Promise<Result \| typeof TARGET_FALLBACK>` |

### Type details (used by core functions)

- Result: The return type of your target function
- Context / SharedContext: The immutable shared context available across advice
- `Aspect<Result, Context>`: Named aspect with optional advice entries (`before`, `around`, `afterReturning`, `afterThrowing`, `after`)
- `AdviceMetadata<Result, Context, AdviceType, Sections>`:
  - `use`: Declared context sections allowed for this advice
  - `dependsOn`: Names to enforce execution ordering
  - `advice`: The advice function typed with `Restricted<Context, Sections>`
- `AdviceFunction`, `AdviceFunctionWithContext`: Strongly‑typed advice signatures per advice type
- `Target<Result>`: `() => Promise<Result>` — the function being advised
- `TargetWrapper<Result>`: `(target: Target<Result>) => Target<Result>` — used by `around`
- `Process<Result, Context>`: `(context: () => Context, exit: <T>(callback: () => T) => T, target: Target<Result>) => Promise<Result | typeof TARGET_FALLBACK>`
- `BuildOptions` (per‑advice): `execution` strategy and `error` policy (`ExecutionStrategy`, `AggregationUnit`, `ErrorAfter`)
- `ProcessOptions<Result>`: `{ resolveHaltRejection, resolveContinuousRejection }`
- `AsyncContext<Context>` and `Restricted<Context, Sections>`: Utilities to provide a fresh immutable context and restrict access per advice

---

## 🔬 Advanced topics

### Section locking and conflicts

- The same section cannot be used concurrently within the same parallel level.
- Resolve conflicts by setting `dependsOn` or `execution: 'sequential'` for that advice phase.

Conflict example:

```ts
const process = createProcess<
  number,
  { db: { query: (s: string) => Promise<unknown> } }
>({
  aspects: [A, B],
  buildOptions: { advice: { before: { execution: "sequential" } } },
});
```

### Around wrapper composition order

- **Target wrappers** (via `attachToTarget`): Last attached executes outermost among target wrappers
- **Result wrappers** (via `attachToResult`): Last attached executes outermost among result wrappers
- **Overall order**: `resultWrapper(nextChain(targetWrapper(target)))`

### AsyncContext integration

Promise-AOP v2 provides seamless AsyncContext integration for better context management:

```ts
import { AsyncContext, createProcess, runProcess } from "@h1y/promise-aop";

// Method 1: Direct AsyncContext usage with runProcess
const asyncContext = AsyncContext.create(() => ({
  logger: console,
  database: myDb,
}));

const result = await runProcess({
  process: myProcess,
  context: asyncContext, // Pass AsyncContext directly
  target: async () => "Hello World",
});

// Method 2: Manual AsyncContext execution (for advanced scenarios)
const process = createProcess({
  aspects: [
    /* ... */
  ],
});
const out = await AsyncContext.execute(asyncContext, (getCtx, exit) =>
  process(getCtx, exit, async () => 42),
);
```

#### Key benefits of AsyncContext

- **Automatic context propagation**: Context flows through all async operations
- **Type safety**: Full TypeScript support with context inference
- **Memory efficiency**: Context is scoped to the execution chain
- **Isolation**: Each execution maintains its own context instance

### Error precedence and early exit

- If `afterThrowing` throws with `halt`, its error takes precedence over the target error.
- `HaltError` is internal‑only; do not throw it yourself. Use `around` for fast‑path exits.
- Fallbacks are represented by the `TARGET_FALLBACK` symbol.

---

## 🔧 Development

```bash
yarn install
yarn test
yarn build
yarn check-types
yarn lint
```

## 🧱 Compatibility

- Node.js 16+ recommended (uses AsyncLocalStorage)
- ESM/CJS support (via export maps)
- Type definitions included (TypeScript)

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

MIT © [h1ylabs](https://github.com/h1ylabs)
