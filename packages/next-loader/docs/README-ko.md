# @h1y/next-loader

**최신 버전: v6.0.1**

Next.js 애플리케이션을 위해 특별히 설계된 강력하고 타입 안전한 리소스 로딩 라이브러리입니다. 내장된 캐싱, 재검증, 재시도 로직, 그리고 Next.js 서버 컴포넌트와의 원활한 통합을 통해 효율적인 데이터 페칭을 구현할 수 있습니다.

[영어 문서 (English Documentation)](https://github.com/h1ylabs/next-loader/tree/main/packages/next-loader/README.md)

[![npm version](https://badge.fury.io/js/%40h1y%2Fnext-loader.svg)](https://badge.fury.io/js/%40h1y%2Fnext-loader)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 📑 목차

- [✨ 주요 기능](#-주요-기능)
- [📦 설치](#-설치)
- [🔧 호환성](#-호환성)
- [🚀 빠른 시작](#-빠른-시작)
- [🧩 핵심 개념](#-핵심-개념)
  - [리소스 빌더 패턴](#리소스-빌더-패턴)
  - [로딩 방식: 언제 무엇을 사용할지](#로딩-방식-언제-무엇을-사용할지)
  - [계층적 태그로 스마트 캐시 무효화](#계층적-태그로-스마트-캐시-무효화)
- [🎯 예제](#-예제)
  - [최소한의 예제](#-예제)
- [🎛️ 미들웨어 시스템](#-미들웨어-시스템)
- [📖 API 참조](#-api-참조)
- [🔄 Next.js 통합](#-nextjs-통합)
- [⚠️ 모범 사례 및 중요 가이드라인](#-모범-사례-및-중요-가이드라인)
- [🤔 자주 묻는 질문](#-자주-묻는-질문)
- [🛠️ 의존성](#-의존성)
- [🔍 문제 해결](#-문제-해결)
- [📄 라이선스](#-라이선스)

## ✨ 주요 기능

- **🎯 Next.js 네이티브**: Next.js를 위해 특별히 설계되었으며 서버 컴포넌트를 완벽하게 지원합니다
- **⚡ 배치 로딩**: 여러 리소스를 병렬로 완전한 타입 안전성으로 로드
- **🔄 스마트 캐싱**: Next.js 캐시 시스템 및 재검증과 원활하게 통합됩니다
- **🛡️ 타입 안전성**: 지능적인 타입 추론을 통한 완전한 TypeScript 지원
- **🎭 경계 관리**: 컴포넌트 회복력을 위한 Suspense와 Error Boundary 통합
- **💾 상태 지속성**: `componentState`가 재시도 사이클 전반에 걸쳐 상태를 유지
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

## 🔧 호환성

- **React**: 18.3+ (peer dependency)
- **Next.js**: 14+ (App Router 권장)
- **Node.js**: 18+
- **TypeScript**: 5+ (선택사항이지만 권장)

**참고**: Next.js App Router와 Server Components에서 최적으로 동작합니다. Next.js가 아닌 환경에서는 `createExternalResourceAdapter()`를 통해 커스텀 어댑터를 사용하세요.

## 🚀 빠른 시작

@h1y/next-loader를 3단계로 간단히 시작해보세요:

### 1. 의존성 설정 및 전역 로더 생성

```typescript
import { cache } from "react";
import { loaderFactory } from "@h1y/next-loader";

// 모듈 레벨에서 한 번 생성하여 어디서나 재사용
const loader = loaderFactory({
  memo: cache, // 요청 중복 제거
});
```

### 2. 리소스 정의

```typescript
import { resourceFactory, NextJSAdapter } from "@h1y/next-loader";

// 프로젝트 관리 앱을 위한 데이터 타입 정의
interface Project {
  id: string;
  name: string;
  description: string;
  status: "active" | "completed" | "archived";
  ownerId: string;
  teamId: string;
}

interface Task {
  id: string;
  title: string;
  description: string;
  status: "todo" | "in-progress" | "done";
  assigneeId: string;
  projectId: string;
  dueDate?: string;
  priority: "low" | "medium" | "high";
}

const Project = resourceFactory({
  tags: (req: { id: string }) => ({ id: `project-${req.id}` }),
  options: { staleTime: 300000 }, // 5분 - 프로젝트 정보는 변경이 적음
  load: async ({ req, fetcher }) => {
    const response = await fetcher(NextJSAdapter).load(
      `/api/projects/${req.id}`,
    );
    if (!response.ok) throw new Error(`Failed to fetch project`);
    return response.json() as Project;
  },
});

const ProjectTasks = resourceFactory({
  tags: (req: { projectId: string }) => ({
    id: `project-${req.projectId}-tasks`,
  }),
  options: { staleTime: 60000 }, // 1분 - 할 일은 자주 변경됨
  load: async ({ req, fetcher }) => {
    const response = await fetcher(NextJSAdapter).load(
      `/api/projects/${req.projectId}/tasks`,
    );
    if (!response.ok) throw new Error(`Failed to fetch tasks`);
    return response.json() as Task[];
  },
});
```

### 3. 컴포넌트에서 사용

**단일 리소스:**

```typescript
import { revalidateTag } from "next/cache";

async function ProjectDetails({ params }: { params: { id: string } }) {
  const [load, revalidation] = loader(Project({ id: params.id }));
  const [project] = await load();

  return (
    <div className="project-details">
      <div className="flex justify-between items-center">
        <h1>{project.name}</h1>
        <span className={`status ${project.status}`}>{project.status}</span>
      </div>
      <p>{project.description}</p>

      <form action={async () => {
        "use server";
        revalidation.forEach(revalidateTag);
      }}>
        <button>프로젝트 새로고침</button>
      </form>
    </div>
  );
}
```

**배치 로딩 (여러 리소스):**

```typescript
async function ProjectDashboard({ params }: { params: { id: string } }) {
  // 프로젝트 정보와 할 일을 병렬로 완전한 타입 안전성으로 로드
  const [load, revalidation] = loader(
    Project({ id: params.id }),
    ProjectTasks({ projectId: params.id })
  );

  // 결과는 타입 안전: [Project, Task[]]
  const [project, tasks] = await load();

  const taskStats = {
    total: tasks.length,
    todo: tasks.filter(t => t.status === 'todo').length,
    inProgress: tasks.filter(t => t.status === 'in-progress').length,
    done: tasks.filter(t => t.status === 'done').length,
  };

  return (
    <div className="project-dashboard">
      <h1>{project.name} 대시보드</h1>

      <div className="task-stats">
        <div>전체: {taskStats.total}</div>
        <div>할 일: {taskStats.todo}</div>
        <div>진행 중: {taskStats.inProgress}</div>
        <div>완료: {taskStats.done}</div>
      </div>

      <div className="recent-tasks">
        <h3>최근 작업</h3>
        {tasks.slice(0, 5).map(task => (
          <div key={task.id} className={`task-item priority-${task.priority}`}>
            <span>{task.title}</span>
            <span className={`status ${task.status}`}>{task.status}</span>
          </div>
        ))}
      </div>

      <form action={async () => {
        "use server";
        revalidation.forEach(revalidateTag);
      }}>
        <button>모든 데이터 새로고침</button>
      </form>
    </div>
  );
}
```

이제 데이터가 자동으로 캐시되고, 배치 로딩되며, 재검증되어 프로덕션에서 사용할 준비가 완료되었습니다.

## 🧩 핵심 개념

### 리소스 빌더 패턴

리소스를 "스스로를 캐시하고 오류를 처리하는 방법을 아는 스마트 API 호출"로 생각하세요. 모든 곳에서 fetch() 호출을 작성하는 대신, 데이터 요구 사항을 한 번만 정의합니다:

빠른 시작에서 최소한의 리소스 정의와 사용 예제를 참조하세요.

**일반적인 fetch()보다 나은 이유:**

- ✅ **자동 캐싱** - 동일한 데이터를 두 번 가져오지 않습니다
- ✅ **오류 처리** - 실패한 요청에 대한 내장 재시도 로직
- ✅ **타입 안전성** - 완전한 TypeScript 지원
- ✅ **재사용 가능** - 한 번 정의하고 앱 어디서나 사용

### 로딩 방식: 언제 무엇을 사용할지

@h1y/next-loader는 함께 작동하는 두 가지 보완적인 방법을 제공합니다:

| 기능                   | `loaderFactory()`             | `componentLoaderFactory()`   |
| ---------------------- | ----------------------------- | ---------------------------- |
| **주요 용도**          | 캐싱을 통한 데이터 페칭       | 컴포넌트 회복력 및 상태      |
| **배치 로딩**          | ✅ 여러 리소스 병렬 처리      | ❌ 단일 컴포넌트 중심        |
| **Next.js 캐시 통합**  | ✅ ISR, revalidateTag         | ❌ 컴포넌트 레벨에서만       |
| **요청 중복 제거**     | ✅ React의 `cache()` 사용     | ❌ 해당 없음                 |
| **재시도 및 타임아웃** | 🔧 구성 가능                  | ✅ UI 피드백이 있는 내장     |
| **상태 지속성**        | ❌ 상태 없음                  | ✅ 재시도 사이클 전반에서    |
| **경계 관리**          | ❌ 수동 설정 필요             | ✅ Suspense + Error Boundary |
| **모범 사례**          | 대부분의 데이터 페칭 시나리오 | `loaderFactory()`와 결합     |

#### `loaderFactory()` 사용 시기

- **가장 일반적인 사용 사례** - 서버 컴포넌트에서 외부 데이터 로딩
- 여러 리소스를 동시에 로드해야 할 때 (배치 로딩)
- Next.js 캐시 통합 및 요청 중복 제거 필요
- 표준 데이터 페칭 패턴 구축

#### `componentLoaderFactory()` 사용 시기

- 사용자 피드백과 함께 컴포넌트 레벨 재시도 필요
- 재시도 시도 전반에 걸쳐 지속되는 상태 필요
- 자동 경계 관리 (로딩/오류 상태) 필요
- 회복력 있는 UI 컴포넌트 구축

#### 빠른 비교 예제

```typescript
// loaderFactory - 데이터 중심 접근법
const [load] = loader(Project({ id: "proj-123" }), ProjectTasks({ projectId: "proj-123" }));
const [project, tasks] = await load(); // 타입 안전성과 배치 로딩

// componentLoaderFactory - 컴포넌트 중심 접근법
const { componentLoader } = componentLoaderFactory({ retry: { maxCount: 3 } });
export default componentLoader(ProjectDashboard).withErrorBoundary({
  fallback: <div>프로젝트 데이터 로드에 실패했습니다</div>
});
```

#### 모범 사례: 함께 사용하기

**권장 패턴**: `componentLoaderFactory()` 컴포넌트 내에서 데이터 페칭을 위해 `loaderFactory()` 사용:

```typescript
const loader = loaderFactory({ memo: cache });
const { componentLoader } = componentLoaderFactory({
  retry: { maxCount: 3, canRetryOnError: true }
});

async function RobustProjectDashboard({ projectId }: { projectId: string }) {
  // 데이터 페칭에 로더 사용 - 캐싱 + 배치 로딩 획득
  const [load, revalidation] = loader(
    Project({ id: projectId }),
    ProjectTasks({ projectId })
  );

  // 로더 실패가 자동으로 componentLoader 재시도를 트리거
  const [project, tasks] = await load();

  const urgentTasks = tasks.filter(t => t.priority === 'high' && t.status !== 'done');
  const completionRate = Math.round((tasks.filter(t => t.status === 'done').length / tasks.length) * 100);

  return (
    <div className="robust-dashboard">
      <header>
        <h1>{project.name}</h1>
        <div className="project-metrics">
          <span>상태: {project.status}</span>
          <span>완료율: {completionRate}%</span>
          <span>긴급 작업: {urgentTasks.length}개</span>
        </div>
      </header>

      {urgentTasks.length > 0 && (
        <div className="urgent-tasks-alert">
          <h3>⚠️ 주의가 필요한 긴급 작업</h3>
          {urgentTasks.map(task => (
            <div key={task.id} className="urgent-task">
              {task.title} {task.dueDate && `(마감일: ${task.dueDate})`}
            </div>
          ))}
        </div>
      )}

      <form action={async () => {
        "use server";
        revalidation.forEach(revalidateTag);
      }}>
        <button>대시보드 새로고침</button>
      </form>
    </div>
  );
}

// 데이터 로딩 효율성 + 컴포넌트 회복력 모두 획득
export default componentLoader(RobustProjectDashboard).withBoundary(<div>프로젝트 대시보드 로딩 중...</div>);
```

### 계층적 태그로 스마트 캐시 무효화

계층적 태그는 강력하고 리소스 기반의 캐시 무효화를 제공합니다. 태그가 리소스를 어떻게 연결하는지 이해하는 것은 효율적인 캐싱 전략을 구축하는 데 중요합니다.

#### 핵심 원칙

**태그는 리소스 연결자이지 캐시 대상이 아닙니다:**

- 태그는 리소스를 식별하고 연결합니다
- 실제 무효화 대상은 항상 리소스이지 태그가 아닙니다
- `revalidateTag("literal-string")`을 직접 사용하지 마세요
- 항상 로더에서 `revalidation.forEach(revalidateTag)`를 사용하세요

#### `id`와 `effects` 이해하기

**`id` (리소스 정체성):**

- 캐시에서 이 리소스를 고유하게 식별합니다
- 평면 및 계층적 스타일 모두 지원
  - 평면 문자열: "user-123-posts"
  - 계층적 정체성: `hierarchyTag()` 사용 (예: `hierarchyTag("user", userId, "posts")` → ["user", "user/123", "user/123/posts"])
- 광범위한 무효화 패턴에는 계층이 권장되지만, 간단한 경우에는 필수가 아닙니다
- 적절한 경우 다른 리소스나 캐시 태그가 이러한 정체성과 일치하여 무효화될 수 있습니다

**`effects` (캐시 무효화 태그):**

- 이 리소스가 변경될 때 무효화될 태그 문자열을 나열합니다
- 이들은 임의의 캐시 태그가 될 수 있으며, 다른 리소스에 해당할 필요가 없습니다
- 커스텀 캐시 무효화 로직과 횡단 관심사에 사용됩니다
- 절대 자신의 `id` 계층 레벨을 포함하지 마세요 (금지 패턴)

#### 기본 계층 예제

```typescript
// 먼저 관련 리소스 정의
const GlobalActivityFeed = resourceFactory({
  tags: () => ({ id: "global-activity-feed" }),
  load: async ({ fetcher }) => {
    const response = await fetcher(NextJSAdapter).load("/api/activity-feed");
    return response.json();
  },
});

const TrendingTopics = resourceFactory({
  tags: () => ({ id: "trending-topics" }),
  load: async ({ fetcher }) => {
    const response = await fetcher(NextJSAdapter).load("/api/trending");
    return response.json();
  },
});

// 계층과 effects가 있는 메인 리소스
const UserPosts = resourceFactory({
  tags: (req: { userId: string }) => ({
    id: hierarchyTag("user", req.userId, "posts"), // 생성: ["user", "user/123", "user/123/posts"]
    effects: [
      "global-activity-feed", // UserPosts가 변경될 때 GlobalActivityFeed 무효화
      "trending-topics", // UserPosts가 변경될 때 TrendingTopics 무효화
    ],
  }),
  load: async ({ req, fetcher }) => {
    const response = await fetcher(NextJSAdapter).load(
      `/api/users/${req.userId}/posts`,
    );
    if (!response.ok)
      throw new Error(`Failed to fetch posts: ${response.status}`);
    return response.json();
  },
});
```

#### 무효화 작동 방식

**UserPosts가 직접 재검증될 때:**

```typescript
const [load, revalidation] = loader(UserPosts({ userId: "123" }));

// 컴포넌트에서:
<form action={async () => {
  "use server";
  revalidation.forEach(revalidateTag); // ✅ 올바른 방법
}}>
  <button>게시글 새로고침</button>
</form>
```

**무효화 연쇄:**

1. **주요 무효화**: `["user", "user/123", "user/123/posts"]` 계층 레벨
2. **리소스 일치**: 이러한 레벨과 일치하는 `id`를 가진 모든 리소스가 무효화됨
3. **Effects 연쇄**: 캐시 태그 "global-activity-feed"와 "trending-topics"가 무효화됨
4. **연쇄 반응**: 해당 캐시 태그가 다른 리소스에서 사용되면 연쇄가 계속됨

#### 다차원 계층

복잡한 애플리케이션의 경우 정교한 무효화 네트워크를 생성하세요:

```typescript
// 전자상거래 제품 계층
const ProductVariant = resourceFactory({
  tags: (req: {
    storeId: string;
    categoryId: string;
    productId: string;
    variantId: string;
  }) => ({
    id: hierarchyTag(
      "store",
      req.storeId,
      "category",
      req.categoryId,
      "product",
      req.productId,
      "variant",
      req.variantId,
    ),
    effects: [
      `store-${req.storeId}-inventory`, // StoreInventory 리소스와 일치
      `category-${req.categoryId}-index`, // CategoryIndex 리소스와 일치
      `product-${req.productId}-recommendations`, // ProductRecommendations 리소스와 일치
    ],
  }),
  load: async ({ req, fetcher }) => {
    const response = await fetcher(NextJSAdapter).load(
      `/api/stores/${req.storeId}/categories/${req.categoryId}/products/${req.productId}/variants/${req.variantId}`,
    );
    return response.json();
  },
});

// 다중 테넌트 SaaS 계층
const ServiceMetrics = resourceFactory({
  tags: (req: {
    orgId: string;
    teamId: string;
    projectId: string;
    serviceId: string;
  }) => ({
    id: hierarchyTag(
      "org",
      req.orgId,
      "team",
      req.teamId,
      "project",
      req.projectId,
      "service",
      req.serviceId,
    ),
    effects: [
      `org-${req.orgId}-billing`, // OrganizationBilling 리소스와 일치
      `team-${req.teamId}-dashboard`, // TeamDashboard 리소스와 일치
      `project-${req.projectId}-alerts`, // ProjectAlerts 리소스와 일치
    ],
  }),
  load: async ({ req, fetcher }) => {
    const response = await fetcher(NextJSAdapter).load(
      `/api/orgs/${req.orgId}/teams/${req.teamId}/projects/${req.projectId}/services/${req.serviceId}/metrics`,
    );
    return response.json();
  },
});
```

#### 리소스 간 의존성

전략적 `effects`를 통해 리소스가 서로를 무효화하도록 할 수 있습니다:

```typescript
const UserProfile = resourceFactory({
  tags: (req: { userId: string }) => ({
    id: hierarchyTag("user", req.userId, "profile"),
    effects: [
      `user/${req.userId}/posts`, // UserPosts 계층 레벨과 일치
      `user-${req.userId}-notifications`, // UserNotifications 리소스와 일치
      "global-search-index", // GlobalSearchIndex 리소스와 일치
    ],
  }),
  load: async ({ req, fetcher }) => {
    const response = await fetcher(NextJSAdapter).load(
      `/api/users/${req.userId}/profile`,
    );
    return response.json();
  },
});
```

#### ❌ 피해야 할 일반적인 실수

```typescript
// ❌ 절대 직접 태그 호출하지 마세요
revalidateTag("user/123/posts"); // 금지!

// ❌ effects에 자신의 계층을 포함하지 마세요
const UserPosts = resourceFactory({
  tags: (req) => ({
    id: hierarchyTag("user", req.userId, "posts"),
    effects: [
      "user", // ❌ 자신의 상위 계층
      `user/${req.userId}`, // ❌ 자신의 상위 계층
      `user/${req.userId}/profile`, // ✅ 다른 리소스는 괜찮음
    ],
  }),
});

// ❌ effects에 임의의 문자열 사용하지 마세요
const UserPosts = resourceFactory({
  tags: (req) => ({
    id: hierarchyTag("user", req.userId, "posts"),
    effects: ["some-random-string"], // ❌ 의미 있는 캐시 태그 사용
  }),
});
```

#### ✅ 모범 사례

```typescript
// ✅ 명확한 리소스 관계
const UserPosts = resourceFactory({
  tags: (req) => ({
    id: hierarchyTag("user", req.userId, "posts"),
    effects: [
      "global-activity-feed", // ✅ 활동 피드용 커스텀 캐시 태그
      "search-index", // ✅ 검색 인덱스용 커스텀 캐시 태그
      "recommendation-engine" // ✅ 추천용 커스텀 캐시 태그
    ]
  })
});

// ✅ 항상 로더에서 revalidation 사용
const [load, revalidation] = loader(UserPosts({ userId: "123" }));
<form action={async () => {
  "use server";
  revalidation.forEach(revalidateTag); // ✅ 유일한 올바른 방법
}}>
  <button>업데이트</button>
</form>
```

**실제 무효화 시나리오:**

- **사용자 프로필 업데이트** → 프로필 리소스 + 커스텀 캐시 태그(분석, 검색 인덱스) 무효화
- **새 게시글 생성** → 사용자 게시글 + 커스텀 캐시 태그(활동 피드, 인기 주제) 무효화
- **제품 가격 변경** → 특정 제품 변형 + 커스텀 캐시 태그(재고, 추천) 무효화
- **팀 설정 업데이트** → 팀 계층 + 커스텀 캐시 태그(프로젝트, 서비스) 무효화

> 고급 계층 패턴과 대규모 무효화 전략은 문서 사이트를 참조하세요.

## 🎯 예제

### 기본 리소스 로딩

간단하고 실용적인 예제로 시작하세요:

```typescript
// 팀 멤버 정보를 위한 리소스 정의
const TeamMember = resourceFactory({
  tags: (req: { id: string }) => ({ id: `team-member-${req.id}` }),
  options: { staleTime: 300000 }, // 5분
  load: async ({ req, fetcher }) => {
    const response = await fetcher(NextJSAdapter).load(`/api/team/members/${req.id}`);
    if (!response.ok) throw new Error(`Failed to fetch team member`);
    return response.json();
  },
});

// 서버 컴포넌트에서 로드
async function TeamMemberProfile({ params }: { params: { id: string } }) {
  const [load] = loader(TeamMember({ id: params.id }));
  const [member] = await load();

  return (
    <div className="member-profile">
      <h1>{member.name}</h1>
      <p>{member.role} • {member.department}</p>
      <p>📧 {member.email}</p>
    </div>
  );
}
```

### 실제 팀 대시보드

의미있는 비즈니스 로직을 포함한 배치 로딩 실제 예제:

```typescript
// 팀 관리 대시보드를 위한 리소스들
const TeamOverview = resourceFactory({
  tags: (req: { teamId: string }) => ({ id: `team-${req.teamId}-overview` }),
  options: { staleTime: 120000 }, // 2분
  load: async ({ req, fetcher }) => {
    const response = await fetcher(NextJSAdapter).load(`/api/teams/${req.teamId}/overview`);
    if (!response.ok) throw new Error(`Failed to fetch team overview`);
    return response.json();
  },
});

const ActiveProjects = resourceFactory({
  tags: (req: { teamId: string }) => ({ id: `team-${req.teamId}-active-projects` }),
  options: { staleTime: 60000 }, // 1분 - 프로젝트는 자주 변경됨
  load: async ({ req, fetcher }) => {
    const response = await fetcher(NextJSAdapter).load(`/api/teams/${req.teamId}/projects/active`);
    if (!response.ok) throw new Error(`Failed to fetch active projects`);
    return response.json();
  },
});

const TeamPerformanceMetrics = resourceFactory({
  tags: (req: { teamId: string; period: string }) => ({
    id: `team-${req.teamId}-metrics-${req.period}`
  }),
  options: { staleTime: 300000 }, // 5분 - 지표는 천천히 변경됨
  load: async ({ req, fetcher }) => {
    const response = await fetcher(NextJSAdapter).load(
      `/api/teams/${req.teamId}/metrics?period=${req.period}`
    );
    if (!response.ok) throw new Error(`Failed to fetch team metrics`);
    return response.json();
  },
});

// 팀 관리 대시보드 컴포넌트
async function TeamManagementDashboard({
  params
}: {
  params: { teamId: string }
}) {
  // 필요한 모든 데이터를 완전한 타입 안전성으로 병렬 로드
  const [load, revalidation] = loader(
    TeamOverview({ teamId: params.teamId }),
    ActiveProjects({ teamId: params.teamId }),
    TeamPerformanceMetrics({ teamId: params.teamId, period: '30d' })
  );

  // TypeScript는 정확한 타입을 알고 있음: [TeamOverview, Project[], PerformanceMetrics]
  const [overview, projects, metrics] = await load();

  const criticalProjects = projects.filter(p =>
    p.status === 'at-risk' || (p.dueDate && new Date(p.dueDate) < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000))
  );

  return (
    <div className="team-dashboard">
      <header className="dashboard-header">
        <h1>{overview.teamName} 팀 대시보드</h1>
        <div className="team-stats">
          <div>👥 {overview.memberCount}명</div>
          <div>📊 {projects.length}개 활성 프로젝트</div>
          <div>⚡ {metrics.velocityScore}/100 속도</div>
        </div>
      </header>

      {criticalProjects.length > 0 && (
        <div className="critical-alerts">
          <h2>🚨 주의가 필요한 프로젝트</h2>
          {criticalProjects.map(project => (
            <div key={project.id} className="alert-item">
              <span>{project.name}</span>
              <span className="status">{project.status}</span>
              {project.dueDate && (
                <span>마감일: {new Date(project.dueDate).toLocaleDateString()}</span>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="dashboard-grid">
        <section className="project-overview">
          <h3>활성 프로젝트</h3>
          {projects.map(project => (
            <div key={project.id} className="project-card">
              <h4>{project.name}</h4>
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{ width: `${project.completionPercentage}%` }}
                />
              </div>
              <span>{project.completionPercentage}% 완료</span>
            </div>
          ))}
        </section>

        <section className="performance-metrics">
          <h3>팀 성과 (지난 30일)</h3>
          <div className="metrics-grid">
            <div>완료된 작업: {metrics.tasksCompleted}</div>
            <div>평균 해결 시간: {metrics.avgResolutionTime}시간</div>
            <div>팀 만족도: {metrics.satisfactionScore}/10</div>
          </div>
        </section>
      </div>

      <form action={async () => {
        "use server";
        // 모든 대시보드 데이터 새로고침
        revalidation.forEach(revalidateTag);
      }}>
        <button className="refresh-btn">🔄 대시보드 새로고침</button>
      </form>
    </div>
  );
}
```

### 복잡한 전자상거래 리소스 네트워크

정교한 캐시 관계를 가진 실제 전자상거래 예제:

```typescript
// 다차원 계층을 가진 제품 카탈로그
const Product = resourceFactory({
  tags: (req: { storeId: string; categoryId: string; productId: string }) => ({
    id: hierarchyTag("store", req.storeId, "category", req.categoryId, "product", req.productId),
    effects: [
      `store-${req.storeId}-search-index`, // 매장 검색 인덱스
      `category-${req.categoryId}-bestsellers`, // 카테고리 베스트셀러
      "recommendation-engine-products", // 제품 추천
      "price-tracking-global" // 가격 추적 시스템
    ]
  }),
  options: { staleTime: 600000 },
  load: async ({ req, fetcher }) => {
    const response = await fetcher(NextJSAdapter).load(
      `/api/stores/${req.storeId}/categories/${req.categoryId}/products/${req.productId}`
    );
    return response.json();
  },
});

// 제품 가용성에 영향을 주는 재고
const ProductInventory = resourceFactory({
  tags: (req: { storeId: string; productId: string; warehouseId: string }) => ({
    id: hierarchyTag("inventory", "store", req.storeId, "product", req.productId, "warehouse", req.warehouseId),
    effects: [
      `store/${req.storeId}/category/*/product/${req.productId}`, // 이 제품의 모든 카테고리 인스턴스
      `warehouse-${req.warehouseId}-capacity`, // 창고 용량 추적
      "inventory-alerts-low-stock", // 재고 부족 알림
      "fulfillment-optimization-queue" // 배송 최적화
    ]
  }),
  options: { staleTime: 30000 }, // 재고는 더 빈번한 업데이트
  load: async ({ req, fetcher }) => {
    const response = await fetcher(NextJSAdapter).load(
      `/api/stores/${req.storeId}/products/${req.productId}/inventory/${req.warehouseId}`
    );
    return response.json();
  },
});

// 세션 기반 계층을 가진 고객 장바구니
const ShoppingCart = resourceFactory({
  tags: (req: { customerId: string; sessionId: string }) => ({
    id: hierarchyTag("customer", req.customerId, "cart", "session", req.sessionId),
    effects: [
      `customer-${req.customerId}-recommendations`, // 고객 추천
      `session-${req.sessionId}-analytics`, // 세션 분석
      "cart-abandonment-tracking", // 장바구니 이탈 추적
      "real-time-inventory-check" // 실시간 재고 확인
    ]
  }),
  options: { staleTime: 60000 },
  use: (req) => [
    Product({ storeId: "main", categoryId: "electronics", productId: "laptop-123" }), // 예제 의존성
  ],
  load: async ({ req, fetcher, use: [product] }) => {
    const productData = await product;
    const response = await fetcher(NextJSAdapter).load(
      `/api/customers/${req.customerId}/cart?session=${req.sessionId}`
    );

    const cartData = await response.json();

    return {
      ...cartData,
      recommendations: productData.related || [],
      totalValue: cartData.items.reduce((sum: number, item: any) => sum + item.price * item.quantity, 0)
    };
  },
});

// 종합적인 전자상거래 대시보드
async function EcommerceDashboard({
  storeId,
  categoryId,
  productId,
  customerId,
  sessionId,
  warehouseId
}: {
  storeId: string;
  categoryId: string;
  productId: string;
  customerId: string;
  sessionId: string;
  warehouseId: string;
}) {
  // 여러 리소스를 완전한 타입 안전성으로 병렬 로드
  const [load, revalidation] = loader(
    Product({ storeId, categoryId, productId }),
    ProductInventory({ storeId, productId, warehouseId }),
    ShoppingCart({ customerId, sessionId })
  );

  // TypeScript는 정확한 타입을 알고 있음: [Product, ProductInventory, ShoppingCart]
  const [product, inventory, cart] = await load();

  return (
    <div className="ecommerce-dashboard">
      <div className="product-section">
        <h2>{product.name}</h2>
        <p>가격: ${product.price}</p>
        <p>재고: {inventory.quantity}개</p>
        <p>창고: {inventory.location}</p>
      </div>

      <div className="cart-section">
        <h3>장바구니 ({cart.items.length}개 항목)</h3>
        <p>총 금액: ${cart.totalValue}</p>
        <p>추천: {cart.recommendations.length}개 항목</p>
      </div>

      <div className="actions">
        <form action={async () => {
          "use server";
          // 이것은 모든 effects를 통해 연쇄됩니다:
          // - 검색 인덱스 업데이트
          // - 추천 새로고침
          // - 분석 업데이트
          // - 재고 알림 트리거
          revalidation.forEach(revalidateTag);
        }}>
          <button>모든 데이터 새로고침</button>
        </form>
      </div>
    </div>
  );
}
```

### 실시간 모니터링과 컴포넌트 상태 관리

`componentState`를 사용하여 재시도 사이클 동안 상태를 유지하세요 - 연결 상태와 재시도 시도를 추적해야 하는 모니터링 대시보드에 특히 강력합니다. React useState와 달리 componentState는 재시도 전반에 걸쳐 유지됩니다.

```typescript
const loader = loaderFactory({ memo: cache });
const { componentLoader, componentState, componentOptions } = componentLoaderFactory({
  retry: { maxCount: 5, canRetryOnError: true }
});

// 시스템 모니터링을 위한 리소스 정의
const SystemHealth = resourceFactory({
  tags: (req: { serviceId: string }) => ({ id: `system-health-${req.serviceId}` }),
  options: { staleTime: 30000 }, // 30초 - 건강 상태 데이터는 신선해야 함
  load: async ({ req, fetcher }) => {
    const response = await fetcher(NextJSAdapter).load(`/api/services/${req.serviceId}/health`);
    if (!response.ok) throw new Error(`Service health check failed: ${response.status}`);
    return response.json();
  },
});

const ServiceMetrics = resourceFactory({
  tags: (req: { serviceId: string; period: string }) => ({
    id: `service-metrics-${req.serviceId}-${req.period}`
  }),
  options: { staleTime: 60000 }, // 1분
  load: async ({ req, fetcher }) => {
    const response = await fetcher(NextJSAdapter).load(
      `/api/services/${req.serviceId}/metrics?period=${req.period}`
    );
    if (!response.ok) throw new Error(`Failed to fetch metrics: ${response.status}`);
    return response.json();
  },
});

async function SystemMonitoringDashboard({ serviceId }: { serviceId: string }) {
  // 재시도 사이클 동안 상태 유지 - 모니터링 대시보드에 중요
  const [connectionAttempts, setConnectionAttempts] = componentState(0);
  const [lastSuccessfulUpdate, setLastSuccessfulUpdate] = componentState<Date | null>(null);
  const [connectionStatus, setConnectionStatus] = componentState<'connected' | 'reconnecting' | 'failed'>('connected');

  const options = componentOptions();

  // 연결 시도 추적 및 상태 업데이트
  if (options.retry.count > connectionAttempts) {
    setConnectionAttempts(options.retry.count);
    setConnectionStatus('reconnecting');
  }

  try {
    // 시스템 데이터 로드 - 실패 시 자동 재시도 트리거
    const [loadHealth] = loader(SystemHealth({ serviceId }));
    const [loadMetrics] = loader(ServiceMetrics({ serviceId, period: '1h' }));

    const [health, metrics] = await Promise.all([
      loadHealth(),
      loadMetrics()
    ]);

    // 성공적인 로드 시 연결 상태 재설정
    if (connectionStatus !== 'connected') {
      setConnectionStatus('connected');
      setLastSuccessfulUpdate(new Date());
    }

    const isHealthy = health.status === 'healthy' && health.responseTime < 500;
    const alertCount = health.alerts?.length || 0;

    return (
      <div className="monitoring-dashboard">
        <header className="dashboard-status">
          <h1>서비스 모니터: {health.serviceName}</h1>
          <div className="connection-info">
            <div className={`status-indicator ${connectionStatus}`}>
              {connectionStatus === 'connected' && '🟢 연결됨'}
              {connectionStatus === 'reconnecting' && '🟡 재연결 중...'}
              {connectionStatus === 'failed' && '🔴 연결 실패'}
            </div>
            {connectionAttempts > 0 && (
              <span className="retry-count">재시도: {connectionAttempts}번</span>
            )}
          </div>
        </header>

        <div className="health-overview">
          <div className={`health-status ${isHealthy ? 'healthy' : 'warning'}`}>
            <h3>시스템 건강 상태</h3>
            <div>상태: {health.status}</div>
            <div>응답 시간: {health.responseTime}ms</div>
            <div>CPU 사용률: {health.cpuUsage}%</div>
            <div>메모리 사용률: {health.memoryUsage}%</div>
          </div>

          {alertCount > 0 && (
            <div className="alerts-panel">
              <h3>🚨 활성 알림 ({alertCount}개)</h3>
              {health.alerts.map((alert: any) => (
                <div key={alert.id} className={`alert ${alert.severity}`}>
                  <span>{alert.message}</span>
                  <time>{new Date(alert.timestamp).toLocaleTimeString()}</time>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="metrics-grid">
          <div className="metric-card">
            <h4>분당 요청</h4>
            <span className="metric-value">{metrics.requestsPerMinute}</span>
          </div>
          <div className="metric-card">
            <h4>오류율</h4>
            <span className={`metric-value ${metrics.errorRate > 5 ? 'warning' : ''}`}>
              {metrics.errorRate}%
            </span>
          </div>
          <div className="metric-card">
            <h4>평균 응답</h4>
            <span className="metric-value">{metrics.avgResponseTime}ms</span>
          </div>
        </div>

        <footer className="dashboard-footer">
          {lastSuccessfulUpdate && (
            <small>마지막 업데이트: {lastSuccessfulUpdate.toLocaleTimeString()}</small>
          )}
          {connectionAttempts > 0 && connectionStatus === 'connected' && (
            <small>✅ {connectionAttempts}번 시도 후 재연결 성공</small>
          )}
        </footer>
      </div>
    );
  } catch (error) {
    // 재시도 메커니즘을 트리거
    setConnectionStatus('failed');
    throw error;
  }
}

export default componentLoader(SystemMonitoringDashboard).withErrorBoundary({
  errorFallback: ({ error, resetErrorBoundary }) => (
    <div className="monitoring-error">
      <h2>🔴 모니터링 시스템 오프라인</h2>
      <p>모니터링 서비스에 연결할 수 없습니다</p>
      <button onClick={resetErrorBoundary}>연결 재시도</button>
    </div>
  )
});
```

### 재시도 (선택사항)

재시도/타임아웃과 같은 복원력 기능을 사용할 수 있지만 선택사항입니다.

### 오류 처리

오류 처리는 간단하게 유지하고 활성화된 경우 라이브러리가 재시도/타임아웃을 처리하도록 하세요.

## 🎛️ 미들웨어 시스템 (선택사항)

미들웨어로 횡단 관심사를 분리하세요.

## ⚠️ 모범 사례 및 중요 가이드라인

### Fallback 컴포넌트 가이드라인

fallback을 간단하고 자체 포함적이며, 상호작용이 필요한 경우 클라이언트 전용으로 유지하세요.

**Fallback 컴포넌트 예제**:

```typescript
// ✅ 올바른 예시: 로딩 fallback을 위한 별도 모듈
export function UserProfileLoadingFallback() {
  return (
    <div className="animate-pulse">
      <div className="h-8 bg-gray-200 rounded mb-2"></div>
      <div className="h-4 bg-gray-200 rounded"></div>
    </div>
  );
}

// ✅ 올바른 예시: 에러 fallback을 위한 별도 클라이언트 컴포넌트 모듈
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
        재시도
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

**next-loader는 Next.js를 지원하는 라이브러리이며 기본적인 행동 전략을 변경하지 않습니다:**

- **재시도로 해결할 수 없는 오류는 억제하지 마세요** - Next.js가 적절하게 처리할 수 있도록 자연스럽게 전파하도록 하세요

```typescript
// ❌ 잘못된 방법 - 이렇게 하지 마세요
async function MyComponent() {
  try {
    const data = await loadData();
    return <div>{data.content}</div>;
  } catch (error) {
    // 재시도로 해결할 수 없는 오류를 억제하지 마세요
    return <div>오류가 발생했습니다: {error.message}</div>;
  }
}

// ✅ 올바른 방법 - Next.js가 오류를 처리하도록 하세요
async function MyComponent() {
  // 재시도로 해결할 수 없는 오류는 자연스럽게 전파되어 Next.js가 처리합니다
  const data = await loadData();
  return <div>{data.content}</div>;
}
```

## 📖 API 참조

### `loaderFactory(dependencies, options?, middlewares?)`

```typescript
const loader = loaderFactory(
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

### `componentLoaderFactory(options?, middlewares?)`

```typescript
const { componentLoader } = componentLoaderFactory({
  retry: { maxCount: 3, canRetryOnError: true }
});

async function UserProfile({ userId }: { userId: string }) {
  const user = await fetchUserProfile(userId);
  return <div>{user.name}님, 안녕하세요!</div>;
}

// 세 가지 경계 관리 옵션:
export const NoBoundary = componentLoader(UserProfile).withNoBoundary();
export const WithSuspense = componentLoader(UserProfile).withBoundary(<LoadingFallback />);
export const WithErrorHandling = componentLoader(UserProfile).withErrorBoundary({
  errorFallback: ErrorFallback
});
```

#### 경계 관리 메소드

**`withNoBoundary()`**: 회복력 로직이 적용된 async 컴포넌트를 추가 경계 래핑 없이 그대로 반환합니다.

**`withBoundary(fallback?)`**: 독립적인 코드 분할과 로딩 상태를 위해 Suspense 경계로 컴포넌트를 래핑합니다.

**`withErrorBoundary(props)`**: 포괄적인 경계 관리로 오류와 로딩 상태를 모두 처리합니다.

```typescript
// 에러 바운더리 props
type AsyncErrorBoundaryProps = {
  pendingFallback?: React.ReactElement; // 로딩 상태
  errorFallback: (props: { error: unknown }) => React.ReactElement; // 에러 상태
};
```

#### loaderFactory와의 통합

```typescript
const loader = loaderFactory({ memo: cache });
const { componentLoader } = componentLoaderFactory({
  retry: { maxCount: 2, canRetryOnError: true }
});

async function Dashboard({ userId }: { userId: string }) {
  // 로더 실패가 자동으로 컴포넌트 재시도를 트리거
  const [loadUser] = loader(User({ id: userId }));
  const [loadPosts] = loader(UserPosts({ userId }));

  const [user, posts] = await Promise.all([loadUser(), loadPosts()]);
  return <div>{user.name}: {posts.length}개의 게시글</div>;
}

export default componentLoader(Dashboard).withBoundary(<div>로딩 중...</div>);
```

### `resourceFactory(config)`

```typescript
const UserPosts = resourceFactory({
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

### `hierarchyTag()`를 사용한 계층적 태그

`hierarchyTag()`를 사용하여 여러 레벨에서 광범위한 무효화를 지원하는 계층적 정체성을 생성하세요. 간단한 경우에는 평면 문자열도 여전히 작동합니다.

```typescript
import { hierarchyTag } from "@h1y/next-loader";

// hierarchyTag가 자동으로 계층 레벨을 생성합니다
const UserPosts = resourceFactory({
  tags: (req: { userId: string }) => ({
    id: hierarchyTag("user", req.userId, "posts"),
    effects: [
      "global-activity-feed",
      `user-${req.userId}-analytics`,
      "content-moderation-queue",
    ],
  }),
  load: async ({ req, fetcher }) => {
    const response = await fetcher(NextJSAdapter).load(
      `/api/users/${req.userId}/posts`,
    );
    if (!response.ok)
      throw new Error(`Failed to fetch posts: ${response.status}`);
    return response.json();
  },
});
```

#### 고급 계층 패턴

**시간 기반 계층:**

```typescript
const TimeSeriesData = resourceFactory({
  tags: (req: {
    metric: string;
    year: string;
    month: string;
    day: string;
  }) => ({
    id: hierarchyTag(
      "metrics",
      req.metric,
      "time",
      req.year,
      req.month,
      req.day,
    ),
    effects: [
      `metrics-${req.metric}-aggregates`, // 메트릭 집계
      `time-${req.year}-${req.month}-summary`, // 월간 요약
      "dashboard-realtime-updates", // 실시간 대시보드 업데이트
    ],
  }),
  load: async ({ req, fetcher }) => {
    const response = await fetcher(NextJSAdapter).load(
      `/api/metrics/${req.metric}/time/${req.year}/${req.month}/${req.day}`,
    );
    return response.json();
  },
});
```

**지리적 계층:**

```typescript
const LocationData = resourceFactory({
  tags: (req: {
    continent: string;
    country: string;
    region: string;
    city: string;
  }) => ({
    id: hierarchyTag("geo", req.continent, req.country, req.region, req.city),
    effects: [
      `geo-${req.country}-statistics`, // 국가 레벨 통계
      `geo-${req.continent}-regional-data`, // 대륙 데이터
      "global-geography-index", // 전역 지리 인덱스
    ],
  }),
  load: async ({ req, fetcher }) => {
    const response = await fetcher(NextJSAdapter).load(
      `/api/geography/${req.continent}/${req.country}/${req.region}/${req.city}`,
    );
    return response.json();
  },
});
```

**조건부 계층 구성:**

```typescript
const ConditionalResource = resourceFactory({
  tags: (req: { userId: string; isAdmin: boolean; teamId?: string }) => {
    const baseHierarchy = hierarchyTag("user", req.userId);

    if (req.isAdmin && req.teamId) {
      return {
        id: hierarchyTag(...baseHierarchy, "admin", "team", req.teamId),
        effects: [
          `user-${req.userId}-notifications`,
          `team-${req.teamId}-admin-actions`,
          "admin-audit-log",
          "security-monitoring",
        ],
      };
    }

    return {
      id: hierarchyTag(...baseHierarchy, "member"),
      effects: [`user-${req.userId}-notifications`, "member-activity-feed"],
    };
  },
  load: async ({ req, fetcher }) => {
    const role = req.isAdmin ? "admin" : "member";
    const response = await fetcher(NextJSAdapter).load(
      `/api/users/${req.userId}/role/${role}${req.teamId ? `?team=${req.teamId}` : ""}`,
    );
    return response.json();
  },
});
```

#### 타입 안전성과 IDE 지원

배열 구문은 뛰어난 TypeScript 지원을 제공합니다:

```typescript
// TypeScript가 계층 구조를 추론하고 검증할 수 있습니다
type UserHierarchy = ["user", string, "posts"]; // 타입 안전한 계층 구조
type OrgHierarchy = ["org", string, "team", string, "project", string];

const typedResource = resourceFactory({
  tags: (req: {
    userId: string;
  }): { id: UserHierarchy; effects: string[] } => ({
    id: hierarchyTag("user", req.userId, "posts"), // TypeScript가 UserHierarchy와 일치하는지 검증
    effects: ["activity-feed", "user-analytics"],
  }),
  load: async ({ req, fetcher }) => {
    const response = await fetcher(NextJSAdapter).load(
      `/api/users/${req.userId}/posts`,
    );
    return response.json();
  },
});
```

#### `hierarchyTag()`로부터의 마이그레이션

**레거시 (여전히 지원됨):**

```typescript
import { hierarchyTag } from "@h1y/next-loader";

const oldStyle = resourceFactory({
  tags: (req) => ({
    id: hierarchyTag("user", req.userId, "posts"), // 함수 호출
    effects: ["activity-feed"],
  }),
});
```

**현대적 (권장):**

```typescript
const newStyle = resourceFactory({
  tags: (req) => ({ id: hierarchyTag("user", req.userId, "posts") }),
});
```

- 현대적 JavaScript 패턴과 일치
- 동적으로 구성하기 더 쉬움

### 백오프 전략

서로 다른 백오프 전략으로 재시도 타이밍을 제어하세요:

```typescript
import {
  FIXED_BACKOFF,
  LINEAR_BACKOFF,
  EXPONENTIAL_BACKOFF,
} from "@h1y/next-loader";

// 고정 지연: 재시도 간 항상 2초 대기
const loader = loaderFactory(dependencies, {
  retry: { maxCount: 3, canRetryOnError: true },
  backoff: {
    strategy: FIXED_BACKOFF,
    initialDelay: 2000, // 2초
  },
});

// 선형 백오프: 1초, 3초, 5초 지연
const loader = loaderFactory(dependencies, {
  retry: { maxCount: 3, canRetryOnError: true },
  backoff: {
    strategy: LINEAR_BACKOFF(2000), // 재시도마다 2초 추가
    initialDelay: 1000, // 1초로 시작
  },
});

// 지수 백오프: 500ms, 1초, 2초, 4초 지연
const loader = loaderFactory(dependencies, {
  retry: { maxCount: 4, canRetryOnError: true },
  backoff: {
    strategy: EXPONENTIAL_BACKOFF(2), // 재시도마다 지연을 2배로 증가
    initialDelay: 500, // 500ms로 시작
  },
});
```

### `createExternalResourceAdapter(adapter)`

⚠️ **API 변경**: 이전에 `createResourceAdapter`로 명명되었던 것이 더 명확한 의미를 위해 `createExternalResourceAdapter`로 이름이 변경되었습니다.

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

const ExternalResource = resourceFactory({
  tags: (req: { url: string }) => ({ id: `external-${req.url}` }),
  load: async ({ req, fetcher }) => {
    const { load } = fetcher(externalAdapter);
    return load({ url: req.url, options: { method: "GET" } });
  },
});
```

## 🔄 Next.js 통합

**중요**: Next.js 캐싱으로 인해 재시도가 보이지 않을 수 있습니다. 재시도를 볼 수 있도록 동적 렌더링을 사용하세요:

```typescript
import { headers } from 'next/headers';

async function DynamicPage({ id }: { id: string }) {
  await headers(); // 동적 렌더링 강제

  const [load, revalidation] = loader(User({ id }));
  const [user] = await load(); // 재시도가 사용자에게 표시됨

  return (
    <div>
      <div>{user.name}</div>
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

## 🤔 자주 묻는 질문

### Q: Next.js 앱에서 재시도 시도가 보이지 않나요?

**A:** 이는 Next.js 캐싱 동작 때문입니다. 콘텐츠가 캐시되면 사용자는 재검증이 백그라운드에서 일어나는 동안 캐시된 버전을 즉시 받습니다. 재시도는 다음의 경우에만 볼 수 있습니다:

- 동적 렌더링 (`force-dynamic` 사용 또는 `headers()`, `cookies()`와 같은 동적 함수 사용)
- 캐시가 없는 새로운 요청
- 캐시 누락 또는 만료된 콘텐츠

### Q: 재시도 프로세스를 사용자에게 어떻게 보이게 할 수 있나요?

**A:** 동적 렌더링 패턴을 사용하세요:

```typescript
import { headers } from 'next/headers';

async function DynamicComponent() {
  await headers(); // 동적 렌더링 강제

  const [load, revalidation] = loader(SomeResource({ id: '123' }));
  const [data] = await load(); // 이제 재시도가 사용자에게 표시됩니다

  return (
    <div>
      <div>{data.content}</div>
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

### Q: componentLoader vs loader를 언제 사용해야 하나요?

**A:**

- **캐싱을 통한 데이터 페칭과 **배치 로딩**에는 `loaderFactory()` 사용** (가장 일반적인 사용 사례)
- **컴포넌트 레벨 재시도/타임아웃 동작과 상태 관리가 필요할 때는 `componentLoaderFactory()` 사용**

**모범 사례:** 함께 사용하세요:

```typescript
const loader = loaderFactory({ memo: cache }); // 전역 데이터 로딩
const { componentLoader } = componentLoaderFactory(config); // 컴포넌트 복원력

async function MyComponent() {
  const [load, revalidation] = loader(SomeResource({ id: '123' }));
  const [data] = await load();
  return (
    <div>
      <div>{data.name}</div>
      <form action={async () => {
        "use server";
        revalidation.forEach(revalidateTag);
      }}>
        <button>새로고침</button>
      </form>
    </div>
  );
}

export default componentLoader(MyComponent).withBoundary(<LoadingFallback />);
```

## 🛠️ 의존성

이 라이브러리는 @h1y 생태계의 다른 패키지들을 기반으로 구축되었습니다:

- **[@h1y/loader-core v6.0.0](https://github.com/h1ylabs/next-loader/tree/main/packages/core)** - 재시도/타임아웃/백오프를 갖춘 핵심 로딩 기능
- **[@h1y/promise-aop v6.0.0](https://github.com/h1ylabs/next-loader/tree/main/packages/promise-aop)** - 미들웨어를 위한 Promise 기반 AOP 프레임워크

**의존성:**

- `react-error-boundary ^6.0.0` - componentLoader를 위한 에러 바운더리 유틸리티

**피어 의존성:**

- React ≥18.3.0
- Next.js ≥14.0.0 (`NextJSAdapter` 및 캐시 통합용)

## 🔍 문제 해결

### 일반적인 문제들

#### "Resource not found" 또는 Import 오류

```typescript
// ❌ 잘못된 방법
import { User } from "./resources"; // 제대로 정의되지 않았을 수 있음

// ✅ 올바른 방법
const User = resourceFactory({
  tags: (req: { id: string }) => ({ id: `user-${req.id}` }),
  load: async ({ req, fetcher }) => {
    // 로드 함수가 제대로 구현되었는지 확인하세요
    const response = await fetcher(NextJSAdapter).load(`/api/users/${req.id}`);
    if (!response.ok)
      throw new Error(`Failed to fetch user: ${response.status}`);
    return response.json();
  },
});
```

#### 개발 환경에서 재시도가 보이지 않음

**원인**: Next.js 캐싱이 재시도 시도를 가립니다  
**해결책**: 재시도 동작을 보기 위해 동적 렌더링 사용

```typescript
import { headers } from 'next/headers';

async function MyComponent() {
  // 개발 환경에서 재시도 동작을 보기 위해 동적 렌더링 강제
  const headersList = headers();
  const userAgent = headersList.get('user-agent') || 'unknown';

  const [load] = loader(User({ id: "123" }));
  const [user] = await load();

  return <div>{user.name} (UA: {userAgent})</div>;
}
```

#### 배치 로딩에서 TypeScript 오류

```typescript
// ❌ 잘못된 방법 - 타입 추론이 누락됨
const [load] = loader(User({ id: "123" }), UserPosts({ userId: "123" }));
const data = await load(); // TypeScript가 타입을 추론할 수 없음

// ✅ 올바른 방법 - TypeScript가 추론하도록 하거나 명시적으로 타입 지정
const [load] = loader(User({ id: "123" }), UserPosts({ userId: "123" }));
const [user, posts] = await load(); // TypeScript가 타입을 알고 있음: [User, Post[]]
```

#### Error Boundaries에서 "Cannot read properties of undefined" 오류

**원인**: Fallback 컴포넌트가 로더 컨텍스트에 접근하려고 함  
**해결책**: fallback 컴포넌트를 독립적으로 유지

```typescript
// ❌ 잘못된 방법 - fallback에서 컨텍스트에 접근하려고 함
function ErrorFallback({ error }: { error: Error }) {
  const options = componentOptions(); // ❌ fallback에서 사용할 수 없음
  return <div>오류: {error.message}</div>;
}

// ✅ 올바른 방법 - 자체 포함된 fallback
function ErrorFallback({ error, resetErrorBoundary }: { error: Error; resetErrorBoundary: () => void }) {
  return (
    <div>
      <h3>오류가 발생했습니다</h3>
      <p>{error.message}</p>
      <button onClick={resetErrorBoundary}>다시 시도</button>
    </div>
  );
}
```

### 디버그 모드

문제 해결을 위해 자세한 로깅을 활성화하세요:

```typescript
const loader = loaderFactory(
  { memo: cache },
  {
    /* options */
  },
  [
    loaderMiddleware({
      name: "debug",
      before: async () => console.log("🚀 로딩 시작됨"),
      complete: async () => console.log("✅ 로딩 완료됨"),
      error: async (_, error) => console.error("❌ 로딩 실패:", error),
    }),
  ],
);
```

## 📄 라이선스

MIT © [h1ylabs](https://github.com/h1ylabs)
