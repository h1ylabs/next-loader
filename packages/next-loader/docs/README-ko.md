# @h1y/next-loader

**최신 버전: v6.0.0**

Next.js 애플리케이션을 위해 특별히 설계된 강력하고 타입 안전한 리소스 로딩 라이브러리입니다. 내장된 캐싱, 재검증, 재시도 로직, 그리고 Next.js 서버 컴포넌트와의 원활한 통합을 통해 효율적인 데이터 페칭을 구현할 수 있습니다.

[영어 문서 (English Documentation)](https://github.com/h1ylabs/next-loader/blob/main/packages/next-loader/README.md)

[![npm version](https://badge.fury.io/js/%40h1y%2Fnext-loader.svg)](https://badge.fury.io/js/%40h1y%2Fnext-loader)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## ✨ 주요 기능

- **🎯 Next.js 네이티브**: Next.js를 위해 특별히 설계되었으며 서버 컴포넌트를 완벽하게 지원합니다
- **⚡ 배치 로딩**: 여러 리소스를 병렬로 타입 안전하게 동시 로드
- **🔄 스마트 캐싱**: Next.js 캐시 시스템 및 재검증과 원활하게 통합됩니다
- **🛡️ 타입 안전성**: 지능적인 타입 추론을 통한 완전한 TypeScript 지원
- **🎭 경계 관리**: Suspense와 Error Boundary를 통한 컴포넌트 회복성
- **💾 상태 지속성**: 재시도 과정에서 상태를 유지하는 `componentState`
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

// 데이터 타입 정의
interface User {
  id: string;
  name: string;
  email: string;
}

interface Post {
  id: string;
  title: string;
  content: string;
  authorId: string;
}

// 모듈 레벨에서 한 번 생성하여 어디서나 재사용
const loader = createLoader({
  memo: cache, // 요청 중복 제거
});
```

### 2. 리소스 정의

```typescript
import { createResourceBuilder } from "@h1y/next-loader";

const User = createResourceBuilder({
  tags: (req: { id: string }) => ({ id: `user-${req.id}` }),
  options: { staleTime: 300000 }, // 5분 캐시
  load: async ({ req, fetcher }): Promise<User> => {
    const response = await fetcher(NextJSAdapter).load(`/api/users/${req.id}`);
    if (!response.ok) throw new Error(`사용자를 불러올 수 없습니다`);
    return response.json();
  },
});

const UserPosts = createResourceBuilder({
  tags: (req: { userId: string }) => ({ id: `user-${req.userId}-posts` }),
  options: { staleTime: 180000 }, // 3분 캐시
  load: async ({ req, fetcher }): Promise<Post[]> => {
    const response = await fetcher(NextJSAdapter).load(
      `/api/users/${req.userId}/posts`,
    );
    return response.json();
  },
});
```

### 3. 컴포넌트에서 사용

**단일 리소스:**

```typescript
async function UserProfile({ params }: { params: { id: string } }) {
  const [load, revalidation] = loader(User({ id: params.id }));
  const [user] = await load();

  return (
    <div>
      <h1>{user.name}</h1>
      <p>{user.email}</p>
      <form action={async () => {
        "use server";
        revalidation.forEach(revalidateTag);
      }}>
        <button>새로고침</button>
      </form>
    </div>
  );
}
```

**배치 로딩 (여러 리소스):**

```typescript
async function UserDashboard({ params }: { params: { id: string } }) {
  // 여러 리소스를 병렬로 타입 안전하게 로드
  const [load, revalidation] = loader(
    User({ id: params.id }),
    UserPosts({ userId: params.id })
  );

  // 결과는 타입 안전: [User, Post[]]
  const [user, posts] = await load();

  return (
    <div>
      <h1>{user.name}의 대시보드</h1>
      <p>{posts.length}개의 게시글</p>
      <form action={async () => {
        "use server";
        revalidation.forEach(revalidateTag);
      }}>
        <button>전체 새로고침</button>
      </form>
    </div>
  );
}
```

이제 데이터가 자동으로 캐시되고, 배치 로딩되며, 재검증되어 프로덕션에서 사용할 준비가 완료되었습니다.

## 🧩 핵심 개념

### 리소스 빌더 패턴

리소스는 @h1y/next-loader에게 데이터를 어떻게 페치하고, 캐시하고, 관리할지를 알려주는 선언적 정의입니다:

```typescript
const BlogPost = createResourceBuilder({
  // 캐시 태그 정의
  tags: (req: { slug: string }) => ({
    id: `post-${req.slug}`,
    effects: ["blog-content"], // 관련 캐시 무효화
  }),

  // 캐싱 구성
  options: { staleTime: 600000 }, // 10분 캐시

  // 데이터 로드 방법 정의
  load: async ({ req, fetcher, retry }) => {
    const response = await fetcher(NextJSAdapter).load(
      `/api/posts/${req.slug}`,
    );
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
const loader = createLoader(dependencies);

async function UserPage() {
  // 단일 리소스
  const [load] = loader(User({ id: '123' }));
  const [data] = await load();

  // 배치 로딩 (주요 기능!)
  const [batchLoad] = loader(
    User({ id: '123' }),
    UserPosts({ userId: '123' }),
    UserStats({ id: '123' })
  );
  const [user, posts, stats] = await batchLoad();

  return <div>{user.name}님은 {posts.length}개의 게시글을 가지고 있어요</div>;
}
```

**특징:**

- ✅ **배치 로딩**으로 완전한 타입 안전성
- ✅ Next.js 캐시 통합 (ISR, revalidateTag)
- ✅ React의 `cache()`를 통한 요청 중복 제거
- ✅ 리소스 의존성 관리
- ❌ 로더에서 미들웨어 컨텍스트 접근 불가
- ❌ 컴포넌트 레벨 재시도/폴백 없음
- 🔧 기본값: 60초 타임아웃, 재시도 없음

#### `createComponentLoader()` - 컴포넌트 복원력용

**언제 사용**: 컴포넌트 자체에 재시도/타임아웃/상태 관리 추가

```typescript
const { componentLoader } = createComponentLoader({
  retry: { maxCount: 3, canRetryOnError: true },
  timeout: { delay: 5000 }
});

async function UserProfile({ userId }: { userId: string }) {
  const user = await fetchUserProfile(userId);
  return <div>{user.name}님, 안녕하세요!</div>;
}

// 로딩 폴백 컴포넌트 (클라이언트 컴포넌트)
function LoadingFallback() {
  return <div>로딩 중...</div>;
}

// 오류 폴백 컴포넌트 (클라이언트 컴포넌트)
function ErrorFallback({ error, resetErrorBoundary }: { error: Error; resetErrorBoundary: () => void }) {
  return (
    <div>
      <p>오류: {error.message}</p>
      <button onClick={resetErrorBoundary}>재시도</button>
    </div>
  );
}

// 세 가지 경계 옵션:
export const NoWrapperComponent = componentLoader(UserProfile).withNoBoundary();
export const SuspenseComponent = componentLoader(UserProfile).withBoundary(<LoadingFallback />);
export const ErrorSafeComponent = componentLoader(UserProfile).withErrorBoundary({
  errorFallback: ErrorFallback
});
```

**특징:**

- ✅ 컴포넌트 레벨 재시도 및 타임아웃 처리
- ✅ **상태 지속성** (`componentState()`)을 통한 재시도 전반에 걸친 상태 유지
- ✅ **경계 관리** (Suspense + Error Boundary)
- ✅ **미들웨어 컨텍스트 접근** 컴포넌트 내에서 `{name}MiddlewareOptions()`를 통해 가능
- ✅ **createLoader()와 통합** - 자동 재시도 신호 전파
- ✅ **모범 사례**: `componentLoader()` 컴포넌트 내에서 데이터 페칭에 `loader()` 사용
- 🔧 기본값: 60초 타임아웃, 재시도 없음

### 로더 + 컴포넌트 로더의 주요 통합

**중요**: `loader()`를 `componentLoader()` 컴포넌트 내부에서 사용할 수 있으며, 재시도 신호가 자동으로 전파됩니다:

```typescript
const loader = createLoader(dependencies, {
  retry: { maxCount: 2, canRetryOnError: true }
});

const { componentLoader } = createComponentLoader({
  retry: { maxCount: 3, canRetryOnError: (err) => err.status >= 500 }
});

async function IntegratedDashboard({ userId }: { userId: string }) {
  // 로더 실패가 자동으로 컴포넌트 로더 재시도를 트리거
  const [loadUser] = loader(User({ id: userId }));
  const [loadPosts] = loader(UserPosts({ userId }));

  const [user, posts] = await Promise.all([
    loadUser(),
    loadPosts()
  ]);

  return (
    <div>
      <h1>{user.name}</h1>
      <p>{posts.length} posts</p>
    </div>
  );
}

// 로딩 폴백 컴포넌트 (클라이언트 컴포넌트)
function DashboardLoadingFallback() {
  return <div>대시보드 로딩 중...</div>;
}

// 래핑된 컴포넌트는 로더 캐싱 + 컴포넌트 복원력 모두 얻음
export default componentLoader(IntegratedDashboard).withBoundary(<DashboardLoadingFallback />);
```

### 계층적 태그로 스마트 캐시 무효화

계층적 태그로 정밀한 제어가 가능한 캐시 무효화 전략을 구성하세요:

```typescript
import { hierarchyTag } from "@h1y/next-loader";

const UserComments = createResourceBuilder({
  tags: (req: { userId: string; postId: string }) => ({
    id: hierarchyTag("user", req.userId, "posts", req.postId, "comments"),
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

````typescript
revalidateTag("user"); // 모든 사용자 데이터
revalidateTag("user/123/posts"); // 사용자 123의 모든 게시물
revalidateTag("user/123/posts/456"); // 특정 게시물

## 🎯 고급 예제

### 타입 안전성을 갖춘 배치 로딩

동시에 여러 리소스를 로드하면서 완전한 TypeScript 지원을 활용하세요:

```typescript
async function ComprehensiveDashboard({ userId }: { userId: string }) {
  // 5개의 서로 다른 리소스를 병렬로 로드
  const [load, revalidation] = loader(
    User({ id: userId }),           // → User
    UserPosts({ userId }),          // → Post[]
    UserStats({ userId }),          // → UserStats
    RecentActivity({ userId }),     // → Activity[]
    NotificationSettings({ userId }) // → NotificationSettings
  );

  // TypeScript가 추론: [User, Post[], UserStats, Activity[], NotificationSettings]
  const [user, posts, stats, activities, settings] = await load();

  return (
    <div>
      <h1>{user.name}님, 환영합니다!</h1>
      <div>게시글: {stats.postCount}개 | 조회수: {stats.totalViews}회</div>
      <div>최신 게시글: {posts[0]?.title}</div>
      <div>최근 활동: {activities.length}개 항목</div>
      <div>이메일 알림: {settings.emailEnabled ? '켜짐' : '꺼짐'}</div>

      {/* 모든 리소스를 한 번에 재검증 */}
      <form action={async () => {
        "use server";
        revalidation.forEach(revalidateTag);
      }}>
        <button>모두 새로고침</button>
      </form>
    </div>
  );
}
````

### 리소스 의존성

리소스를 조합하여 복잡한 데이터 흐름을 구축하세요:

```typescript
// 기본 사용자 리소스
const User = createResourceBuilder({
  tags: (req: { id: string }) => ({ id: `user-${req.id}` }),
  options: { staleTime: 300000 },
  use: [],
  load: async ({ req, fetcher }) => {
    const response = await fetcher(NextJSAdapter).load(`/api/users/${req.id}`);
    return response.json();
  },
});

// 사용자 데이터에 의존하는 게시물
const UserPosts = createResourceBuilder({
  tags: (req: { userId: string }) => ({
    id: hierarchyTag('user', req.userId, 'posts'),
    effects: ['activity-feed'] // 게시물 변경 시 활동 피드 무효화
  }),
  options: { staleTime: 180000 },
  use: (req) => [User({ id: req.userId })], // 의존성 선언
  load: async ({ req, fetcher, use: [user] }) => {
    const userData = await user;

    // 비활성 사용자는 로딩 생략
    if (!userData.isActive) {
      return { posts: [], reason: '사용자 비활성' };
    }

    const response = await fetcher(NextJSAdapter).load(`/api/users/${req.userId}/posts`);
    return {
      posts: await response.json(),
      author: userData.name,
    };
  },
});

// 두 리소스와 함께 배치 로딩 사용
async function UserDashboard({ userId }: { userId: string }) {
  const [load, revalidation] = loader(
    User({ id: userId }),
    UserPosts({ userId })
  );

  const [user, posts] = await load();

  return (
    <div>
      <h1>{user.name}님의 대시보드</h1>
      <p>{posts.posts.length}개의 게시물 (작성자: {posts.author})</p>
      <form action={async () => {
        "use server";
        revalidation.forEach(revalidateTag);
      }}>
        <button>새로고침</button>
      </form>
    </div>
  );
}
```

### 컴포넌트 상태 관리

`componentState`를 사용하여 재시도 사이클 동안 상태를 유지하고 `loader()`와 통합하여 데이터를 페칭하세요. React useState와 달리 componentState는 재시도 전반에 걸쳐 유지됩니다.

```typescript
const loader = createLoader({ memo: cache });
const { componentLoader, componentState, componentOptions } = createComponentLoader({
  retry: { maxCount: 3, canRetryOnError: true }
});

// 리소스 정의
const UserProfile = createResourceBuilder({
  tags: (req: { userId: string }) => ({ id: `user-profile-${req.userId}` }),
  load: async ({ req, fetcher }) => {
    const response = await fetcher(NextJSAdapter).load(`/api/users/${req.userId}/profile`);
    return response.json();
  },
});

const UserSettings = createResourceBuilder({
  tags: (req: { userId: string }) => ({ id: `user-settings-${req.userId}` }),
  load: async ({ req, fetcher }) => {
    const response = await fetcher(NextJSAdapter).load(`/api/users/${req.userId}/settings`);
    return response.json();
  },
});

async function StatefulDashboard({ userId }: { userId: string }) {
  // 재시도 사이클 동안 상태 유지 (React useState와 달리)
  const [retryCount, setRetryCount] = componentState(0);
  const [lastLoadTime, setLastLoadTime] = componentState<Date | null>(null);

  const options = componentOptions();

  // 성공적인 재시도 시도 추적
  if (options.retry.count > retryCount) {
    setRetryCount(options.retry.count);
    setLastLoadTime(new Date());
  }

  // loader를 사용한 데이터 페칭 - 오류가 componentLoader 재시도를 트리거
  const [loadProfile] = loader(UserProfile({ userId }));
  const [loadSettings] = loader(UserSettings({ userId }));

  const [profile, settings] = await Promise.all([
    loadProfile(),
    loadSettings()
  ]);

  return (
    <div className={`theme-${settings.theme}`}>
      <h1>{profile.name}님, 환영합니다!</h1>
      <p>언어: {settings.language}</p>
      {retryCount > 0 && (
        <small>✅ {retryCount}번 재시도 후 로드됨</small>
      )}
      {lastLoadTime && (
        <small>마지막 업데이트: {lastLoadTime.toLocaleTimeString()}</small>
      )}
    </div>
  );
}

export default componentLoader(StatefulDashboard).withBoundary(<div>로딩 중...</div>);
```

### 고급 재시도 제어

재시도 동작과 사용자 피드백을 세밀하게 제어하기 위해 고급 재시도 기능을 사용하세요.

#### `retryImmediately()` - 즉시 재시도

```typescript
const { componentLoader, retryImmediately } = createComponentLoader({
  retry: { maxCount: 3, canRetryOnError: true }
});

async function PaymentProcessor({ amount }: { amount: number }) {
  const result = await processPayment(amount);

  // 결제가 즉시 재시도를 필요로 하는 경우 (예: 속도 제한)
  if (result.needsRetry) {
    retryImmediately(<div>결제 속도 제한됨, 즉시 재시도 중...</div>);
  }

  return <div>✅ 결제: ${result.amount}</div>;
}

export default componentLoader(PaymentProcessor).withBoundary(<div>Loading...</div>);
```

#### `retryFallback()` - 조건부 폴백

`retryImmediately()`와 달리 `retryFallback()`은 즉시 재시도를 트리거하지 않습니다. 대신 특정 오류 조건이 충족될 때 표시되는 조건부 폴백을 등록한 다음 자동 재시도가 계속 진행되도록 합니다.

```typescript
const { componentLoader, retryFallback } = createComponentLoader({
  retry: { maxCount: 3, canRetryOnError: true }
});

async function CheckoutForm({ amount }: { amount: number }) {
  // 오류 조건에 따라 다른 폴백 표시
  retryFallback({
    when: (err) => err.code === 'INSUFFICIENT_FUNDS',
    fallback: <div>❌ 잔액 부족. 계좌에 돈을 추가해주세요.</div>
  });

  retryFallback({
    when: (err) => err.code === 'CARD_EXPIRED',
    fallback: <div>❌ 카드 만료됨. 결제 방법을 업데이트해주세요.</div>
  });

  // 다른 오류는 자동 재시도를 트리거하도록 전파
  const result = await processPayment(amount);
  return <div>✅ 결제: ${result.amount}</div>;
}

export default componentLoader(CheckoutForm).withBoundary(<div>Loading...</div>);
```

**주요 차이점:**

- `retryImmediately()`: 자동 재시도를 우회하고 즉시 재시도 트리거
- `retryFallback()`: 조건부 폴백을 등록하고 자동 재시도가 계속 진행되도록 허용

### 오류 처리

```typescript
const Product = createResourceBuilder({
  tags: (req: { id: string }) => ({ id: `product-${req.id}` }),
  load: async ({ req, fetcher }) => {
    const response = await fetcher(NextJSAdapter).load(`/api/products/${req.id}`);
    if (!response.ok) throw new Error(`제품을 찾을 수 없습니다`);
    return response.json();
  },
});

// 오류가 자동으로 재시도를 트리거
async function ProductPage({ id }: { id: string }) {
  const [load] = loader(Product({ id }));
  const [product] = await load();
  return <div>{product.name}: ${product.price}</div>;
}
```

## 🎛️ 미들웨어 시스템

```typescript
import { createLoaderMiddleware } from "@h1y/next-loader";

// 로깅 미들웨어
const loggingMiddleware = createLoaderMiddleware({
  name: "logging",
  contextGenerator: () => ({ startTime: 0 }),
  before: async (context) => {
    context.startTime = Date.now();
    console.log("🚀 로딩 시작");
  },
  complete: async (context) => {
    const duration = Date.now() - context.startTime;
    console.log(`✅ 완료 시간: ${duration}ms`);
  },
});

const loader = createLoader(dependencies, config, [loggingMiddleware]);
```

#### 컴포넌트 미들웨어와 컨텍스트 접근

```typescript
import { createComponentMiddleware } from "@h1y/next-loader";

// 컴포넌트 렌더링을 위한 성능 모니터링
const performanceMiddleware = createComponentMiddleware({
  name: "performance",
  contextGenerator: () => ({ startTime: 0, componentName: '' }),
  before: async (context) => {
    context.startTime = Date.now();
  },
  complete: async (context) => {
    const renderTime = Date.now() - context.startTime;
    console.log(`컴포넌트 ${context.componentName} 렌더링 시간: ${renderTime}ms`);
  },
});

const { componentLoader, performanceMiddlewareOptions } = createComponentLoader({
  retry: { maxCount: 2, canRetryOnError: true }
}, [performanceMiddleware]);

async function MonitoredComponent({ userId }: { userId: string }) {
  // 컴포넌트 내에서 미들웨어 컨텍스트에 직접 접근
  const perfContext = performanceMiddlewareOptions();
  perfContext.componentName = 'MonitoredComponent';

  const [load] = loader(User({ id: userId }));
  const [user] = await load();

  return (
    <div>
      <h1>{user.name}</h1>
      <p>렌더링 시작: {new Date(perfContext.startTime).toISOString()}</p>
    </div>
  );
}

export default componentLoader(MonitoredComponent).withBoundary(<div>로딩 중...</div>);
```

## ⚠️ 모범 사례 및 중요 가이드라인

### Fallback 컴포넌트 가이드라인

**별도 모듈 생성**: 유지보수성과 재사용성을 위해 fallback 컴포넌트를 항상 별도 모듈로 만들어 인라인 정의 대신 사용하세요.

**Error Fallback 요구사항**: Error fallback 컴포넌트는 `onClick` 같은 인터랙티브 이벤트를 처리하므로 **반드시** Client Component여야 합니다.

**컨텍스트 접근 제한**: Fallback 컴포넌트는 (Component)Loader Context에 접근할 수 없습니다. Fallback 로직을 독립적이고 상태가 없는 방식으로 유지하세요.

**retryFallback 사용 패턴**: React Hooks처럼 `retryFallback` 함수는 모든 컴포넌트 렌더 사이클마다 호출되어야 하며, 조건부로 호출하면 안 됩니다.

```typescript
// ❌ 잘못된 예시 - 조건부 fallback 등록
async function MyComponent() {
  if (someCondition) {
    retryFallback({ when: () => true, fallback: () => {} }); // 하지 마세요
  }
  return await loadData();
}

// ✅ 올바른 예시 - 항상 fallback 등록
async function MyComponent() {
  // 컴포넌트 렌더링 시마다 항상 retryFallback 호출
  retryFallback({ when: () => true, fallback: () => {} });

  return await loadData();
}
```

**Fallback 컴포넌트 예시**:

```typescript
// ✅ 올바른 예시: 로딩 fallback을 별도 모듈로
export function UserProfileLoadingFallback() {
  return (
    <div className="animate-pulse">
      <div className="h-8 bg-gray-200 rounded mb-2"></div>
      <div className="h-4 bg-gray-200 rounded"></div>
    </div>
  );
}

// ✅ 올바른 예시: 에러 fallback을 별도 Client Component 모듈로
"use client";
export function UserProfileErrorFallback({
  error,
  resetErrorBoundary
}: {
  error: Error;
  resetErrorBoundary: () => void;
}) {
  return (
    <div className="p-4 border border-red-300 rounded">
      <h3>사용자 프로필 로드 실패</h3>
      <p className="text-red-600">{error.message}</p>
      <button
        onClick={resetErrorBoundary}
        className="mt-2 px-4 py-2 bg-red-600 text-white rounded"
      >
        다시 시도
      </button>
    </div>
  );
}

// 메인 컴포넌트에서 사용
export const UserProfileComponent = componentLoader(UserProfile).withErrorBoundary({
  errorFallback: UserProfileErrorFallback
});
```

## ⚠️ 중요한 원칙

**next-loader는 Next.js를 지원하는 라이브러리이며, 기본적인 행동 전략을 바꾸지 않습니다:**

- **재시도로 해결할 수 없는 오류는 억제하지 말고 자연스럽게 전파하세요** - Next.js가 적절한 방식으로 처리하도록 맡기세요

```typescript
// ❌ 잘못된 방법 - 이렇게 하지 말 것
async function MyComponent() {
  try {
    const data = await loadData();
    return <div>{data.content}</div>;
  } catch (error) {
    // 재시도로 해결할 수 없는 오류를 억제하지 말고 자연스럽게 전파
    return <div>오류: {error.message}</div>;
  }
}

// ✅ 올바른 방법 - Next.js가 오류를 처리하도록 허용
async function MyComponent() {
  // 재시도로 해결할 수 없는 오류는 자연스럽게 전파되어 Next.js가 처리
  const data = await loadData();
  return <div>{data.content}</div>;
}
```

## 📖 API 참조

### `createLoader(dependencies, options?, middlewares?)`

```typescript
const loader = createLoader(
  {
    memo: cache, // 요청 중복 제거
  },
  {
    retry: { maxCount: 3, canRetryOnError: true },
    timeout: { delay: 10000 },
  },
);

// revalidation 사용 예시
const [load, revalidation] = loader(SomeResource({ id: '123' }));

// 컴포넌트에서
<form action={async () => {
  "use server";
  revalidation.forEach(revalidateTag);
}}>
  <button>새로고침</button>
</form>
```

### `createComponentLoader(options?, middlewares?)`

```typescript
const { componentLoader } = createComponentLoader({
  retry: { maxCount: 3, canRetryOnError: true }
});

async function UserProfile({ userId }: { userId: string }) {
  const user = await fetchUserProfile(userId);
  return <div>{user.name}님, 안녕하세요!</div>;
}

// 세 가지 옵션:
export const NoBoundary = componentLoader(UserProfile).withNoBoundary();
export const WithSuspense = componentLoader(UserProfile).withBoundary(<LoadingFallback />);
export const WithErrorHandling = componentLoader(UserProfile).withErrorBoundary({
  errorFallback: ErrorFallback
});
```

#### createLoader와의 통합

```typescript
const loader = createLoader(dependencies);
const { componentLoader } = createComponentLoader({
  retry: { maxCount: 2, canRetryOnError: true }
});

async function Dashboard({ userId }: { userId: string }) {
  // 로더 실패가 자동으로 컴포넌트 재시도를 트리거
  const [loadUser] = loader(User({ id: userId }));
  const [loadPosts] = loader(UserPosts({ userId }));

  const [user, posts] = await Promise.all([loadUser(), loadPosts()]);
  return <div>{user.name}: {posts.length} posts</div>;
}

export default componentLoader(Dashboard).withBoundary(<div>Loading...</div>);
```

### `createResourceBuilder(config)`

```typescript
const UserPosts = createResourceBuilder({
  tags: (req: { userId: string }) => ({
    id: hierarchyTag("user", req.userId, "posts"),
    effects: ["activity-feed"],
  }),
  options: { staleTime: 180000 },
  use: (req) => [User({ id: req.userId })], // 의존성
  load: async ({ req, fetcher, use: [user] }) => {
    const userData = await user;
    if (!userData.isActive) return { posts: [] };

    const response = await fetcher(NextJSAdapter).load(
      `/api/users/${req.userId}/posts`,
    );
    return { posts: await response.json() };
  },
});
```

### `hierarchyTag(...segments)`

```typescript
// ['user', 'user/123', 'user/123/posts'] 생성
const tags = hierarchyTag("user", "123", "posts");

const UserPosts = createResourceBuilder({
  tags: (req: { userId: string }) => ({
    id: hierarchyTag("user", req.userId, "posts"),
    effects: hierarchyTag("user", req.userId), // 상위 레벨
  }),
});
```

### 백오프 전략

재시도 타이밍을 제어하기 위해 서로 다른 백오프 전략을 사용하세요:

```typescript
import {
  FIXED_BACKOFF,
  LINEAR_BACKOFF,
  EXPONENTIAL_BACKOFF,
} from "@h1y/next-loader";

// 고정 지연: 재시도 간 항상 2초 대기
const loader = createLoader(dependencies, {
  retry: { maxCount: 3, canRetryOnError: true },
  backoff: {
    strategy: FIXED_BACKOFF,
    initialDelay: 2000, // 2초
  },
});

// 선형 백오프: 1초, 3초, 5초 지연
const loader = createLoader(dependencies, {
  retry: { maxCount: 3, canRetryOnError: true },
  backoff: {
    strategy: LINEAR_BACKOFF(2000), // 재시도마다 2초 추가
    initialDelay: 1000, // 1초로 시작
  },
});

// 지수 백오프: 500ms, 1초, 2초, 4초 지연
const loader = createLoader(dependencies, {
  retry: { maxCount: 4, canRetryOnError: true },
  backoff: {
    strategy: EXPONENTIAL_BACKOFF(2), // 재시도마다 2배로 곱함
    initialDelay: 500, // 500ms로 시작
  },
});
```

### `createExternalResourceAdapter(adapter)`

⚠️ **API 변경**: 이전에 `createResourceAdapter`로 명명되었던 함수가 더 명확한 의미를 위해 `createExternalResourceAdapter`로 이름이 변경되었습니다.

외부 리소스용 커스텀 어댑터를 생성하세요:

```typescript
import { createExternalResourceAdapter } from "@h1y/next-loader";

// 외부 API용 커스텀 어댑터
const externalAdapter = createExternalResourceAdapter({
  validate: (param) => {
    if (!param.url) throw new Error("URL이 필요합니다");
  },
  load: async (param) => {
    const response = await fetch(param.url, param.options);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  },
});

const ExternalResource = createResourceBuilder({
  tags: (req: { url: string }) => ({ id: `external-${req.url}` }),
  load: async ({ req, fetcher }) => {
    const { load } = fetcher(externalAdapter);
    return load({ url: req.url, options: { method: "GET" } });
  },
});
```

## 🔄 Next.js 통합

**중요**: Next.js 캐싱으로 인해 재시도가 사용자에게 표시되지 않을 수 있습니다. 재시도가 표시되도록 동적 렌더링을 사용하세요:

```typescript
import { headers } from 'next/headers';

async function DynamicPage({ id }: { id: string }) {
  await headers(); // 동적 렌더링 강제

  const [load] = loader(User({ id }));
  const [user] = await load(); // 재시도가 사용자에게 표시됨

  return <div>{user.name}</div>;
}
```

## 🤔 자주 묻는 질문

### Q: Next.js 앱에서 재시도 시도가 표시되지 않나요?

**A:** 이는 Next.js 캐싱 동작 때문입니다. 콘텐츠가 캐시되면 사용자는 재검증이 백그라운드에서 일어나는 동안 캐시된 버전을 즉시 받습니다. 재시도는 다음과 같은 경우에만 표시됩니다:

- 동적 렌더링 (`force-dynamic` 사용 또는 `headers()`, `cookies()` 같은 동적 함수 사용)
- 캐시가 없는 새로운 요청
- 캐시 누락 또는 만료된 콘텐츠

### Q: 재시도 프로세스를 사용자에게 어떻게 표시할 수 있나요?

**A:** 동적 렌더링 패턴을 사용하세요:

```typescript
import { headers } from 'next/headers';

async function DynamicComponent() {
  await headers(); // 동적 렌더링 강제

  const [load] = loader(SomeResource({ id: '123' }));
  const [data] = await load(); // 이제 재시도가 사용자에게 표시됩니다

  return <div>{data.content}</div>;
}
```

또는 PPR을 사용하여 동적 렌더링을 특정 섹션으로 제한하세요.

### Q: componentLoader와 loader를 언제 사용해야 하나요?

**A:**

- **캐싱을 통한 데이터 페칭에는 `createLoader()` 사용** (가장 일반적인 사용 사례)
- **컴포넌트 레벨 재시도/타임아웃 동작이나 컴포넌트 내 미들웨어 컨텍스트 접근이 필요할 때 `createComponentLoader()` 사용**

**모범 사례:** 함께 사용하세요:

```typescript
const loader = createLoader(dependencies); // 전역 데이터 로딩
const { componentLoader } = createComponentLoader(config); // 컴포넌트 복원력

async function MyComponent() {
  const [load] = loader(SomeResource({ id: '123' }));
  const [data] = await load();
  return <div>{data.name}</div>;
}

export default componentLoader(MyComponent).withBoundary(<LoadingFallback />);
```

## 🙏 관련 패키지

이 라이브러리는 @h1y 생태계의 다른 패키지들을 기반으로 구축되었습니다:

- **[@h1y/loader-core v6.0.0](https://github.com/h1ylabs/next-loader/tree/main/packages/core)** - 재시도/타임아웃/백오프를 갖춘 핵심 로딩 기능
- **[@h1y/promise-aop v6.0.0](https://github.com/h1ylabs/next-loader/tree/main/packages/promise-aop)** - 미들웨어를 위한 Promise 기반 AOP 프레임워크

**의존성 (Dependencies):**

- `react-error-boundary ^6.0.0` - componentLoader를 위한 에러 바운다리 유틸리티

**필수 의존성 (Peer Dependencies):**

- React ≥18.2.0
- Next.js ≥14.0.0 (`NextJSAdapter` 및 캐시 통합용)

## 📄 라이선스

MIT © [h1ylabs](https://github.com/h1ylabs)
