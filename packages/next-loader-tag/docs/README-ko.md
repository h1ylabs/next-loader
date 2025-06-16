# @h1y/next-loader-tag

타입 안전한 태그 시스템을 제공하는 TypeScript 라이브러리입니다. 정적 태그, 동적 태그, 복합 태그, 계층적 태그를 지원합니다.

## 설치

```bash
npm install @h1y/next-loader-tag
```

## 사용법

### 기본 태그

```typescript
import { tag } from "@h1y/next-loader-tag";

// 정적 태그
const userTag = tag("user");
console.log(userTag.result); // "user"

// 동적 태그
const dynamicTag = tag((id: number) => tag(`user-${id}`));
const resolved = dynamicTag.resolver(123);
console.log(resolved.result); // "user-123"
```

### 복합 태그 (Composite)

여러 태그를 `_`로 조합합니다.

```typescript
import { tag, compose } from "@h1y/next-loader-tag";

const appTag = tag("app");
const userTag = tag((id: number) => tag(`user-${id}`));
const actionTag = tag("click");

const compositeTag = compose(appTag, userTag, actionTag);
const resolved = compositeTag.resolver([123]);
console.log(resolved.result); // "app_user-123_click"
```

### 계층적 태그 (Hierarchy)

여러 태그를 `/`로 연결하여 계층 구조를 만듭니다.

```typescript
import { tag, hierarchy } from "@h1y/next-loader-tag";

const rootTag = tag("api");
const versionTag = tag("v1");
const resourceTag = tag((resource: string) => tag(resource));

const pathTag = hierarchy(rootTag, versionTag, resourceTag);
const resolved = pathTag.resolver(["users"]);
console.log(resolved.result);
// ["api", "api/v1", "api/v1/users"]
```

## 라이센스

MIT
