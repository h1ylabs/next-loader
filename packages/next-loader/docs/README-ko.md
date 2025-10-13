# @h1y/next-loader

**최신 버전: v0.6.1**

Next.js 애플리케이션을 위한 강력하고 타입 안전한 리소스 로딩 라이브러리입니다. 내장된 캐싱, 배치 로딩, 재시도 로직, 그리고 Next.js App Router와의 원활한 통합을 통해 효율적인 데이터 페칭을 구현할 수 있습니다.

[![npm version](https://badge.fury.io/js/%40h1y%2Fnext-loader.svg)](https://badge.fury.io/js/%40h1y%2Fnext-loader)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

[English Documentation](https://github.com/h1ylabs/next-loader/tree/main/packages/next-loader/README.md)

---

## 왜 next-loader인가?

**문제점**: 전통적인 Next.js 데이터 페칭은 반복적인 보일러플레이트, 수동 캐시 관리, 그리고 실패한 요청에 대한 내장 복원력이 부족합니다.

**해결책**: next-loader는 캐싱, 배치 로딩, 재시도 로직, 캐시 무효화를 자동으로 처리하는 선언적 리소스 시스템을 제공합니다 - 모두 완전한 TypeScript 지원과 함께.

```typescript
// 이전: 보일러플레이트가 많은 수동 fetch
async function UserPage({ userId }) {
  const response = await fetch(`/api/users/${userId}`, {
    next: {
      revalidate: 300,
      tags: ["user", `user-${userId}`, `user-${userId}-profile`],
    },
  });
  const user = await response.json();
  // 수동 에러 처리, 재시도 없음, 장황함...
}

// 이후: 선언적 리소스 로딩
const User = resourceFactory({
  tags: (req) => ({ id: hierarchyTag("user", req.userId, "profile") }),
  options: { staleTime: 300 }, // 5분
  load: async ({ req, fetcher }) => {
    const response = await fetcher(NextJSAdapter).load(
      `/api/users/${req.userId}`,
    );
    return response.json();
  },
});

async function UserPage({ userId }) {
  const [load, revalidation] = loader(User({ userId }));
  const [user] = await load(); // 캐시됨, 재시도 가능, 타입 안전
}
```

**주요 이점**:

- ✅ 자동 캐싱 및 요청 중복 제거
- ✅ 여러 리소스를 병렬로 배치 로딩
- ✅ 내장된 재시도 및 타임아웃 전략
- ✅ 계층적 캐시 무효화
- ✅ 완전한 TypeScript 타입 추론
- ✅ 시작하는 데 설정이 필요 없음

---

## 📦 설치

```bash
npm install @h1y/next-loader
# 또는
yarn add @h1y/next-loader
# 또는
pnpm add @h1y/next-loader
```

**요구 사항**:

- React ≥18.3.0
- Next.js ≥14.0.0 (App Router)
- Node.js ≥18.0.0

---

## 🚀 빠른 시작

### 1단계: 로더 생성

```typescript
import { cache } from "react";
import { loaderFactory } from "@h1y/next-loader";

// 모듈 레벨에서 한 번 생성하여 어디서나 재사용
export const loader = loaderFactory({
  memo: cache, // React의 내장 요청 중복 제거
});
```

### 2단계: 리소스 정의

```typescript
import { resourceFactory, NextJSAdapter } from "@h1y/next-loader";

interface User {
  id: string;
  name: string;
  email: string;
}

const User = resourceFactory({
  tags: (req: { userId: string }) => ({ id: `user-${req.userId}` }),
  options: { staleTime: 300 }, // 5분
  load: async ({ req, fetcher }) => {
    const response = await fetcher(NextJSAdapter).load(
      `/api/users/${req.userId}`,
    );
    if (!response.ok) throw new Error("사용자 정보를 가져올 수 없습니다");
    return response.json() as User;
  },
});
```

### 3단계: 컴포넌트에서 사용

```typescript
import { revalidateTag } from "next/cache";

async function UserProfile({ userId }: { userId: string }) {
  const [load, revalidation] = loader(User({ userId }));
  const [user] = await load();

  return (
    <div>
      <h1>{user.name}</h1>
      <p>{user.email}</p>

      <form action={async () => {
        "use server";
        revalidation.forEach(revalidateTag);
      }}>
        <button>프로필 새로고침</button>
      </form>
    </div>
  );
}
```

이제 데이터가 캐시되고, 중복이 제거되며, 프로덕션에서 사용할 준비가 완료되었습니다.

---

## ✨ 핵심 기능

| 기능                   | 설명                                                            |
| ---------------------- | --------------------------------------------------------------- |
| **배치 로딩**          | `loader(Resource1, Resource2, ...)`로 여러 리소스를 병렬로 로드 |
| **스마트 캐싱**        | Next.js 캐시 및 ISR과 자동 통합                                 |
| **타입 안전성**        | 요청, 응답, 배치 결과에 대한 완전한 TypeScript 추론             |
| **재시도 및 타임아웃** | 구성 가능한 전략을 통한 내장 복원력                             |
| **캐시 무효화**        | 정밀한 캐시 제어를 위한 계층적 태그 시스템                      |
| **요청 중복 제거**     | React의 `cache()`를 사용하여 중복 요청 방지                     |
| **컴포넌트 복원력**    | UI 레벨 재시도를 위한 선택적 `componentLoaderFactory`           |

---

## 📖 기본 사용법

### 단일 리소스 로딩

```typescript
const Product = resourceFactory({
  tags: (req: { id: string }) => ({ id: `product-${req.id}` }),
  options: { staleTime: 600 }, // 10분
  load: async ({ req, fetcher }) => {
    const response = await fetcher(NextJSAdapter).load(`/api/products/${req.id}`);
    return response.json();
  },
});

async function ProductPage({ id }: { id: string }) {
  const [load, revalidation] = loader(Product({ id }));
  const [product] = await load();

  return <div>{product.name}: ${product.price}</div>;
}
```

### 배치 로딩 (가장 일반적인 사용 사례)

완전한 타입 안전성으로 여러 리소스를 동시에 로드:

```typescript
const User = resourceFactory({
  tags: (req: { userId: string }) => ({ id: `user-${req.userId}` }),
  options: { staleTime: 300 }, // 5분
  load: async ({ req, fetcher }) => {
    const response = await fetcher(NextJSAdapter).load(`/api/users/${req.userId}`);
    return response.json();
  },
});

const UserPosts = resourceFactory({
  tags: (req: { userId: string }) => ({ id: `user-posts-${req.userId}` }),
  options: { staleTime: 120 }, // 2분
  load: async ({ req, fetcher }) => {
    const response = await fetcher(NextJSAdapter).load(`/api/users/${req.userId}/posts`);
    return response.json();
  },
});

async function UserDashboard({ userId }: { userId: string }) {
  // 두 리소스를 병렬로 로드
  const [load, revalidation] = loader(
    User({ userId }),
    UserPosts({ userId })
  );

  // TypeScript가 정확한 타입을 알고 있음: [User, Post[]]
  const [user, posts] = await load();

  return (
    <div>
      <h1>{user.name}</h1>
      <p>{posts.length}개의 게시글</p>

      <form action={async () => {
        "use server";
        revalidation.forEach(revalidateTag); // 모든 리소스 새로고침
      }}>
        <button>새로고침</button>
      </form>
    </div>
  );
}
```

### 캐시 재검증

```typescript
import { revalidateTag } from "next/cache";

async function DataPage({ id }: { id: string }) {
  const [load, revalidation] = loader(MyResource({ id }));
  const [data] = await load();

  return (
    <div>
      <div>{data.content}</div>

      <form action={async () => {
        "use server";
        // 이 리소스와 연결된 모든 태그 재검증
        revalidation.forEach(revalidateTag);
      }}>
        <button>데이터 새로고침</button>
      </form>
    </div>
  );
}
```

---

## 🧩 핵심 개념

### Resource Factory

리소스는 "스스로를 캐시하는 방법을 아는 스마트 API 호출"입니다:

```typescript
const MyResource = resourceFactory({
  // 이 리소스를 위한 캐시 태그
  tags: (req) => ({ id: `my-resource-${req.id}` }),

  // 선택사항: 캐시 지속 시간 (초 단위)
  options: { staleTime: 300 }, // 5분

  // 로드 함수
  load: async ({ req, fetcher }) => {
    const response = await fetcher(NextJSAdapter).load(`/api/data/${req.id}`);
    return response.json();
  },
});
```

### Loader Factory

로더를 한 번 생성하여 어디서나 재사용:

```typescript
import { cache } from "react";
import { loaderFactory } from "@h1y/next-loader";

// 중복 제거를 위한 React의 cache()를 사용하는 전역 로더
export const loader = loaderFactory({
  memo: cache,
});

// 선택사항: 재시도 및 타임아웃 구성
export const resilientLoader = loaderFactory(
  { memo: cache },
  {
    retry: { maxCount: 3, canRetryOnError: true },
    timeout: { delay: 10000 },
  },
);
```

### 계층적 태그

유연한 무효화를 위한 캐시 계층 구조 생성:

```typescript
import { hierarchyTag } from "@h1y/next-loader";

const UserPosts = resourceFactory({
  tags: (req: { userId: string }) => ({
    // 생성: ["user", "user/123", "user/123/posts"]
    id: hierarchyTag("user", req.userId, "posts"),
  }),
  load: async ({ req, fetcher }) => {
    const response = await fetcher(NextJSAdapter).load(
      `/api/users/${req.userId}/posts`,
    );
    return response.json();
  },
});

// 재검증하면 모든 계층 레벨이 무효화됨
const [load, revalidation] = loader(UserPosts({ userId: "123" }));
// revalidation = ["user", "user/123", "user/123/posts"]
```

**이점**:

- 특정 사용자의 게시글만 무효화: `user/123/posts`
- 사용자의 모든 데이터 무효화: `user/123`
- 모든 사용자 관련 데이터 무효화: `user`

---

## 🎯 실전 예제

### 배치 로딩을 사용한 팀 대시보드

```typescript
const TeamInfo = resourceFactory({
  tags: (req: { teamId: string }) => ({ id: `team-${req.teamId}` }),
  options: { staleTime: 300 }, // 5분
  load: async ({ req, fetcher }) => {
    const response = await fetcher(NextJSAdapter).load(`/api/teams/${req.teamId}`);
    return response.json();
  },
});

const TeamProjects = resourceFactory({
  tags: (req: { teamId: string }) => ({ id: `team-projects-${req.teamId}` }),
  options: { staleTime: 120 }, // 2분
  load: async ({ req, fetcher }) => {
    const response = await fetcher(NextJSAdapter).load(`/api/teams/${req.teamId}/projects`);
    return response.json();
  },
});

const TeamMembers = resourceFactory({
  tags: (req: { teamId: string }) => ({ id: `team-members-${req.teamId}` }),
  options: { staleTime: 300 }, // 5분
  load: async ({ req, fetcher }) => {
    const response = await fetcher(NextJSAdapter).load(`/api/teams/${req.teamId}/members`);
    return response.json();
  },
});

async function TeamDashboard({ teamId }: { teamId: string }) {
  // 모든 데이터를 병렬로 로드
  const [load, revalidation] = loader(
    TeamInfo({ teamId }),
    TeamProjects({ teamId }),
    TeamMembers({ teamId })
  );

  const [team, projects, members] = await load();

  const activeProjects = projects.filter(p => p.status === 'active');

  return (
    <div className="dashboard">
      <header>
        <h1>{team.name}</h1>
        <p>{members.length}명 • {activeProjects.length}개 활성 프로젝트</p>
      </header>

      <section className="projects">
        <h2>활성 프로젝트</h2>
        {activeProjects.map(project => (
          <div key={project.id}>
            <h3>{project.name}</h3>
            <p>{project.completionPercentage}% 완료</p>
          </div>
        ))}
      </section>

      <section className="members">
        <h2>팀 멤버</h2>
        {members.map(member => (
          <div key={member.id}>{member.name} - {member.role}</div>
        ))}
      </section>

      <form action={async () => {
        "use server";
        revalidation.forEach(revalidateTag);
      }}>
        <button>대시보드 새로고침</button>
      </form>
    </div>
  );
}
```

### 콜백을 사용한 모니터링

콜백 함수를 사용하여 재시도 시도 및 타임아웃을 추적:

```typescript
const monitoredLoader = loaderFactory(
  { memo: cache },
  {
    retry: {
      maxCount: 3,
      canRetryOnError: (error) => error.status >= 500,
      onRetryEach: () => {
        console.log('요청 재시도 중...');
        // 모니터링 서비스에 메트릭 전송
      },
      onRetryExceeded: () => {
        console.error('모든 재시도 시도가 소진됨');
        // 운영 팀에 알림
      },
    },
    timeout: {
      delay: 5000,
      onTimeout: () => {
        console.warn('요청 타임아웃 - 네트워크가 느릴 수 있음');
        // 느린 네트워크 문제 추적
      },
    },
  }
);

const SlowAPI = resourceFactory({
  tags: () => ({ id: 'slow-api' }),
  load: async ({ fetcher }) => {
    const response = await fetcher(NextJSAdapter).load('/api/slow-endpoint');
    if (!response.ok) throw { status: response.status };
    return response.json();
  },
});

async function MonitoredPage() {
  const [load] = monitoredLoader(SlowAPI({}));
  const [data] = await load(); // 재시도/타임아웃 시 콜백 실행
  return <div>{data.content}</div>;
}
```

### Fallback을 사용한 우아한 성능 저하

모든 재시도가 실패할 때 fallback 데이터 제공:

```typescript
const resilientLoader = loaderFactory(
  { memo: cache },
  {
    retry: {
      maxCount: 3,
      canRetryOnError: true,
      fallback: () => async () => ({
        // 모든 재시도 소진 시 fallback 데이터
        items: [],
        cached: true,
        message: '캐시된 데이터를 표시합니다'
      }),
    },
    timeout: { delay: 5000 },
  }
);

const UserFeed = resourceFactory({
  tags: (req: { userId: string }) => ({ id: `feed-${req.userId}` }),
  load: async ({ req, fetcher }) => {
    const response = await fetcher(NextJSAdapter).load(`/api/users/${req.userId}/feed`);
    if (!response.ok) throw new Error('피드를 사용할 수 없습니다');
    return response.json();
  },
});

async function FeedPage({ userId }: { userId: string }) {
  const [load] = resilientLoader(UserFeed({ userId }));
  const [feed] = await load(); // API 실패 시 빈 피드로 대체

  return (
    <div>
      {feed.cached && <p>⚠️ {feed.message}</p>}
      {feed.items.map(item => <div key={item.id}>{item.content}</div>)}
    </div>
  );
}
```

### 리소스 의존성

리소스는 다른 리소스에 의존할 수 있습니다:

```typescript
const User = resourceFactory({
  tags: (req: { userId: string }) => ({ id: `user-${req.userId}` }),
  load: async ({ req, fetcher }) => {
    const response = await fetcher(NextJSAdapter).load(
      `/api/users/${req.userId}`,
    );
    return response.json();
  },
});

const UserSettings = resourceFactory({
  tags: (req: { userId: string }) => ({ id: `user-settings-${req.userId}` }),
  use: (req) => [User({ userId: req.userId })], // User에 의존
  load: async ({ req, use, fetcher }) => {
    const [user] = await Promise.all(use);

    // 사용자가 활성화된 경우에만 설정 가져오기
    if (!user.isActive) return { theme: "default" };

    const response = await fetcher(NextJSAdapter).load(
      `/api/users/${req.userId}/settings`,
    );
    return response.json();
  },
});
```

---

## 📚 API 참조

### `loaderFactory(dependencies, options?, middlewares?)`

리소스를 로드하기 위한 로더 인스턴스를 생성합니다.

**기본 사용법:**

```typescript
import { cache } from "react";

const loader = loaderFactory(
  { memo: cache },
  {
    retry: { maxCount: 3, canRetryOnError: true },
    timeout: { delay: 10000 },
  }
);

// 반환: [loadFunction, revalidationTags]
const [load, revalidation] = loader(Resource1, Resource2, ...);
```

**전체 옵션:**

```typescript
const loader = loaderFactory(
  { memo: cache }, // dependencies
  {
    retry: {
      maxCount: 3,                              // 최대 재시도 횟수
      canRetryOnError: true,                    // 또는 (error) => boolean
      fallback?: () => async () => fallbackData, // 선택사항: 재시도 실패 시 기본 데이터
      onRetryEach?: () => {},                   // 선택사항: 각 재시도 시 호출
      onRetryExceeded?: () => {},               // 선택사항: 최대 재시도 초과 시 호출
    },
    timeout: {
      delay: 10000,                             // 타임아웃 (밀리초)
      onTimeout?: () => {},                     // 선택사항: 타임아웃 발생 시 호출
    },
    backoff?: {
      strategy: EXPONENTIAL_BACKOFF(2),         // 백오프 전략
      initialDelay: 500,                        // 초기 지연 (밀리초)
    },
  },
  [customMiddleware] // 선택사항: 미들웨어 배열
);
```

### `resourceFactory(config)`

캐싱 구성을 가진 재사용 가능한 리소스를 정의합니다.

```typescript
const MyResource = resourceFactory({
  tags: (req) => ({
    id: "my-resource-id", // 캐시 식별자
    effects: ["related-cache-tag"], // 선택사항: 무효화할 태그
  }),
  options: { staleTime: 300 }, // 선택사항: 캐시 지속 시간 (초 단위, 5분)
  use: (req) => [DependencyResource], // 선택사항: 의존성
  load: async ({ req, fetcher, use }) => {
    // 데이터를 가져와서 반환
  },
});
```

### `hierarchyTag(...segments)`

유연한 무효화를 위한 계층적 캐시 태그를 생성합니다.

```typescript
import { hierarchyTag } from "@h1y/next-loader";

// 생성: ["org", "org/123", "org/123/team", "org/123/team/456"]
const tags = hierarchyTag("org", "123", "team", "456");
```

### `componentLoaderFactory(options?, middlewares?)`

재시도 UI 피드백 및 상태 관리를 제공하는 컴포넌트 레벨 로더를 생성합니다.

**기본 사용법:**

```typescript
const { componentLoader } = componentLoaderFactory({
  retry: { maxCount: 3, canRetryOnError: true }
});

async function MyComponent({ id }: { id: string }) {
  const data = await fetchData(id);
  return <div>{data.content}</div>;
}

export default componentLoader(MyComponent).withBoundary(<Loading />);
```

**전체 옵션 및 반환값:**

```typescript
const {
  componentLoader,        // 컴포넌트를 복원력 로직으로 래핑
  retryImmediately,       // 선택적 fallback과 함께 즉시 재시도 트리거
  retryFallback,          // 조건부 재시도 fallback 등록
  componentState,         // 재시도 간 지속되는 상태 생성
  componentOptions,       // 로더 구성 접근
  // 커스텀 미들웨어 옵션 (미들웨어 제공 시)
  metricsMiddlewareOptions, // 예시: 'metrics' 미들웨어 컨텍스트 접근
} = componentLoaderFactory(
  {
    retry: {
      maxCount: 3,
      canRetryOnError: true,
      fallback?: <div>기본 UI</div>,      // 선택사항: 재시도 실패 시 UI
      onRetryEach?: () => {},               // 선택사항: 각 재시도 시 호출
      onRetryExceeded?: () => {},           // 선택사항: 최대 재시도 초과 시 호출
    },
    timeout: {
      delay: 10000,
      onTimeout?: () => {},                 // 선택사항: 타임아웃 발생 시 호출
    },
    backoff?: {
      strategy: EXPONENTIAL_BACKOFF(2),
      initialDelay: 500,
    },
  },
  [metricsMiddleware] // 선택사항: 커스텀 미들웨어
);

// 컴포넌트 내부 사용:
async function MyComponent() {
  const [count, setCount] = componentState(0);       // 지속 상태
  const options = componentOptions();                 // retry/timeout 구성 접근
  const metrics = metricsMiddlewareOptions();         // 미들웨어 컨텍스트 접근

  retryFallback({
    when: (error) => error.status === 503,
    fallback: (error) => <div>서비스 사용 불가</div>
  });

  // ... 컴포넌트 로직
}
```

### 백오프 전략

재시도 타이밍 제어:

```typescript
import {
  FIXED_BACKOFF,
  LINEAR_BACKOFF,
  EXPONENTIAL_BACKOFF,
} from "@h1y/next-loader";

// 고정: 항상 1초 대기
const loader1 = loaderFactory(deps, {
  retry: { maxCount: 3, canRetryOnError: true },
  backoff: { strategy: FIXED_BACKOFF, initialDelay: 1000 },
});

// 선형: 1초, 2초, 3초
const loader2 = loaderFactory(deps, {
  retry: { maxCount: 3, canRetryOnError: true },
  backoff: { strategy: LINEAR_BACKOFF(1000), initialDelay: 1000 },
});

// 지수: 500ms, 1초, 2초, 4초
const loader3 = loaderFactory(deps, {
  retry: { maxCount: 4, canRetryOnError: true },
  backoff: { strategy: EXPONENTIAL_BACKOFF(2), initialDelay: 500 },
});
```

---

## 🔄 Next.js 통합

### 캐시 재검증

항상 로더가 반환한 `revalidation` 배열을 사용하세요:

```typescript
const [load, revalidation] = loader(MyResource({ id: "123" }));

// ✅ 올바름
<form action={async () => {
  "use server";
  revalidation.forEach(revalidateTag);
}}>
  <button>새로고침</button>
</form>

// ❌ 잘못됨 - revalidateTag을 직접 호출하지 마세요
<form action={async () => {
  "use server";
  revalidateTag("my-resource-123"); // 이렇게 하지 마세요!
}}>
```

### 동적 렌더링

재시도는 동적 렌더링 모드에서만 표시됩니다:

```typescript
import { headers } from 'next/headers';

async function DynamicPage({ id }: { id: string }) {
  await headers(); // 동적 렌더링 강제

  const [load] = loader(MyResource({ id }));
  const [data] = await load(); // 재시도가 사용자에게 표시됨

  return <div>{data.content}</div>;
}
```

### 정적 생성 (ISR)

리소스가 자동으로 Next.js ISR과 통합됩니다:

```typescript
const News = resourceFactory({
  tags: () => ({ id: "latest-news" }),
  options: { staleTime: 3600 }, // 1시간
  load: async ({ fetcher }) => {
    const response = await fetcher(NextJSAdapter).load("/api/news");
    return response.json();
  },
});

async function NewsPage() {
  const [load] = loader(News({}));
  const [news] = await load(); // 1시간(3600초) 재검증으로 캐시됨

  return <div>{/* 뉴스 렌더링 */}</div>;
}
```

---

## 💡 고급 기능

### 계층적 캐시 무효화

다단계 무효화를 위해 `hierarchyTag()` 사용:

```typescript
const UserProfile = resourceFactory({
  tags: (req: { userId: string }) => ({
    id: hierarchyTag("user", req.userId, "profile"),
    effects: ["user-analytics", "search-index"], // 관련 캐시 무효화
  }),
  load: async ({ req, fetcher }) => {
    const response = await fetcher(NextJSAdapter).load(
      `/api/users/${req.userId}/profile`,
    );
    return response.json();
  },
});

// 무효화 레벨:
// 1. "user" - 모든 사용자 데이터
// 2. "user/123" - 사용자 123의 모든 데이터
// 3. "user/123/profile" - 특정 프로필
// 추가: "user-analytics" 및 "search-index" (effects)
```

### 컴포넌트 레벨 재시도

재시도 피드백이 필요한 UI 컴포넌트용:

```typescript
import { componentLoaderFactory } from "@h1y/next-loader";

const { componentLoader, componentState, componentOptions } = componentLoaderFactory({
  retry: { maxCount: 3, canRetryOnError: true }
});

async function MonitoringWidget({ serviceId }: { serviceId: string }) {
  const [retryCount, setRetryCount] = componentState(0);
  const options = componentOptions();

  if (options.retry.count > retryCount) {
    setRetryCount(options.retry.count);
  }

  const [load] = loader(ServiceHealth({ serviceId }));
  const [health] = await load();

  return (
    <div>
      <p>상태: {health.status}</p>
      {retryCount > 0 && <small>{retryCount}번 재시도함</small>}
    </div>
  );
}

export default componentLoader(MonitoringWidget).withErrorBoundary({
  errorFallback: ({ error, resetErrorBoundary }) => (
    <div>
      <p>로드 실패: {error.message}</p>
      <button onClick={resetErrorBoundary}>재시도</button>
    </div>
  )
});
```

### 커스텀 어댑터

Next.js가 아닌 환경을 위한 어댑터 생성:

```typescript
import { createExternalResourceAdapter } from "@h1y/next-loader";

const CustomAdapter = createExternalResourceAdapter({
  validate: (url) => {
    if (!url.startsWith("https://")) throw new Error("HTTPS가 필요합니다");
  },
  load: async (url) => {
    const response = await fetch(url, {
      headers: { Authorization: "Bearer token" },
    });
    return response.json();
  },
});

const ExternalResource = resourceFactory({
  tags: () => ({ id: "external-api" }),
  load: async ({ fetcher }) => {
    return fetcher(CustomAdapter).load("https://api.example.com/data");
  },
});
```

---

## ❓ 문제 해결

### Q: 재시도 시도가 보이지 않나요?

**A**: Next.js 캐싱이 재시도를 가립니다. 동적 렌더링을 사용하세요:

```typescript
import { headers } from 'next/headers';

async function MyPage() {
  await headers(); // 동적 렌더링 강제
  const [load] = loader(MyResource({ id: '123' }));
  const [data] = await load(); // 이제 재시도가 표시됨
  return <div>{data.content}</div>;
}
```

### Q: 배치 로딩에서 타입 에러가 발생하나요?

**A**: 결과를 구조 분해하여 TypeScript가 타입을 추론하도록 하세요:

```typescript
// ❌ 잘못됨
const [load] = loader(User({ id: "1" }), Posts({ userId: "1" }));
const data = await load(); // 타입 추론 실패

// ✅ 올바름
const [load] = loader(User({ id: "1" }), Posts({ userId: "1" }));
const [user, posts] = await load(); // TypeScript가 타입을 알고 있음
```

### Q: `loaderFactory` vs `componentLoaderFactory` 언제 사용하나요?

**A**:

- **95%의 경우 `loaderFactory()` 사용** - 캐싱을 통한 데이터 페칭
- **UI 레벨 재시도 피드백과 상태 지속성이 필요한 경우에만 `componentLoaderFactory()` 사용**

**모범 사례**: 함께 사용:

```typescript
const loader = loaderFactory({ memo: cache });
const { componentLoader } = componentLoaderFactory({ retry: { maxCount: 3 } });

async function MyComponent() {
  const [load] = loader(MyResource({ id: '123' }));
  const [data] = await load(); // 캐싱 + 재시도 획득
  return <div>{data.content}</div>;
}

export default componentLoader(MyComponent).withBoundary(<Loading />);
```

### Q: 캐시 태그는 어떻게 작동하나요?

**A**:

- **`id`**: 캐시에서 이 특정 리소스를 식별
- **`effects`**: 이 리소스가 변경될 때 무효화할 태그
- **항상 `revalidation.forEach(revalidateTag)` 사용** - `revalidateTag()`을 직접 호출하지 마세요

```typescript
const Post = resourceFactory({
  tags: (req: { postId: string }) => ({
    id: `post-${req.postId}`,
    effects: ["activity-feed", "trending-posts"], // 게시글 변경 시 이것들 무효화
  }),
  load: async ({ req, fetcher }) => {
    const response = await fetcher(NextJSAdapter).load(
      `/api/posts/${req.postId}`,
    );
    return response.json();
  },
});
```

### Q: 에러가 Next.js 에러 바운더리로 전파되지 않나요?

**A**: 에러를 억제하지 마세요 - 자연스럽게 전파되도록 하세요:

```typescript
// ❌ 잘못됨
async function MyComponent() {
  try {
    const data = await loadData();
    return <div>{data.content}</div>;
  } catch (error) {
    return <div>에러: {error.message}</div>; // 억제하지 마세요
  }
}

// ✅ 올바름
async function MyComponent() {
  const data = await loadData(); // 에러를 전파하도록 함
  return <div>{data.content}</div>;
}
```

---

## 🛠️ 의존성

다음 패키지 위에 구축되었습니다:

- **[@h1ylabs/loader-core v0.6.0](https://github.com/h1ylabs/next-loader/tree/main/packages/core)** - 재시도/타임아웃/백오프를 갖춘 핵심 로딩 기능
- **[@h1ylabs/promise-aop v0.6.0](https://github.com/h1ylabs/next-loader/tree/main/packages/promise-aop)** - Promise 기반 AOP 프레임워크

**런타임 의존성**:

- `react-error-boundary ^6.0.0`

**피어 의존성**:

- React ≥18.3.0
- Next.js ≥14.0.0 (NextJSAdapter용)

---

## 📄 라이선스

MIT © [h1ylabs](https://github.com/h1ylabs)
