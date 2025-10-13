# @h1y/next-loader

**Latest version: v0.6.1**

A powerful, type-safe resource loading library for Next.js applications. Build efficient data fetching with built-in caching, batch loading, retry logic, and seamless integration with Next.js App Router.

[![npm version](https://badge.fury.io/js/%40h1y%2Fnext-loader.svg)](https://badge.fury.io/js/%40h1y%2Fnext-loader)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

[한국어 문서 (Korean Documentation)](./docs/README-ko.md)

---

## Why next-loader?

**The Problem**: Traditional Next.js data fetching requires repetitive boilerplate, manual cache management, and lacks built-in resilience for failed requests.

**The Solution**: next-loader provides a declarative resource system that handles caching, batch loading, retry logic, and cache invalidation automatically - all with full TypeScript support.

```typescript
// Before: Manual fetch with boilerplate
async function UserPage({ userId }) {
  const response = await fetch(`/api/users/${userId}`, {
    next: {
      revalidate: 300,
      tags: ["user", `user-${userId}`, `user-${userId}-profile`],
    },
  });
  const user = await response.json();
  // Manual error handling, no retries, verbose...
}

// After: Declarative resource loading
const User = resourceFactory({
  tags: (req) => ({ id: hierarchyTag("user", req.userId, "profile") }),
  options: { staleTime: 300 }, // 5 minutes
  load: async ({ req, fetcher }) => {
    const response = await fetcher(NextJSAdapter).load(
      `/api/users/${req.userId}`,
    );
    return response.json();
  },
});

async function UserPage({ userId }) {
  const [load, revalidation] = loader(User({ userId }));
  const [user] = await load(); // Cached, retryable, type-safe
}
```

**Key Benefits**:

- ✅ Automatic caching and request deduplication
- ✅ Batch loading multiple resources in parallel
- ✅ Built-in retry and timeout strategies
- ✅ Hierarchical cache invalidation
- ✅ Full TypeScript type inference
- ✅ Zero configuration needed to get started

---

## 📦 Installation

```bash
npm install @h1y/next-loader
# or
yarn add @h1y/next-loader
# or
pnpm add @h1y/next-loader
```

**Requirements**:

- React ≥18.3.0
- Next.js ≥14.0.0 (App Router)
- Node.js ≥18.0.0

---

## 🚀 Quick Start

### Step 1: Create a loader

```typescript
import { cache } from "react";
import { loaderFactory } from "@h1y/next-loader";

// Create once at module level and reuse everywhere
export const loader = loaderFactory({
  memo: cache, // React's built-in request deduplication
});
```

### Step 2: Define your resources

```typescript
import { resourceFactory, NextJSAdapter } from "@h1y/next-loader";

interface User {
  id: string;
  name: string;
  email: string;
}

const User = resourceFactory({
  tags: (req: { userId: string }) => ({ id: `user-${req.userId}` }),
  options: { staleTime: 300 }, // 5 minutes
  load: async ({ req, fetcher }) => {
    const response = await fetcher(NextJSAdapter).load(
      `/api/users/${req.userId}`,
    );
    if (!response.ok) throw new Error("Failed to fetch user");
    return response.json() as User;
  },
});
```

### Step 3: Use in your components

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
        <button>Refresh Profile</button>
      </form>
    </div>
  );
}
```

That's it! Your data is now cached, deduplicated, and ready for production.

---

## ✨ Core Features

| Feature                   | Description                                                                  |
| ------------------------- | ---------------------------------------------------------------------------- |
| **Batch Loading**         | Load multiple resources in parallel with `loader(Resource1, Resource2, ...)` |
| **Smart Caching**         | Automatic integration with Next.js cache and ISR                             |
| **Type Safety**           | Full TypeScript inference for requests, responses, and batch results         |
| **Retry & Timeout**       | Built-in resilience with configurable strategies                             |
| **Cache Invalidation**    | Hierarchical tagging system for precise cache control                        |
| **Request Deduplication** | Prevents duplicate requests using React's `cache()`                          |
| **Component Resilience**  | Optional `componentLoaderFactory` for UI-level retry                         |

---

## 📖 Basic Usage

### Single Resource Loading

```typescript
const Product = resourceFactory({
  tags: (req: { id: string }) => ({ id: `product-${req.id}` }),
  options: { staleTime: 600 }, // 10 minutes
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

### Batch Loading (Most Common Use Case)

Load multiple resources simultaneously with full type safety:

```typescript
const User = resourceFactory({
  tags: (req: { userId: string }) => ({ id: `user-${req.userId}` }),
  options: { staleTime: 300 }, // 5 minutes
  load: async ({ req, fetcher }) => {
    const response = await fetcher(NextJSAdapter).load(`/api/users/${req.userId}`);
    return response.json();
  },
});

const UserPosts = resourceFactory({
  tags: (req: { userId: string }) => ({ id: `user-posts-${req.userId}` }),
  options: { staleTime: 120 }, // 2 minutes
  load: async ({ req, fetcher }) => {
    const response = await fetcher(NextJSAdapter).load(`/api/users/${req.userId}/posts`);
    return response.json();
  },
});

async function UserDashboard({ userId }: { userId: string }) {
  // Load both resources in parallel
  const [load, revalidation] = loader(
    User({ userId }),
    UserPosts({ userId })
  );

  // TypeScript knows the exact types: [User, Post[]]
  const [user, posts] = await load();

  return (
    <div>
      <h1>{user.name}</h1>
      <p>{posts.length} posts</p>

      <form action={async () => {
        "use server";
        revalidation.forEach(revalidateTag); // Refresh all resources
      }}>
        <button>Refresh</button>
      </form>
    </div>
  );
}
```

### Cache Revalidation

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
        // Revalidate all tags associated with this resource
        revalidation.forEach(revalidateTag);
      }}>
        <button>Refresh Data</button>
      </form>
    </div>
  );
}
```

---

## 🧩 Core Concepts

### Resource Factory

Resources are "smart API calls" that know how to cache themselves:

```typescript
const MyResource = resourceFactory({
  // Cache tags for this resource
  tags: (req) => ({ id: `my-resource-${req.id}` }),

  // Optional: cache duration in seconds
  options: { staleTime: 300 }, // 5 minutes

  // Load function
  load: async ({ req, fetcher }) => {
    const response = await fetcher(NextJSAdapter).load(`/api/data/${req.id}`);
    return response.json();
  },
});
```

### Loader Factory

Create a loader once and reuse it everywhere:

```typescript
import { cache } from "react";
import { loaderFactory } from "@h1y/next-loader";

// Global loader with React's cache() for deduplication
export const loader = loaderFactory({
  memo: cache,
});

// Optional: Configure retry and timeout
export const resilientLoader = loaderFactory(
  { memo: cache },
  {
    retry: { maxCount: 3, canRetryOnError: true },
    timeout: { delay: 10000 },
  },
);
```

### Hierarchical Tags

Create cache hierarchies for flexible invalidation:

```typescript
import { hierarchyTag } from "@h1y/next-loader";

const UserPosts = resourceFactory({
  tags: (req: { userId: string }) => ({
    // Creates: ["user", "user/123", "user/123/posts"]
    id: hierarchyTag("user", req.userId, "posts"),
  }),
  load: async ({ req, fetcher }) => {
    const response = await fetcher(NextJSAdapter).load(
      `/api/users/${req.userId}/posts`,
    );
    return response.json();
  },
});

// Revalidating invalidates all hierarchy levels
const [load, revalidation] = loader(UserPosts({ userId: "123" }));
// revalidation = ["user", "user/123", "user/123/posts"]
```

**Benefits**:

- Invalidate specific user's posts: `user/123/posts`
- Invalidate all data for a user: `user/123`
- Invalidate all user-related data: `user`

---

## 🎯 Practical Examples

### Team Dashboard with Batch Loading

```typescript
const TeamInfo = resourceFactory({
  tags: (req: { teamId: string }) => ({ id: `team-${req.teamId}` }),
  options: { staleTime: 300 }, // 5 minutes
  load: async ({ req, fetcher }) => {
    const response = await fetcher(NextJSAdapter).load(`/api/teams/${req.teamId}`);
    return response.json();
  },
});

const TeamProjects = resourceFactory({
  tags: (req: { teamId: string }) => ({ id: `team-projects-${req.teamId}` }),
  options: { staleTime: 120 }, // 2 minutes
  load: async ({ req, fetcher }) => {
    const response = await fetcher(NextJSAdapter).load(`/api/teams/${req.teamId}/projects`);
    return response.json();
  },
});

const TeamMembers = resourceFactory({
  tags: (req: { teamId: string }) => ({ id: `team-members-${req.teamId}` }),
  options: { staleTime: 300 }, // 5 minutes
  load: async ({ req, fetcher }) => {
    const response = await fetcher(NextJSAdapter).load(`/api/teams/${req.teamId}/members`);
    return response.json();
  },
});

async function TeamDashboard({ teamId }: { teamId: string }) {
  // Load all data in parallel
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
        <p>{members.length} members • {activeProjects.length} active projects</p>
      </header>

      <section className="projects">
        <h2>Active Projects</h2>
        {activeProjects.map(project => (
          <div key={project.id}>
            <h3>{project.name}</h3>
            <p>{project.completionPercentage}% complete</p>
          </div>
        ))}
      </section>

      <section className="members">
        <h2>Team Members</h2>
        {members.map(member => (
          <div key={member.id}>{member.name} - {member.role}</div>
        ))}
      </section>

      <form action={async () => {
        "use server";
        revalidation.forEach(revalidateTag);
      }}>
        <button>Refresh Dashboard</button>
      </form>
    </div>
  );
}
```

### Monitoring with Callbacks

Track retry attempts and timeouts using callback functions:

```typescript
const monitoredLoader = loaderFactory(
  { memo: cache },
  {
    retry: {
      maxCount: 3,
      canRetryOnError: (error) => error.status >= 500,
      onRetryEach: () => {
        console.log('Retrying failed request...');
        // Send metrics to monitoring service
      },
      onRetryExceeded: () => {
        console.error('All retry attempts exhausted');
        // Alert operations team
      },
    },
    timeout: {
      delay: 5000,
      onTimeout: () => {
        console.warn('Request timeout - network may be slow');
        // Track slow network issues
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
  const [data] = await load(); // Callbacks fire on retry/timeout
  return <div>{data.content}</div>;
}
```

### Graceful Degradation with Fallback

Provide fallback data when all retries fail:

```typescript
const resilientLoader = loaderFactory(
  { memo: cache },
  {
    retry: {
      maxCount: 3,
      canRetryOnError: true,
      fallback: () => async () => ({
        // Fallback data when all retries exhausted
        items: [],
        cached: true,
        message: 'Showing cached data'
      }),
    },
    timeout: { delay: 5000 },
  }
);

const UserFeed = resourceFactory({
  tags: (req: { userId: string }) => ({ id: `feed-${req.userId}` }),
  load: async ({ req, fetcher }) => {
    const response = await fetcher(NextJSAdapter).load(`/api/users/${req.userId}/feed`);
    if (!response.ok) throw new Error('Feed unavailable');
    return response.json();
  },
});

async function FeedPage({ userId }: { userId: string }) {
  const [load] = resilientLoader(UserFeed({ userId }));
  const [feed] = await load(); // Falls back to empty feed if API fails

  return (
    <div>
      {feed.cached && <p>⚠️ {feed.message}</p>}
      {feed.items.map(item => <div key={item.id}>{item.content}</div>)}
    </div>
  );
}
```

### Resource Dependencies

Resources can depend on other resources:

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
  use: (req) => [User({ userId: req.userId })], // Depends on User
  load: async ({ req, use, fetcher }) => {
    const [user] = await Promise.all(use);

    // Only fetch settings if user is active
    if (!user.isActive) return { theme: "default" };

    const response = await fetcher(NextJSAdapter).load(
      `/api/users/${req.userId}/settings`,
    );
    return response.json();
  },
});
```

---

## 📚 API Reference

### `loaderFactory(dependencies, options?, middlewares?)`

Creates a loader instance for loading resources.

**Basic Usage:**

```typescript
import { cache } from "react";

const loader = loaderFactory(
  { memo: cache },
  {
    retry: { maxCount: 3, canRetryOnError: true },
    timeout: { delay: 10000 },
  }
);

// Returns: [loadFunction, revalidationTags]
const [load, revalidation] = loader(Resource1, Resource2, ...);
```

**Complete Options:**

```typescript
const loader = loaderFactory(
  { memo: cache }, // dependencies
  {
    retry: {
      maxCount: 3,                              // Maximum retry attempts
      canRetryOnError: true,                    // or (error) => boolean
      fallback?: () => async () => fallbackData, // Optional: Fallback when retries fail
      onRetryEach?: () => {},                   // Optional: Called on each retry
      onRetryExceeded?: () => {},               // Optional: Called when max retries exceeded
    },
    timeout: {
      delay: 10000,                             // Timeout in milliseconds
      onTimeout?: () => {},                     // Optional: Called when timeout occurs
    },
    backoff?: {
      strategy: EXPONENTIAL_BACKOFF(2),         // Backoff strategy
      initialDelay: 500,                        // Initial delay in milliseconds
    },
  },
  [customMiddleware] // Optional: middleware array
);
```

### `resourceFactory(config)`

Defines a reusable resource with caching configuration.

```typescript
const MyResource = resourceFactory({
  tags: (req) => ({
    id: "my-resource-id", // Cache identifier
    effects: ["related-cache-tag"], // Optional: tags to invalidate
  }),
  options: { staleTime: 300 }, // Optional: cache duration in seconds (5 minutes)
  use: (req) => [DependencyResource], // Optional: dependencies
  load: async ({ req, fetcher, use }) => {
    // Fetch and return data
  },
});
```

### `hierarchyTag(...segments)`

Creates hierarchical cache tags for flexible invalidation.

```typescript
import { hierarchyTag } from "@h1y/next-loader";

// Creates: ["org", "org/123", "org/123/team", "org/123/team/456"]
const tags = hierarchyTag("org", "123", "team", "456");
```

### `componentLoaderFactory(options?, middlewares?)`

Creates a component-level loader with retry UI feedback and state management.

**Basic Usage:**

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

**Complete Options & Return Values:**

```typescript
const {
  componentLoader,        // Wraps component with resilience logic
  retryImmediately,       // Trigger immediate retry with optional fallback
  retryFallback,          // Register conditional retry fallback
  componentState,         // Create persistent state across retries
  componentOptions,       // Access loader configuration
  // Custom middleware options (if middlewares provided)
  metricsMiddlewareOptions, // Example: access 'metrics' middleware context
} = componentLoaderFactory(
  {
    retry: {
      maxCount: 3,
      canRetryOnError: true,
      fallback?: <div>Default UI</div>,    // Optional: UI when retries fail
      onRetryEach?: () => {},               // Optional: Called on each retry
      onRetryExceeded?: () => {},           // Optional: Called when max retries exceeded
    },
    timeout: {
      delay: 10000,
      onTimeout?: () => {},                 // Optional: Called when timeout occurs
    },
    backoff?: {
      strategy: EXPONENTIAL_BACKOFF(2),
      initialDelay: 500,
    },
  },
  [metricsMiddleware] // Optional: custom middlewares
);

// Usage inside component:
async function MyComponent() {
  const [count, setCount] = componentState(0);       // Persistent state
  const options = componentOptions();                 // Access retry/timeout config
  const metrics = metricsMiddlewareOptions();         // Access middleware context

  retryFallback({
    when: (error) => error.status === 503,
    fallback: (error) => <div>Service unavailable</div>
  });

  // ... component logic
}
```

### Backoff Strategies

Control retry timing:

```typescript
import {
  FIXED_BACKOFF,
  LINEAR_BACKOFF,
  EXPONENTIAL_BACKOFF,
} from "@h1y/next-loader";

// Fixed: always wait 1 second
const loader1 = loaderFactory(deps, {
  retry: { maxCount: 3, canRetryOnError: true },
  backoff: { strategy: FIXED_BACKOFF, initialDelay: 1000 },
});

// Linear: 1s, 2s, 3s
const loader2 = loaderFactory(deps, {
  retry: { maxCount: 3, canRetryOnError: true },
  backoff: { strategy: LINEAR_BACKOFF(1000), initialDelay: 1000 },
});

// Exponential: 500ms, 1s, 2s, 4s
const loader3 = loaderFactory(deps, {
  retry: { maxCount: 4, canRetryOnError: true },
  backoff: { strategy: EXPONENTIAL_BACKOFF(2), initialDelay: 500 },
});
```

---

## 🔄 Next.js Integration

### Cache Revalidation

Always use the `revalidation` array returned by the loader:

```typescript
const [load, revalidation] = loader(MyResource({ id: "123" }));

// ✅ Correct
<form action={async () => {
  "use server";
  revalidation.forEach(revalidateTag);
}}>
  <button>Refresh</button>
</form>

// ❌ Wrong - never call revalidateTag directly
<form action={async () => {
  "use server";
  revalidateTag("my-resource-123"); // Don't do this!
}}>
```

### Dynamic Rendering

Retries are only visible in dynamic rendering mode:

```typescript
import { headers } from 'next/headers';

async function DynamicPage({ id }: { id: string }) {
  await headers(); // Forces dynamic rendering

  const [load] = loader(MyResource({ id }));
  const [data] = await load(); // Retries visible to users

  return <div>{data.content}</div>;
}
```

### Static Generation (ISR)

Resources automatically integrate with Next.js ISR:

```typescript
const News = resourceFactory({
  tags: () => ({ id: "latest-news" }),
  options: { staleTime: 3600 }, // 1 hour
  load: async ({ fetcher }) => {
    const response = await fetcher(NextJSAdapter).load("/api/news");
    return response.json();
  },
});

async function NewsPage() {
  const [load] = loader(News({}));
  const [news] = await load(); // Cached with 1-hour (3600 seconds) revalidation

  return <div>{/* render news */}</div>;
}
```

---

## 💡 Advanced Features

### Hierarchical Cache Invalidation

Use `hierarchyTag()` for multi-level invalidation:

```typescript
const UserProfile = resourceFactory({
  tags: (req: { userId: string }) => ({
    id: hierarchyTag("user", req.userId, "profile"),
    effects: ["user-analytics", "search-index"], // Invalidate related caches
  }),
  load: async ({ req, fetcher }) => {
    const response = await fetcher(NextJSAdapter).load(
      `/api/users/${req.userId}/profile`,
    );
    return response.json();
  },
});

// Invalidation levels:
// 1. "user" - all user data
// 2. "user/123" - all data for user 123
// 3. "user/123/profile" - specific profile
// Plus: "user-analytics" and "search-index" (effects)
```

### Component-Level Retry

For UI components that need retry feedback:

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
      <p>Status: {health.status}</p>
      {retryCount > 0 && <small>Retried {retryCount} times</small>}
    </div>
  );
}

export default componentLoader(MonitoringWidget).withErrorBoundary({
  errorFallback: ({ error, resetErrorBoundary }) => (
    <div>
      <p>Failed to load: {error.message}</p>
      <button onClick={resetErrorBoundary}>Retry</button>
    </div>
  )
});
```

### Custom Adapters

Create adapters for non-Next.js environments:

```typescript
import { createExternalResourceAdapter } from "@h1y/next-loader";

const CustomAdapter = createExternalResourceAdapter({
  validate: (url) => {
    if (!url.startsWith("https://")) throw new Error("HTTPS required");
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

## ❓ Troubleshooting

### Q: Why don't I see retry attempts?

**A**: Next.js caching masks retries. Use dynamic rendering to see them:

```typescript
import { headers } from 'next/headers';

async function MyPage() {
  await headers(); // Forces dynamic rendering
  const [load] = loader(MyResource({ id: '123' }));
  const [data] = await load(); // Retries now visible
  return <div>{data.content}</div>;
}
```

### Q: Type errors with batch loading?

**A**: Destructure the results to let TypeScript infer types:

```typescript
// ❌ Wrong
const [load] = loader(User({ id: "1" }), Posts({ userId: "1" }));
const data = await load(); // Type inference fails

// ✅ Correct
const [load] = loader(User({ id: "1" }), Posts({ userId: "1" }));
const [user, posts] = await load(); // TypeScript knows types
```

### Q: When to use `loaderFactory` vs `componentLoaderFactory`?

**A**:

- **Use `loaderFactory()`** for 95% of use cases - data fetching with caching
- **Use `componentLoaderFactory()`** only when you need UI-level retry feedback and state persistence

**Best Practice**: Use both together:

```typescript
const loader = loaderFactory({ memo: cache });
const { componentLoader } = componentLoaderFactory({ retry: { maxCount: 3 } });

async function MyComponent() {
  const [load] = loader(MyResource({ id: '123' }));
  const [data] = await load(); // Gets caching + retry
  return <div>{data.content}</div>;
}

export default componentLoader(MyComponent).withBoundary(<Loading />);
```

### Q: How do cache tags work?

**A**:

- **`id`**: Identifies this specific resource in the cache
- **`effects`**: Tags to invalidate when this resource changes
- **Always use `revalidation.forEach(revalidateTag)`** - never call `revalidateTag()` directly

```typescript
const Post = resourceFactory({
  tags: (req: { postId: string }) => ({
    id: `post-${req.postId}`,
    effects: ["activity-feed", "trending-posts"], // Invalidate these when post changes
  }),
  load: async ({ req, fetcher }) => {
    const response = await fetcher(NextJSAdapter).load(
      `/api/posts/${req.postId}`,
    );
    return response.json();
  },
});
```

### Q: Errors not propagating to Next.js error boundaries?

**A**: Don't suppress errors - let them propagate naturally:

```typescript
// ❌ Wrong
async function MyComponent() {
  try {
    const data = await loadData();
    return <div>{data.content}</div>;
  } catch (error) {
    return <div>Error: {error.message}</div>; // Don't suppress
  }
}

// ✅ Correct
async function MyComponent() {
  const data = await loadData(); // Let errors propagate
  return <div>{data.content}</div>;
}
```

---

## 🛠️ Dependencies

Built on top of:

- **[@h1ylabs/loader-core v0.6.0](https://github.com/h1ylabs/next-loader/tree/main/packages/core)** - Core loading functionality with retry/timeout/backoff
- **[@h1ylabs/promise-aop v0.6.0](https://github.com/h1ylabs/next-loader/tree/main/packages/promise-aop)** - Promise-based AOP framework

**Runtime Dependencies**:

- `react-error-boundary ^6.0.0`

**Peer Dependencies**:

- React ≥18.3.0
- Next.js ≥14.0.0 (for NextJSAdapter)

---

## 📄 License

MIT © [h1ylabs](https://github.com/h1ylabs)
