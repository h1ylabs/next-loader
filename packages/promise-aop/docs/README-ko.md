# Promise-AOP

비동기 JavaScript를 위한 TypeScript-first AOP(Aspect-Oriented Programming) 프레임워크입니다. 타입 안전한 공유 컨텍스트와 섹션 잠금, around advice를 통한 유연한 래퍼 조합, 설정 가능한 에러 처리(halt/continue와 집계), 의존성 기반 실행 순서를 제공합니다.

[English README](../README.md)

---

## 🚀 TL;DR — 빠른 시작

```ts
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

체인이 중단되면 결과가 `TARGET_FALLBACK` 심볼일 수 있습니다:

```ts
import { TARGET_FALLBACK } from "@h1y/promise-aop";
const output = await runProcess({ process, context, target });
if (output === TARGET_FALLBACK) {
  // handle fallback path
}
```

---

## 📦 설치

```bash
# npm
npm install @h1y/promise-aop

# yarn
yarn add @h1y/promise-aop

# pnpm
pnpm add @h1y/promise-aop
```

---

## 💡 왜 Promise-AOP인가?

- 핵심 로직에서 횡단 관심사(로깅, 메트릭, 인증, 캐싱)를 깔끔히 분리
- 공유 컨텍스트 섹션 단위 잠금으로 안전한 병렬 실행 보장
- halt/continue 정책과 집계를 통한 예측 가능한 에러 처리
- `dependsOn` 기반 의존성 정렬로 실행 순서 제어
- Zero runtime dependencies, 완전한 TypeScript 지원

---

## 🧠 핵심 개념

### 어드바이스 타입

| Type             | 언제 실행    | Parameters                                      | 주요 용도                                 |
| ---------------- | ------------ | ----------------------------------------------- | ----------------------------------------- |
| `before`         | 타겟 이전    | `(context)`                                     | 검증, 초기화, 인증                        |
| `around`         | 타겟을 래핑  | `(context, { attachToResult, attachToTarget })` | 캐싱, 재시도, 시간 측정; 유연한 래퍼 조합 |
| `afterReturning` | 성공 후      | `(context)`                                     | 성공 로그/정리                            |
| `afterThrowing`  | 예외 발생 후 | `(context, error)`                              | 에러 로그/알림                            |
| `after`          | 항상 마지막  | `(context)`                                     | 정리, 메트릭                              |

### Aspect, Process, Context

- `Aspect<Result, Context>`: 이름을 가진 어드바이스 묶음
- `Process<Result, Context>`: 여러 Aspect를 실행 가능한 체인으로 조합
- 공유 `Context`는 최상위가 불변이며 섹션으로 나뉩니다
- 각 어드바이스는 `use: ["section", ...]`로 접근 가능한 섹션을 선언합니다 (선언되지 않은 섹션 접근은 런타임 에러)

간단한 컨텍스트 예시:

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

### 실행 순서와 의존성

- 동일 단계의 어드바이스 간 실행 순서를 강제하려면 `dependsOn: ["AspectName", ...]`를 사용하세요
- 의존 그래프는 위상 정렬되며, 순환은 감지되어 경로와 함께 보고됩니다

### 에러 처리와 Fallback

- 어드바이스별 런타임 정책: `buildOptions.advice[advice].error.runtime.afterThrow`로 `halt`/`continue` 지정
- 타겟이 예외를 던지면 `afterThrowing`이 실행되고 체인이 중단됩니다. 최종 결과는 `resolveHaltRejection`이 결정(일반적으로 `TARGET_FALLBACK` 반환)
- `continue` 하의 비치명적 에러는 집계되어 `resolveContinuousRejection`으로 전달

---

## ⚙️ 설정 & 기본값

| Advice           | execution    | error.aggregation | error.runtime.afterThrow |
| ---------------- | ------------ | ----------------- | ------------------------ |
| `before`         | `parallel`   | `unit`            | `halt`                   |
| `around`         | `sequential` | `unit`            | `halt`                   |
| `after`          | `parallel`   | `all`             | `continue`               |
| `afterReturning` | `parallel`   | `all`             | `continue`               |
| `afterThrowing`  | `parallel`   | `all`             | `continue`               |

어드바이스별 기본값은 `buildOptions.advice[advice]`로 재정의할 수 있으며, 최종 실패 처리자는 `processOptions`에서 구성합니다:

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

## 🧩 자주 쓰는 패턴

### 유연한 래퍼 조합을 통한 캐싱

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
      // attachToTarget: 원본 타겟 함수에 직접 적용
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

### 인증

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

### 메트릭

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

### 의존성 정렬

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

### 고급 Around Advice: 유연한 래퍼 조합

v2 around advice는 최고의 유연성을 위해 두 가지 별개의 부착 지점을 제공합니다:

```ts
const AdvancedAround = createAspect<number, { log: Console }>(
  (createAdvice) => ({
    name: "advanced-around",
    around: createAdvice({
      use: ["log"],
      advice: async ({ log }, { attachToResult, attachToTarget }) => {
        // attachToTarget: 원본 타겟 함수에 적용
        // 가장 안쪽에서 실행되어 실제 타겟에 가장 가깝게 위치
        attachToTarget((target) => async () => {
          log.info("target-wrapper: before");
          const result = await target();
          log.info("target-wrapper: after");
          return result + 10;
        });

        // attachToResult: 최종 조합된 결과에 적용
        // 가장 바깥쪽에서 실행되어 전체 체인을 래핑
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

// 타겟 값 5에 대한 실행 순서:
// result-wrapper: before
// target-wrapper: before
// [원본 타겟 실행: 5]
// target-wrapper: after  → 5 + 10 = 15
// result-wrapper: after  → 15 * 2 = 30
```

#### 주요 차이점

- **`attachToTarget`**: 원본 타겟 함수를 직접 래핑합니다. 여러 타겟 래퍼는 역순으로 조합됩니다(마지막에 부착된 것이 타겟 래퍼 중 가장 바깥쪽에서 실행).
- **`attachToResult`**: 모든 타겟 래퍼가 적용된 후 전체 실행 체인을 래핑합니다. 결과 래퍼도 역순으로 조합됩니다.
- **실행 순서**: `resultWrapper(nextChain(targetWrapper(target)))`

이 설계는 다음과 같은 정교한 시나리오를 가능하게 합니다:

- 타겟 레벨에서 캐싱하면서 결과 레벨에서 메트릭 추가
- 타겟 래퍼를 통한 입력 검증/변환, 결과 래퍼를 통한 출력 포맷팅
- 다계층 에러 처리 및 재시도 로직

---

## 📚 API 레퍼런스

### Core functions

| Function                                 | Description                                   | Returns                                     |
| ---------------------------------------- | --------------------------------------------- | ------------------------------------------- |
| `createAspect<Result, Context>(helper)`  | 횡단 관심사를 선언하는 Aspect 생성            | `Aspect<Result, Context>`                   |
| `createProcess<Result, Context>(config)` | 어드바이스 체인을 실행 가능한 프로세스로 조합 | `Process<Result, Context>`                  |
| `runProcess<Result, Context>(props)`     | 컨텍스트와 타겟을 받아 프로세스 실행          | `Promise<Result \| typeof TARGET_FALLBACK>` |

### Type details (used by core functions)

- Result: 타겟 함수의 반환 타입
- Context / SharedContext: 모든 어드바이스에서 공유되는 불변 컨텍스트 객체
- `Aspect<Result, Context>`: 이름을 가진 Aspect. `before`, `around`, `afterReturning`, `afterThrowing`, `after` 중 필요한 어드바이스를 선택적으로 포함
- `AdviceMetadata<Result, Context, AdviceType, Sections>`:
  - `use`: 이 어드바이스가 접근할 컨텍스트 섹션 목록
  - `dependsOn`: 실행 순서를 위한 의존 대상 이름 목록
  - `advice`: `Restricted<Context, Sections>`로 제한된 컨텍스트를 받는 어드바이스 함수
- `AdviceFunction`, `AdviceFunctionWithContext`: 어드바이스 타입별 엄격한 시그니처
- `Target<Result>`: `() => Promise<Result>` — 조인 포인트가 되는 타겟 함수
- `TargetWrapper<Result>`: `(target: Target<Result>) => Target<Result>` — `around`에서 사용하는 래퍼
- `Process<Result, Context>`: `(context: () => Context, exit: <T>(callback: () => T) => T, target: Target<Result>) => Promise<Result | typeof TARGET_FALLBACK>`
- `BuildOptions`(어드바이스별): 실행 전략과 에러 정책 (`ExecutionStrategy`, `AggregationUnit`, `ErrorAfter`)
- `ProcessOptions<Result>`: `{ resolveHaltRejection, resolveContinuousRejection }`
- `AsyncContext<Context>`와 `Restricted<Context, Sections>`: 실행마다 새 불변 컨텍스트 제공 및 섹션 단위 접근 제한 유틸리티

---

## 🔬 심화 주제

### 섹션 잠금과 충돌

- 동일한 병렬 단계에서 같은 섹션을 동시에 사용할 수 없습니다
- 충돌 시 `dependsOn` 또는 해당 단계 `execution: 'sequential'`을 사용해 해결하세요

충돌 예시:

```ts
const process = createProcess<
  number,
  { db: { query: (s: string) => Promise<unknown> } }
>({
  aspects: [A, B],
  buildOptions: { advice: { before: { execution: "sequential" } } },
});
```

### Around 래퍼 조합 순서

- **타겟 래퍼** (`attachToTarget` 사용): 마지막에 부착된 것이 타겟 래퍼 중 가장 바깥쪽에서 실행
- **결과 래퍼** (`attachToResult` 사용): 마지막에 부착된 것이 결과 래퍼 중 가장 바깥쪽에서 실행
- **전체 순서**: `resultWrapper(nextChain(targetWrapper(target)))`

### AsyncContext 통합

Promise-AOP v2는 더 나은 컨텍스트 관리를 위해 완벽한 AsyncContext 통합을 제공합니다:

```ts
import { AsyncContext, createProcess, runProcess } from "@h1y/promise-aop";

// 방법 1: runProcess와 직접 AsyncContext 사용
const asyncContext = AsyncContext.create(() => ({
  logger: console,
  database: myDb,
}));

const result = await runProcess({
  process: myProcess,
  context: asyncContext, // AsyncContext를 직접 전달
  target: async () => "Hello World",
});

// 방법 2: 수동 AsyncContext 실행 (고급 시나리오용)
const process = createProcess({
  aspects: [
    /* ... */
  ],
});
const out = await AsyncContext.execute(asyncContext, (getCtx, exit) =>
  process(getCtx, exit, async () => 42),
);
```

#### AsyncContext의 주요 장점

- **자동 컨텍스트 전파**: 모든 비동기 작업에서 컨텍스트가 자동으로 흐름
- **타입 안전성**: 컨텍스트 추론과 함께 완전한 TypeScript 지원
- **메모리 효율성**: 컨텍스트가 실행 체인에 범위 지정됨
- **격리**: 각 실행이 고유한 컨텍스트 인스턴스를 유지

### 에러 우선순위와 빠른 종료

- `afterThrowing`이 `halt`로 에러를 던지면 타겟 에러보다 우선합니다
- `HaltError`는 내부용이며 직접 던지지 마세요. 빠른 경로가 필요하면 `around`로 처리하세요
- Fallback은 `TARGET_FALLBACK` 심볼로 표현됩니다 (null 사용 없음)

---

## 🔧 개발

```bash
yarn install
yarn test
yarn build
yarn check-types
yarn lint
```

## 🧱 호환성

- Node.js 16+ 권장 (AsyncLocalStorage 사용)
- ESM/CJS 지원 (export maps)
- Type definitions 포함 (TypeScript)

## 🤝 기여

1. 저장소를 포크합니다
2. 브랜치를 생성합니다 (`git checkout -b feature/amazing-feature`)
3. 커밋합니다 (`git commit -m 'Add some amazing feature'`)
4. 브랜치를 푸시합니다 (`git push origin feature/amazing-feature`)
5. Pull Request를 생성합니다

## 📝 License

MIT © [h1ylabs](https://github.com/h1ylabs)
