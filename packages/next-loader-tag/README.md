# @h1y/loader-tag

A TypeScript library that provides a type-safe tag system. Supports static tags, dynamic tags, composite tags, and hierarchical tags.

[한국어 문서 (Korean Documentation)](./docs/README-ko.md)

## Installation

```bash
npm install @h1y/loader-tag
```

## Usage

### Basic Tags

```typescript
import { tag } from "@h1y/loader-tag";

// Static tag
const userTag = tag("user");
console.log(userTag.result); // "user"

// Dynamic tag
const dynamicTag = tag((id: number) => tag(`user-${id}`));
const resolved = dynamicTag.resolver(123);
console.log(resolved.result); // "user-123"
```

### Composite Tags

Combine multiple tags with `_`.

```typescript
import { tag, compose } from "@h1y/loader-tag";

const appTag = tag("app");
const userTag = tag((id: number) => tag(`user-${id}`));
const actionTag = tag("click");

const compositeTag = compose(appTag, userTag, actionTag);
const resolved = compositeTag.resolver([123]);
console.log(resolved.result); // "app_user-123_click"
```

### Hierarchical Tags

Connect multiple tags with `/` to create hierarchical structures.

```typescript
import { tag, hierarchy } from "@h1y/loader-tag";

const rootTag = tag("api");
const versionTag = tag("v1");
const resourceTag = tag((resource: string) => tag(resource));

const pathTag = hierarchy(rootTag, versionTag, resourceTag);
const resolved = pathTag.resolver(["users"]);
console.log(resolved.result);
// ["api", "api/v1", "api/v1/users"]
```

## License

MIT
