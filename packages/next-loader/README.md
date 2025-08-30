# @h1y/next-loader

**Latest version: v6.0.0**

A powerful, type-safe resource loading library specifically designed for Next.js applications. Build efficient data fetching with built-in caching, revalidation, retry logic, and seamless integration with Next.js server components.

[한국어 문서 (Korean Documentation)](https://github.com/h1ylabs/next-loader/tree/main/packages/next-loader/docs/README-ko.md)

[![npm version](https://badge.fury.io/js/%40h1y%2Fnext-loader.svg)](https://badge.fury.io/js/%40h1y%2Fnext-loader)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## ✨ Key Features

- **🎯 Next.js Native**: Built specifically for Next.js with first-class server component support
- **⚡ Batch Loading**: Load multiple resources in parallel with full type safety
- **🔄 Smart Caching**: Integrates seamlessly with Next.js cache system and revalidation
- **🛡️ Type Safety**: Full TypeScript support with intelligent type inference
- **🎭 Boundary Management**: Suspense and Error Boundary integration for component resilience
- **💾 State Persistence**: `componentState` maintains state across retry cycles
- **🔗 Hierarchical Tags**: Advanced cache invalidation with hierarchical tagging system
- **⏱️ Retry & Timeout**: Built-in resilience with configurable retry and timeout strategies
- **🎛️ Middleware Support**: Extensible middleware system for cross-cutting concerns

## 📦 Installation

```bash
npm install @h1y/next-loader
# or
yarn add @h1y/next-loader
# or
pnpm add @h1y/next-loader
```

## 🚀 Quick Start

Get started with @h1y/next-loader in three simple steps:

### 1. Set up dependencies and create a global loader

```typescript
import { revalidateTag } from "next/cache";
import { cache } from "react";
import { loaderFactory, NextJSAdapter } from "@h1y/next-loader";

// Define data types
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

// Create once at module level and reuse everywhere
const loader = loaderFactory({
  memo: cache, // Request deduplication
});
```

### 2. Define your resources

```typescript
import { resourceFactory } from "@h1y/next-loader";

const User = resourceFactory({
  tags: (req: { id: string }) => ({ id: `user-${req.id}` }),
  options: { staleTime: 300000 }, // Cache for 5 minutes
  load: async ({ req, fetcher }): Promise<User> => {
    const response = await fetcher(NextJSAdapter).load(`/api/users/${req.id}`);
    if (!response.ok) throw new Error(`Failed to fetch user`);
    return response.json();
  },
});

const UserPosts = resourceFactory({
  tags: (req: { userId: string }) => ({ id: `user-${req.userId}-posts` }),
  options: { staleTime: 180000 }, // Cache for 3 minutes
  load: async ({ req, fetcher }): Promise<Post[]> => {
    const response = await fetcher(NextJSAdapter).load(
      `/api/users/${req.userId}/posts`,
    );
    return response.json();
  },
});
```

### 3. Use in your components

**Single Resource:**

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
        <button>Refresh</button>
      </form>
    </div>
  );
}
```

**Batch Loading (Multiple Resources):**

```typescript
async function UserDashboard({ params }: { params: { id: string } }) {
  // Load multiple resources in parallel with full type safety
  const [load, revalidation] = loader(
    User({ id: params.id }),
    UserPosts({ userId: params.id })
  );

  // Results are type-safe: [User, Post[]]
  const [user, posts] = await load();

  return (
    <div>
      <h1>{user.name}'s Dashboard</h1>
      <p>{posts.length} posts</p>
      <form action={async () => {
        "use server";
        revalidation.forEach(revalidateTag);
      }}>
        <button>Refresh All</button>
      </form>
    </div>
  );
}
```

That's it! Your data is now automatically cached, batch-loaded, revalidated, and ready for production.

## 🧩 Core Concepts

### Resource Builder Pattern

Resources are declarative definitions that tell @h1y/next-loader how to fetch, cache, and manage your data:

```typescript
const BlogPost = resourceFactory({
  // Define cache tags
  tags: (req: { slug: string }) => ({
    id: `post-${req.slug}`,
    effects: ["blog-content"], // Invalidate related caches
  }),

  // Configure caching
  options: { staleTime: 600000 }, // Cache for 10 minutes

  // Define how to load data
  load: async ({ req, fetcher, retry }) => {
    const response = await fetcher(NextJSAdapter).load(
      `/api/posts/${req.slug}`,
    );
    if (!response.ok) {
      if (response.status >= 500) retry(); // Retry on server errors
      throw new Error("Failed to load post");
    }
    return response.json();
  },
});
```

**Key benefits:**

- **Declarative**: Define what you need, not how to get it
- **Composable**: Resources can depend on other resources
- **Cacheable**: Automatic caching with fine-grained control
- **Resilient**: Built-in retry and error handling

### Two Loading Approaches

@h1y/next-loader provides two distinct approaches for different use cases:

#### `loaderFactory()` - For Data Fetching with Caching

**When to use**: Loading external data in server components (most common use case)

```typescript
const loader = loaderFactory({ memo: cache });

async function UserPage() {
  // Single resource
  const [load] = loader(User({ id: '123' }));
  const [data] = await load();

  // Batch loading (key feature!)
  const [batchLoad] = loader(
    User({ id: '123' }),
    UserPosts({ userId: '123' }),
    UserStats({ id: '123' })
  );
  const [user, posts, stats] = await batchLoad();

  return <div>{user.name} has {posts.length} posts</div>;
}
```

**Characteristics:**

- ✅ **Batch loading** with full type safety
- ✅ Next.js cache integration (ISR, revalidateTag)
- ✅ Request deduplication via React's `cache()`
- ✅ Resource dependency management
- ❌ No middleware context access
- ❌ No component-level retry/fallback
- 🔧 Default: 60s timeout, no retries

#### `componentLoaderFactory()` - For Component Resilience

**When to use**: Adding retry/timeout/state management to components themselves

```typescript
const { componentLoader } = componentLoaderFactory({
  retry: { maxCount: 3, canRetryOnError: true },
  timeout: { delay: 5000 }
});

async function UserProfile({ userId }: { userId: string }) {
  const user = await fetchUserProfile(userId);
  return <div>Hello, {user.name}!</div>;
}

// Loading fallback component (Client Component)
function LoadingFallback() {
  return <div>Loading...</div>;
}

// Error fallback component (Client Component)
function ErrorFallback({ error, resetErrorBoundary }: { error: Error; resetErrorBoundary: () => void }) {
  return (
    <div>
      <p>Something went wrong: {error.message}</p>
      <button onClick={resetErrorBoundary}>Retry</button>
    </div>
  );
}

// Three boundary options:
export const NoWrapperComponent = componentLoader(UserProfile).withNoBoundary();
export const SuspenseComponent = componentLoader(UserProfile).withBoundary(<LoadingFallback />);
export const ErrorSafeComponent = componentLoader(UserProfile).withErrorBoundary({
  errorFallback: ErrorFallback
});
```

**Characteristics:**

- ✅ Component-level retry and timeout handling
- ✅ **State persistence** across retries (`componentState`)
- ✅ **Boundary management** (Suspense + Error Boundary)
- ✅ **Middleware context access** via `{name}MiddlewareOptions()` within components
- ✅ **Integrates with `loaderFactory()`** - automatic retry signal propagation
- ✅ **Best Practice**: Use `loader()` for data fetching within `componentLoader()` components
- 🔧 Default: 60s timeout, no retries

### Key Integration: loader + componentLoader

**Important**: You can use `loaderFactory()` inside `componentLoaderFactory()` components, and retry signals automatically propagate:

```typescript
const loader = loaderFactory(dependencies, {
  retry: { maxCount: 2, canRetryOnError: true }
});

const { componentLoader } = componentLoaderFactory({
  retry: { maxCount: 3, canRetryOnError: (err) => err.status >= 500 }
});

async function IntegratedDashboard({ userId }: { userId: string }) {
  // loader failures automatically trigger componentLoader retries
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

// Loading fallback component (Client Component)
function DashboardLoadingFallback() {
  return <div>Loading dashboard...</div>;
}

// Wrapped component gets both loader caching + component resilience
export default componentLoader(IntegratedDashboard).withBoundary(<DashboardLoadingFallback />);
```

### Smart Cache Invalidation with Hierarchical Tags

Organize your cache invalidation strategy with hierarchical tags for precise control:

```typescript
import { hierarchyTag } from "@h1y/next-loader";

const UserComments = resourceFactory({
  tags: (req: { userId: string; postId: string }) => ({
    id: hierarchyTag("user", req.userId, "posts", req.postId, "comments"),
  }),
  // ... other config
});
```

**How it works:**

```typescript
// hierarchyTag('user', '123', 'posts', '456', 'comments') creates:
// ['user', 'user/123', 'user/123/posts', 'user/123/posts/456', 'user/123/posts/456/comments']
```

**Invalidation at any level:**

```typescript
revalidateTag("user"); // All user data
revalidateTag("user/123/posts"); // All posts for user 123
revalidateTag("user/123/posts/456"); // Specific post
```

## 🎯 Advanced Examples

### Batch Loading with Type Safety

Load multiple resources simultaneously with full TypeScript support:

```typescript
async function ComprehensiveDashboard({ userId }: { userId: string }) {
  // Load 5 different resources in parallel
  const [load, revalidation] = loader(
    User({ id: userId }),           // → User
    UserPosts({ userId }),          // → Post[]
    UserStats({ userId }),          // → UserStats
    RecentActivity({ userId }),     // → Activity[]
    NotificationSettings({ userId }) // → NotificationSettings
  );

  // TypeScript infers: [User, Post[], UserStats, Activity[], NotificationSettings]
  const [user, posts, stats, activities, settings] = await load();

  return (
    <div>
      <h1>Welcome, {user.name}!</h1>
      <div>Posts: {stats.postCount} | Views: {stats.totalViews}</div>
      <div>Latest post: {posts[0]?.title}</div>
      <div>Recent activity: {activities.length} items</div>
      <div>Email notifications: {settings.emailEnabled ? 'On' : 'Off'}</div>

      {/* Revalidate all resources at once */}
      <form action={async () => {
        "use server";
        revalidation.forEach(revalidateTag);
      }}>
        <button>Refresh Everything</button>
      </form>
    </div>
  );
}
```

### Resource Dependencies

Build complex data flows by composing resources:

```typescript
// Base user resource
const User = resourceFactory({
  tags: (req: { id: string }) => ({ id: `user-${req.id}` }),
  options: { staleTime: 300000 },
  load: async ({ req, fetcher }) => {
    const response = await fetcher(NextJSAdapter).load(`/api/users/${req.id}`);
    return response.json();
  },
});

// Posts that depend on user data
const UserPosts = resourceFactory({
  tags: (req: { userId: string }) => ({
    id: hierarchyTag('user', req.userId, 'posts'),
    effects: ['activity-feed'] // Invalidate activity feed when posts change
  }),
  options: { staleTime: 180000 },
  use: (req) => [User({ id: req.userId })], // Declare dependency
  load: async ({ req, fetcher, use: [user] }) => {
    const userData = await user;

    // Skip loading if user is inactive
    if (!userData.isActive) {
      return { posts: [], reason: 'User inactive' };
    }

    const response = await fetcher(NextJSAdapter).load(`/api/users/${req.userId}/posts`);
    return {
      posts: await response.json(),
      author: userData.name,
    };
  },
});

// Use both resources with batch loading
async function UserDashboard({ userId }: { userId: string }) {
  const [load, revalidation] = loader(
    User({ id: userId }),
    UserPosts({ userId })
  );

  const [user, posts] = await load();

  return (
    <div>
      <h1>{user.name}'s Dashboard</h1>
      <p>{posts.posts.length} posts by {posts.author}</p>
      <form action={async () => {
        "use server";
        revalidation.forEach(revalidateTag);
      }}>
        <button>Refresh</button>
      </form>
    </div>
  );
}
```

### Component State Management

Use `componentState` to maintain state across retry cycles and integrate with `loader()` for data fetching. Unlike React useState, componentState persists across retries.

```typescript
const loader = loaderFactory({ memo: cache });
const { componentLoader, componentState, componentOptions } = componentLoaderFactory({
  retry: { maxCount: 3, canRetryOnError: true }
});

// Define resources
const UserProfile = resourceFactory({
  tags: (req: { userId: string }) => ({ id: `user-profile-${req.userId}` }),
  load: async ({ req, fetcher }) => {
    const response = await fetcher(NextJSAdapter).load(`/api/users/${req.userId}/profile`);
    return response.json();
  },
});

const UserSettings = resourceFactory({
  tags: (req: { userId: string }) => ({ id: `user-settings-${req.userId}` }),
  load: async ({ req, fetcher }) => {
    const response = await fetcher(NextJSAdapter).load(`/api/users/${req.userId}/settings`);
    return response.json();
  },
});

async function StatefulDashboard({ userId }: { userId: string }) {
  // State persists across retries (unlike React useState)
  const [retryCount, setRetryCount] = componentState(0);
  const [lastLoadTime, setLastLoadTime] = componentState<Date | null>(null);

  const options = componentOptions();

  // Track successful retry attempts
  if (options.retry.count > retryCount) {
    setRetryCount(options.retry.count);
    setLastLoadTime(new Date());
  }

  // Use loader for data fetching - errors will propagate and trigger componentLoader retries
  const [loadProfile] = loader(UserProfile({ userId }));
  const [loadSettings] = loader(UserSettings({ userId }));

  const [profile, settings] = await Promise.all([
    loadProfile(),
    loadSettings()
  ]);

  return (
    <div className={`theme-${settings.theme}`}>
      <h1>Welcome back, {profile.name}!</h1>
      <p>Language: {settings.language}</p>
      {retryCount > 0 && (
        <small>✅ Successfully loaded after {retryCount} retries</small>
      )}
      {lastLoadTime && (
        <small>Last updated: {lastLoadTime.toLocaleTimeString()}</small>
      )}
    </div>
  );
}

export default componentLoader(StatefulDashboard).withBoundary(<div>Loading...</div>);
```

### Advanced Retry Control

Use advanced retry functions for fine-grained control over retry behavior and user feedback.

#### `retryImmediately()` - Immediate Retry

```typescript
const { componentLoader, retryImmediately } = componentLoaderFactory({
  retry: { maxCount: 3, canRetryOnError: true }
});

async function PaymentProcessor({ amount }: { amount: number }) {
  const result = await processPayment(amount);

  // If payment requires immediate retry (e.g., rate limited)
  if (result.needsRetry) {
    retryImmediately(<div>Payment rate limited, retrying immediately...</div>);
  }

  return <div>✅ Payment: ${result.amount}</div>;
}

export default componentLoader(PaymentProcessor).withBoundary(<div>Loading...</div>);
```

#### `retryFallback()` - Conditional Fallback

Unlike `retryImmediately()`, `retryFallback()` doesn't trigger immediate retry. Instead, it registers conditional fallbacks that are shown when specific error conditions are met, then allows automatic retry to proceed.

```typescript
const { componentLoader, retryFallback } = componentLoaderFactory({
  retry: { maxCount: 3, canRetryOnError: true }
});

async function CheckoutForm({ amount }: { amount: number }) {
  // Show different fallbacks based on error conditions
  retryFallback({
    when: (err) => err.code === 'INSUFFICIENT_FUNDS',
    fallback: <div>❌ Insufficient funds. Please add money to your account.</div>
  });

  retryFallback({
    when: (err) => err.code === 'CARD_EXPIRED',
    fallback: <div>❌ Card expired. Please update your payment method.</div>
  });

  // Let other errors propagate to trigger automatic retry
  const result = await processPayment(amount);
  return <div>✅ Payment: ${result.amount}</div>;
}

export default componentLoader(CheckoutForm).withBoundary(<div>Loading...</div>);
```

**Key Differences:**

- `retryImmediately()`: Bypasses automatic retry, triggers immediate retry
- `retryFallback()`: Registers conditional fallbacks, allows automatic retry to continue

### Error Handling

```typescript
const Product = resourceFactory({
  tags: (req: { id: string }) => ({ id: `product-${req.id}` }),
  load: async ({ req, fetcher }) => {
    const response = await fetcher(NextJSAdapter).load(`/api/products/${req.id}`);
    if (!response.ok) throw new Error(`Product not found`);
    return response.json();
  },
});

// Errors propagate and trigger retries automatically
async function ProductPage({ id }: { id: string }) {
  const [load] = loader(Product({ id }));
  const [product] = await load();
  return <div>{product.name}: ${product.price}</div>;
}
```

## 🎛️ Middleware System

```typescript
import { loaderMiddleware } from "@h1y/next-loader";

// Logging middleware
const loggingMiddleware = loaderMiddleware({
  name: "logging",
  contextGenerator: () => ({ startTime: 0 }),
  before: async (context) => {
    context.startTime = Date.now();
    console.log("🚀 Loading started");
  },
  complete: async (context) => {
    const duration = Date.now() - context.startTime;
    console.log(`✅ Loading completed in ${duration}ms`);
  },
});

const loader = loaderFactory({ memo: cache }, config, [loggingMiddleware]);
```

#### Component Middleware with Context Access

```typescript
import { componentMiddleware } from "@h1y/next-loader";

// Performance monitoring for component rendering
const performanceMiddleware = componentMiddleware({
  name: "performance",
  contextGenerator: () => ({ startTime: 0, componentName: '' }),
  before: async (context) => {
    context.startTime = Date.now();
  },
  complete: async (context) => {
    const renderTime = Date.now() - context.startTime;
    console.log(`Component ${context.componentName} render time: ${renderTime}ms`);
  },
});

const { componentLoader, performanceMiddlewareOptions } = componentLoaderFactory({
  retry: { maxCount: 2, canRetryOnError: true }
}, [performanceMiddleware]);

async function MonitoredComponent({ userId }: { userId: string }) {
  // Access middleware context directly in component
  const perfContext = performanceMiddlewareOptions();
  perfContext.componentName = 'MonitoredComponent';

  const [load] = loader(User({ id: userId }));
  const [user] = await load();

  return (
    <div>
      <h1>{user.name}</h1>
      <p>Render started at: {new Date(perfContext.startTime).toISOString()}</p>
    </div>
  );
}

export default componentLoader(MonitoredComponent).withBoundary(<div>Loading...</div>);
```

## ⚠️ Best Practices & Important Guidelines

### Fallback Component Guidelines

**Separate Module Creation**: Always create fallback components as separate modules rather than inline definitions for better maintainability and reusability.

**Error Fallback Requirements**: Error fallback components **must** be Client Components since they handle interactive events like `onClick` for retry buttons.

**Context Access Limitation**: Fallback components cannot access (Component)Loader Context. Keep fallback logic independent and stateless.

**retryFallback Usage Pattern**: Like React Hooks, `retryFallback` functions must be called during every component render cycle, not conditionally.

```typescript
// ❌ Wrong - Conditional fallback registration
async function MyComponent() {
  if (someCondition) {
    retryFallback({ when: () => true, fallback: () => {} }); // Don't do this
  }
  return await loadData();
}

// ✅ Correct - Always register fallbacks
async function MyComponent() {
  // Always call retryFallback at component render
  retryFallback({ when: () => true, fallback: () => {} });

  return await loadData();
}
```

**Fallback Component Examples**:

```typescript
// ✅ Correct: Separate module for loading fallback
export function UserProfileLoadingFallback() {
  return (
    <div className="animate-pulse">
      <div className="h-8 bg-gray-200 rounded mb-2"></div>
      <div className="h-4 bg-gray-200 rounded"></div>
    </div>
  );
}

// ✅ Correct: Separate Client Component module for error fallback
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
      <h3>Failed to load user profile</h3>
      <p className="text-red-600">{error.message}</p>
      <button
        onClick={resetErrorBoundary}
        className="mt-2 px-4 py-2 bg-red-600 text-white rounded"
      >
        Retry
      </button>
    </div>
  );
}

// Usage in main component
export const UserProfileComponent = componentLoader(UserProfile).withErrorBoundary({
  errorFallback: UserProfileErrorFallback
});
```

## ⚠️ Important Principles

**next-loader is a library that supports Next.js and does not change its fundamental behavior strategies:**

- **Don't suppress errors that cannot be resolved through retries** - Let them propagate naturally so Next.js can handle them appropriately

```typescript
// ❌ Wrong - Don't do this
async function MyComponent() {
  try {
    const data = await loadData();
    return <div>{data.content}</div>;
  } catch (error) {
    // Don't suppress errors that cannot be resolved through retries
    return <div>Something went wrong: {error.message}</div>;
  }
}

// ✅ Correct - Let Next.js handle errors
async function MyComponent() {
  // Errors that cannot be resolved through retries will propagate naturally for Next.js to handle
  const data = await loadData();
  return <div>{data.content}</div>;
}
```

## 📖 API Reference

### `loaderFactory(dependencies, options?, middlewares?)`

```typescript
const loader = loaderFactory(
  {
    memo: cache, // Request deduplication
  },
  {
    retry: { maxCount: 3, canRetryOnError: true },
    timeout: { delay: 10000 },
  },
);

// Usage with revalidation
const [load, revalidation] = loader(SomeResource({ id: '123' }));

// In your component
<form action={async () => {
  "use server";
  revalidation.forEach(revalidateTag);
}}>
  <button>Refresh</button>
</form>
```

### `componentLoaderFactory(options?, middlewares?)`

```typescript
const { componentLoader } = componentLoaderFactory({
  retry: { maxCount: 3, canRetryOnError: true }
});

async function UserProfile({ userId }: { userId: string }) {
  const user = await fetchUserProfile(userId);
  return <div>Hello, {user.name}!</div>;
}

// Three boundary management options:
export const NoBoundary = componentLoader(UserProfile).withNoBoundary();
export const WithSuspense = componentLoader(UserProfile).withBoundary(<LoadingFallback />);
export const WithErrorHandling = componentLoader(UserProfile).withErrorBoundary({
  errorFallback: ErrorFallback
});
```

#### Boundary Management Methods

**`withNoBoundary()`**: Returns the async component as-is with resilience logic applied but no additional boundary wrapping.

**`withBoundary(fallback?)`**: Wraps the component with a Suspense boundary for independent code-splitting and loading states.

**`withErrorBoundary(props)`**: Handles both errors and loading states with comprehensive boundary management.

```typescript
// Error boundary props
type AsyncErrorBoundaryProps = {
  pendingFallback?: React.ReactElement; // Loading state
  errorFallback: (props: { error: unknown }) => React.ReactElement; // Error state
};
```

#### Integration with loaderFactory

```typescript
const loader = loaderFactory({ memo: cache });
const { componentLoader } = componentLoaderFactory({
  retry: { maxCount: 2, canRetryOnError: true }
});

async function Dashboard({ userId }: { userId: string }) {
  // Loader failures automatically trigger component retries
  const [loadUser] = loader(User({ id: userId }));
  const [loadPosts] = loader(UserPosts({ userId }));

  const [user, posts] = await Promise.all([loadUser(), loadPosts()]);
  return <div>{user.name}: {posts.length} posts</div>;
}

export default componentLoader(Dashboard).withBoundary(<div>Loading...</div>);
```

### `resourceFactory(config)`

```typescript
const UserPosts = resourceFactory({
  tags: (req: { userId: string }) => ({
    id: hierarchyTag("user", req.userId, "posts"),
    effects: ["activity-feed"],
  }),
  options: { staleTime: 180000 },
  use: (req) => [User({ id: req.userId })], // Dependencies
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
// Creates: ['user', 'user/123', 'user/123/posts']
const tags = hierarchyTag("user", "123", "posts");

const UserPosts = resourceFactory({
  tags: (req: { userId: string }) => ({
    id: hierarchyTag("user", req.userId, "posts"),
    effects: hierarchyTag("user", req.userId), // Parent levels
  }),
});
```

### Backoff Strategies

Control retry timing with different backoff strategies:

```typescript
import {
  FIXED_BACKOFF,
  LINEAR_BACKOFF,
  EXPONENTIAL_BACKOFF,
} from "@h1y/next-loader";

// Fixed delay: always wait 2 seconds between retries
const loader = loaderFactory(dependencies, {
  retry: { maxCount: 3, canRetryOnError: true },
  backoff: {
    strategy: FIXED_BACKOFF,
    initialDelay: 2000, // 2 seconds
  },
});

// Linear backoff: 1s, 3s, 5s delays
const loader = loaderFactory(dependencies, {
  retry: { maxCount: 3, canRetryOnError: true },
  backoff: {
    strategy: LINEAR_BACKOFF(2000), // Add 2 seconds each retry
    initialDelay: 1000, // Start with 1 second
  },
});

// Exponential backoff: 500ms, 1s, 2s, 4s delays
const loader = loaderFactory(dependencies, {
  retry: { maxCount: 4, canRetryOnError: true },
  backoff: {
    strategy: EXPONENTIAL_BACKOFF(2), // Double delay each retry
    initialDelay: 500, // Start with 500ms
  },
});
```

### `createExternalResourceAdapter(adapter)`

⚠️ **API Change**: Previously named `createResourceAdapter`, now renamed to `createExternalResourceAdapter` for better clarity.

Create custom adapters for external resources:

```typescript
import { createExternalResourceAdapter } from "@h1y/next-loader";

// Custom adapter for external API
const externalAdapter = createExternalResourceAdapter({
  validate: (param) => {
    if (!param.url) throw new Error("URL is required");
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

## 🔄 Next.js Integration

**Important**: Retries might not be visible due to Next.js caching. Use dynamic rendering for visible retries:

```typescript
import { headers } from 'next/headers';

async function DynamicPage({ id }: { id: string }) {
  await headers(); // Forces dynamic rendering

  const [load, revalidation] = loader(User({ id }));
  const [user] = await load(); // Retries visible to users

  return (
    <div>
      <div>{user.name}</div>
      <form action={async () => {
        "use server";
        revalidation.forEach(revalidateTag);
      }}>
        <button>Refresh</button>
      </form>
    </div>
  );
}
```

## 🤔 FAQ

### Q: Why don't I see retry attempts in my Next.js app?

**A:** This is due to Next.js caching behavior. When content is cached, users get the cached version immediately while revalidation happens in the background. Retries are only visible during:

- Dynamic rendering (using `force-dynamic` or dynamic functions like `headers()` and `cookies()`)
- Fresh requests without cache
- Cache misses or expired content

### Q: How can I make retry processes visible to users?

**A:** Use dynamic rendering patterns:

```typescript
import { headers } from 'next/headers';

async function DynamicComponent() {
  await headers(); // Forces dynamic rendering

  const [load, revalidation] = loader(SomeResource({ id: '123' }));
  const [data] = await load(); // Now retries will be visible to users

  return (
    <div>
      <div>{data.content}</div>
      <form action={async () => {
        "use server";
        revalidation.forEach(revalidateTag);
      }}>
        <button>Refresh</button>
      </form>
    </div>
  );
}
```

### Q: When should I use componentLoader vs loader?

**A:**

- **Use `loaderFactory()`** for data fetching with caching and **batch loading** (most common use case)
- **Use `componentLoaderFactory()`** when you need component-level retry/timeout behavior and state management

**Best Practice:** Use both together:

```typescript
const loader = loaderFactory({ memo: cache }); // Global data loading
const { componentLoader } = componentLoaderFactory(config); // Component resilience

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
        <button>Refresh</button>
      </form>
    </div>
  );
}

export default componentLoader(MyComponent).withBoundary(<LoadingFallback />);
```

## 🛠️ Dependencies

This library is built on top of other packages in the @h1y ecosystem:

- **[@h1y/loader-core v6.0.0](https://github.com/h1ylabs/next-loader/tree/main/packages/core)** - Core loading functionality with retry/timeout/backoff
- **[@h1y/promise-aop v6.0.0](https://github.com/h1ylabs/next-loader/tree/main/packages/promise-aop)** - Promise-based AOP framework for middleware

**Dependencies:**

- `react-error-boundary ^6.0.0` - Error boundary utilities for componentLoader

**Peer Dependencies:**

- React ≥18.2.0
- Next.js ≥14.0.0 (for `NextJSAdapter` and cache integration)

## 📄 License

MIT © [h1ylabs](https://github.com/h1ylabs)
