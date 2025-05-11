# `@h1y/next-loader`

안녕하세요! 이 라이브러리는 Next.js 개발을 더욱 편리하게 만들어주는 도구입니다. 외부 리소스(API 데이터 등)를 효율적으로 불러오고 관리할 수 있도록 도와드립니다. 복잡한 데이터 관리와 캐싱 문제를 간단하게 해결해보세요!

## 목차

- [`@h1y/next-loader`](#h1ynext-loader)
  - [목차](#목차)
  - [설치 방법](#설치-방법)
  - [이런 기능들을 제공해요](#이런-기능들을-제공해요)
  - [어떻게 사용하면 될까요?](#어떻게-사용하면-될까요)
    - [로더 설정하기](#로더-설정하기)
    - [리소스 빌더 만들기](#리소스-빌더-만들기)
    - [리소스 사용하기](#리소스-사용하기)
  - [더 고급 사용법을 알아볼까요?](#더-고급-사용법을-알아볼까요)
    - [리소스 간 의존성 관리하기](#리소스-간-의존성-관리하기)
    - [리소스 내에서 로더 중첩 사용하기](#리소스-내에서-로더-중첩-사용하기)
  - [유용한 유틸리티 함수들](#유용한-유틸리티-함수들)
    - [계층적 태그 생성하기](#계층적-태그-생성하기)
  - [라이센스](#라이센스)

## 설치 방법

여러분의 프로젝트에 쉽게 추가할 수 있습니다:

```bash
npm install @h1y/next-loader
# 또는
yarn add @h1y/next-loader
# 또는
pnpm add @h1y/next-loader
```

## 이런 기능들을 제공해요

- **손쉬운 리소스 관리**: 외부 API 호출을 깔끔하게 정리하고 효율적으로 관리해요.
- **편리한 태그 기반 재검증**: Next.js의 태그 기반 재검증 시스템과 자연스럽게 연동됩니다.
- **똑똑한 의존성 관리**: 리소스 간 의존성을 쉽게 정의하여 연관된 데이터의 자동 재검증이 가능합니다.
- **효율적인 요청 메모이제이션**: 같은 서버 요청 생명주기 내에서 동일한 데이터 요청을 똑똑하게 캐싱합니다.

## 어떻게 사용하면 될까요?

### 로더 설정하기

먼저 로더를 설정해볼까요? 아래의 코드는 Next.js의 캐시 태그 기반 재검증 시스템과 연동하는 방법을 보여줍니다:

```typescript
import { revalidateTag } from 'next/cache'
import { configureLoader } from '@h1y/next-loader'

// 여러분의 서비스에 맞게 로더를 설정해 보세요
const loader = configureLoader({
  // 기본 fetch 함수를 사용하거나 여러분만의 fetch 함수를 구현할 수 있어요
  fetch,
  
  // 태그 기반 재검증을 위한 함수입니다
  revalidate: async (tags) => {
    "use server"
    
    // Next.js의 revalidateTag 함수로 캐시 태그를 갱신합니다
    tags.forEach(revalidateTag)
  },
});
```

### 리소스 빌더 만들기

이제 필요한 데이터를 가져오는 리소스 빌더를 정의해 볼까요?

```typescript
import { buildResource } from '@h1y/next-loader'
import type { ResourceOptions } from '@h1y/next-loader'

interface UserRequest {
  userId: string
}

interface UserResourceOptions extends UserRequest, ResourceOptions {}

// 사용자 정보를 가져오는 리소스 빌더를 만들어 봅시다
const getUserResource = buildResource(
  // 요청 파라미터를 리소스 옵션으로 변환하는 함수예요
  (request: UserRequest) => ({
    ...request,
    tags: `user:${request.userId}`, // 이렇게 태그를 설정하면 나중에 재검증할 때 유용해요
    revalidate: 60,                 // 60초 후에 데이터를 다시 확인할게요
  }),
  
  // 실제 데이터를 로드하는 함수입니다
  (options: UserResourceOptions) => ({
    async load(fetch) {
      // API에서 사용자 정보를 가져옵니다
      const response = await fetch(`/api/users/${options.userId}`)
      return response.json()
    },
  })
)
```

### 리소스 사용하기

서버 컴포넌트에서 리소스를 사용하는 방법은 정말 간단해요:

```typescript
import { loader, getUserResource } from './your-resources';

// 서버 컴포넌트에서 이렇게 사용해보세요
async function UserProfile({ userId }) {
  // 리소스 로드 함수와 재검증 함수를 받아옵니다
  const [load, revalidate] = loader(getUserResource({ userId }))
  
  // 데이터를 로드합니다 - 캐싱과 재검증은 라이브러리가 알아서 처리해줍니다!
  const [userData] = await load()

  return (
    <div>
      <h1>{userData.name}</h1>
      {/* 사용자 정보를 여기에 표시하세요 */}
      
      {/* 데이터를 새로고침하고 싶을 때는 이렇게 재검증 함수를 사용하세요 */}
      <form action={revalidate}>
        <button type="submit">새로고침</button>
      </form>
    </div>
  );
}
```

## 더 고급 사용법을 알아볼까요?

### 리소스 간 의존성 관리하기

여러 데이터 사이에 관계가 있나요? 걱정 마세요! 의존성을 쉽게 관리할 수 있습니다:

```typescript
// 부모 리소스를 정의합니다
const parentResource = getResource({ id: 'parent' })

// 자식 리소스를 정의하고 부모에 연결합니다
const childResource = getResource({ 
  id: 'child',
  // 이렇게 연결하면 부모가 업데이트될 때 자식도 자동으로 업데이트됩니다!
  parents: [parentResource]
})

// 서버 컴포넌트에서 리소스 의존성을 관리하는 예시입니다
async function RelatedDataComponent() {
  // 여러 리소스를 한 번에 로드하는 것도 가능해요
  const [loadAll, revalidateAll] = loader(parentResource, childResource)
  const [parent, child] = await loadAll()
  
  return (
    <div>
      <h2>{parent.title}</h2>
      <p>{child.description}</p>
      <form action={revalidateAll}>
        <button type="submit">모든 데이터 새로고침</button>
      </form>
    </div>
  );
}
```

### 리소스 내에서 로더 중첩 사용하기

더 복잡한 데이터 구조를 다룰 때는 리소스 내에서 다른 리소스를 로드할 수도 있어요. 예를 들어, 블로그의 카테고리와 각 카테고리에 속한 글 목록을 불러오는 경우를 생각해볼까요?

```typescript
// 블로그 글 하나에 대한 리소스 정의
interface PostRequest {
  categoryId: string
  postId: string
}

interface PostOptions extends PostRequest, ResourceOptions {}

const getPostResource = buildResource(
  (request: PostRequest) => ({
    ...request,
    tags: [`category:${request.categoryId}`, `post:${request.postId}`],
  }),
  (options: PostOptions) => ({
    async load(fetch) {
      // 특정 글의 상세 내용을 가져옵니다
      const response = await fetch(`/api/categories/${options.categoryId}/posts/${options.postId}`)
      return response.json()
    },
  })
);

// 카테고리에 속한 모든 글 목록을 가져오는 리소스
interface CategoryPostsRequest {
  categoryId: string
}

interface CategoryPostsOptions extends CategoryPostsRequest, ResourceOptions {}

const getCategoryPostsResource = buildResource(
  (request: CategoryPostsRequest) => ({
    ...request,
    tags: [`category:${request.categoryId}`],
  }),
  (options: CategoryPostsOptions) => ({
    async load(fetch) {
      // 1. 먼저 카테고리에 속한 글 ID 목록을 가져옵니다
      const response = await fetch(`/api/categories/${options.categoryId}/posts`)
      const postIds = await response.json()

      // 2. 각 글에 대한 리소스를 만듭니다
      const postResources = postIds.map(postId => 
        getPostResource({
          categoryId: options.categoryId,
          postId,
        })
      );

      // 3. 중첩으로 로더를 사용하여 모든 글을 로드합니다
      const [loadAll] = loader(...postResources)
      return await loadAll()
    },
  })
);

// 서버 컴포넌트에서 사용하는 예시
async function CategoryPage({ categoryId }) {
  const [load] = loader(getCategoryPostsResource({ categoryId }))
  const [posts] = await load()

  return (
    <div>
      <h1>카테고리 글 목록</h1>
      <ul>
        {posts.map(post => (
          <li key={post.id}>
            <h2>{post.title}</h2>
            <p>{post.summary}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

이런 패턴은 복잡한 데이터 관계가 있을 때 특히 유용합니다. 예를 들어, 상위 리소스가 여러 하위 리소스의 ID 목록만 반환하고, 각 하위 리소스의 상세 정보는 별도 API를 통해 가져와야 하는 경우에 적합해요. 중첩 로더를 사용하면 이런 복잡한 데이터 구조도 효율적으로 관리할 수 있습니다.

## 유용한 유틸리티 함수들

`@h1y/next-loader`는 리소스 관리를 더 편리하게 만들어주는 여러 유틸리티 함수들도 제공해요. 이 함수들을 활용하면 더 깔끔하고 유지보수하기 쉬운 코드를 작성할 수 있습니다.

### 계층적 태그 생성하기

계층 구조가 있는 데이터를 다룰 때 태그도 계층적으로 관리하면 편리해요. `hierarchicalTags` 함수를 사용하면 쉽게 계층적 태그를 생성할 수 있습니다:

```typescript
import { hierarchicalTags } from "@h1y/next-loader/utils"

// 리소스 빌더 정의
const getUserResource = buildResource(
  (request) => ({
    ...request,
    // 계층적 태그 생성
    tags: hierarchicalTags(
      "user",                        // 최상위 태그
      `role:${request.role}`,        // 중간 태그
      `id:${request.userId}`         // 최하위 태그
    ),
    revalidate: 60,
  }),
  (options) => ({
    async load(fetch) {
      // 데이터 로드 로직
    },
  })
)
```

이렇게 생성된 태그는 다음과 같이 세 가지 형태로 자동 등록됩니다:

- `user`: 모든 사용자 데이터에 대한 태그
- `user/role:admin`: 관리자 역할을 가진 사용자들에 대한 태그
- `user/role:admin/id:123`: 특정 ID를 가진 관리자에 대한 태그

이렇게 계층적 태그를 사용하면 특정 수준에서 재검증이 필요할 때 유연하게 대응할 수 있어요. 예를 들어, 모든 관리자 정보를 갱신하고 싶다면 `user/role:admin` 태그만 재검증하면 됩니다.

## 라이센스

MIT 라이센스로 제공됩니다.
