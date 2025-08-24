# @h1y/next-loader

**최신 버전: v5.0.0**

Next.js 애플리케이션을 위해 특별히 설계된 강력하고 타입 안전한 리소스 로딩 라이브러리입니다. 내장된 캐싱, 재검증, 재시도 로직, 그리고 Next.js 서버 컴포넌트와의 원활한 통합을 통해 효율적인 데이터 페칭을 구현할 수 있습니다.

[![npm version](https://badge.fury.io/js/%40h1y%2Fnext-loader.svg)](https://badge.fury.io/js/%40h1y%2Fnext-loader)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## ✨ 주요 기능

- **🎯 Next.js 네이티브**: Next.js를 위해 구축되었으며 서버 컴포넌트를 완벽하게 지원합니다
- **🔄 스마트 캐싱**: Next.js 캐시 시스템 및 재검증과 원활하게 통합됩니다
- **⚡ 리소스 빌더 패턴**: 의존성 관리가 포함된 선언적 리소스 정의
- **🛡️ 타입 안전성**: 지능적인 타입 추론을 통한 완전한 TypeScript 지원
- **🔗 계층적 태그**: 계층적 태그 시스템을 통한 고급 캐시 무효화
- **⏱️ 재시도 및 타임아웃**: 구성 가능한 재시도 및 타임아웃 전략을 통한 내장 복원력
- **🎛️ 미들웨어 지원**: 횡단 관심사를 위한 확장 가능한 미들웨어 시스템

## 📦 설치

```bash
npm install @h1y/next-loader
# 또는
yarn add @h1y/next-loader
# 또는
pnpm add @h1y/next-loader
```

## 🚀 빠른 시작

@h1y/next-loader를 3단계로 간단히 시작해보세요:

### 1. 의존성 설정 및 전역 로더 생성

```typescript
import { revalidateTag } from "next/cache";
import { cache } from "react";
import { createLoader, NextJSAdapter } from "@h1y/next-loader";

// 모듈 레벨에서 한 번 생성하여 어디서나 재사용
const { loader } = createLoader({
  adapter: NextJSAdapter,
  revalidate: revalidateTag,
  memo: cache, // 요청 중복 제거
});
```

### 2. 리소스 정의

```typescript
import { createResourceBuilder } from "@h1y/next-loader";

const User = createResourceBuilder({
  tags: (req: { id: string }) => ({ identifier: `user-${req.id}` }),
  options: { staleTime: 300000 }, // 5분 캐시
  use: [],
  load: async ({ req, fetch }) => {
    const response = await fetch(`/api/users/${req.id}`);
    if (!response.ok) throw new Error("사용자를 불러올 수 없습니다");
    return response.json();
  },
});
```

### 3. 컴포넌트에서 사용

```typescript
async function UserProfile({ params }: { params: { id: string } }) {
  const [load, revalidate] = loader(User({ id: params.id }));
  const [user] = await load();

  return (
    <div>
      <h1>{user.name}</h1>
      <p>{user.email}</p>
      <form action={revalidate}>
        <button>새로고침</button>
      </form>
    </div>
  );
}
```

이제 데이터가 자동으로 캐시되고 재검증되며 프로덕션에서 사용할 준비가 완료되었습니다.

## 🧩 핵심 개념

### 리소스 빌더 패턴

리소스는 @h1y/next-loader에게 데이터를 어떻게 페치하고, 캐시하고, 관리할지를 알려주는 선언적 정의입니다:

```typescript
const BlogPost = createResourceBuilder({
  // 캐시 태그 정의
  tags: (req: { slug: string }) => ({
    identifier: `post-${req.slug}`,
    effects: ["blog-content"], // 관련 캐시 무효화
  }),

  // 캐싱 구성
  options: { staleTime: 600000 }, // 10분 캐시

  // 의존성 선언
  use: [], // 이 리소스는 의존성이 없음

  // 데이터 로드 방법 정의
  load: async ({ req, fetch, retry }) => {
    const response = await fetch(`/api/posts/${req.slug}`);
    if (!response.ok) {
      if (response.status >= 500) retry(); // 서버 오류 시 재시도
      throw new Error("게시글을 불러올 수 없습니다");
    }
    return response.json();
  },
});
```

**주요 장점:**

- **선언적**: 어떻게가 아닌 무엇을 원하는지 정의
- **조합 가능**: 리소스끼리 의존 관계 형성 가능
- **캐시 가능**: 세밀한 제어가 가능한 자동 캐싱
- **복원력**: 내장된 재시도 및 오류 처리

### 두 가지 로딩 방식

@h1y/next-loader는 서로 다른 용도에 따라 두 가지 접근법을 제공합니다:

#### `createLoader()` - 데이터 페칭용

**언제 사용**: 서버 컴포넌트에서 데이터 로딩 (가장 일반적인 사용 사례)

```typescript
const { loader } = createLoader(dependencies);

async function UserPage() {
  const [load] = loader(User({ id: '123' }));
  const [data] = await load();
  return <div>{data.name}</div>;
}
```

**특징:**

- ✅ 캐싱을 통한 데이터 페칭에 완벽
- ❌ 컴포넌트에서 미들웨어 컨텍스트 접근 불가
- 🔧 기본값: 60초 타임아웃, 재시도 없음

#### `createComponentLoader()` - 컴포넌트 복원력용

**언제 사용**: 컴포넌트 자체에 재시도/타임아웃 동작 추가

```typescript
const { componentLoader } = createComponentLoader({
  retry: { maxCount: 3, canRetryOnError: true },
  timeout: { delay: 5000 }
});

async function RiskyComponent() {
  const data = await unreliableApiCall();
  return <div>{data}</div>;
}

export default componentLoader(RiskyComponent);
```

**특징:**

- ✅ 컴포넌트 레벨 재시도 및 타임아웃 처리
- ✅ `{name}MiddlewareOptions()`를 통한 미들웨어 컨텍스트 접근 가능
- 🔧 기본값: 무한 타임아웃, 재시도 없음

### 계층적 태그로 스마트 캐시 무효화

계층적 태그로 정밀한 제어가 가능한 캐시 무효화 전략을 구성하세요:

```typescript
import { hierarchyTag } from "@h1y/next-loader";

const UserComments = createResourceBuilder({
  tags: (req: { userId: string; postId: string }) => ({
    identifier: hierarchyTag(
      "user",
      req.userId,
      "posts",
      req.postId,
      "comments",
    ),
  }),
  // ... 기타 설정
});
```

**작동 원리:**

```typescript
// hierarchyTag('user', '123', 'posts', '456', 'comments')는 다음을 생성:
// ['user', 'user/123', 'user/123/posts', 'user/123/posts/456', 'user/123/posts/456/comments']
```

**모든 레벨에서 무효화 가능:**

```typescript
revalidateTag("user"); // 모든 사용자 데이터
revalidateTag("user/123/posts"); // 사용자 123의 모든 게시물
revalidateTag("user/123/posts/456"); // 특정 게시물
```

## 🎯 고급 예제

### 리소스 의존성

리소스를 조합하여 복잡한 데이터 흐름을 구축하세요:

```typescript
// 기본 사용자 리소스
const User = createResourceBuilder({
  tags: (req: { id: string }) => ({ identifier: `user-${req.id}` }),
  options: { staleTime: 300000 },
  use: [],
  load: async ({ req, fetch }) => {
    const response = await fetch(`/api/users/${req.id}`);
    return response.json();
  },
});

// 사용자 데이터에 의존하는 게시물
const UserPosts = createResourceBuilder({
  tags: (req: { userId: string }) => ({
    identifier: hierarchyTag('user', req.userId, 'posts'),
    effects: ['activity-feed'] // 게시물 변경 시 활동 피드 무효화
  }),
  options: { staleTime: 180000 },
  use: [User({ id: req.userId })], // 의존성 선언
  load: async ({ req, fetch, use: [user] }) => {
    const userData = await user;

    // 비활성 사용자는 로딩 생략
    if (!userData.isActive) {
      return { posts: [], reason: '사용자 비활성' };
    }

    const response = await fetch(`/api/users/${req.userId}/posts`);
    return {
      posts: await response.json(),
      author: userData.name,
    };
  },
});

// 두 리소스 사용
async function UserDashboard({ userId }: { userId: string }) {
  const [load, revalidate] = loader(
    User({ id: userId }),
    UserPosts({ userId })
  );

  const [user, posts] = await load();

  return (
    <div>
      <h1>{user.name}님의 대시보드</h1>
      <p>게시물 {posts.posts.length}개</p>
      <form action={revalidate}>
        <button>새로고침</button>
      </form>
    </div>
  );
}
```

### 오류 처리 및 복원력

```typescript
const { loader } = createLoader(dependencies, {
  retry: {
    maxCount: 3,
    canRetryOnError: (error) => error.status >= 500, // 서버 오류만 재시도
  },
  timeout: { delay: 10000 },
});

const Product = createResourceBuilder({
  tags: (req: { id: string }) => ({ identifier: `product-${req.id}` }),
  options: { staleTime: 120000 },
  use: [],
  load: async ({ req, fetch, retry, loaderOptions }) => {
    try {
      const response = await fetch(`/api/products/${req.id}`);
      if (!response.ok) {
        if (response.status >= 500) retry(); // 서버 오류 시 재시도 트리거
        throw new Error(`제품을 찾을 수 없습니다: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      const options = loaderOptions();

      // 재시도 정보와 함께 오류 상태 반환
      return {
        id: req.id,
        error: true,
        message: error.message,
        retryCount: options.retry.count,
      };
    }
  },
});
```

## 🎛️ 미들웨어 시스템

[@h1y/promise-aop](https://github.com/h1ylabs/next-loader/tree/main/packages/promise-aop) 위에 구축된 강력한 미들웨어 시스템으로 로깅, 메트릭, 모니터링 등을 로더에 추가하세요.

### 미들웨어를 사용하는 이유

**미들웨어**는 깨끗한 관심사 분리를 제공합니다:

- **단순화된 API**: 일반적인 패턴을 위한 사용하기 쉬운 인터페이스
- **타입 안전성**: 자동 컨텍스트 추론을 통한 완전한 TypeScript 지원
- **통합**: Next.js 캐싱과의 원활한 통합
- **격리**: 각 미들웨어는 자체적인 비공개 컨텍스트를 가짐

### 사용자 정의 미들웨어 생성

#### 데이터 로더용

```typescript
import { createLoaderMiddleware } from "@h1y/next-loader";

// 성능 모니터링 미들웨어
const performanceMiddleware = createLoaderMiddleware({
  name: "performance",
  contextGenerator: () => ({ startTime: 0 }),

  before: async (context) => {
    context.startTime = performance.now();
    console.log("🚀 로딩 시작");
  },

  complete: async (context, result) => {
    const duration = performance.now() - context.startTime;
    console.log(`✅ 완료 ${duration.toFixed(2)}ms`);
  },

  failure: async (context, error) => {
    const duration = performance.now() - context.startTime;
    console.error(`❌ 실패 ${duration.toFixed(2)}ms 후:`, error.message);
  },
});

// 로더에 적용
const { loader } = createLoader(dependencies, loaderConfig, [
  performanceMiddleware,
]);
```

#### 컴포넌트 로더용

```typescript
import { createComponentMiddleware } from "@h1y/next-loader";

// 메트릭 수집 미들웨어
const metricsMiddleware = createComponentMiddleware({
  name: "metrics",
  contextGenerator: () => ({ renderStart: 0, componentName: "Unknown" }),

  before: async (context) => {
    context.renderStart = Date.now();
  },

  complete: async (context) => {
    const renderTime = Date.now() - context.renderStart;
    analytics.track("component.render.success", {
      component: context.componentName,
      renderTimeMs: renderTime,
    });
  },

  failure: async (context, error) => {
    analytics.track("component.render.failure", {
      component: context.componentName,
      error: error.message,
    });
  },
});

// 컴포넌트 로더에 적용
const { componentLoader } = createComponentLoader(componentConfig, [
  metricsMiddleware,
]);
```

### 고급 미들웨어 패턴

#### 조건부 미들웨어

```typescript
const conditionalMiddleware = createLoaderMiddleware({
  name: "conditional-logging",
  contextGenerator: () => ({ shouldLog: false }),

  before: async (context) => {
    // 개발 환경이거나 디버그 플래그가 설정된 경우에만 로깅
    context.shouldLog =
      process.env.NODE_ENV === "development" || process.env.DEBUG === "true";

    if (context.shouldLog) {
      console.log("🔍 디버그 모드: 로더 시작");
    }
  },

  complete: async (context, result) => {
    if (context.shouldLog) {
      console.log("🔍 디버그 모드: 로더 결과:", result);
    }
  },
});
```

#### 오류 복구 미들웨어

```typescript
const errorRecoveryMiddleware = createLoaderMiddleware({
  name: "error-recovery",
  contextGenerator: () => ({ fallbackUsed: false }),

  failure: async (context, error) => {
    // 특정 오류 유형에 대해서만 복구 시도
    if (error instanceof NetworkError && !context.fallbackUsed) {
      context.fallbackUsed = true;
      console.warn("네트워크 오류 감지됨, 폴백 전략 시도 중");

      // 여기서 재시도를 트리거하거나 폴백 데이터를 설정할 수 있습니다
      // 이것은 단순히 실패를 로깅/모니터링하기 위한 것입니다
    }
  },
});
```

### 미들웨어 컨텍스트 격리

각 미들웨어는 서로 간섭하지 않는 완전히 격리된 컨텍스트를 유지합니다:

```typescript
const middlewareA = createLoaderMiddleware({
  name: "middleware-a",
  contextGenerator: () => ({ data: "A" }),
  complete: async (context, result) => {
    context.data = "Modified A"; // 미들웨어 A의 컨텍스트에만 영향
  },
});

const middlewareB = createLoaderMiddleware({
  name: "middleware-b",
  contextGenerator: () => ({ data: "B" }),
  complete: async (context, result) => {
    console.log(context.data); // 항상 'B'를 로그, 미들웨어 A의 영향 받지 않음
  },
});
```

### 모범 사례

1. **미들웨어 집중화**: 각 미들웨어는 하나의 특정 관심사를 처리해야 합니다
2. **무거운 계산 방지**: 미들웨어는 성능 영향을 최소화하기 위해 가벼워야 합니다
3. **오류를 우아하게 처리**: 복원력을 위해 항상 미들웨어 로직을 try-catch로 래핑하세요
4. **설명적 이름 사용**: 디버깅 및 모니터링을 더 쉽게 만듭니다
5. **컨텍스트 크기 고려**: 메모리 사용량을 줄이기 위해 컨텍스트 데이터를 최소한으로 유지하세요
6. **독립적으로 테스트**: 비즈니스 로직과 별도로 미들웨어 로직에 대한 단위 테스트를 작성하세요

## 📖 API 참조

### `createLoader(dependencies, options?, middlewares?)`

리소스를 페치하고 캐시하기 위한 전역 데이터 로더를 생성합니다.

**의존성** (필수):

```typescript
{
  adapter: NextJSAdapter,        // 데이터 페칭 통합
  revalidate: revalidateTag,     // 캐시 무효화 ('next/cache'에서 가져옴)
  memo?: cache                   // 요청 중복 제거 ('react'에서 가져옴)
}
```

**옵션** (선택):

```typescript
{
  retry: {
    maxCount: number;                              // 최대 재시도 횟수 (기본값: 0)
    canRetryOnError: boolean | ((error) => boolean); // 재시도 조건 (기본값: false)
    onRetryEach?: () => void;                      // 각 재시도마다 호출
  };
  timeout: {
    delay: number;                                 // ms 단위 타임아웃 (기본값: 60000)
    onTimeout?: () => void;                        // 타임아웃 시 호출
  };
  backoff?: {
    strategy: Backoff;                             // 재시도 간 지연 전략
    initialDelay: number;                          // 첫 재시도 지연 시간(ms)
  };
}
```

**반환값:** `{ loader }` - 로더 함수
}

````

**예제:**
```typescript
const { loader } = createLoader(
  { adapter: NextJSAdapter, revalidate: revalidateTag },
  { retry: { maxCount: 3, canRetryOnError: (error) => error.status >= 500 } }
);
````

### `createComponentLoader(options?, middlewares?)`

재시도 및 타임아웃 동작으로 서버 컴포넌트를 래핑합니다.

**옵션** (선택):

```typescript
{
  retry: {
    maxCount: number;                              // 최대 재시도 (기본값: 0)
    canRetryOnError: boolean | ((error) => boolean); // 재시도 조건
    fallback?: React.ReactElement;                 // 로딩 컴포넌트
  };
  timeout: {
    delay: number;                                 // ms 단위 타임아웃 (기본값: Infinity)
  };
  backoff?: {
    strategy: Backoff;                             // 지연 전략
    initialDelay: number;                          // 초기 지연
  };
}
```

**반환값:**

- `componentLoader`: 컴포넌트를 래핑하는 함수
- `retryComponent`: 수동 재시도 트리거
- `componentOptions`: 현재 상태 접근
  timeout: {
  delay: number; // 밀리초 단위 타임아웃 (기본값: Infinity)
  onTimeout?: () => void; // 타임아웃 발생 시 호출됨
  };
  backoff?: {
  strategy: Backoff; // 재시도 지연을 위한 백오프 전략
  initialDelay: number; // 첫 번째 재시도 전 초기 지연 시간
  };
  }

  ```

  ```

- `middlewares?`: **선택적** `createComponentMiddleware`로 생성된 컴포넌트 미들웨어 인스턴스 배열. 컴포넌트 렌더링 주변에서 생명주기 훅을 제공

**반환값:** `componentLoader`와 유틸리티 함수가 포함된 객체

```typescript
// 전역으로 컴포넌트 로더 생성
const { componentLoader, retryComponent, componentOptions, componentState } = createComponentLoader({
  retry: {
    maxCount: 2,
    canRetryOnError: true,
    fallback: <div>로딩 중...</div>
  },
  timeout: { delay: 30000 }
});

// 컴포넌트를 별도로 정의
async function UserProfile({ userId }: { userId: string }) {
  const user = await fetchUser(userId);
  return <div>안녕하세요, {user.name}님!</div>;
}

// 래핑하고 내보내기
export default componentLoader(UserProfile);
```

### `createResourceBuilder(config)`

데이터를 페치하고, 캐시하고, 관리하는 방법을 정의하는 리소스 팩토리를 생성합니다.

**매개변수:**

- `config`: **필수** 리소스 빌더 구성 객체:

  ```typescript
  {
    tags: (req: Request) => {                        // 캐시 태그 생성 함수
      identifier: string;                            // 이 리소스의 기본 캐시 태그
      effects?: string[];                            // 이 리소스가 변경될 때 무효화할 추가 태그
    };

    options: {
      staleTime: number;                             // 밀리초 단위 캐시 지속 시간
      revalidate?: boolean | number;                 // Next.js 재검증 설정
    };

    use: ResourceBuilder[];                          // 먼저 로드해야 하는 의존 리소스 배열

    load: (context: {                                // 데이터 페칭 함수
      req: Request;                                  // 리소스에 전달된 요청 매개변수
      fetch: typeof fetch;                           // Next.js 캐시 통합이 포함된 향상된 fetch 함수
      use: Promise<Dependency>[];                    // 'use' 배열에서 해결된 의존성
      retry: () => never;                            // 수동 재시도 트리거 (RetrySignal 던짐)
      loaderOptions: () => LoaderOptions;            // 현재 재시도/타임아웃 상태에 대한 접근
    }) => Promise<Result>;
  }
  ```

```typescript
const UserPosts = createResourceBuilder({
  tags: (req: { userId: string }) => ({
    identifier: hierarchyTag("user", req.userId, "posts"),
  }),
  options: { staleTime: 180000 }, // 3분
  use: [User({ id: req.userId })], // User 리소스에 의존
  load: async ({ req, fetch, use: [user] }) => {
    // 의존성을 구조분해하고 기다림
    const userData = await user;

    // 사용자가 활성 상태일 때만 게시물 페치
    if (!userData.isActive) {
      return { posts: [], reason: "사용자가 비활성 상태입니다" };
    }

    const response = await fetch(`/api/users/${req.userId}/posts`);
    const posts = await response.json();

    return {
      posts,
      userInfo: {
        name: userData.name,
        memberSince: userData.createdAt,
      },
    };
  },
});
```

### `hierarchyTag(...tags)`

세밀한 무효화 전략을 위한 계층적 캐시 태그를 생성합니다.

**매개변수:**

- `...tags`: **필수** 계층 경로를 형성하는 가변 개수의 문자열 인수

**반환값:** `string[]` - 가장 일반적인 것부터 가장 구체적인 것까지의 계층적 캐시 태그 배열

**동작:**

- 각 레벨을 `/`로 연결하여 누적 태그를 생성합니다
- 계층의 모든 레벨에서 무효화를 활성화합니다
- 각 레벨에는 모든 상위 레벨이 포함됩니다

```typescript
// 생성: ['api', 'api/v1', 'api/v1/users', 'api/v1/users/123']
const tags = hierarchyTag("api", "v1", "users", "123");

// 리소스 빌더에서 사용
const UserProfile = createResourceBuilder({
  tags: (req: { userId: string }) => ({
    identifier: hierarchyTag("user", req.userId, "profile")[3], // 가장 구체적: 'user/123/profile'
    effects: hierarchyTag("user", req.userId), // 모든 레벨: ['user', 'user/123']
  }),
  // ... 나머지 구성
});

// 무효화 예제:
revalidateTag("user"); // 모든 사용자 관련 데이터 무효화
revalidateTag("user/123"); // 사용자 123의 모든 데이터 무효화
revalidateTag("user/123/profile"); // 사용자 123의 프로필만 무효화
```

### 백오프 전략

백오프 전략은 재시도 시도 간의 지연을 제어합니다. 모든 전략은 `@h1y/loader-core`에서 가져옵니다.

```typescript
import {
  FIXED_BACKOFF,
  LINEAR_BACKOFF,
  EXPONENTIAL_BACKOFF,
} from "@h1y/next-loader"; // loader-core에서 재내보냄
```

**사용 가능한 전략:**

| 전략     | 함수                              | 설명                            | 예제 지연 시간         |
| -------- | --------------------------------- | ------------------------------- | ---------------------- |
| **고정** | `FIXED_BACKOFF`                   | 모든 재시도 간 동일한 지연 시간 | 1000ms, 1000ms, 1000ms |
| **선형** | `LINEAR_BACKOFF(increment)`       | 지연 시간이 선형적으로 증가     | 1000ms, 2000ms, 3000ms |
| **지수** | `EXPONENTIAL_BACKOFF(multiplier)` | 지연 시간이 지수적으로 증가     | 1000ms, 2000ms, 4000ms |

**사용 예제:**

```typescript
// 고정 지연: 재시도 간 항상 2초 대기
const { loader } = createLoader(dependencies, {
  retry: { maxCount: 3, canRetryOnError: true },
  backoff: {
    strategy: FIXED_BACKOFF,
    initialDelay: 2000 // 2초
  }
});

// 선형 백오프: 1초, 3초, 5초 지연
const { loader } = createLoader(dependencies, {
  retry: { maxCount: 3, canRetryOnError: true },
  backoff: {
    strategy: LINEAR_BACKOFF(2000), // 각 재시도마다 2초 추가
    initialDelay: 1000 // 1초로 시작
  }
});

// 지수 백오프: 500ms, 1초, 2초, 4초 지연
const { loader } = createLoader(dependencies, {
  retry: { maxCount: 4, canRetryOnError: true },
  backoff: {
    strategy: EXPONENTIAL_BACKOFF(2), // 각 재시도마다 지연 시간 2배
    initialDelay: 500 // 500ms로 시작
  }
});

// 지수 백오프를 사용하는 컴포넌트 로더
const { componentLoader } = createComponentLoader({
  retry: {
    maxCount: 3,
    canRetryOnError: true,
    fallback: <div>재시도 중...</div>
  },
  backoff: {
    strategy: EXPONENTIAL_BACKOFF(1.5), // 각 재시도마다 1.5배로 곱함
    initialDelay: 1000
  }
});
```

**백오프 모범 사례:**

1. **API 호출**: 지수 백오프를 사용하여 중단 시 서버 부하를 줄입니다
2. **데이터베이스 작업**: 예측 가능한 재시도 간격을 위해 선형 백오프를 사용합니다
3. **빠른 작업**: 일관된 사용자 경험을 위해 고정 백오프를 사용합니다
4. **속도 제한 API**: 더 긴 초기 지연을 가진 지수 백오프를 사용합니다

### 미들웨어 생성 함수

#### `createLoaderMiddleware(config)`

데이터 페칭 작업 주변의 생명주기 훅을 가진 데이터 로더용 미들웨어를 생성합니다.

**매개변수:**

- `config`: **필수** 미들웨어 구성 객체:
  ```typescript
  {
    name: string;                                    // 고유 미들웨어 식별자
    contextGenerator: () => Context;                 // 미들웨어 컨텍스트용 팩토리 함수
    before?: (context: Context) => Promise<void>;   // 로더 실행 전 호출
    complete?: (context: Context, result: Result) => Promise<void>; // 성공적인 실행 후 호출
    failure?: (context: Context, error: unknown) => Promise<void>;  // 로더 실패 시 호출
    cleanup?: (context: Context) => Promise<void>;  // 정리를 위해 항상 호출
  }
  ```

**반환값:** `createLoader`와 함께 사용할 미들웨어 인스턴스

#### `createComponentMiddleware(config)`

컴포넌트 렌더링 주변의 생명주기 훅을 가진 컴포넌트 로더용 미들웨어를 생성합니다.

**매개변수:**

- `config`: **필수** 미들웨어 구성 객체:
  ```typescript
  {
    name: string;                                    // 고유 미들웨어 식별자
    contextGenerator: () => Context;                 // 미들웨어 컨텍스트용 팩토리 함수
    before?: (context: Context) => Promise<void>;   // 컴포넌트 렌더링 전 호출
    complete?: (context: Context, result: React.ReactElement) => Promise<void>; // 성공적인 렌더링 후 호출
    failure?: (context: Context, error: unknown) => Promise<void>;              // 컴포넌트 실패 시 호출
    cleanup?: (context: Context) => Promise<void>;  // 정리를 위해 항상 호출
  }
  ```

**반환값:** `createComponentLoader`와 함께 사용할 미들웨어 인스턴스

**미들웨어 생명주기:**

1. `contextGenerator()` - 이 미들웨어 인스턴스를 위한 격리된 컨텍스트 생성
2. `before(context)` - 설정, 검증, 준비
3. **대상 실행** (로더 또는 컴포넌트)
4. `complete(context, result)` **또는** `failure(context, error)` - 결과 처리
5. `cleanup(context)` - 리소스 정리를 위해 항상 실행

## 🔄 Next.js 통합 및 캐싱 동작

### ISR 및 캐시 동작 이해하기

**중요**: Next.js 캐싱 메커니즘으로 인해 재시도 프로세스가 사용자에게 보이지 않을 수 있습니다.

Next.js는 `stale-while-revalidate`와 유사한 ISR(Incremental Static Regeneration) 접근 방식을 사용합니다:

1. **캐시가 없는 경우**: 요청이 렌더링을 트리거한 다음 결과를 캐시합니다
2. **캐시가 있는 경우**: 캐시된 콘텐츠를 즉시 반환합니다
3. **재검증이 트리거된 경우**:
   - **현재 요청**은 오래된 캐시된 콘텐츠를 받습니다
   - **백그라운드**에서 새로운 렌더링을 수행합니다
   - **다음 요청**은 렌더링이 성공한 경우 새로운 콘텐츠를 받습니다
   - **렌더링 실패**는 오래된 캐시를 유지하고 다음 요청에서 재시도합니다

이는 사용자가 캐시된 결과를 받기 때문에 재시도 프로세스를 보지 못할 수 있음을 의미합니다.

### 언제 사용자가 재시도를 볼 것인가?

다음 시나리오에서 재시도가 보이게 됩니다:

- **동적 렌더링**: `force-dynamic` 사용 또는 `headers()`, `cookies()`와 같은 함수 사용
- **새로운 요청**: 캐시가 아직 존재하지 않음
- **캐시 누락**: 캐시가 만료되었고 오래된 콘텐츠가 사용 불가능함

```typescript
// 예제: 재시도가 보이는 동적 렌더링
import { headers } from 'next/headers';

// 재시도 구성을 가진 전역 로더
const { loader } = createLoader(dependencies, {
  retry: { maxCount: 3, canRetryOnError: true }, // 사용자가 이 재시도들을 볼 것입니다
  timeout: { delay: 5000 }
});

async function DynamicUserPage({ id }: { id: string }) {
  const headersList = await headers();
  const userAgent = headersList.get('user-agent'); // 동적 렌더링 강제

  const [load] = loader(User({ id }));
  const [userData] = await load();

  return <div>안녕하세요 {userData.name}님! (UA: {userAgent})</div>;
}
```

## 🎯 고급 예제

### 복잡한 리소스 의존성

```typescript
// 전역 로더 인스턴스
const { loader } = createLoader(dependencies);

// 사용자 리소스
const User = createResourceBuilder({
  tags: (req: { id: string }) => ({ identifier: `user-${req.id}` }),
  options: { staleTime: 300000 },
  use: [],
  load: async ({ req, fetch }) => {
    const response = await fetch(`/api/users/${req.id}`);
    return response.json();
  },
});

// 사용자 의존성과 계층적 태그를 가진 게시물
const UserPosts = createResourceBuilder({
  tags: (req: { userId: string }) => ({
    identifier: hierarchyTag('user', req.userId, 'posts'),
    effects: ['activity-feed']
  }),
  options: { staleTime: 180000 },
  use: [User({ id: req.userId })],
  load: async ({ req, fetch, use: [user], retry }) => {
    const userData = await user;

    if (!userData.isActive) {
      retry(); // 사용자가 비활성 상태면 재시도
    }

    const response = await fetch(`/api/users/${req.userId}/posts`);
    const posts = await response.json();

    return {
      posts,
      author: userData.name,
      totalPosts: posts.length
    };
  },
});

// 서버 컴포넌트에서 사용
async function UserDashboard({ userId }: { userId: string }) {
  const [load, revalidate] = loader(
    User({ id: userId }),
    UserPosts({ userId })
  );

  const [userData, postsData] = await load();

  return (
    <div>
      <h1>{userData.name}님의 대시보드</h1>
      <p>{postsData.author}님의 게시물 {postsData.totalPosts}개</p>
      <form action={revalidate}>
        <button>새로고침</button>
      </form>
    </div>
  );
}
```

### 오류 처리 및 폴백

```typescript
// 스마트 오류 처리를 가진 전역 로더
const { loader } = createLoader(dependencies, {
  retry: {
    maxCount: 3,
    canRetryOnError: (error) => error.status >= 500
  },
  timeout: { delay: 10000 }
});

// 여러 폴백 전략을 가진 제품 리소스
const Product = createResourceBuilder({
  tags: (req: { id: string }) => ({
    identifier: `product-${req.id}`,
    effects: ['inventory']
  }),
  options: { staleTime: 120000 },
  use: [],
  load: async ({ req, fetch, retry, loaderOptions }) => {
    const options = loaderOptions();

    try {
      const response = await fetch(`/api/products/${req.id}`);
      if (!response.ok) {
        if (response.status >= 500) retry();
        throw new Error(`API 오류: ${response.status}`);
      }

      const product = await response.json();

      // 실시간 재고를 가져오려고 시도, 캐시된 것으로 폴백
      let stock;
      try {
        const invResponse = await fetch(`/api/inventory/${req.id}`);
        stock = invResponse.ok ? await invResponse.json() : product.cachedStock;
      } catch {
        stock = product.cachedStock;
      }

      return {
        ...product,
        stock,
        available: stock > 0,
        retries: options.retry.count
      };

    } catch (error) {
      // 재시도 정보와 함께 오류 상태 반환
      return {
        id: req.id,
        error: true,
        message: error.message,
        retries: options.retry.count,
        stock: 0,
        available: false
      };
    }
  },
});

// 오류 처리와 함께 사용
async function ProductPage({ id }: { id: string }) {
  const [load, revalidate] = loader(Product({ id }));
  const [product] = await load();

  if (product.error) {
    return (
      <div>
        <h1>제품을 사용할 수 없습니다</h1>
        <p>{product.message}</p>
        <p>{product.retries}번 재시도했습니다</p>
        <form action={revalidate}>
          <button>다시 시도</button>
        </form>
      </div>
    );
  }

  return (
    <div>
      <h1>{product.name}</h1>
      <p>{product.price}원</p>
      <p>{product.available ? `재고 ${product.stock}개` : '품절'}</p>
      {product.retries > 0 && <small>{product.retries}번 재시도 후 로드됨</small>}
    </div>
  );
}
```

### 컴포넌트 레벨 복원력

```typescript
import { createComponentLoader, middleware } from '@h1y/next-loader';

// 성능 모니터링 미들웨어
const perfMiddleware = middleware<React.ReactElement>().withOptions({
  name: 'perf',
  contextGenerator: () => ({ startTime: 0 }),
  before: async (context) => {
    context.startTime = Date.now();
  },
  complete: async (context) => {
    console.log(`${Date.now() - context.startTime}ms에 렌더링됨`);
  },
});

// 미들웨어와 폴백을 가진 컴포넌트 로더 생성
const { componentLoader, retryComponent, componentOptions } = createComponentLoader({
  retry: {
    maxCount: 3,
    canRetryOnError: (error) => error.status >= 500,
    fallback: <div>대시보드 로딩 중...</div>
  },
  timeout: { delay: 10000 }
}, [perfMiddleware]);

// 수동 재시도 로직을 가진 대시보드 컴포넌트
async function UserDashboard({ userId }: { userId: string }) {
  const options = componentOptions();

  try {
    const [profile, notifications] = await Promise.all([
      fetch(`/api/users/${userId}/profile`).then(r => r.json()),
      fetch(`/api/users/${userId}/notifications`).then(r => r.json())
    ]);

    // 데이터가 오래되었으면 재시도 트리거
    if (!profile.isActive && options.retry.count === 0) {
      retryComponent();
    }

    return (
      <div>
        <h1>환영합니다, {profile.name}님!</h1>
        <div>
          <p>{notifications.length}개의 알림</p>
          {options.retry.count > 0 && (
            <small>{options.retry.count}번 재시도 후 로드됨</small>
          )}
        </div>
      </div>
    );

  } catch (error) {
    return (
      <div>
        <h2>대시보드 오류</h2>
        <p>{error.message}</p>
        <p>{options.retry.count}번 재시도했습니다</p>
      </div>
    );
  }
}

// 래핑된 컴포넌트 내보내기
export default componentLoader(UserDashboard);
```

## ⚠️ 중요한 고려사항 및 주의사항

### 미들웨어 컨텍스트 접근

- **`createLoader()`**: 미들웨어 컨텍스트가 서버 컴포넌트에서 **접근 불가**
- **`createComponentLoader()`**: 미들웨어 컨텍스트가 `createComponentLoader`에서 반환되는 `{name}MiddlewareOptions()` 함수를 사용하여 래핑된 컴포넌트에서 **접근 가능**

### 컨텍스트 전파 제한

- **폴백 요소**: 메인 컴포넌트와 컨텍스트를 공유하지 않음
- **자식 컴포넌트**: 컨텍스트가 자식 컴포넌트로 전파되지 않음
- **격리된 실행**: 각 재시도는 새로운 실행 컨텍스트를 생성

### 재시도/타임아웃 재설정

재시도와 타임아웃을 프로그래밍 방식으로 재설정할 수 있지만, 예측 불가능한 동작을 유발할 수 있어 **권장하지 않습니다**:

```typescript
// ❌ 권장하지 않음
const [load] = loader(SomeResource({ id: "123" }));
await load();

// 재설정 (권장하지 않음)
loaderOptions().retry.resetRetryCount();
loaderOptions().timeout.resetTimeout();
```

## 🤔 자주 묻는 질문

### Q: Next.js 앱에서 재시도 시도가 왜 보이지 않나요?

**A:** 이는 Next.js 캐싱 동작 때문입니다. 콘텐츠가 캐시되면 사용자는 재검증이 백그라운드에서 일어나는 동안 캐시된 버전을 즉시 받습니다. 재시도는 다음과 같은 경우에만 보입니다:

- 동적 렌더링 (`force-dynamic` 사용 또는 동적 함수 사용)
- 캐시가 없는 새로운 요청
- 캐시 누락 또는 만료된 콘텐츠

### Q: 재시도 프로세스를 사용자에게 어떻게 보이게 할 수 있나요?

**A:** 동적 렌더링 패턴을 사용하세요:

```typescript
import { headers } from 'next/headers';

// 전역 로더 인스턴스
const { loader } = createLoader(dependencies, {
  retry: { maxCount: 3, canRetryOnError: true }
});

async function DynamicComponent() {
  await headers(); // 동적 렌더링 강제

  const [load] = loader(SomeResource({ id: '123' }));
  const [data] = await load();
  // 이제 재시도가 사용자에게 보일 것입니다

  return <div>{data.content}</div>;
}
```

또는 PPR을 사용하여 동적 렌더링을 특정 섹션으로 제한하세요.

### Q: 태그에서 `identifier`와 `effects`의 차이점은 무엇인가요?

**A:**

- `identifier`: 이 특정 리소스의 기본 캐시 태그
- `effects`: 이 리소스가 변경될 때 무효화되어야 하는 추가 태그

```typescript
tags: (req) => ({
  identifier: `user-${req.id}`, // 이 사용자에 특정됨
  effects: ["user-list", "activity-feed"], // 무효화할 관련 캐시
});
```

### Q: 동일한 태그를 가진 여러 리소스 빌더를 사용할 수 있나요?

**A:** 네, 하지만 캐시 충돌에 주의하세요. 계층적 태그를 사용하여 관련 리소스를 정리하세요:

```typescript
const UserProfile = createResourceBuilder({
  tags: (req: { id: string }) => ({
    identifier: hierarchyTag("user", req.id, "profile"),
  }),
  options: { staleTime: 300000 },
  use: [],
  load: async ({ req, fetch }) => {
    const response = await fetch(`/api/users/${req.id}/profile`);
    return response.json();
  },
});

const UserSettings = createResourceBuilder({
  tags: (req: { id: string }) => ({
    identifier: hierarchyTag("user", req.id, "settings"),
  }),
  options: { staleTime: 180000 },
  use: [],
  load: async ({ req, fetch }) => {
    const response = await fetch(`/api/users/${req.id}/settings`);
    return response.json();
  },
});
```

### Q: 많은 리소스로 성능을 어떻게 최적화하나요?

**A:**

1. 데이터 신선도 요구사항에 따라 **적절한 staleTime** 값 사용
2. 효율적인 무효화를 위해 **계층적 태그** 활용
3. 단일 로더 호출에서 **관련 리소스 일괄 처리**
4. 동적 렌더링 범위를 제한하기 위해 **PPR** 고려

### Q: componentLoader vs loader를 언제 사용해야 하나요?

**A:**

- 캐싱을 통한 데이터 페칭에는 **`createLoader()` 사용** (가장 일반적인 사용 사례). **항상 로더 인스턴스를 전역으로 생성**하고 컴포넌트 간에 재사용하세요.
- 컴포넌트 레벨 재시도 동작이나 컴포넌트 내에서 미들웨어 컨텍스트에 대한 접근이 필요할 때 **`createComponentLoader()` 사용**

## 🙏 관련 패키지

이 라이브러리는 @h1y 생태계의 다른 패키지들 위에 구축되었습니다:

- [@h1y/loader-core](https://github.com/h1ylabs/next-loader/tree/main/packages/loader-core) - 재시도/타임아웃을 가진 핵심 로딩 기능
- [@h1y/promise-aop](https://github.com/h1ylabs/next-loader/tree/main/packages/promise-aop) - Promise 기반 AOP 프레임워크
- [@h1y/loader-tag](https://github.com/h1ylabs/next-loader/tree/main/packages/loader-tag) - 타입 안전 태깅 유틸리티

## 📄 라이선스

MIT © [h1ylabs](https://github.com/h1ylabs)
