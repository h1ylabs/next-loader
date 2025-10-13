# @h1ylabs/loader-core

**최신 버전: v0.6.0**

Promise AOP 기반의 탄력적인 비동기 작업 라이브러리로 내장된 retry, timeout, backoff 전략을 제공합니다. [@h1ylabs/promise-aop](https://github.com/h1ylabs/next-loader/tree/main/packages/promise-aop) 위에 구축되어 프로덕션 수준의 오류 복구 및 middleware 지원을 제공합니다.

## 설치

```bash
# npm
npm install @h1ylabs/loader-core

# yarn
yarn add @h1ylabs/loader-core

# pnpm
pnpm add @h1ylabs/loader-core
```

## 문서

- [English Documentation](../README.md)

## 핵심 아키텍처

### Promise AOP 기반

loader-core는 Promise AOP 라이브러리 위에 구축되어 세 가지 핵심 aspect를 활용합니다:

1. **Backoff Aspect**: 재시도 간 지연 전략 관리
2. **Retry Aspect**: 재시도 로직 및 fallback 선택 처리
3. **Timeout Aspect**: 작업에 시간 제한 강제

이 aspect들은 `Retry → Timeout → Backoff` 의존성 체인으로 구성되어 적절한 실행 순서와 일관된 동작을 보장합니다.

### Signal 기반 제어 흐름

라이브러리는 정밀한 오류 처리를 위해 우선순위 기반 signal 시스템을 사용합니다:

```typescript
// Signal 우선순위 (높은 값 = 높은 우선순위)
MIDDLEWARE_INVALID_SIGNAL_PRIORITY = 0b1000_0000_0000_0000; // 32768
TIMEOUT_SIGNAL_PRIORITY = 0b0100_0000_0000_0000; // 16384
RETRY_EXCEEDED_SIGNAL_PRIORITY = 0b0010_0000_0000_0000; // 8192
RETRY_SIGNAL_PRIORITY = 0b0001_0000_0000_0000; // 4096
ERROR_PRIORITY = 0b0000_0000_0000_0000; // 0
```

Signal을 통해 가능한 기능:

- **결정적 오류 처리**: 높은 우선순위 signal이 항상 우선
- **내부 제어 흐름**: Retry 및 timeout 메커니즘이 signal을 통해 통신
- **사용자 수준 확장성**: Application 오류는 커스텀 콜백을 통해 처리 가능

### Context 격리

각 loader 실행은 격리된 context를 유지합니다:

- **Loader Context**: `{ __core__retry, __core__timeout, __core__backoff }`
- **Middleware Context**: 각 middleware가 자체 격리된 context 보유
- **Metadata Context**: 전파 전략을 위한 loader 계층 추적

## 빠른 시작

```typescript
import { loader, EXPONENTIAL_BACKOFF } from "@h1ylabs/loader-core";

// 설정이 포함된 재사용 가능한 loader 생성
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

// target과 함께 실행 - loader는 재사용 가능
const data = await execute(async () => {
  // ⚠️ retryFallback은 execute 내부에서 호출해야 함 (React Hooks 패턴)
  retryFallback({
    when: (error) => error.status === 503,
    fallback: () => () => async () => getCachedData(),
  });

  const response = await fetch("/api/data");
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
});
```

## API 레퍼런스

### loader\<Result\>()

설정된 loader instance를 구축하기 위한 loader factory를 생성합니다.

#### .withOptions(props)

Retry, timeout, middleware 기능을 갖춘 loader instance를 생성합니다.

**타입 시그니처:**

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
  | boolean // 항상 전파 (true) 또는 안함 (false)
  | "HAS_OUTER_CONTEXT" // 외부 loader가 존재하면 전파
  | "HAS_SAME_OUTER_CONTEXT"; // 동일한 loader instance에게만 전파
```

**반환값:**

- `execute(target)`: Retry/timeout/middleware 보호와 함께 target 실행
- `loaderOptions()`: 현재 loader 상태 접근 (retry 횟수, 경과 시간 등)
- `middlewareOptions()`: 이름으로 middleware context 접근
- `retryImmediately(fallback?)`: 즉시 재시도 트리거 (1순위 fallback)
- `retryFallback(matcher)`: 조건부 fallback 등록 (2순위)

**Context 요구사항:**

⚠️ `retryImmediately`와 `retryFallback`은 **`execute` 콜백 내에서만** 호출 가능합니다. 내부 `AsyncContext`에 의존하며 실행 범위 밖에서 호출하면 예외가 발생합니다.

**예시:**

```typescript
const { execute, retryImmediately, retryFallback } = loader().withOptions({
  input: {
    retry: { maxCount: 3, canRetryOnError: true },
    timeout: { delay: 5000 },
  },
  propagateRetry: false,
  middlewares: [],
});

// ❌ 잘못됨: execute context 외부
retryFallback({ when: (e) => true, fallback: () => () => async () => "fail" });

// ✅ 올바름: execute 콜백 내부
await execute(async () => {
  retryFallback({ when: (e) => true, fallback: () => () => async () => "ok" });

  return await apiCall();
});
```

#### .withDefaultOptions()

기본 설정으로 loader 생성: retry 없음, 무한 timeout, middleware 없음.

```typescript
function withDefaultOptions(): LoaderReturn<Result>;
```

다음과 동일:

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

Lifecycle hook을 가진 middleware instance를 구축하기 위한 middleware factory를 생성합니다.

#### .withOptions(props)

Before/complete/failure/cleanup hook을 가진 middleware를 생성합니다.

**타입 시그니처:**

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

**Lifecycle 실행 순서:**

1. `before`: Target 실행 전
2. Target 실행
3. `complete`: 성공적으로 완료 시 (또는)
4. `failure`: 오류/signal 발생 시
5. `cleanup`: 항상 마지막에 실행

**예시:**

```typescript
const loggingMiddleware = middleware<ApiResponse>().withOptions({
  name: "logging",
  contextGenerator: () => ({ startTime: 0, duration: 0 }),
  before: async (context) => {
    context.startTime = Date.now();
  },
  complete: async (context, result) => {
    context.duration = Date.now() - context.startTime;
    console.log(`성공 (${context.duration}ms):`, result);
  },
  failure: async (context, error) => {
    console.error(`실패 (${Date.now() - context.startTime}ms):`, error);
  },
  cleanup: async (context) => {
    // 성공/실패 여부와 관계없이 항상 호출
    console.log(`정리 (${Date.now() - context.startTime}ms)`);
  },
});
```

### Signal

#### RetrySignal

재시도 시도가 필요함을 나타냅니다.

```typescript
class RetrySignal extends Signal {
  readonly errorReason: unknown;
  readonly propagated: boolean;
  readonly priority: 4096;
}
```

#### TimeoutSignal

작업 timeout을 나타냅니다.

```typescript
class TimeoutSignal extends Signal {
  readonly delay: number;
  readonly priority: 16384;
}
```

#### RetryExceededSignal

모든 재시도 시도가 소진되었음을 나타냅니다.

```typescript
class RetryExceededSignal extends Signal {
  readonly maxRetry: number;
  readonly priority: 8192;
}
```

#### MiddlewareInvalidContextSignal

Middleware context 손상을 나타냅니다.

```typescript
class MiddlewareInvalidContextSignal extends Signal {
  readonly middlewareName: string;
  readonly priority: 32768;
}
```

### Backoff 전략

```typescript
import {
  createBackoff,
  FIXED_BACKOFF,
  LINEAR_BACKOFF,
  EXPONENTIAL_BACKOFF,
} from "@h1ylabs/loader-core";

// 고정 지연: 항상 동일한 지연
const fixed = FIXED_BACKOFF;
fixed.next(100); // → 100
fixed.next(100); // → 100

// 선형 증가: delay + add
const linear = LINEAR_BACKOFF(50);
linear.next(100); // → 150
linear.next(150); // → 200

// 지수 증가: delay * factor
const exponential = EXPONENTIAL_BACKOFF(2);
exponential.next(100); // → 200
exponential.next(200); // → 400

// 커스텀 전략
const custom = createBackoff("custom", (delay) => Math.min(delay * 1.5, 10000));
```

**Backoff 타입:**

```typescript
interface Backoff<T extends string = string> {
  type: T;
  next: (delay: number) => number;
}
```

## 고급 기능

### Fallback 우선순위 시스템

3단계 fallback 선택이 재시도 동작을 결정합니다:

**우선순위 순서:**

1. **즉시 Fallback** (최고): 런타임에 `retryImmediately(fallback)`로 설정
2. **조건부 Fallback**: 실행 중 `retryFallback(matcher)`로 등록
3. **초기 Fallback** (최저): 생성 시 `input.retry.fallback`에 구성

**내부 선택 로직:**

```typescript
// createRetryAspect.ts before advice에서
retry.fallback.target =
  retry.fallback.immediate ?? // 1순위: retryImmediately() fallback
  retry.fallback.conditional ?? // 2순위: retryFallback() 매치된 fallback
  retry.fallback.initial; // 3순위: loader 설정 fallback
```

**예시:**

```typescript
const { execute, retryImmediately, retryFallback } = loader().withOptions({
  input: {
    retry: {
      maxCount: 3,
      canRetryOnError: true,
      fallback: () => async () => "default-fallback", // 3순위
    },
    timeout: { delay: 5000 },
  },
  propagateRetry: false,
  middlewares: [],
});

await execute(async () => {
  // 2순위: 조건부 fallback
  retryFallback({
    when: (error) => error.status === 503,
    fallback: () => () => async () => getReadReplica(),
  });

  // 1순위: 중요 오류에 대한 즉시 fallback
  retryFallback({
    when: (error) => error.code === "CRITICAL",
    fallback: () => () => async () => getBackupData(),
  });

  return await primaryApiCall();
});
```

### Retry 전파 전략

중첩된 loader 실행에서 `RetrySignal` 처리 방법을 제어합니다.

#### `propagateRetry: false` (기본값)

모든 retry signal을 로컬에서 처리하며 전파하지 않습니다.

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

// 자식이 최대 2번까지 독립적으로 재시도
await parent.execute(async () => {
  return await child.execute(async () => {
    throw new Error("자식 수준에서만 재시도");
  });
});
```

#### `propagateRetry: true`

모든 retry signal을 로컬 처리 없이 부모로 전파합니다.

```typescript
const child = loader().withOptions({
  input: {
    retry: { maxCount: 2, canRetryOnError: true },
    timeout: { delay: 1000 },
  },
  propagateRetry: true, // 모든 signal을 상위로 전파
  middlewares: [],
});

const parent = loader().withOptions({
  input: {
    retry: { maxCount: 3, canRetryOnError: true },
    timeout: { delay: 5000 },
  },
  propagateRetry: false, // 전파된 signal 처리
  middlewares: [],
});

// 자식 오류가 부모 수준에서 재시도 트리거 (최대 3번)
await parent.execute(async () => {
  return await child.execute(async () => {
    throw new Error("부모 수준에서 재시도");
  });
});
```

#### `propagateRetry: "HAS_OUTER_CONTEXT"`

외부 loader context가 존재할 때만 전파합니다.

```typescript
const child = loader().withOptions({
  input: { retry: { maxCount: 2, canRetryOnError: true }, timeout: { delay: 1000 } },
  propagateRetry: "HAS_OUTER_CONTEXT",
  middlewares: [],
});

// 외부 context 있음 → 전파
await parent.execute(async () => child.execute(async () => { ... }));

// 외부 context 없음 → 로컬 처리
await child.execute(async () => { ... });
```

#### `propagateRetry: "HAS_SAME_OUTER_CONTEXT"`

외부 loader가 동일한 instance일 때만 전파합니다.

**구현:** 각 loader instance는 `generateID("loader")`를 통해 고유 ID를 받습니다. 시스템은 `LoaderMetadata.context().hierarchy`에서 loader 계층을 추적하고 ID를 비교하여 전파를 결정합니다.

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

// 동일한 instance → 전파
await loaderA.execute(async () => {
  return await loaderA.execute(async () => {
    throw new Error("외부 loaderA로 전파");
  });
});

// 다른 instance → 로컬 처리
await loaderB.execute(async () => {
  return await loaderA.execute(async () => {
    throw new Error("로컬에서 처리");
  });
});
```

### Loader 재사용성

Loader는 재사용을 위해 설계됨: 한 번 생성하고, 여러 target과 함께 여러 번 실행.

**이점:**

- **성능**: 설정 및 aspect 구성의 일회성 setup 비용
- **메모리 효율성**: 공유 loader instance로 할당 감소
- **아키텍처 명확성**: 설정과 실행 로직 분리

**예시:**

```typescript
// 한 번 설정
const { execute } = loader().withOptions({
  input: {
    retry: { maxCount: 3, canRetryOnError: true },
    timeout: { delay: 5000 },
    backoff: { strategy: EXPONENTIAL_BACKOFF(2), initialDelay: 100 },
  },
  propagateRetry: false,
  middlewares: [loggingMiddleware, metricsMiddleware],
});

// 다른 endpoint에 재사용
const users = await execute(() => fetch("/api/users").then((r) => r.json()));
const posts = await execute(() => fetch("/api/posts").then((r) => r.json()));
const comments = await execute(() =>
  fetch("/api/comments").then((r) => r.json()),
);
```

### 런타임 상태 접근

실행 중 `loaderOptions()`를 통해 loader 상태에 접근합니다.

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

  // 상태 읽기
  console.log(`Retry: ${options.retry.count}/${options.retry.maxCount}`);
  console.log(`경과: ${options.timeout.elapsedTime}ms`);

  // 상태 변경
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

### Middleware Context 접근

실행 중 `middlewareOptions()`를 통해 middleware context에 접근합니다.

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

  console.log(`요청: ${tracking.requests}`);
  console.log(`오류: ${tracking.errors}`);

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

## 타입 레퍼런스

### 핵심 Export

```typescript
// 주요 함수
export { loader, middleware };

// Signal
export {
  MiddlewareInvalidContextSignal,
  RetryExceededSignal,
  RetrySignal,
  TimeoutSignal,
};

// Backoff 전략
export { createBackoff, FIXED_BACKOFF, LINEAR_BACKOFF, EXPONENTIAL_BACKOFF };

// 타입 export
export type { BackoffContextInput };
export type { LoaderCoreInput };
export type { LoaderMiddleware, MiddlewareContext, MiddlewareOptions };
export type { LoaderCoreOptions };
export type { RetryContextInput };
export type { TimeoutContextInput };
```

### 타입 정의

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

## 구현 세부사항

### 내부 Aspect 구성

Loader는 내부적으로 세 가지 aspect에서 구성된 AOP process를 생성합니다:

```typescript
// loader.ts 89-100줄에서
const process: Process<Result, LoaderContext> = createProcess({
  aspects: [
    createBackoffAspect<Result>(), // 재시도 간 지연 관리
    createRetryAspect<Result>(), // 재시도 로직 처리
    createTimeoutAspect<Result>(), // 시간 제한 강제
    ...middlewares.map(({ aspect }) => aspect), // 사용자 정의 middleware
  ],
  buildOptions: {
    advice: {
      afterThrowing: {
        error: {
          runtime: { afterThrow: "halt" }, // Signal이 target 오류를 덮어씀
        },
      },
    },
  },
  processOptions: {
    /* 커스텀 오류 처리 */
  },
});
```

**Aspect 의존성:**

- `LOADER_RETRY_ASPECT`는 `LOADER_TIMEOUT_ASPECT`에 의존
- `LOADER_TIMEOUT_ASPECT`는 `LOADER_BACKOFF_ASPECT`에 의존
- 이는 적절한 실행 순서를 보장: Backoff → Timeout → Retry

### 오류 결정 로직

여러 오류가 동시에 발생하면, loader는 우선순위를 지정합니다:

```typescript
// loader.ts 115-139줄에서
async determineError({ errors }) {
  if (errors.length === 0) {
    throw new Error("no error to determine");
  }

  // 우선순위로 정렬 (signal 우선, 그 다음 우선순위 값으로)
  const [, error] = errors
    .map((error) =>
      Signal.isSignal(error)
        ? ([error.priority, error] as const)
        : ([ERROR_PRIORITY, error] as const),
    )
    .sort(([priorityA], [priorityB]) => priorityB - priorityA)
    .at(0)!;

  // 최고 우선순위 오류가 Signal이면 직접 사용
  if (Signal.isSignal(error)) {
    return error;
  }

  // 그렇지 않으면 사용자 제공 onDetermineError에 위임하거나 첫 번째 오류 반환
  return onDetermineError ? onDetermineError(errors) : error;
}
```

**동작:**

- Signal은 항상 일반 오류보다 우선
- Signal 중에서는 높은 우선순위가 승리 (Middleware > Timeout > RetryExceeded > Retry)
- 비-signal 오류의 경우, `onDetermineError`가 커스텀 선택 로직 허용
- 기본 동작은 배열의 첫 번째 오류 반환

### 오류 처리 로직

오류 결정 후, loader는 복구를 시도합니다:

```typescript
// loader.ts 142-171줄에서
async handleError({ exit, error, currentTarget, context }) {
  // 비-signal 오류: 사용자 핸들러에 위임하거나 재발생
  if (!Signal.isSignal(error)) {
    if (onHandleError) {
      return onHandleError(error);
    }
    throw error;
  }

  // RetrySignal: 재시도 또는 전파
  if (error instanceof RetrySignal) {
    if (canPropagateRetry(loaderID, propagateRetry)) {
      throw new RetrySignal({ ...error, propagated: true });
    }

    // 로컬에서 재시도: 업데이트된 context로 process 재실행
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

  // 다른 signal: 재발생
  throw error;
}
```

### Metadata 추적

전파 전략을 위해 loader 계층이 추적됩니다.

```typescript
// withLoaderMetadata.ts에서
export function withLoaderMetadata<T>(id: string, fn: () => Promise<T>) {
  const metadata: LoaderMetadata = { hierarchy: [] };

  try {
    const currentContext = LoaderMetadata.context();
    metadata.hierarchy = [...currentContext.hierarchy];
  } catch {
    /* 외부 context 없음 */
  }

  metadata.hierarchy = [...metadata.hierarchy, id];

  return async () =>
    LoaderMetadata.exit(async () =>
      AsyncContext.executeWith(LoaderMetadata, () => metadata, fn),
    );
}
```

**계층 예시:**

```typescript
// loaderA.execute() → hierarchy: ["id:loader:uuid-1"]
//   loaderA.execute() → hierarchy: ["id:loader:uuid-1", "id:loader:uuid-1"]
//   loaderB.execute() → hierarchy: ["id:loader:uuid-1", "id:loader:uuid-2"]
```

`canPropagateRetry()` 함수는 이 계층을 사용하여 `propagateRetry` 전략에 따라 `RetrySignal`을 전파할지 결정합니다.

### canRetryOnError 범위

**중요:** `canRetryOnError`는 **오직** target 함수의 오류만 평가하며, middleware 오류는 **평가하지 않습니다**.

```typescript
// createRetryAspect.ts afterThrowing advice에서
async advice({ __core__retry: retry }, error) {
  // 비-retry signal 제외
  if (Signal.isSignal(error) && !(error instanceof RetrySignal)) {
    return;
  }

  // 오직 비-signal 오류만 평가 (target 함수에서)
  if (!Signal.isSignal(error)) {
    const { canRetryOnError } = retry;
    const isRetryable =
      canRetryOnError === true ||
      (typeof canRetryOnError === "function" && canRetryOnError(error));

    if (!isRetryable) {
      return; // 재시도 안함
    }
  }

  // 최대 횟수 확인 및 재시도 진행
  if (retry.maxCount < retry.count + 1) {
    retry.onRetryExceeded?.();
    throw new RetryExceededSignal({ maxRetry: retry.maxCount });
  }

  retry.count += 1;
  throw new RetrySignal({ errorReason: error });
}
```

**의미:** Middleware 오류는 재시도 평가 없이 즉시 실패합니다. Target 함수 오류만 `canRetryOnError` 로직의 대상입니다.

## 고급 패턴

### 타입 안전 Middleware 구성

Loader와 모든 middleware는 동일한 `Result` 타입 매개변수를 공유해야 합니다.

```typescript
// ✅ 올바름: 타입 일치
interface ApiResponse {
  data: string;
  status: number;
}

const middleware1 = middleware<ApiResponse>().withOptions({
  name: "m1",
  contextGenerator: () => ({}),
  complete: async (context, result) => {
    console.log(result.data, result.status); // 타입 안전
  },
});

const { execute } = loader<ApiResponse>().withOptions({
  input: {
    retry: { maxCount: 3, canRetryOnError: true },
    timeout: { delay: 5000 },
  },
  propagateRetry: false,
  middlewares: [middleware1], // 타입 호환
});

// ❌ 잘못됨: 타입 불일치
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
  middlewares: [badMiddleware], // ❌ TypeScript 오류: 타입 불일치
});
```

### 중첩 Loader 실행

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

### BFF 데이터 집계

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

// 여러 API 호출을 집계하는 BFF endpoint
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

### CDN Fallback을 사용한 SSR

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

// CDN fallback을 사용한 SSR 페이지 데이터 페칭
export async function getServerSideProps(slug: string) {
  return fetchPage(async () => {
    // CDN이 비정상이면 origin으로 fallback
    retryFallback({
      when: () => !cdnMonitor.shouldUseCDN(),
      fallback: () => () => async () => {
        const data = await fetchFromOrigin(slug);
        cdnMonitor.recordSuccess();
        return data;
      },
    });

    // 기본: 먼저 CDN 시도
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

### 캐시를 사용한 클라이언트 사이드 데이터 페칭

```typescript
interface CachedData<T> {
  data: T;
  cachedAt: number;
}

// IndexedDB 캐시 레이어
async function getCached<T>(key: string): Promise<T | null> {
  const cached = await indexedDB.get<CachedData<T>>(key);
  if (!cached) return null;
  if (Date.now() - cached.cachedAt > 300000) return null; // 5분 TTL
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
        throw error; // 캐시 없음
      },
    });

    retryFallback({
      when: (error) => error.status === 429,
      fallback: () => () => async () => {
        console.warn("Rate limited, 오래된 캐시 사용");
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

## 관련 패키지

- [@h1ylabs/promise-aop](https://github.com/h1ylabs/next-loader/tree/main/packages/promise-aop) - 기반이 되는 Promise AOP 라이브러리
- [@h1ylabs/next-loader](https://github.com/h1ylabs/next-loader/tree/main/packages/next-loader) - Next.js 전용 loader 구현체

## 라이센스

MIT
