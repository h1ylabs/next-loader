# @h1y/next-loader

A powerful, type-safe resource loading library specifically designed for Next.js applications. Build efficient data fetching with built-in caching, revalidation, retry logic, and seamless integration with Next.js server components.

[한국어 문서 (Korean Documentation)](./docs/README-ko.md)

[![npm version](https://badge.fury.io/js/%40h1y%2Fnext-loader.svg)](https://badge.fury.io/js/%40h1y%2Fnext-loader)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## ✨ Key Features

- **🎯 Next.js Native**: Built specifically for Next.js with first-class server component support
- **🔄 Smart Caching**: Integrates seamlessly with Next.js cache system and revalidation
- **⚡ Resource Builder Pattern**: Declarative resource definitions with dependency management
- **🛡️ Type Safety**: Full TypeScript support with intelligent type inference
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
import { revalidateTag } from 'next/cache';
import { cache } from 'react';
import { createLoader, NextJSAdapter } from '@h1y/next-loader';

// Create once at module level, reuse everywhere
const { loader } = createLoader({
  adapter: NextJSAdapter,
  revalidate: revalidateTag,
  memo: cache // Request deduplication
});
```

### 2. Define your resources

```typescript
import { createResourceBuilder } from '@h1y/next-loader';

const User = createResourceBuilder({
  tags: (req: { id: string }) => ({ identifier: `user-${req.id}` }),
  options: { staleTime: 300000 }, // Cache for 5 minutes
  use: [],
  load: async ({ req, fetch }) => {
    const response = await fetch(`/api/users/${req.id}`);
    if (!response.ok) throw new Error(`Failed to fetch user`);
    return response.json();
  },
});
```

### 3. Use in your components

```typescript
async function UserProfile({ params }: { params: { id: string } }) {
  const [load, revalidate] = loader(User({ id: params.id }));
  const [user] = await load();
  
  return (
    <div>
      <h1>{user.name}</h1>
      <p>{user.email}</p>
      <form action={revalidate}>
        <button>Refresh</button>
      </form>
    </div>
  );
}
```

That's it! Your data is now automatically cached, revalidated, and ready for production.

## 🧩 Core Concepts

### Resource Builder Pattern

Resources are declarative definitions that tell @h1y/next-loader how to fetch, cache, and manage your data:

```typescript
const BlogPost = createResourceBuilder({
  // Define cache tags
  tags: (req: { slug: string }) => ({ 
    identifier: `post-${req.slug}`,
    effects: ['blog-content'] // Invalidate related caches
  }),
  
  // Configure caching
  options: { staleTime: 600000 }, // Cache for 10 minutes
  
  // Declare dependencies
  use: [], // No dependencies for this resource
  
  // Define how to load data
  load: async ({ req, fetch, retry }) => {
    const response = await fetch(`/api/posts/${req.slug}`);
    if (!response.ok) {
      if (response.status >= 500) retry(); // Retry on server errors
      throw new Error('Failed to load post');
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

### Two Ways to Handle Loading

@h1y/next-loader provides two distinct approaches for different use cases:

#### `createLoader()` - For Data Fetching
**When to use**: Loading data in server components (most common use case)

```typescript
const { loader } = createLoader(dependencies);

async function UserPage() {
  const [load] = loader(User({ id: '123' }));
  const [data] = await load();
  return <div>{data.name}</div>;
}
```

**Characteristics:**
- ✅ Perfect for data fetching with caching
- ❌ Middleware context not accessible in components
- 🔧 Default: 60s timeout, no retries

#### `createComponentLoader()` - For Component Resilience
**When to use**: Adding retry/timeout behavior to components themselves

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

**Characteristics:**
- ✅ Component-level retry and timeout handling
- ✅ Middleware context accessible via `{name}MiddlewareOptions()`
- 🔧 Default: Infinite timeout, no retries

### Smart Cache Invalidation with Hierarchical Tags

Organize your cache invalidation strategy with hierarchical tags for precise control:

```typescript
import { hierarchyTag } from '@h1y/next-loader';

const UserComments = createResourceBuilder({
  tags: (req: { userId: string, postId: string }) => ({
    identifier: hierarchyTag('user', req.userId, 'posts', req.postId, 'comments')
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
revalidateTag('user');                    // All user data
revalidateTag('user/123/posts');          // All posts for user 123
revalidateTag('user/123/posts/456');      // Specific post
```

## 🎯 Advanced Examples

### Resource Dependencies

Build complex data flows by composing resources:

```typescript
// Base user resource
const User = createResourceBuilder({
  tags: (req: { id: string }) => ({ identifier: `user-${req.id}` }),
  options: { staleTime: 300000 },
  use: [],
  load: async ({ req, fetch }) => {
    const response = await fetch(`/api/users/${req.id}`);
    return response.json();
  },
});

// Posts that depend on user data
const UserPosts = createResourceBuilder({
  tags: (req: { userId: string }) => ({
    identifier: hierarchyTag('user', req.userId, 'posts'),
    effects: ['activity-feed'] // Invalidate activity feed when posts change
  }),
  options: { staleTime: 180000 },
  use: [User({ id: req.userId })], // Declare dependency
  load: async ({ req, fetch, use: [user] }) => {
    const userData = await user;
    
    // Skip loading if user is inactive
    if (!userData.isActive) {
      return { posts: [], reason: 'User inactive' };
    }
    
    const response = await fetch(`/api/users/${req.userId}/posts`);
    return {
      posts: await response.json(),
      author: userData.name,
    };
  },
});

// Use both resources
async function UserDashboard({ userId }: { userId: string }) {
  const [load, revalidate] = loader(
    User({ id: userId }),
    UserPosts({ userId })
  );
  
  const [user, posts] = await load();
  
  return (
    <div>
      <h1>{user.name}'s Dashboard</h1>
      <p>{posts.posts.length} posts</p>
      <form action={revalidate}>
        <button>Refresh</button>
      </form>
    </div>
  );
}
```

### Error Handling and Resilience

```typescript
const { loader } = createLoader(dependencies, {
  retry: { 
    maxCount: 3, 
    canRetryOnError: (error) => error.status >= 500 // Only retry server errors
  },
  timeout: { delay: 10000 }
});

const Product = createResourceBuilder({
  tags: (req: { id: string }) => ({ identifier: `product-${req.id}` }),
  options: { staleTime: 120000 },
  use: [],
  load: async ({ req, fetch, retry, loaderOptions }) => {
    try {
      const response = await fetch(`/api/products/${req.id}`);
      if (!response.ok) {
        if (response.status >= 500) retry(); // Trigger retry for server errors
        throw new Error(`Product not found: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      const options = loaderOptions();
      
      // Return error state with retry info
      return {
        id: req.id,
        error: true,
        message: error.message,
        retryCount: options.retry.count
      };
    }
  },
});
```

## 🎛️ Middleware System

Add cross-cutting concerns like logging, metrics, and monitoring to your loaders with a powerful middleware system built on [@h1y/promise-aop](https://github.com/h1ylabs/next-loader/tree/main/packages/promise-aop).

### Why Middleware?

**Middleware** provides clean separation of concerns:
- **Simplified API**: Easy-to-use interfaces for common patterns
- **Type Safety**: Full TypeScript support with automatic context inference  
- **Integration**: Seamless integration with Next.js caching
- **Isolation**: Each middleware has its own isolated context

### Creating Custom Middleware

#### For Data Loaders

```typescript
import { createLoaderMiddleware } from '@h1y/next-loader';

// Performance monitoring middleware
const performanceMiddleware = createLoaderMiddleware({
  name: 'performance',
  contextGenerator: () => ({ startTime: 0 }),
  
  before: async (context) => {
    context.startTime = performance.now();
    console.log('🚀 Loading started');
  },
  
  complete: async (context, result) => {
    const duration = performance.now() - context.startTime;
    console.log(`✅ Completed in ${duration.toFixed(2)}ms`);
  },
  
  failure: async (context, error) => {
    const duration = performance.now() - context.startTime;
    console.error(`❌ Failed after ${duration.toFixed(2)}ms:`, error.message);
  }
});

// Apply to your loader
const { loader } = createLoader(dependencies, loaderConfig, [
  performanceMiddleware
]);
```

#### For Component Loaders

```typescript
import { createComponentMiddleware } from '@h1y/next-loader';

// Metrics collection middleware
const metricsMiddleware = createComponentMiddleware({
  name: 'metrics',
  contextGenerator: () => ({ renderStart: 0, componentName: 'Unknown' }),
  
  before: async (context) => {
    context.renderStart = Date.now();
  },
  
  complete: async (context) => {
    const renderTime = Date.now() - context.renderStart;
    analytics.track('component.render.success', {
      component: context.componentName,
      renderTimeMs: renderTime
    });
  },
  
  failure: async (context, error) => {
    analytics.track('component.render.failure', {
      component: context.componentName,
      error: error.message
    });
  }
});

// Apply to component loader
const { componentLoader } = createComponentLoader(componentConfig, [
  metricsMiddleware
]);
```
### Advanced Patterns

#### Conditional Logic

```typescript
const debugMiddleware = createLoaderMiddleware({
  name: 'debug',
  contextGenerator: () => ({ shouldLog: process.env.NODE_ENV === 'development' }),
  
  before: async (context) => {
    if (context.shouldLog) console.log('🔍 Starting loader');
  },
  
  complete: async (context, result) => {
    if (context.shouldLog) console.log('✅ Result:', result);
  }
});
```

#### Error Recovery

```typescript
const recoveryMiddleware = createLoaderMiddleware({
  name: 'recovery',
  contextGenerator: () => ({ attempts: 0 }),
  
  failure: async (context, error) => {
    context.attempts++;
    if (error.code === 'NETWORK_ERROR') {
      console.warn(`Network error (attempt ${context.attempts}), will retry`);
    }
  }
});
```

### Key Features

- **🔒 Isolated Contexts**: Each middleware has its own private context
- **🔁 Lifecycle Hooks**: Hook into before, complete, failure, and cleanup phases
- **🎯 Composable**: Stack multiple middleware for complex behaviors
- **🛡️ Type Safe**: Full TypeScript support with automatic inference

### Best Practices

- Keep middleware **focused** on a single concern
- Use **descriptive names** for easier debugging
- Keep context data **minimal** to reduce memory usage
- **Test middleware independently** from business logic

## 📖 API Reference

### `createLoader(dependencies, options?, middlewares?)`

Creates a global data loader for fetching and caching resources.

**Dependencies** (required):
```typescript
{
  adapter: NextJSAdapter,        // Data fetching integration
  revalidate: revalidateTag,     // Cache invalidation (from 'next/cache')
  memo?: cache                   // Request deduplication (from 'react')
}
```

**Options** (optional):
```typescript
{
  retry: {
    maxCount: number;                              // Max retry attempts (default: 0)
    canRetryOnError: boolean | ((error) => boolean); // When to retry (default: false)
    onRetryEach?: () => void;                      // Called on each retry
  };
  timeout: {
    delay: number;                                 // Timeout in ms (default: 60000)
    onTimeout?: () => void;                        // Called on timeout
  };
  backoff?: {
    strategy: Backoff;                             // Delay strategy between retries
    initialDelay: number;                          // First retry delay in ms
  };
}
```

**Returns:** `{ loader }` - The loader function

**Example:**
```typescript
const { loader } = createLoader(
  { adapter: NextJSAdapter, revalidate: revalidateTag },
  { retry: { maxCount: 3, canRetryOnError: (error) => error.status >= 500 } }
);
```

### `createComponentLoader(options?, middlewares?)`

Wraps server components with retry and timeout behavior.

**Options** (optional):
```typescript
{
  retry: {
    maxCount: number;                              // Max retries (default: 0)
    canRetryOnError: boolean | ((error) => boolean); // Retry condition
    fallback?: React.ReactElement;                 // Loading component
  };
  timeout: {
    delay: number;                                 // Timeout in ms (default: Infinity)
  };
  backoff?: {
    strategy: Backoff;                             // Delay strategy
    initialDelay: number;                          // Initial delay
  };
}
```

**Returns:**
- `componentLoader`: Function to wrap components
- `retryComponent`: Trigger manual retry
- `componentOptions`: Access current state

```typescript
// Create component loader globally
const { componentLoader, retryComponent, componentOptions, componentState } = createComponentLoader({
  retry: { 
    maxCount: 2, 
    canRetryOnError: true,
    fallback: <div>Loading...</div> 
  },
  timeout: { delay: 30000 }
});

// Define component separately
async function UserProfile({ userId }: { userId: string }) {
  const user = await fetchUser(userId);
  return <div>Hello, {user.name}!</div>;
}

// Wrap and export
export default componentLoader(UserProfile);
```

### `createResourceBuilder(config)`

Defines how to fetch, cache, and manage data resources.

**Configuration:**
```typescript
{
  tags: (req) => ({                                 // Cache tag generation
    identifier: string;                            // Primary cache tag
    effects?: string[];                            // Additional tags to invalidate
  });
  
  options: {
    staleTime: number;                             // Cache duration in ms
    revalidate?: boolean | number;                 // Next.js ISR setting
  };
  
  use: ResourceBuilder[];                          // Resource dependencies
  
  load: async ({ req, fetch, use, retry }) => {    // Data loading function
    // req: Request parameters
    // fetch: Next.js enhanced fetch
    // use: Resolved dependencies
    // retry: Manual retry trigger
  };
}
```

**Example:**
```typescript
const UserPosts = createResourceBuilder({
  tags: (req: { userId: string }) => ({
    identifier: hierarchyTag('user', req.userId, 'posts')
  }),
  options: { staleTime: 180000 },
  use: [User({ id: req.userId })],
  load: async ({ req, fetch, use: [user] }) => {
    const userData = await user;
    if (!userData.isActive) return { posts: [] };
    
    const response = await fetch(`/api/users/${req.userId}/posts`);
    return { posts: await response.json() };
  },
});
```

### `hierarchyTag(...segments)`

Builds hierarchical cache tags for precise invalidation control.

**Usage:**
```typescript
// Creates: ['user', 'user/123', 'user/123/posts']
const tags = hierarchyTag('user', '123', 'posts');

// In resource builders:
const UserProfile = createResourceBuilder({
  tags: (req: { userId: string }) => ({
    identifier: hierarchyTag('user', req.userId, 'profile'),
    effects: hierarchyTag('user', req.userId) // Parent levels
  }),
});
```

**Invalidation:**
```typescript
revalidateTag('user');           // All user data
revalidateTag('user/123');       // All data for user 123
revalidateTag('user/123/profile'); // Only user 123's profile
```

### Backoff Strategies

Backoff strategies control the delay between retry attempts. All strategies are imported from `@h1y/loader-core`.

```typescript
import {
  FIXED_BACKOFF,
  LINEAR_BACKOFF, 
  EXPONENTIAL_BACKOFF
} from '@h1y/next-loader'; // Re-exported from loader-core
```

**Available Strategies:**

| Strategy | Function | Description | Example Delays |
|----------|----------|-------------|----------------|
| **Fixed** | `FIXED_BACKOFF` | Same delay between all retries | 1000ms, 1000ms, 1000ms |
| **Linear** | `LINEAR_BACKOFF(increment)` | Delay increases linearly | 1000ms, 2000ms, 3000ms |
| **Exponential** | `EXPONENTIAL_BACKOFF(multiplier)` | Delay multiplies exponentially | 1000ms, 2000ms, 4000ms |

**Usage Examples:**

```typescript
// Fixed delay: always wait 2 seconds between retries
const { loader } = createLoader(dependencies, {
  retry: { maxCount: 3, canRetryOnError: true },
  backoff: {
    strategy: FIXED_BACKOFF,
    initialDelay: 2000 // 2 seconds
  }
});

// Linear backoff: 1s, 3s, 5s delays  
const { loader } = createLoader(dependencies, {
  retry: { maxCount: 3, canRetryOnError: true },
  backoff: {
    strategy: LINEAR_BACKOFF(2000), // Add 2 seconds each retry
    initialDelay: 1000 // Start with 1 second
  }
});

// Exponential backoff: 500ms, 1s, 2s, 4s delays
const { loader } = createLoader(dependencies, {
  retry: { maxCount: 4, canRetryOnError: true },
  backoff: {
    strategy: EXPONENTIAL_BACKOFF(2), // Double delay each retry
    initialDelay: 500 // Start with 500ms
  }
});

// Component loader with exponential backoff
const { componentLoader } = createComponentLoader({
  retry: { 
    maxCount: 3, 
    canRetryOnError: true,
    fallback: <div>Retrying...</div>
  },
  backoff: {
    strategy: EXPONENTIAL_BACKOFF(1.5), // Multiply by 1.5 each retry
    initialDelay: 1000
  }
});
```

**Backoff Best Practices:**

1. **API Calls**: Use exponential backoff to reduce server load during outages
2. **Database Operations**: Use linear backoff for predictable retry intervals  
3. **Quick Operations**: Use fixed backoff for consistent user experience
4. **Rate Limited APIs**: Use exponential backoff with longer initial delays

### Middleware Creation Functions

#### `createLoaderMiddleware(config)`

Creates middleware for data loaders with lifecycle hooks around data fetching operations.

**Parameters:**

- `config`: **Required** middleware configuration object:
  ```typescript
  {
    name: string;                                    // Unique middleware identifier  
    contextGenerator: () => Context;                 // Factory function for middleware context
    before?: (context: Context) => Promise<void>;   // Called before loader execution
    complete?: (context: Context, result: Result) => Promise<void>; // Called after successful execution
    failure?: (context: Context, error: unknown) => Promise<void>;  // Called when loader fails
    cleanup?: (context: Context) => Promise<void>;  // Always called for cleanup
  }
  ```

**Returns:** Middleware instance for use with `createLoader`

#### `createComponentMiddleware(config)`

Creates middleware for component loaders with lifecycle hooks around component rendering.

**Parameters:**

- `config`: **Required** middleware configuration object:
  ```typescript
  {
    name: string;                                    // Unique middleware identifier
    contextGenerator: () => Context;                 // Factory function for middleware context  
    before?: (context: Context) => Promise<void>;   // Called before component rendering
    complete?: (context: Context, result: React.ReactElement) => Promise<void>; // Called after successful render
    failure?: (context: Context, error: unknown) => Promise<void>;              // Called when component fails
    cleanup?: (context: Context) => Promise<void>;  // Always called for cleanup
  }
  ```

**Returns:** Middleware instance for use with `createComponentLoader`

**Middleware Lifecycle:**
1. `contextGenerator()` - Creates isolated context for this middleware instance
2. `before(context)` - Setup, validation, preparation  
3. **Target execution** (loader or component)
4. `complete(context, result)` **OR** `failure(context, error)` - Result handling
5. `cleanup(context)` - Always executed for resource cleanup

## 🔄 Next.js Integration & Caching Behavior

### Understanding ISR and Cache Behavior

**Important**: The retry process might not be visible to users due to Next.js caching mechanisms.

Next.js uses an ISR (Incremental Static Regeneration) approach similar to `stale-while-revalidate`:

1. **No cache exists**: Request triggers rendering, then caches the result
2. **Cache exists**: Returns cached content immediately
3. **Revalidation triggered**: 
   - **Current request** gets the stale cached content
   - **Background** performs new rendering
   - **Next request** gets fresh content if rendering succeeded
   - **Failed rendering** keeps stale cache and retries on next request

This means users might not see retry processes because they're getting cached results.

### When Will Users See Retries?

Retries become visible in these scenarios:

- **Dynamic rendering**: Using `force-dynamic` or functions like `headers()`, `cookies()`
- **Fresh requests**: No cache exists yet
- **Cache misses**: Cache expired and no stale content available

```typescript
// Example: Dynamic rendering where retries are visible
import { headers } from 'next/headers';

// Global loader with retry configuration
const { loader } = createLoader(dependencies, {
  retry: { maxCount: 3, canRetryOnError: true }, // Users will see these retries
  timeout: { delay: 5000 }
});

async function DynamicUserPage({ id }: { id: string }) {
  const headersList = await headers();
  const userAgent = headersList.get('user-agent'); // Forces dynamic rendering
  
  const [load] = loader(User({ id }));
  const [userData] = await load();
  
  return <div>Hello {userData.name}! (UA: {userAgent})</div>;
}
```


## 🎯 Advanced Examples

### Complex Resource Dependencies

```typescript
// Global loader instance
const { loader } = createLoader(dependencies);

// User resource
const User = createResourceBuilder({
  tags: (req: { id: string }) => ({ identifier: `user-${req.id}` }),
  options: { staleTime: 300000 },
  use: [],
  load: async ({ req, fetch }) => {
    const response = await fetch(`/api/users/${req.id}`);
    return response.json();
  },
});

// Posts with user dependency and hierarchical tags
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
      retry(); // Retry if user inactive
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

// Usage in server component
async function UserDashboard({ userId }: { userId: string }) {
  const [load, revalidate] = loader(
    User({ id: userId }),
    UserPosts({ userId })
  );
  
  const [userData, postsData] = await load();
  
  return (
    <div>
      <h1>{userData.name}'s Dashboard</h1>
      <p>{postsData.totalPosts} posts by {postsData.author}</p>
      <form action={revalidate}>
        <button>Refresh</button>
      </form>
    </div>
  );
}
```

### Error Handling and Fallbacks

```typescript
// Global loader with smart error handling
const { loader } = createLoader(dependencies, {
  retry: { 
    maxCount: 3, 
    canRetryOnError: (error) => error.status >= 500
  },
  timeout: { delay: 10000 }
});

// Product resource with multiple fallback strategies
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
        throw new Error(`API Error: ${response.status}`);
      }
      
      const product = await response.json();
      
      // Try to get live inventory, fallback to cached
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
      // Return error state with retry info
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

// Usage with error handling
async function ProductPage({ id }: { id: string }) {
  const [load, revalidate] = loader(Product({ id }));
  const [product] = await load();
  
  if (product.error) {
    return (
      <div>
        <h1>Product Unavailable</h1>
        <p>{product.message}</p>
        <p>Retried {product.retries} times</p>
        <form action={revalidate}>
          <button>Try Again</button>
        </form>
      </div>
    );
  }
  
  return (
    <div>
      <h1>{product.name}</h1>
      <p>${product.price}</p>
      <p>{product.available ? `${product.stock} in stock` : 'Out of stock'}</p>
      {product.retries > 0 && <small>Loaded after {product.retries} retries</small>}
    </div>
  );
}
```

### Component-Level Resilience

```typescript
import { createComponentLoader, middleware } from '@h1y/next-loader';

// Performance monitoring middleware
const perfMiddleware = middleware<React.ReactElement>().withOptions({
  name: 'perf',
  contextGenerator: () => ({ startTime: 0 }),
  before: async (context) => {
    context.startTime = Date.now();
  },
  complete: async (context) => {
    console.log(`Rendered in ${Date.now() - context.startTime}ms`);
  },
});

// Create component loader with middleware and fallback
const { componentLoader, retryComponent, componentOptions } = createComponentLoader({
  retry: { 
    maxCount: 3, 
    canRetryOnError: (error) => error.status >= 500,
    fallback: <div>Loading dashboard...</div>
  },
  timeout: { delay: 10000 }
}, [perfMiddleware]);

// Dashboard component with manual retry logic
async function UserDashboard({ userId }: { userId: string }) {
  const options = componentOptions();
  
  try {
    const [profile, notifications] = await Promise.all([
      fetch(`/api/users/${userId}/profile`).then(r => r.json()),
      fetch(`/api/users/${userId}/notifications`).then(r => r.json())
    ]);
    
    // Trigger retry if data is stale
    if (!profile.isActive && options.retry.count === 0) {
      retryComponent();
    }
    
    return (
      <div>
        <h1>Welcome, {profile.name}!</h1>
        <div>
          <p>{notifications.length} notifications</p>
          {options.retry.count > 0 && (
            <small>Loaded after {options.retry.count} retries</small>
          )}
        </div>
      </div>
    );
    
  } catch (error) {
    return (
      <div>
        <h2>Dashboard Error</h2>
        <p>{error.message}</p>
        <p>Retried {options.retry.count} times</p>
      </div>
    );
  }
}

// Export wrapped component
export default componentLoader(UserDashboard);
```

## ⚠️ Important Considerations & Caveats

### Middleware Context Access

- **`createLoader()`**: Middleware context is **NOT accessible** from your server component
- **`createComponentLoader()`**: Middleware context **IS accessible** from wrapped component using the `{name}MiddlewareOptions()` function returned from `createComponentLoader`

### Context Propagation Limitations  

- **Fallback Elements**: Do not share context with the main component
- **Children Components**: Context is not propagated to child components
- **Isolated Execution**: Each retry creates a fresh execution context

### Retry/Timeout Reset

While you can reset retry and timeout programmatically, **it's not recommended** as it can lead to unpredictable behavior:

```typescript
// ❌ Not recommended
const [load] = loader(SomeResource({ id: '123' }));
await load();

// Reset (not recommended)
loaderOptions().retry.resetRetryCount();
loaderOptions().timeout.resetTimeout();
```

## 🤔 FAQ

### Q: Why don't I see retry attempts in my Next.js app?

**A:** This is due to Next.js caching behavior. When content is cached, users get the cached version immediately while revalidation happens in the background. Retries are only visible during:
- Dynamic rendering (using `force-dynamic` or dynamic functions)
- Fresh requests without cache
- Cache misses or expired content

### Q: How can I make retry processes visible to users?

**A:** Use dynamic rendering patterns:

```typescript
import { headers } from 'next/headers';

// Global loader instance
const { loader } = createLoader(dependencies, {
  retry: { maxCount: 3, canRetryOnError: true }
});

async function DynamicComponent() {
  await headers(); // Forces dynamic rendering
  
  const [load] = loader(SomeResource({ id: '123' }));
  const [data] = await load();
  // Now retries will be visible to users
  
  return <div>{data.content}</div>;
}
```

Or use PPR to limit dynamic rendering to specific sections.

### Q: What's the difference between `identifier` and `effects` in tags?

**A:** 
- `identifier`: Primary cache tag for this specific resource
- `effects`: Additional tags that should be invalidated when this resource changes

```typescript
tags: (req) => ({
  identifier: `user-${req.id}`, // Specific to this user
  effects: ['user-list', 'activity-feed'] // Related caches to invalidate
})
```

### Q: Can I use multiple resource builders with the same tags?

**A:** Yes, but be careful about cache conflicts. Use hierarchical tags to organize related resources:

```typescript
const UserProfile = createResourceBuilder({
  tags: (req: { id: string }) => ({ 
    identifier: hierarchyTag('user', req.id, 'profile') 
  }),
  options: { staleTime: 300000 },
  use: [],
  load: async ({ req, fetch }) => {
    const response = await fetch(`/api/users/${req.id}/profile`);
    return response.json();
  }
});

const UserSettings = createResourceBuilder({
  tags: (req: { id: string }) => ({ 
    identifier: hierarchyTag('user', req.id, 'settings') 
  }),
  options: { staleTime: 180000 },
  use: [],
  load: async ({ req, fetch }) => {
    const response = await fetch(`/api/users/${req.id}/settings`);
    return response.json();
  }
});
```

### Q: How do I optimize performance with many resources?

**A:**
1. **Use appropriate staleTime** values based on data freshness needs
2. **Leverage hierarchical tags** for efficient invalidation
3. **Batch related resources** in single loader calls
4. **Consider PPR** to limit dynamic rendering scope

### Q: When should I use componentLoader vs loader?

**A:** 
- **Use `createLoader()`** for data fetching with caching (most common use case). **Always create loader instances globally** and reuse them across components.
- **Use `createComponentLoader()`** when you need component-level retry behavior or access to middleware context within the component

## 🙏 Related Packages

This library is built on top of other packages in the @h1y ecosystem:

- [@h1y/loader-core](https://github.com/h1ylabs/next-loader/tree/main/packages/loader-core) - Core loading functionality with retry/timeout
- [@h1y/promise-aop](https://github.com/h1ylabs/next-loader/tree/main/packages/promise-aop) - Promise-based AOP framework
- [@h1y/loader-tag](https://github.com/h1ylabs/next-loader/tree/main/packages/loader-tag) - Type-safe tagging utilities

## 📄 License

MIT © [h1ylabs](https://github.com/h1ylabs)

