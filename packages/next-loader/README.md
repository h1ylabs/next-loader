# @h1y/next-loader

**Latest version: v6.0.1**

A powerful, type-safe resource loading library specifically designed for Next.js applications. Build efficient data fetching with built-in caching, revalidation, retry logic, and seamless integration with Next.js server components.

[한국어 문서 (Korean Documentation)](https://github.com/h1ylabs/next-loader/tree/main/packages/next-loader/docs/README-ko.md)

[![npm version](https://badge.fury.io/js/%40h1y%2Fnext-loader.svg)](https://badge.fury.io/js/%40h1y%2Fnext-loader)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 📑 Table of Contents

- [✨ Key Features](#-key-features)
- [📦 Installation](#-installation)
- [🔧 Compatibility](#-compatibility)
- [🚀 Quick Start](#-quick-start)
- [🧩 Core Concepts](#-core-concepts)
  - [Resource Builder Pattern](#resource-builder-pattern)
  - [Loading Approaches: When to Use What](#loading-approaches-when-to-use-what)
  - [Smart Cache Invalidation with Hierarchical Tags](#smart-cache-invalidation-with-hierarchical-tags)
- [🎯 Examples](#-examples)
  - [Minimal](#-examples)
- [🎛️ Middleware System](#middleware-system)
- [🎛️ Middleware System](#middleware-system)
- [📖 API Reference](#-api-reference)
- [🔄 Next.js Integration](#-nextjs-integration)
- [⚠️ Best Practices & Important Guidelines](#best-practices--important-guidelines)
- [🤔 FAQ](#-faq)
- [🛠️ Dependencies](#dependencies)
- [🔍 Troubleshooting](#-troubleshooting)
- [📄 License](#-license)

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

## 🔧 Compatibility

- **React**: 18.3+ (peer dependency)
- **Next.js**: 14+ (App Router recommended)
- **Node.js**: 18+
- **TypeScript**: 5+ (optional but recommended)

**Note**: Works best with Next.js App Router and Server Components. For non-Next.js environments, use custom adapters via `createExternalResourceAdapter()`.

## 🚀 Quick Start

Get started with @h1y/next-loader in three simple steps:

### 1. Set up dependencies and create a global loader

```typescript
import { cache } from "react";
import { loaderFactory } from "@h1y/next-loader";

// Create once at module level and reuse everywhere
const loader = loaderFactory({
  memo: cache, // Request deduplication
});
```

### 2. Define your resources

```typescript
import { resourceFactory, NextJSAdapter } from "@h1y/next-loader";

// Define your data types for a project management app
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
  options: { staleTime: 300000 }, // 5 minutes - project info changes less frequently
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
  options: { staleTime: 60000 }, // 1 minute - tasks change frequently
  load: async ({ req, fetcher }) => {
    const response = await fetcher(NextJSAdapter).load(
      `/api/projects/${req.projectId}/tasks`,
    );
    if (!response.ok) throw new Error(`Failed to fetch tasks`);
    return response.json() as Task[];
  },
});
```

### 3. Use in your components

**Single Resource:**

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
        <button>Refresh Project</button>
      </form>
    </div>
  );
}
```

**Batch Loading (Multiple Resources):**

```typescript
async function ProjectDashboard({ params }: { params: { id: string } }) {
  // Load project info and tasks in parallel with full type safety
  const [load, revalidation] = loader(
    Project({ id: params.id }),
    ProjectTasks({ projectId: params.id })
  );

  // Results are type-safe: [Project, Task[]]
  const [project, tasks] = await load();

  const taskStats = {
    total: tasks.length,
    todo: tasks.filter(t => t.status === 'todo').length,
    inProgress: tasks.filter(t => t.status === 'in-progress').length,
    done: tasks.filter(t => t.status === 'done').length,
  };

  return (
    <div className="project-dashboard">
      <h1>{project.name} Dashboard</h1>

      <div className="task-stats">
        <div>Total: {taskStats.total}</div>
        <div>To Do: {taskStats.todo}</div>
        <div>In Progress: {taskStats.inProgress}</div>
        <div>Done: {taskStats.done}</div>
      </div>

      <div className="recent-tasks">
        <h3>Recent Tasks</h3>
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
        <button>Refresh All Data</button>
      </form>
    </div>
  );
}
```

That's it! Your data is now automatically cached, batch-loaded, revalidated, and ready for production.

## 🧩 Core Concepts

### Resource Builder Pattern

Think of resources as "smart API calls" that know how to cache themselves and handle errors. Instead of writing fetch() calls everywhere, you define your data requirements once:

See Quick Start for a minimal resource definition and usage example.

**Why this is better than regular fetch():**

- ✅ **Automatic caching** - Same data won't be fetched twice
- ✅ **Error handling** - Built-in retry logic for failed requests
- ✅ **Type safety** - Full TypeScript support
- ✅ **Reusable** - Define once, use anywhere in your app

### Loading Approaches: When to Use What

@h1y/next-loader provides two complementary approaches that work together:

| Feature                       | `loaderFactory()`                 | `componentLoaderFactory()`     |
| ----------------------------- | --------------------------------- | ------------------------------ |
| **Primary Use Case**          | Data fetching with caching        | Component resilience & state   |
| **Batch Loading**             | ✅ Multiple resources in parallel | ❌ Single component focus      |
| **Next.js Cache Integration** | ✅ ISR, revalidateTag             | ❌ Component-level only        |
| **Request Deduplication**     | ✅ Via React's `cache()`          | ❌ Not applicable              |
| **Retry & Timeout**           | 🔧 Configurable                   | ✅ Built-in with UI feedback   |
| **State Persistence**         | ❌ Stateless                      | ✅ Across retry cycles         |
| **Boundary Management**       | ❌ Manual setup needed            | ✅ Suspense + Error Boundary   |
| **Best Practice**             | Most data fetching scenarios      | Combine with `loaderFactory()` |

#### When to Use `loaderFactory()`

- **Most common use case** - Loading external data in server components
- Need to load multiple resources simultaneously (batch loading)
- Want Next.js cache integration and request deduplication
- Building standard data fetching patterns

#### When to Use `componentLoaderFactory()`

- Need component-level retry with user feedback
- Want state that persists across retry attempts
- Need automatic boundary management (loading/error states)
- Building resilient UI components

#### Quick Comparison Example

```typescript
// loaderFactory - Data-focused approach
const [load] = loader(Project({ id: "proj-123" }), ProjectTasks({ projectId: "proj-123" }));
const [project, tasks] = await load(); // Batch loading with type safety

// componentLoaderFactory - Component-focused approach
const { componentLoader } = componentLoaderFactory({ retry: { maxCount: 3 } });
export default componentLoader(ProjectDashboard).withErrorBoundary({
  fallback: <div>Failed to load project data</div>
});
```

#### Best Practice: Use Both Together

**Recommended Pattern**: Use `loaderFactory()` for data fetching within `componentLoaderFactory()` components:

```typescript
const loader = loaderFactory({ memo: cache });
const { componentLoader } = componentLoaderFactory({
  retry: { maxCount: 3, canRetryOnError: true }
});

async function RobustProjectDashboard({ projectId }: { projectId: string }) {
  // Use loader for data fetching - gets caching + batch loading
  const [load, revalidation] = loader(
    Project({ id: projectId }),
    ProjectTasks({ projectId })
  );

  // loader failures automatically trigger componentLoader retries
  const [project, tasks] = await load();

  const urgentTasks = tasks.filter(t => t.priority === 'high' && t.status !== 'done');
  const completionRate = Math.round((tasks.filter(t => t.status === 'done').length / tasks.length) * 100);

  return (
    <div className="robust-dashboard">
      <header>
        <h1>{project.name}</h1>
        <div className="project-metrics">
          <span>Status: {project.status}</span>
          <span>Completion: {completionRate}%</span>
          <span>Urgent Tasks: {urgentTasks.length}</span>
        </div>
      </header>

      {urgentTasks.length > 0 && (
        <div className="urgent-tasks-alert">
          <h3>⚠️ Urgent Tasks Requiring Attention</h3>
          {urgentTasks.map(task => (
            <div key={task.id} className="urgent-task">
              {task.title} {task.dueDate && `(Due: ${task.dueDate})`}
            </div>
          ))}
        </div>
      )}

      <form action={async () => {
        "use server";
        revalidation.forEach(revalidateTag);
      }}>
        <button>Refresh Dashboard</button>
      </form>
    </div>
  );
}

// Gets both: data loading efficiency + component resilience
export default componentLoader(RobustProjectDashboard).withBoundary(<div>Loading project dashboard...</div>);
```

### Smart Cache Invalidation with Hierarchical Tags

Hierarchical tags provide powerful, resource-based cache invalidation. Understanding how tags connect resources is crucial for building efficient caching strategies.

#### Core Principles

**Tags are Resource Connectors, Not Cache Targets:**

- Tags identify and link resources together
- Actual invalidation targets are always resources, not tags
- Never use `revalidateTag("literal-string")` directly
- Always use `revalidation.forEach(revalidateTag)` from loader

#### Understanding `id` and `effects`

**`id` (Resource Identity):**

- Uniquely identifies this resource in the cache
- Supports both flat and hierarchical styles
  - Flat string: "user-123-posts"
  - Hierarchical identity: use `hierarchyTag()` (e.g., `hierarchyTag("user", userId, "posts")` → ["user", "user/123", "user/123/posts"])
- Hierarchy is recommended for broad invalidation patterns, but not required for simple cases
- Other resources or cache tags may be invalidated by matching these identities when appropriate

**`effects` (Cache Invalidation Tags):**

- Lists tag strings that will be invalidated when THIS resource changes
- These can be any cache tags - they don't need to correspond to other resources
- Used for custom cache invalidation logic and cross-cutting concerns
- Never include your own `id` hierarchy levels (forbidden pattern)

#### Basic Hierarchy Example

```typescript
// Define related resources first
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

// Main resource with hierarchy and effects
const UserPosts = resourceFactory({
  tags: (req: { userId: string }) => ({
    id: hierarchyTag("user", req.userId, "posts"), // Creates: ["user", "user/123", "user/123/posts"]
    effects: [
      "global-activity-feed", // When UserPosts changes, invalidate GlobalActivityFeed
      "trending-topics", // When UserPosts changes, invalidate TrendingTopics
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

#### How Invalidation Works

**When UserPosts is directly revalidated:**

```typescript
const [load, revalidation] = loader(UserPosts({ userId: "123" }));

// In component:
<form action={async () => {
  "use server";
  revalidation.forEach(revalidateTag); // ✅ Correct way
}}>
  <button>Refresh Posts</button>
</form>
```

**Invalidation cascade:**

1. **Primary invalidation**: `["user", "user/123", "user/123/posts"]` hierarchy levels
2. **Resource matching**: Any resources with `id` matching these levels get invalidated
3. **Effects cascade**: Cache tags "global-activity-feed" and "trending-topics" get invalidated
4. **Chain reaction**: If those cache tags are used by other resources, the cascade continues

#### Multi-Dimensional Hierarchies

For complex applications, create sophisticated invalidation networks:

```typescript
// E-commerce product hierarchy
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
      `store-${req.storeId}-inventory`, // Matches StoreInventory resource
      `category-${req.categoryId}-index`, // Matches CategoryIndex resource
      `product-${req.productId}-recommendations`, // Matches ProductRecommendations resource
    ],
  }),
  load: async ({ req, fetcher }) => {
    const response = await fetcher(NextJSAdapter).load(
      `/api/stores/${req.storeId}/categories/${req.categoryId}/products/${req.productId}/variants/${req.variantId}`,
    );
    return response.json();
  },
});

// Multi-tenant SaaS hierarchy
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
      `org-${req.orgId}-billing`, // Matches OrganizationBilling resource
      `team-${req.teamId}-dashboard`, // Matches TeamDashboard resource
      `project-${req.projectId}-alerts`, // Matches ProjectAlerts resource
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

#### Cross-Resource Dependencies

Resources can invalidate each other through strategic `effects`:

```typescript
const UserProfile = resourceFactory({
  tags: (req: { userId: string }) => ({
    id: hierarchyTag("user", req.userId, "profile"),
    effects: [
      `user/${req.userId}/posts`, // Matches UserPosts hierarchy level
      `user-${req.userId}-notifications`, // Matches UserNotifications resource
      "global-search-index", // Matches GlobalSearchIndex resource
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

#### ❌ Common Mistakes to Avoid

```typescript
// ❌ NEVER do direct tag calls
revalidateTag("user/123/posts"); // Forbidden!

// ❌ NEVER include your own hierarchy in effects
const UserPosts = resourceFactory({
  tags: (req) => ({
    id: hierarchyTag("user", req.userId, "posts"),
    effects: [
      "user", // ❌ Your own parent hierarchy
      `user/${req.userId}`, // ❌ Your own parent hierarchy
      `user/${req.userId}/profile`, // ✅ Different resource OK
    ],
  }),
});

// ❌ NEVER use arbitrary strings in effects
const UserPosts = resourceFactory({
  tags: (req) => ({
    id: hierarchyTag("user", req.userId, "posts"),
    effects: ["some-random-string"], // ❌ Use meaningful cache tags
  }),
});
```

#### ✅ Best Practices

```typescript
// ✅ Clear resource relationships
const UserPosts = resourceFactory({
  tags: (req) => ({
    id: hierarchyTag("user", req.userId, "posts"),
    effects: [
      "global-activity-feed", // ✅ Custom cache tag for activity feed
      "search-index", // ✅ Custom cache tag for search index
      "recommendation-engine" // ✅ Custom cache tag for recommendations
    ]
  })
});

// ✅ Always use revalidation from loader
const [load, revalidation] = loader(UserPosts({ userId: "123" }));
<form action={async () => {
  "use server";
  revalidation.forEach(revalidateTag); // ✅ Only correct way
}}>
  <button>Update</button>
</form>
```

**Real-world invalidation scenarios:**

- **User profile update** → Invalidates profile resource + custom cache tags (analytics, search index)
- **New post creation** → Invalidates user posts + custom cache tags (activity feed, trending topics)
- **Product price change** → Invalidates specific product variant + custom cache tags (inventory, recommendations)
- **Team settings update** → Invalidates team hierarchy + custom cache tags (projects, services)

> For advanced hierarchy patterns and large-scale invalidation strategies, please see the documentation site.

## 🎯 Examples

### Basic Resource Loading

Start with a simple, practical example:

```typescript
// Define a resource for team member information
const TeamMember = resourceFactory({
  tags: (req: { id: string }) => ({ id: `team-member-${req.id}` }),
  options: { staleTime: 300000 }, // 5 minutes
  load: async ({ req, fetcher }) => {
    const response = await fetcher(NextJSAdapter).load(`/api/team/members/${req.id}`);
    if (!response.ok) throw new Error(`Failed to fetch team member`);
    return response.json();
  },
});

// Load it in a Server Component
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

### Real-World Team Dashboard

A practical example showing batch loading with meaningful business logic:

```typescript
// Resources for a team management dashboard
const TeamOverview = resourceFactory({
  tags: (req: { teamId: string }) => ({ id: `team-${req.teamId}-overview` }),
  options: { staleTime: 120000 }, // 2 minutes
  load: async ({ req, fetcher }) => {
    const response = await fetcher(NextJSAdapter).load(`/api/teams/${req.teamId}/overview`);
    if (!response.ok) throw new Error(`Failed to fetch team overview`);
    return response.json();
  },
});

const ActiveProjects = resourceFactory({
  tags: (req: { teamId: string }) => ({ id: `team-${req.teamId}-active-projects` }),
  options: { staleTime: 60000 }, // 1 minute - projects change frequently
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
  options: { staleTime: 300000 }, // 5 minutes - metrics change slowly
  load: async ({ req, fetcher }) => {
    const response = await fetcher(NextJSAdapter).load(
      `/api/teams/${req.teamId}/metrics?period=${req.period}`
    );
    if (!response.ok) throw new Error(`Failed to fetch team metrics`);
    return response.json();
  },
});

// Team management dashboard component
async function TeamManagementDashboard({
  params
}: {
  params: { teamId: string }
}) {
  // Load all necessary data in parallel with full type safety
  const [load, revalidation] = loader(
    TeamOverview({ teamId: params.teamId }),
    ActiveProjects({ teamId: params.teamId }),
    TeamPerformanceMetrics({ teamId: params.teamId, period: '30d' })
  );

  // TypeScript knows exact types: [TeamOverview, Project[], PerformanceMetrics]
  const [overview, projects, metrics] = await load();

  const criticalProjects = projects.filter(p =>
    p.status === 'at-risk' || (p.dueDate && new Date(p.dueDate) < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000))
  );

  return (
    <div className="team-dashboard">
      <header className="dashboard-header">
        <h1>{overview.teamName} Team Dashboard</h1>
        <div className="team-stats">
          <div>👥 {overview.memberCount} Members</div>
          <div>📊 {projects.length} Active Projects</div>
          <div>⚡ {metrics.velocityScore}/100 Velocity</div>
        </div>
      </header>

      {criticalProjects.length > 0 && (
        <div className="critical-alerts">
          <h2>🚨 Projects Needing Attention</h2>
          {criticalProjects.map(project => (
            <div key={project.id} className="alert-item">
              <span>{project.name}</span>
              <span className="status">{project.status}</span>
              {project.dueDate && (
                <span>Due: {new Date(project.dueDate).toLocaleDateString()}</span>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="dashboard-grid">
        <section className="project-overview">
          <h3>Active Projects</h3>
          {projects.map(project => (
            <div key={project.id} className="project-card">
              <h4>{project.name}</h4>
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{ width: `${project.completionPercentage}%` }}
                />
              </div>
              <span>{project.completionPercentage}% Complete</span>
            </div>
          ))}
        </section>

        <section className="performance-metrics">
          <h3>Team Performance (Last 30 Days)</h3>
          <div className="metrics-grid">
            <div>Tasks Completed: {metrics.tasksCompleted}</div>
            <div>Avg. Resolution Time: {metrics.avgResolutionTime}h</div>
            <div>Team Satisfaction: {metrics.satisfactionScore}/10</div>
          </div>
        </section>
      </div>

      <form action={async () => {
        "use server";
        // Refresh all dashboard data
        revalidation.forEach(revalidateTag);
      }}>
        <button className="refresh-btn">🔄 Refresh Dashboard</button>
      </form>
    </div>
  );
}
```

### Complex E-commerce Resource Network

Real-world e-commerce example with sophisticated cache relationships:

```typescript
// Product catalog with multi-dimensional hierarchy
const Product = resourceFactory({
  tags: (req: { storeId: string; categoryId: string; productId: string }) => ({
    id: hierarchyTag("store", req.storeId, "category", req.categoryId, "product", req.productId),
    effects: [
      `store-${req.storeId}-search-index`, // Store search index
      `category-${req.categoryId}-bestsellers`, // Category bestsellers
      "recommendation-engine-products", // Product recommendations
      "price-tracking-global" // Price tracking system
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

// Inventory that affects product availability
const ProductInventory = resourceFactory({
  tags: (req: { storeId: string; productId: string; warehouseId: string }) => ({
    id: hierarchyTag("inventory", "store", req.storeId, "product", req.productId, "warehouse", req.warehouseId),
    effects: [
      `store/${req.storeId}/category/*/product/${req.productId}`, // All category instances of this product
      `warehouse-${req.warehouseId}-capacity`, // Warehouse capacity tracking
      "inventory-alerts-low-stock", // Low stock alerts
      "fulfillment-optimization-queue" // Fulfillment optimization
    ]
  }),
  options: { staleTime: 30000 }, // More frequent updates for inventory
  load: async ({ req, fetcher }) => {
    const response = await fetcher(NextJSAdapter).load(
      `/api/stores/${req.storeId}/products/${req.productId}/inventory/${req.warehouseId}`
    );
    return response.json();
  },
});

// Customer cart with session-based hierarchy
const ShoppingCart = resourceFactory({
  tags: (req: { customerId: string; sessionId: string }) => ({
    id: hierarchyTag("customer", req.customerId, "cart", "session", req.sessionId),
    effects: [
      `customer-${req.customerId}-recommendations`, // Customer recommendations
      `session-${req.sessionId}-analytics`, // Session analytics
      "cart-abandonment-tracking", // Cart abandonment tracking
      "real-time-inventory-check" // Real-time inventory verification
    ]
  }),
  options: { staleTime: 60000 },
  use: (req) => [
    Product({ storeId: "main", categoryId: "electronics", productId: "laptop-123" }), // Example dependency
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

// Comprehensive e-commerce dashboard
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
  // Load multiple resources in parallel with full type safety
  const [load, revalidation] = loader(
    Product({ storeId, categoryId, productId }),
    ProductInventory({ storeId, productId, warehouseId }),
    ShoppingCart({ customerId, sessionId })
  );

  // TypeScript knows the exact types: [Product, ProductInventory, ShoppingCart]
  const [product, inventory, cart] = await load();

  return (
    <div className="ecommerce-dashboard">
      <div className="product-section">
        <h2>{product.name}</h2>
        <p>Price: ${product.price}</p>
        <p>In Stock: {inventory.quantity} units</p>
        <p>Warehouse: {inventory.location}</p>
      </div>

      <div className="cart-section">
        <h3>Shopping Cart ({cart.items.length} items)</h3>
        <p>Total Value: ${cart.totalValue}</p>
        <p>Recommendations: {cart.recommendations.length} items</p>
      </div>

      <div className="actions">
        <form action={async () => {
          "use server";
          // This will cascade through all the effects:
          // - Search indexes get updated
          // - Recommendations refresh
          // - Analytics update
          // - Inventory alerts trigger
          revalidation.forEach(revalidateTag);
        }}>
          <button>Refresh All Data</button>
        </form>
      </div>
    </div>
  );
}
```

### Component State Management with Real-Time Monitoring

Use `componentState` to maintain state across retry cycles - this is particularly powerful for monitoring dashboards where you need to track connection status and retry attempts. Unlike React useState, componentState persists across retries.

```typescript
const loader = loaderFactory({ memo: cache });
const { componentLoader, componentState, componentOptions } = componentLoaderFactory({
  retry: { maxCount: 5, canRetryOnError: true }
});

// Define resources for system monitoring
const SystemHealth = resourceFactory({
  tags: (req: { serviceId: string }) => ({ id: `system-health-${req.serviceId}` }),
  options: { staleTime: 30000 }, // 30 seconds - health data should be fresh
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
  options: { staleTime: 60000 }, // 1 minute
  load: async ({ req, fetcher }) => {
    const response = await fetcher(NextJSAdapter).load(
      `/api/services/${req.serviceId}/metrics?period=${req.period}`
    );
    if (!response.ok) throw new Error(`Failed to fetch metrics: ${response.status}`);
    return response.json();
  },
});

async function SystemMonitoringDashboard({ serviceId }: { serviceId: string }) {
  // State persists across retries - crucial for monitoring dashboards
  const [connectionAttempts, setConnectionAttempts] = componentState(0);
  const [lastSuccessfulUpdate, setLastSuccessfulUpdate] = componentState<Date | null>(null);
  const [connectionStatus, setConnectionStatus] = componentState<'connected' | 'reconnecting' | 'failed'>('connected');

  const options = componentOptions();

  // Track connection attempts and update status
  if (options.retry.count > connectionAttempts) {
    setConnectionAttempts(options.retry.count);
    setConnectionStatus('reconnecting');
  }

  try {
    // Load system data - failures will trigger automatic retries
    const [loadHealth] = loader(SystemHealth({ serviceId }));
    const [loadMetrics] = loader(ServiceMetrics({ serviceId, period: '1h' }));

    const [health, metrics] = await Promise.all([
      loadHealth(),
      loadMetrics()
    ]);

    // Reset connection status on successful load
    if (connectionStatus !== 'connected') {
      setConnectionStatus('connected');
      setLastSuccessfulUpdate(new Date());
    }

    const isHealthy = health.status === 'healthy' && health.responseTime < 500;
    const alertCount = health.alerts?.length || 0;

    return (
      <div className="monitoring-dashboard">
        <header className="dashboard-status">
          <h1>Service Monitor: {health.serviceName}</h1>
          <div className="connection-info">
            <div className={`status-indicator ${connectionStatus}`}>
              {connectionStatus === 'connected' && '🟢 Connected'}
              {connectionStatus === 'reconnecting' && '🟡 Reconnecting...'}
              {connectionStatus === 'failed' && '🔴 Connection Failed'}
            </div>
            {connectionAttempts > 0 && (
              <span className="retry-count">Retries: {connectionAttempts}</span>
            )}
          </div>
        </header>

        <div className="health-overview">
          <div className={`health-status ${isHealthy ? 'healthy' : 'warning'}`}>
            <h3>System Health</h3>
            <div>Status: {health.status}</div>
            <div>Response Time: {health.responseTime}ms</div>
            <div>CPU Usage: {health.cpuUsage}%</div>
            <div>Memory Usage: {health.memoryUsage}%</div>
          </div>

          {alertCount > 0 && (
            <div className="alerts-panel">
              <h3>🚨 Active Alerts ({alertCount})</h3>
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
            <h4>Requests/min</h4>
            <span className="metric-value">{metrics.requestsPerMinute}</span>
          </div>
          <div className="metric-card">
            <h4>Error Rate</h4>
            <span className={`metric-value ${metrics.errorRate > 5 ? 'warning' : ''}`}>
              {metrics.errorRate}%
            </span>
          </div>
          <div className="metric-card">
            <h4>Avg Response</h4>
            <span className="metric-value">{metrics.avgResponseTime}ms</span>
          </div>
        </div>

        <footer className="dashboard-footer">
          {lastSuccessfulUpdate && (
            <small>Last updated: {lastSuccessfulUpdate.toLocaleTimeString()}</small>
          )}
          {connectionAttempts > 0 && connectionStatus === 'connected' && (
            <small>✅ Reconnected after {connectionAttempts} attempts</small>
          )}
        </footer>
      </div>
    );
  } catch (error) {
    // This will trigger the retry mechanism
    setConnectionStatus('failed');
    throw error;
  }
}

export default componentLoader(SystemMonitoringDashboard).withErrorBoundary({
  errorFallback: ({ error, resetErrorBoundary }) => (
    <div className="monitoring-error">
      <h2>🔴 Monitoring System Offline</h2>
      <p>Unable to connect to monitoring service</p>
      <button onClick={resetErrorBoundary}>Retry Connection</button>
    </div>
  )
});
```

### Retry (optional)

Resilience features like retries/timeouts are available but optional.

### Error Handling

Keep error handling simple and let the library handle retries/timeouts when enabled.

## 🎛️ Middleware System (optional)

Keep cross-cutting concerns separate with middlewares.

## ⚠️ Best Practices & Important Guidelines

### Fallback Component Guidelines

Keep fallbacks simple, self-contained, and client-only when interactive.

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

### Hierarchical Tags with `hierarchyTag()`

Use `hierarchyTag()` to create hierarchical identities that support broad invalidation at multiple levels. Flat strings still work for simple cases.

```typescript
import { hierarchyTag } from "@h1y/next-loader";

// hierarchyTag automatically creates hierarchy levels
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

#### Advanced Hierarchy Patterns

**Time-based hierarchies:**

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
      `metrics-${req.metric}-aggregates`, // Metric aggregations
      `time-${req.year}-${req.month}-summary`, // Monthly summary
      "dashboard-realtime-updates", // Real-time dashboard updates
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

**Geographic hierarchies:**

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
      `geo-${req.country}-statistics`, // Country-level statistics
      `geo-${req.continent}-regional-data`, // Continental data
      "global-geography-index", // Global geographic index
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

**Conditional hierarchy construction:**

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

#### Type Safety and IDE Support

The array syntax provides excellent TypeScript support:

```typescript
// TypeScript can infer and validate hierarchy segments
type UserHierarchy = ["user", string, "posts"]; // Type-safe hierarchy structure
type OrgHierarchy = ["org", string, "team", string, "project", string];

const typedResource = resourceFactory({
  tags: (req: {
    userId: string;
  }): { id: UserHierarchy; effects: string[] } => ({
    id: hierarchyTag("user", req.userId, "posts"), // TypeScript validates this matches UserHierarchy
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

#### Migration from `hierarchyTag()`

**Legacy (still supported):**

```typescript
import { hierarchyTag } from "@h1y/next-loader";

const oldStyle = resourceFactory({
  tags: (req) => ({
    id: hierarchyTag("user", req.userId, "posts"), // Function call
    effects: ["activity-feed"],
  }),
});
```

**Modern (recommended):**

```typescript
const newStyle = resourceFactory({
  tags: (req) => ({ id: hierarchyTag("user", req.userId, "posts") }),
});
```

- Consistent with modern JavaScript patterns
- Easier to dynamically construct

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

- React ≥18.3.0
- Next.js ≥14.0.0 (for `NextJSAdapter` and cache integration)

## 🔍 Troubleshooting

### Common Issues

#### "Resource not found" or Import Errors

```typescript
// ❌ Wrong
import { User } from "./resources"; // May not be defined correctly

// ✅ Correct
const User = resourceFactory({
  tags: (req: { id: string }) => ({ id: `user-${req.id}` }),
  load: async ({ req, fetcher }) => {
    // Make sure your load function is properly implemented
    const response = await fetcher(NextJSAdapter).load(`/api/users/${req.id}`);
    if (!response.ok)
      throw new Error(`Failed to fetch user: ${response.status}`);
    return response.json();
  },
});
```

#### Retries Not Visible in Development

**Cause**: Next.js caching masks retry attempts  
**Solution**: Use dynamic rendering to see retry behavior

```typescript
import { headers } from 'next/headers';

async function MyComponent() {
  // Force dynamic rendering to see retry behavior in development
  const headersList = headers();
  const userAgent = headersList.get('user-agent') || 'unknown';

  const [load] = loader(User({ id: "123" }));
  const [user] = await load();

  return <div>{user.name} (UA: {userAgent})</div>;
}
```

#### TypeScript Errors with Batch Loading

```typescript
// ❌ Wrong - Missing type inference
const [load] = loader(User({ id: "123" }), UserPosts({ userId: "123" }));
const data = await load(); // TypeScript can't infer types

// ✅ Correct - Let TypeScript infer or explicitly type
const [load] = loader(User({ id: "123" }), UserPosts({ userId: "123" }));
const [user, posts] = await load(); // TypeScript knows types: [User, Post[]]
```

#### "Cannot read properties of undefined" in Error Boundaries

**Cause**: Fallback components trying to access loader context  
**Solution**: Keep fallback components independent

```typescript
// ❌ Wrong - Trying to access context in fallback
function ErrorFallback({ error }: { error: Error }) {
  const options = componentOptions(); // ❌ Not available in fallbacks
  return <div>Error: {error.message}</div>;
}

// ✅ Correct - Self-contained fallback
function ErrorFallback({ error, resetErrorBoundary }: { error: Error; resetErrorBoundary: () => void }) {
  return (
    <div>
      <h3>Something went wrong</h3>
      <p>{error.message}</p>
      <button onClick={resetErrorBoundary}>Try Again</button>
    </div>
  );
}
```

### Debug Mode

Enable detailed logging for troubleshooting:

```typescript
const loader = loaderFactory(
  { memo: cache },
  {
    /* options */
  },
  [
    loaderMiddleware({
      name: "debug",
      before: async () => console.log("🚀 Loading started"),
      complete: async () => console.log("✅ Loading completed"),
      error: async (_, error) => console.error("❌ Loading failed:", error),
    }),
  ],
);
```

## 📄 License

MIT © [h1ylabs](https://github.com/h1ylabs)
