# @h1y/next-loader-tag

타입 안전한 태그 시스템을 제공하는 TypeScript 라이브러리입니다. 정적 태그와 동적 태그를 지원하며, 이들을 조합하여 복합 태그나 계층적 태그를 만들 수 있습니다.

## 설치

```bash
npm install @h1y/next-loader-tag
```

또는

```bash
yarn add @h1y/next-loader-tag
```

## 주요 기능

- **정적 태그**: 고정된 문자열 태그
- **동적 태그**: 매개변수를 받아 동적으로 생성되는 태그
- **복합 태그 (Composite)**: 여러 태그를 `_`로 조합
- **계층적 태그 (Hierarchy)**: 여러 태그를 `/`로 계층 구조화
- **완전한 TypeScript 지원**: 타입 안전성과 자동완성 제공

## 사용법

### 기본 태그 생성

```typescript
import { tag } from '@h1y/next-loader-tag';

// 정적 태그
const userTag = tag("user");
console.log(userTag.result); // "user"

// 동적 태그
const dynamicUserTag = tag((id: number) => tag(`user-${id}`));
const resolved = dynamicUserTag.resolver(123);
console.log(resolved.result); // "user-123"
```

### 복합 태그 (Composite Tags)

여러 태그를 `_`로 조합하여 하나의 태그를 만듭니다.

```typescript
import { tag, compose } from '@h1y/next-loader-tag';

// 정적 태그들 조합
const appTag = tag("myapp");
const userTag = tag("user");
const actionTag = tag("login");

const compositeTag = compose(appTag, userTag, actionTag);
const resolved = compositeTag.resolver();
console.log(resolved.result); // "myapp_user_login"

// 동적 태그들 조합
const dynamicUserTag = tag((id: number) => tag(`user-${id}`));
const dynamicActionTag = tag((action: string) => tag(`action-${action}`));

const dynamicComposite = compose(appTag, dynamicUserTag, dynamicActionTag);
const dynamicResolved = dynamicComposite.resolver([123], ["click"]);
console.log(dynamicResolved.result); // "myapp_user-123_action-click"
```

### 계층적 태그 (Hierarchy Tags)

여러 태그를 `/`로 연결하여 계층 구조를 만듭니다. 각 단계별 경로를 배열로 반환합니다.

```typescript
import { tag, hierarchy } from '@h1y/next-loader-tag';

// 파일 시스템 경로 구조
const rootTag = tag("home");
const userTag = tag((username: string) => tag(username));
const folderTag = tag("documents");
const fileTag = tag((filename: string) => tag(filename));

const pathTag = hierarchy(rootTag, userTag, folderTag, fileTag);
const resolved = pathTag.resolver(["john"], ["report.pdf"]);

console.log(resolved.result);
// [
//   "home",
//   "home/john",
//   "home/john/documents",
//   "home/john/documents/report.pdf"
// ]
```

## 실제 사용 예시

### 사용자 액션 추적

```typescript
import { tag, compose } from '@h1y/next-loader-tag';

const appTag = tag("analytics");
const userTag = tag((userId: number) => tag(`user-${userId}`));
const actionTag = tag((action: string) => tag(`action-${action}`));

const trackingTag = compose(appTag, userTag, actionTag);
const eventTag = trackingTag.resolver([123], ["button-click"]);

console.log(eventTag.result); // "analytics_user-123_action-button-click"
```

### API 엔드포인트 경로 생성

```typescript
import { tag, hierarchy } from '@h1y/next-loader-tag';

const domainTag = tag("api.example.com");
const versionTag = tag("v1");
const resourceTag = tag((resource: string) => tag(resource));
const idTag = tag((id: number) => tag(id.toString()));

const apiPathTag = hierarchy(domainTag, versionTag, resourceTag, idTag);
const paths = apiPathTag.resolver(["users"], [123]);

console.log(paths.result);
// [
//   "api.example.com",
//   "api.example.com/v1", 
//   "api.example.com/v1/users",
//   "api.example.com/v1/users/123"
// ]
```

### 조직 리소스 네임스페이스

```typescript
import { tag, compose } from '@h1y/next-loader-tag';

const orgTag = tag("acme-corp");
const deptTag = tag((dept: string) => tag(`dept:${dept}`));
const projectTag = tag((project: string) => tag(`project:${project}`));
const resourceTag = tag("resource");

const resourcePathTag = compose(orgTag, deptTag, projectTag, resourceTag);
const resourceId = resourcePathTag.resolver(["engineering"], ["web-app"]);

console.log(resourceId.result); // "acme-corp_dept:engineering_project:web-app_resource"
```

## API 참조

### `tag(value)`

기본 태그를 생성합니다.

**매개변수:**

- `value: string | Function` - 정적 태그의 경우 문자열, 동적 태그의 경우 resolver 함수

**반환값:**

- `SingleTag` - 생성된 태그 객체

### `compose(...tags)`

여러 태그를 `_`로 조합하여 복합 태그를 생성합니다.

**매개변수:**

- `...tags: SingleTag[]` - 조합할 태그들

**반환값:**

- `CompositeTag` - 조합된 태그 객체

### `hierarchy(...tags)`

여러 태그를 `/`로 연결하여 계층적 태그를 생성합니다.

**매개변수:**

- `...tags: SingleTag[]` - 계층을 구성할 태그들

**반환값:**

- `HierarchyTag` - 계층적 태그 객체

## 타입 시스템

이 라이브러리는 완전한 TypeScript 지원을 제공하며, 컴파일 타임에 타입 안전성을 보장합니다.

```typescript
// 타입 추론 예시
const userTag = tag((id: number) => tag(`user-${id}`));
const actionTag = tag((action: string) => tag(`action-${action}`));

const composite = compose(userTag, actionTag);
// TypeScript가 매개변수 타입을 자동으로 추론합니다
const resolved = composite.resolver([123], ["click"]); // ✅ 올바른 타입
// const resolved = composite.resolver(["123"], [123]); // ❌ 타입 에러
```

## 라이선스

MIT

## 기여하기

이슈나 풀 리퀘스트를 통해 기여해 주세요.

## 개발자

h1ylabs 
