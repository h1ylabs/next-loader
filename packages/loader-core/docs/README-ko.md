# @h1y/loader-core

내장된 retry, timeout, backoff 전략을 갖춘 견고한 Promise AOP 기반 loader 라이브러리입니다. [@h1y/promise-aop](https://github.com/h1ylabs/next-loader/tree/main/packages/promise-aop) 위에 구축된 이 core 라이브러리는 middleware 지원과 함께 탄력적인 비동기 작업을 생성하기 위한 기반을 제공합니다.

## 설치

```bash
npm install @h1y/loader-core
# 또는
yarn add @h1y/loader-core
# 또는
pnpm add @h1y/loader-core
```

## 문서

- [영문 문서 (English Documentation)](../README.md)

## 빠른 시작

```typescript
import { loader, EXPONENTIAL_BACKOFF } from "@h1y/loader-core";

// 재사용 가능한 loader 설정 생성
const { execute } = loader().withOptions({
  input: {
    retry: { maxCount: 3, canRetryOnError: true },
    timeout: { delay: 5000 },
    backoff: { strategy: EXPONENTIAL_BACKOFF(2), initialDelay: 100 },
  },
  propagateRetry: false,
  middlewares: [],
});

// Target과 함께 실행 - loader는 다른 target과 함께 재사용될 수 있습니다
const result = await execute(async () => {
  const response = await fetch("/api/data");
  return response.json();
});

// 다른 target과 함께 동일한 loader 재사용
const userData = await execute(async () => {
  const response = await fetch("/api/user");
  return response.json();
});
```

## 핵심 개념

[@h1y/promise-aop](https://github.com/h1ylabs/next-loader/tree/main/packages/promise-aop)를 기반으로 구축된 이 라이브러리는 다음을 제공합니다:

- **재사용 가능한 Loader**: 한 번 생성하고 다른 target과 함께 실행하여 최적의 성능을 발휘합니다
- **Signal 기반 Error 처리**: `RetrySignal`, `TimeoutSignal`을 통한 정밀한 제어
- **Middleware 시스템**: 관찰, 검증 및 부수 효과를 위한 lifecycle hook
- **Context 격리**: 각 실행은 안전을 위해 격리된 context를 유지합니다

## Loader 재사용성

API 디자인은 **loader 재사용성**을 우선시합니다 - 한 번 생성하고, 다른 target으로 여러 번 실행합니다. 이 패턴은 상당한 성능 및 아키텍처상의 이점을 제공합니다:

### 주요 이점

#### 성능 최적화

- **일회성 Setup 비용**: Loader 설정, middleware 초기화, aspect 구성이 한 번만 발생합니다
- **메모리 할당 감소**: 동일한 loader instance가 context를 다시 생성하지 않고 여러 작업을 처리합니다
- **효율적인 Resource 사용**: 특히 고빈도 시나리오에서 유용합니다

#### 아키텍처 이점

- **관심사 분리**: 설정이 실행 로직과 분리됩니다
- **Template 패턴**: retry/timeout/middleware 동작을 한 번 정의하고 여러 작업에 적용합니다
- **더 깔끔한 중첩 패턴**: 자식 loader를 한 번 정의하고 여러 부모 실행에서 재사용할 수 있습니다

### 사용 패턴

#### 단일 Loader, 여러 Target

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

// 다른 API endpoint에 재사용
const users = await execute(() =>
  fetch("/api/users").then((r) => r.json()),
);
const posts = await execute(() =>
  fetch("/api/posts").then((r) => r.json()),
);
const comments = await execute(() =>
  fetch("/api/comments").then((r) => r.json()),
);
```

#### Template 기반 설정

```typescript
// 다양한 시나리오를 위한 loader template 생성
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

// 작업의 중요도에 따라 적절한 loader 사용
const quickData = await fastExecute(() => getCacheableData());
const criticalData = await robustExecute(() =>
  getBusinessCriticalData(),
);
```

#### 효율적인 Batch 작업

```typescript
const { execute } = loader().withOptions({
  input: {
    retry: { maxCount: 2, canRetryOnError: true },
    timeout: { delay: 2000 },
  },
  propagateRetry: false,
  middlewares: [progressMiddleware],
});

// 대규모 dataset을 효율적으로 처리
const results = await Promise.all(
  largeDataArray.map((item) => execute(() => processItem(item))),
);
```

## Error 처리 내부 구조

### Signal 우선순위 시스템

Loader는 동시에 발생하는 여러 실패를 관리하기 위해 정교한 우선순위 기반 error 처리 시스템을 사용합니다. 여러 aspect(retry, timeout, middleware)가 동시에 error를 만날 때, 시스템은 긴급도와 중요도에 따라 signal의 우선순위를 정합니다.

#### 우선순위 계층

다음 우선순위가 내부적으로 사용됩니다 (높은 값 = 높은 우선순위):

```typescript
// Signal 우선순위 (명확성을 위한 이진 표현)
const MIDDLEWARE_INVALID_SIGNAL_PRIORITY = 0b1000_0000_0000_0000; // 32768
const TIMEOUT_SIGNAL_PRIORITY =            0b0100_0000_0000_0000; // 16384  
const RETRY_EXCEEDED_SIGNAL_PRIORITY =     0b0010_0000_0000_0000; // 8192
const RETRY_SIGNAL_PRIORITY =              0b0001_0000_0000_0000; // 4096
const ERROR_PRIORITY =                     0b0000_0000_0000_0000; // 0
```

**우선순위 순서 (높은 순):**
1. **`MiddlewareInvalidContextSignal`** - 중요한 시스템 error, middleware context 손상
2. **`TimeoutSignal`** - 작업 timeout, 시간에 민감한 실패  
3. **`RetryExceededSignal`** - 모든 retry 시도 소진
4. **`RetrySignal`** - Retry 시도 요청
5. **일반 `Error`** - Application level error

#### Error 결정 Process

여러 error가 발생할 때, `determineError` 로직은 다음 과정을 따릅니다:

```typescript
// 단순화된 내부 로직
async determineError({ errors }) {
  if (errors.length === 0) {
    throw new Error("No errors to determine");
  }

  // Error를 우선순위로 정렬 (signal 우선, 그 다음 우선순위 값으로)
  const prioritizedErrors = errors
    .map((error) => 
      Signal.isSignal(error)
        ? [error.priority, error]  // Signal의 우선순위 사용
        : [ERROR_PRIORITY, error]  // 일반 error는 최저 우선순위
    )
    .sort(([priorityA], [priorityB]) => priorityB - priorityA) // 내림차순
    .map(([, error]) => error);

  const highestPriorityError = prioritizedErrors[0];

  // 최고 우선순위 error가 Signal이면 직접 사용
  if (Signal.isSignal(highestPriorityError)) {
    return highestPriorityError;
  }

  // Signal이 없으면, 사용자 제공 onDetermineError에 위임
  // 또는 첫 번째 error를 기본값으로 사용
  return onDetermineError 
    ? await onDetermineError(errors) 
    : highestPriorityError;
}
```

#### Signal vs Error 처리

시스템은 **Signal**과 일반 **Error**를 다르게 처리합니다:

**Signal** (내부적으로 처리):
- 내장된 우선순위와 특별한 처리 로직을 가집니다
- `RetrySignal`: 자동 retry 메커니즘 트리거
- `TimeoutSignal`: Timeout이 발생했음을 나타냄
- `RetryExceededSignal`: 모든 retry가 소진되었음을 나타냄
- `MiddlewareInvalidContextSignal`: 중요한 middleware 상태 error

**일반 Error** (사용자 제어):
- 항상 최저 우선순위(0)를 가집니다
- `canRetryOnError` 평가 대상입니다  
- `onDetermineError`와 `onHandleError`를 통해 커스터마이징 가능합니다

#### 예시: 동시 다중 실패

```typescript
import { loader, TimeoutSignal } from "@h1y/loader-core";

const { execute } = loader().withOptions({
  input: {
    retry: { maxCount: 2, canRetryOnError: true },
    timeout: { delay: 100 }, // 매우 짧은 timeout
  },
  propagateRetry: false,
  middlewares: [],
  
  onDetermineError: async (errors) => {
    console.log("Multiple error 발생:", errors.map(e => e.constructor.name));
    // 이 함수는 Signal이 없을 때만 호출됩니다
    return errors[0];
  },
  
  onHandleError: async (error) => {
    console.log("최종 error 처리:", error.constructor.name);
    if (error instanceof TimeoutSignal) {
      return "timeout-fallback";
    }
    throw error;
  },
});

const result = await execute(async () => {
  // 이것은 timeout과 error를 모두 발생시킵니다
  await new Promise(resolve => setTimeout(resolve, 200)); // 100ms timeout 초과
  throw new Error("Business logic error");
});

// 출력은 TimeoutSignal이 Error보다 우선순위가 높음을 보여줍니다
// 결과: "timeout-fallback"
```

이 우선순위 시스템은 중요한 시스템 수준 문제(timeout 등)가 application 수준 error보다 먼저 처리되도록 보장하여, 예측 가능하고 신뢰할 수 있는 error 처리 동작을 제공합니다.

## Retry 전파 전략

`propagateRetry` 옵션은 중첩된 작업에서 발생한 `RetrySignal`이 어떻게 처리되는지를 제어합니다. 이는 중첩된 loader 실행이나 애플리케이션의 다른 계층에서 retry 동작을 제어하려는 시나리오에서 특히 중요합니다.

### Retry 전파 이해하기

`RetrySignal`이 발생할 때 (`retry()`를 통해 수동으로 또는 retry 메커니즘에 의해 자동으로), `propagateRetry` 설정은 해당 signal이 다음 중 어떻게 처리되어야 하는지를 결정합니다:
- **로컬에서 처리** (현재 수준에서 retry 시도로 변환)
- **상위로 전파** (부모/호출 context로 그대로 전달)

### 전파 옵션

#### `propagateRetry: false` (기본값)

모든 retry signal은 로컬에서 처리되며 부모 context로 전파되지 않습니다.

```typescript
const { execute: childExecute } = loader().withOptions({
  input: { retry: { maxCount: 2, canRetryOnError: true }, timeout: { delay: 1000 } },
  propagateRetry: false, // Retry signal을 로컬에서 처리
  middlewares: [],
});

const { execute: parentExecute } = loader().withOptions({
  input: { retry: { maxCount: 1, canRetryOnError: true }, timeout: { delay: 5000 } },
  propagateRetry: false,
  middlewares: [],
});

await parentExecute(async () => {
  // 자식 retry signal은 부모 retry 로직에 영향을 주지 않음
  return await childExecute(async () => {
    throw new Error("이것은 자식 수준에서 2번 retry할 수 있습니다");
  });
});
```

#### `propagateRetry: true`

모든 retry signal은 로컬 처리 없이 부모 context로 전파됩니다.

```typescript
const { execute: childExecute } = loader().withOptions({
  input: { retry: { maxCount: 2, canRetryOnError: true }, timeout: { delay: 1000 } },
  propagateRetry: true, // 모든 retry signal을 상위로 전파
  middlewares: [],
});

const { execute: parentExecute } = loader().withOptions({
  input: { retry: { maxCount: 3, canRetryOnError: true }, timeout: { delay: 5000 } },
  propagateRetry: false, // 자식으로부터 전파된 signal 처리
  middlewares: [],
});

await parentExecute(async () => {
  // 자식 error는 부모 수준에서 retry됩니다 (최대 3번)
  // 자식의 maxCount: 2는 signal이 전파되므로 무시됩니다
  return await childExecute(async () => {
    throw new Error("이것은 부모 수준에서 retry됩니다");
  });
});
```

#### `propagateRetry: "HAS_OUTER_CONTEXT"`

외부 loader context가 있을 때만 retry signal을 전파합니다.

```typescript
const { execute: childExecute } = loader().withOptions({
  input: { retry: { maxCount: 2, canRetryOnError: true }, timeout: { delay: 1000 } },
  propagateRetry: "HAS_OUTER_CONTEXT", // 부모 loader가 존재할 때만 전파
  middlewares: [],
});

const { execute: parentExecute } = loader().withOptions({
  input: { retry: { maxCount: 3, canRetryOnError: true }, timeout: { delay: 5000 } },
  propagateRetry: false, // 전파된 signal을 로컬에서 처리
  middlewares: [],
});

// 부모 context가 있는 경우 - signal 전파
await parentExecute(async () => {
  return await childExecute(async () => {
    throw new Error("부모 수준에서 retry됩니다 (최대 3번)");
  });
});

// 부모 context가 없는 경우 - signal 로컬 처리
await childExecute(async () => {
  throw new Error("로컬에서 retry됩니다 (최대 2번)");
});
```

#### `propagateRetry: "HAS_SAME_OUTER_CONTEXT"`

외부 loader가 동일한 instance(같은 `execute` 함수)일 때만 retry signal을 전파합니다.

```typescript
// 재사용 가능한 loader instance 생성
const { execute: reusableExecute } = loader().withOptions({
  input: { retry: { maxCount: 2, canRetryOnError: true }, timeout: { delay: 1000 } },
  propagateRetry: "HAS_SAME_OUTER_CONTEXT", // 동일한 loader instance에게만 전파
  middlewares: [],
});

// 다른 loader instance 생성
const { execute: differentExecute } = loader().withOptions({
  input: { retry: { maxCount: 3, canRetryOnError: true }, timeout: { delay: 2000 } },
  propagateRetry: false,
  middlewares: [],
});

// 동일한 loader instance - signal 전파
await reusableExecute(async () => {
  return await reusableExecute(async () => {  // 같은 execute 함수
    throw new Error("외부 reusableExecute로 전파됩니다");
  });
});

// 다른 loader instance - signal 로컬 처리
await differentExecute(async () => {
  return await reusableExecute(async () => {  // 다른 execute 함수
    throw new Error("로컬에서 처리되며 전파되지 않습니다");
  });
});

// 실용적인 사용 사례: 동일한 loader를 사용한 재귀 작업
async function processNestedData(data: any[], depth = 0): Promise<any[]> {
  return reusableExecute(async () => {
    if (depth > 5) throw new Error("최대 깊이 도달");
    
    return Promise.all(data.map(async (item) => {
      if (Array.isArray(item)) {
        // 재귀 호출은 동일한 loader 사용 - retry가 상위로 전파
        return processNestedData(item, depth + 1);
      }
      return processItem(item);
    }));
  });
}
```

### 사용 사례 및 Best Practice

#### 사용 사례 1: 독립적인 Operation Retry

```typescript
// 독립적으로 retry되어야 하는 API 호출
const { execute: apiCall } = loader().withOptions({
  input: { retry: { maxCount: 3, canRetryOnError: (e) => e.status >= 500 }, timeout: { delay: 2000 } },
  propagateRetry: false, // 각 API 호출이 독립적으로 retry
  middlewares: [],
});

const { execute: batchProcess } = loader().withOptions({
  input: { retry: { maxCount: 1, canRetryOnError: true }, timeout: { delay: 30000 } },
  propagateRetry: false,
  middlewares: [],
});

// 각 API 호출은 독립적으로 retry되며, batch는 개별 실패를 retry하지 않음
await batchProcess(async () => {
  return await Promise.allSettled([
    apiCall(() => fetch('/api/users')),
    apiCall(() => fetch('/api/posts')),
    apiCall(() => fetch('/api/comments')),
  ]);
});
```

#### 사용 사례 2: 계층적 Retry 전략

```typescript
// Fallback 계층을 가진 복합 작업
const { execute: primaryOperation } = loader().withOptions({
  input: { retry: { maxCount: 2, canRetryOnError: true }, timeout: { delay: 1000 } },
  propagateRetry: true, // 실패를 상위로 전파
  middlewares: [],
});

const { execute: operationWithFallback } = loader().withOptions({
  input: { retry: { maxCount: 1, canRetryOnError: true }, timeout: { delay: 5000 } },
  propagateRetry: false, // 이 수준에서 모든 retry 처리
  middlewares: [],
});

await operationWithFallback(async () => {
  try {
    // 먼저 주요 작업 시도
    return await primaryOperation(async () => performPrimaryTask());
  } catch (error) {
    // 주요 작업이 retry 전파 후 실패하면 fallback 시도
    return await performFallbackTask();
  }
});
```

#### 사용 사례 3: 조건부 전파

```typescript
const { execute } = loader().withOptions({
  input: { retry: { maxCount: 3, canRetryOnError: true }, timeout: { delay: 2000 } },
  propagateRetry: false,
  middlewares: [],
  
  onHandleError: async (error) => {
    // 커스텀 로직: 특정 유형의 error만 전파
    if (error.type === 'SYSTEM_ERROR') {
      throw error; // 시스템 error 전파
    }
    // Application error는 로컬에서 처리
    return getDefaultValue();
  },
});
```

### 성능 고려사항

- **`propagateRetry: false`**: 독립적인 작업에 더 적합, 더 예측 가능한 resource 사용
- **`propagateRetry: true`**: 계층적 error 처리에 더 적합하지만 예상치 못한 retry 패턴을 유발할 수 있음
- **혼합 전략**: 작업의 중요도와 error 복구 전략에 따라 다른 수준에서 다른 설정 사용

### 일반적인 함정

1. **의도하지 않은 Retry 증식**: 조정된 retry 동작이 필요할 때 모든 수준에서 `propagateRetry: false` 설정
2. **Resource 고갈**: 계층 간 retry의 누적 효과를 고려하지 않고 `propagateRetry: true` 사용
3. **Error Context 손실**: 디버깅을 위한 원본 error 정보를 보존하지 않고 retry 전파

지역화된 독립적인 retry 동작(`false`) 또는 조정된 계층적 retry 동작(`true`) 중 어떤 것을 원하는지에 따라 전파 전략을 선택하세요.

## API 레퍼런스

### Type 호환성 요구사항

#### 중요: 일치하는 Result Type

**필수 요구사항**: Middleware와 함께 loader를 생성할 때, loader와 모든 middleware는 **반드시** 동일한 `Result` generic type parameter를 사용해야 합니다. 일치하지 않는 type은 TypeScript 컴파일 error와 runtime 문제를 발생시킵니다.

**올바른 Type 선언:**

```typescript
// ✅ 올바름: 모든 component가 동일한 Result type을 사용
type ApiResponse = { data: string; status: number };

const loggingMiddleware = middleware<ApiResponse>().withOptions({
  name: "logging",
  contextGenerator: () => ({ startTime: 0 }),
  complete: async (context, result) => {
    // result는 올바르게 ApiResponse로 타입이 지정됩니다
    console.log("API Response:", result.data, result.status);
  },
});

const { execute } = loader<ApiResponse>().withOptions({
  input: {
    retry: { maxCount: 3, canRetryOnError: true },
    timeout: { delay: 5000 },
  },
  propagateRetry: false,
  middlewares: [loggingMiddleware], // Type 호환성 보장
});

const result = await execute(async (): Promise<ApiResponse> => {
  return { data: "success", status: 200 };
});
```

**잘못된 Type 선언 (Error 발생):**

```typescript
// ❌ 잘못됨: 일치하지 않는 Result type
type ApiResponse = { data: string; status: number };
type DifferentResponse = { message: string; code: number };

const loggingMiddleware = middleware<DifferentResponse>().withOptions({
  name: "logging",
  contextGenerator: () => ({ startTime: 0 }),
  complete: async (context, result) => {
    // result는 DifferentResponse로 타입이 지정되지만 loader는 ApiResponse를 기대합니다
    console.log(result.message); // Type error 발생
  },
});

const { execute } = loader<ApiResponse>().withOptions({
  input: {
    retry: { maxCount: 3, canRetryOnError: true },
    timeout: { delay: 5000 },
  },
  propagateRetry: false,
  middlewares: [loggingMiddleware], // ❌ TypeScript error: Type 불일치
});
```

#### Type 안전성 강제

TypeScript 컴파일러는 type 호환성을 강제합니다:

```typescript
// 컴파일 error 예시
interface UserData { id: number; name: string; }
interface ProductData { id: string; title: string; price: number; }

const userMiddleware = middleware<UserData>().withOptions({
  name: "user-logging",
  contextGenerator: () => ({}),
});

const { execute } = loader<ProductData>().withOptions({
  input: { retry: { maxCount: 1, canRetryOnError: false }, timeout: { delay: 1000 } },
  propagateRetry: false,
  middlewares: [userMiddleware], // ❌ Compiler Error:
  // Type 'LoaderMiddleware<UserData, {}, "user-logging">' is not assignable to
  // type 'LoaderMiddleware<ProductData, any, any>'
});
```

#### Type 관리 Best Practice

**1. Result Type을 먼저 정의:**

```typescript
// Result type을 먼저 정의
interface MyApiResult {
  success: boolean;
  data?: any;
  error?: string;
}

// 모든 component에서 일관되게 사용
const middleware1 = middleware<MyApiResult>().withOptions({...});
const middleware2 = middleware<MyApiResult>().withOptions({...});
const { execute } = loader<MyApiResult>().withOptions({
  middlewares: [middleware1, middleware2]
});
```

**2. 유연한 Type을 위한 Generic Constraint 사용:**

```typescript
// Base interface를 확장하는 모든 type에 대해 재사용 가능한 middleware 생성
interface BaseResponse { status: number; }

function createStatusMiddleware<T extends BaseResponse>() {
  return middleware<T>().withOptions({
    name: "status-logger",
    contextGenerator: () => ({}),
    complete: async (context, result) => {
      console.log("Status:", result.status); // .status 접근 안전
    },
  });
}

// 특정 type과 함께 사용
type ApiResult = BaseResponse & { data: string };
const statusMiddleware = createStatusMiddleware<ApiResult>();
const { execute } = loader<ApiResult>().withOptions({
  middlewares: [statusMiddleware] // Type이 완벽하게 일치
});
```

**3. Type Assertion 피하기:**

```typescript
// ❌ 하지 마세요: assertion으로 type 호환성 강제
const badMiddleware = middleware<any>().withOptions({
  complete: async (context, result) => {
    const typed = result as MySpecificType; // 안전하지 않음, 피하세요
  },
});

// ✅ 하세요: 적절한 generic typing 사용
const goodMiddleware = middleware<MySpecificType>().withOptions({
  complete: async (context, result) => {
    // result는 이미 MySpecificType으로 올바르게 타입이 지정됨
    console.log(result.specificProperty);
  },
});
```

이 type 안전성은 middleware가 target 함수에서 생성된 결과에 안전하게 접근하고 검증할 수 있도록 보장하여, runtime type error를 방지하고 코드 유지보수성을 향상시킵니다.

### loader\<Result\>()

구성된 loader instance를 생성하는 방법을 제공하는 loader factory를 생성합니다.

#### Method

##### .withOptions(props)

Retry, timeout, middleware 기능을 갖춘 loader instance를 생성합니다.

**매개변수:**

```typescript
interface LoaderProps<Result> {
  // 핵심 설정
  input: LoaderCoreInput<Result>; // Retry, timeout, backoff 설정

  // Error 처리
  onDetermineError?: (errors: unknown[]) => Promise<unknown>;
  onHandleError?: (error: unknown) => Promise<Result>;

  // 옵션
  propagateRetry: boolean | "HAS_OUTER_CONTEXT" | "HAS_SAME_OUTER_CONTEXT"; // RetrySignal 전파 여부
  middlewares: readonly LoaderMiddleware<Result, any, any>[];
}
```

**Input 설정:**

```typescript
interface LoaderCoreInput<Result> {
  retry: {
    maxCount: number; // 최대 retry 횟수
    canRetryOnError: boolean | ((error: unknown) => boolean);
    fallback?: TargetWrapper<Result>; // Fallback 함수
    onRetryEach?: () => void; // 각 retry 시 호출
    onRetryExceeded?: () => void; // Retry 초과 시 호출
  };
  timeout: {
    delay: number; // Timeout 시간(밀리초)
    onTimeout?: () => void; // Timeout 시 호출
  };
  backoff?: {
    strategy: Backoff; // Backoff 전략
    initialDelay: number; // 초기 지연 시간(밀리초)
  };
}
```

**반환값:**

```typescript
interface LoaderReturn<Result> {
  execute: (target: Target<Result>) => Promise<Result>; // Target과 함께 실행
  retry: (fallback?: TargetWrapper<Result>) => never; // 수동 retry (target context 내에서만)
  loaderOptions: () => LoaderCoreOptions<Result>; // 현재 상태 접근
  middlewareOptions: () => MiddlewareOptions<Middlewares>; // Middleware context 접근
}
```

##### .withDefaultOptions()

기본 설정(retry 없음, timeout 제한 없음, middleware 없음)으로 loader instance를 생성합니다.

**예시:**

```typescript
import { loader } from "@h1y/loader-core";

// 커스텀 옵션으로 생성
const { execute, retry, loaderOptions, middlewareOptions } = loader<MyResult>().withOptions({
  input: {
    retry: { maxCount: 3, canRetryOnError: true },
    timeout: { delay: 5000 },
  },
  propagateRetry: false,
  middlewares: [loggingMiddleware],
  onDetermineError: async (errors) => errors[0],
  onHandleError: async (error) => defaultResult,
});

// 또는 기본 옵션으로 생성
const defaultLoader = loader<MyResult>().withDefaultOptions();

const result = await execute(myAsyncFunction);
```

**중요**: `retry` 함수는 `target` 함수 context 내에서만 호출할 수 있습니다:

```typescript
const { execute, retry } = loader().withOptions({
  input: {
    retry: { maxCount: 3, canRetryOnError: true },
    timeout: { delay: 5000 },
  },
  propagateRetry: false,
  middlewares: [],
});

// Target과 함께 실행 - retry는 target 내에서 호출될 수 있습니다
const result = await execute(async () => {
  try {
    return await apiCall();
  } catch (error) {
    // ✅ 올바름: target context 내에서 retry 호출
    if (shouldRetry(error)) {
      retry();
    }
    throw error;
  }
});

// ❌ 잘못됨: target context 외부에서 retry 호출
// retry(); // 이것은 예상대로 작동하지 않습니다
```

### middleware\<Result\>()

구성된 middleware instance를 생성하는 방법을 제공하는 middleware factory를 생성합니다.

#### Method

##### .withOptions(props)

횡단 관심사를 위한 lifecycle hook을 갖춘 middleware를 생성합니다.

**매개변수:**

```typescript
interface MiddlewareProps<Result, Context, Name extends string> {
  name: Name; // 고유한 middleware 식별자
  contextGenerator: () => Context; // 초기 context factory

  // Lifecycle hook (모두 선택사항)
  before?: (context: Context) => Promise<void>;
  complete?: (context: Context, result: Result) => Promise<void>;
  failure?: (context: Context, error: unknown) => Promise<void>;
  cleanup?: (context: Context) => Promise<void>;
}
```

**예시:**

```typescript
import { middleware } from "@h1y/loader-core";

const loggingMiddleware = middleware<MyResult>().withOptions({
  name: 'logging',
  contextGenerator: () => ({ startTime: 0 }),
  before: async (context) => {
    context.startTime = Date.now();
    console.log('Loader 실행 시작.');
  },
  complete: async (context, result) => {
    const duration = Date.now() - context.startTime;
    console.log(`Loader 실행이 ${duration}ms에 완료되었습니다. 결과:`, result);
  },
  failure: async (context, error) => {
    console.error('Loader 실행 실패:', error);
  }
});
```

#### 실행 순서

1. **before**: Target 실행 전 호출
2. **complete**: 성공적인 target 실행 후 호출
3. **failure**: Target에서 error 발생 시 호출
4. **cleanup**: 성공/실패 여부와 관계없이 마지막에 항상 호출

#### Context 격리

각 middleware는 완전히 격리된 context를 유지합니다:

```typescript
const cacheMiddleware = middleware().withOptions({
  name: "cache",
  contextGenerator: () => ({ cached: false, data: null }),
  // 이 context는 다른 middleware들로부터 격리됩니다
});

const metricsMiddleware = middleware().withOptions({
  name: "metrics",
  contextGenerator: () => ({ startTime: 0, duration: 0 }),
  // 이 context는 완전히 분리되어 있습니다
});
```

### Backoff 전략

```typescript
import {
  FIXED_BACKOFF,
  LINEAR_BACKOFF,
  EXPONENTIAL_BACKOFF,
} from "@h1y/loader-core";

// 고정 지연
const fixed = FIXED_BACKOFF; // 항상 동일한 지연

// 선형 증가
const linear = LINEAR_BACKOFF(100); // 매번 지연 + 100ms

// 지수적 증가
const exponential = EXPONENTIAL_BACKOFF(2); // 매번 지연 * 2
```

## API 문서

### Loader 상태 접근

`loaderOptions()`를 사용하여 target 실행 내에서 loader 상태에 접근합니다:

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

  // 상태 모니터링
  console.log(`Retry: ${options.retry.count}/${options.retry.maxCount}`);
  console.log(`경과 시간: ${options.timeout.elapsedTime}ms`);

  // 동작 제어
  options.retry.resetRetryCount();
  options.timeout.resetTimeout();
  options.retry.useFallbackOnNextRetry(async () => getDefaultData());

  return await performOperation();
});
```

## 사용 예제

### Timeout을 사용한 기본 Retry

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

#### 중요: canRetryOnError 범위 제한사항

**중요한 구분**: `canRetryOnError` 옵션은 **오직** **target 함수**에서 발생한 error만 평가합니다. Middleware advice 함수(`before`, `complete`, `failure`, `cleanup`)에서 발생한 error에는 **적용되지 않습니다**.

**`canRetryOnError`가 평가하는 대상:**
- ✅ Target 함수에서 직접 발생한 error
- ✅ Target 함수를 통해 중첩 호출에서 전파된 error
- ❌ **아님** middleware의 `before` advice에서 발생한 error
- ❌ **아님** middleware의 `complete` advice에서 발생한 error  
- ❌ **아님** middleware의 `failure` advice에서 발생한 error
- ❌ **아님** middleware의 `cleanup` advice에서 발생한 error

**내부 구현 로직:**

```typescript
// createRetryAspect의 단순화된 로직
afterThrowing: createAdvice({
  use: ["__core__retry"],
  async advice({ __core__retry: retry }, error) {
    // RetrySignal이 아닌 Signal들은 retry에서 제외됩니다
    if (Signal.isSignal(error) && !(error instanceof RetrySignal)) {
      return; // 다른 signal에 대해서는 retry 평가 건너뜀
    }

    // 오직 non-signal error(즉, target에서의 일반 error)만 평가됩니다
    if (!Signal.isSignal(error)) {
      const { canRetryOnError } = retry;

      const isRetryable =
        canRetryOnError === true ||
        (typeof canRetryOnError === "function" && canRetryOnError(error));

      if (!isRetryable) {
        return; // 조건을 만족하지 않으면 retry하지 않음
      }
    }

    // Retry 로직 진행...
    if (retry.maxCount < retry.count + 1) {
      retry.onRetryExceeded?.();
      throw new RetryExceededSignal({ maxRetry: retry.maxCount });
    }

    retry.count += 1;
    throw new RetrySignal();
  },
})
```

**예시: Middleware Error는 Retry되지 않음**

```typescript
const validationMiddleware = middleware().withOptions({
  name: "validation",
  contextGenerator: () => ({}),
  before: async () => {
    // 이 error는 canRetryOnError 평가 대상이 아닙니다
    if (Math.random() > 0.5) {
      throw new Error("Middleware에서 검증 실패");
    }
  },
});

const { execute } = loader().withOptions({
  input: {
    retry: { 
      maxCount: 3, 
      canRetryOnError: (error) => {
        console.log("Retry를 위한 error 평가:", error.message);
        return true; // 이 함수는 middleware error에 대해서는 절대 호출되지 않습니다
      }
    },
    timeout: { delay: 5000 },
  },
  propagateRetry: false,
  middlewares: [validationMiddleware],
});

await execute(async () => {
  // 이 error는 canRetryOnError 평가 대상입니다
  throw new Error("Target 함수 error");
});

// Middleware에서 발생하면: Retry 평가 없이 즉시 실패
// Target에서 발생하면: canRetryOnError 함수가 호출됨
```

이 설계는 retry 로직이 target 함수의 비즈니스 로직 error에만 적용되도록 보장하며, middleware error(일반적으로 시스템이나 설정 문제를 나타냄)는 retry 시도 없이 즉시 실패합니다.

### Middleware 구성

```typescript
const loggingMiddleware = middleware().withOptions({
  name: "logging",
  contextGenerator: () => ({ startTime: Date.now() }),
  complete: async (context, result) => {
    const duration = Date.now() - context.startTime;
    console.log(`작업이 ${duration}ms에 완료되었습니다`);
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

### Loader 상태 접근

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
  // Target context 내에서 loader 상태 접근
  const options = loaderOptions();
  console.log(`Retry 횟수: ${options.retry.count}/${options.retry.maxCount}`);
  console.log(`경과 시간: ${options.timeout.elapsedTime}ms`);

  // 프로그래밍 방식으로 retry 횟수 재설정
  if (options.retry.count > 2) {
    options.retry.resetRetryCount();
  }

  // 다음 retry를 위한 fallback 설정
  options.retry.useFallbackOnNextRetry(async () => getDefaultData());

  return await performOperation();
});
```

### Fallback을 사용한 Error 처리

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

## 고급 패턴

### 중첩 Loader 실행

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
  return Promise.all(
    ids.map((id) => childExecute(() => fetchDataById(id)))
  );
});
```

## 관련 패키지

- [@h1y/promise-aop](https://github.com/h1ylabs/next-loader/tree/main/packages/promise-aop) - 기반이 되는 Promise AOP 라이브러리
- [@h1y/next-loader](https://github.com/h1ylabs/next-loader) - Next.js 전용 loader 구현체

## 라이센스

MIT