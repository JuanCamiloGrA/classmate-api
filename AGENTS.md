# AGENTS.md

> **Stack**: Hono + Cloudflare Workers + D1 + Drizzle ORM  
> **Architecture**: Hexagonal (Ports & Adapters)  
> **Auth**: Clerk Middleware

---

## Quick Commands

```bash
# Dev with local D1
bun run dev

# Generate types for the worker-configuration.d.ts file
bun run cf-typegen

# Generate migrations
bun run db:generate

# Apply migrations (local)
bun run db:migrate:local

# Apply migrations (remote) Remote migrations will be running on automatic deploy
bun run db:migrate:remote

# Deploy, but we will be using Github PRs and automatic CI/CD for the main branch.
bun run deploy

# Test
bun run test

# Lint and format (Biome)
bun run check

# Type checking
bunx tsc --noEmit
```

---

## Architecture: Hexagonal (Simplified)

```
src/
├── domain/              # Pure business logic (no dependencies)
│   ├── entities/        # Domain models (TS types/classes)
│   ├── repositories/    # Repository interfaces (ports)
│   └── services/        # Domain services
│
├── application/         # Use cases / application services
│   └── [feature]/
│       ├── [action].usecase.ts
│       └── dto.ts       # DTOs for use case I/O
│
├── infrastructure/      # External adapters
│   ├── database/
│   │   ├── schema.ts    # Drizzle schema
│   │   ├── repositories/# Repository implementations
│   │   └── client.ts    # D1 client wrapper
│   ├── auth/            # Clerk adapter
│   └── cache/           # KV adapter (if used)
│
├── interfaces/          # HTTP layer
│   ├── http/
│   │   ├── routes/      # Hono route handlers
│   │   ├── middleware/  # HTTP middleware
│   │   └── validators/  # Zod schemas
│   └── index.ts         # Hono app composition
│
└── config/
    ├── bindings.ts      # Cloudflare bindings types
    └── env.ts           # Type-safe env vars
```

### Key Principles

1. **Domain is king**: Never import from `infrastructure/` or `interfaces/` in `domain/`
2. **Dependency inversion**: Use cases depend on repository interfaces, not implementations
3. **Single file = single responsibility**: Max 150 lines
4. **Type-safe everything**: Bindings, env vars, DTOs

## Route & OpenAPI Workflow

- **Define endpoints** inside `src/interfaces/http/routes/<feature>.ts` as classes extending `OpenAPIRoute`; expose helper functions for shared logic when needed.
- **Describe requests/responses** with existing Zod schemas via `contentJson(schema)` so Chanfana can emit accurate Swagger docs automatically.
- **Register the routes** in `src/index.ts` through `apiApp.<method>('/path', EndpointClass)` – this wires the handler and the OpenAPI metadata in one place.
- **Rely on shared middleware** by keeping all middleware in `createApp()`; the exported `apiApp` reuses that pipeline for every documented endpoint.
- **Verify locally** with `bun run dev` and inspect `GET /openapi.json` (or `/` for Swagger UI) before shipping a feature.

---

## Critical Practices

### 1. Cloudflare Workers Constraints

```typescript
// ❌ NEVER do this (blocks event loop)
await heavyComputation() // > 50ms CPU time kills worker

// ✅ Split work or use Durable Objects for heavy tasks, ask the user for information if neccesary.
const stub = env.DURABLE_OBJECT.get(id)
await stub.fetch(req)
```

### 2. D1 Connection Patterns

```typescript
// ❌ WRONG: Creating new Drizzle instance per request
export async function handler(c: Context) {
  const db = drizzle(c.env.DB) // Inefficient
}

// ✅ CORRECT: Reuse with factory pattern
export class DatabaseFactory {
  static create(binding: D1Database) {
    return drizzle(binding, { schema })
  }
}

// In route:
const db = DatabaseFactory.create(c.env.DB)
```

### 3. Middleware Order Matters

```typescript
// Order is CRITICAL:
app.use('*', clerkMiddleware()) // 1. Auth first (handles all auth logic)
app.use('*', requestIdMiddleware) // 2. Observability
app.use('*', errorHandler) // 3. Error handling
app.use('/api/*', rateLimiter) // 4. Rate limiting

// ❌ NEVER put errorHandler first (won't catch errors)
```

### 4. Type-Safe Bindings, ALWAYS use the `bun run cf-typegen` command.

- Remember to rerun 'bun run cf-typegen' after you change your wrangler.jsonc file.
- The worker-configuration.d.ts is a large file, do not read it entirely but use tools to confirm that the variables or types you expect to use in a given moment are present there.
- For development, use `.dev.vars` file with your environment variables (CLERK_SECRET_KEY, CLERK_PUBLISHABLE_KEY, ALLOWED_ORIGIN).

```typescript
// src/config/bindings.ts
export type Bindings = {
  DB: D1Database
  CLERK_SECRET_KEY: string
  CLERK_PUBLISHABLE_KEY: string
  ALLOWED_ORIGIN: string
  ENVIRONMENT: "development" | "staging" | "production"
}

// In Hono context:
type HonoContext = { Bindings: Bindings; Variables: Variables }
const app = new Hono<HonoContext>()
```

### 5. Repository Pattern (Critical for Testing)

```typescript
// domain/repositories/user.repository.ts (interface)
export interface UserRepository {
  findById(id: string): Promise<User | null>
  create(user: CreateUser): Promise<User>
}

// infrastructure/database/repositories/user.repository.ts
export class D1UserRepository implements UserRepository {
  constructor(private db: ReturnType<typeof drizzle>) {}
  
  async findById(id: string) {
    // Drizzle implementation
  }
}

// Why: Easy to mock for tests, swap DB later
```

### 6. Validation at Boundary

```typescript
// ❌ WRONG: Validating inside use case
export class CreateUserUseCase {
  execute(data: unknown) {
    const parsed = userSchema.parse(data) // NO
  }
}

// ✅ CORRECT: Validate in HTTP layer
app.post('/users', async (c) => {
  const body = await c.req.json()
  const validated = userSchema.parse(body) // YES
  await createUserUseCase.execute(validated)
})
```

### 7. Error Handling Strategy

```typescript
// Domain errors (extends Error)
export class UserNotFoundError extends Error {
  constructor(id: string) {
    super(`User ${id} not found`)
    this.name = 'UserNotFoundError'
  }
}

// Global error handler
app.onError((err, c) => {
  if (err instanceof UserNotFoundError) {
    return c.json({ error: err.message }, 404)
  }
  if (err instanceof ZodError) {
    return c.json({ errors: err.errors }, 400)
  }
  // Log to Cloudflare Analytics
  console.error(err)
  return c.json({ error: 'Internal error' }, 500)
})
```

### 8. Dependency Injection Pattern

```typescript
// interfaces/index.ts
export function createApp(dependencies: Dependencies) {
  const app = new Hono<HonoContext>()
  
  // Inject repositories into routes
  app.route('/users', createUserRoutes(dependencies.userRepository))
  
  return app
}

// In worker:
export default {
  async fetch(req, env, ctx) {
    const db = DatabaseFactory.create(env.DB)
    const dependencies = {
      userRepository: new D1UserRepository(db),
      // other repos
    }
    const app = createApp(dependencies)
    return app.fetch(req, env, ctx)
  }
}
```

---

## Security Checklist

```typescript
// 1. ALWAYS validate bindings exist
if (!env.DB) throw new Error('DB binding missing')

// 2. NEVER log sensitive data
console.log(user.email) // ❌
console.log(`User ${user.id} logged in`) // ✅

// 3. Rate limit by IP + user
await rateLimiter.check(c.req.header('CF-Connecting-IP'), userId)

// 4. Sanitize SQL inputs (Drizzle handles this, but verify)
db.select().where(eq(users.id, userInput)) // ✅ Parameterized

// 5. CORS configuration
app.use('*', cors({
  origin: ['https://yourdomain.com'],
  credentials: true
}))

// 6. Clerk middleware handles authentication automatically
import { clerkMiddleware, getAuth } from '@infrastructure/auth'

app.use('*', clerkMiddleware())

app.get('/protected', (c) => {
  const auth = getAuth(c)
  if (!auth?.userId) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  // User is authenticated, proceed
})
```

---

## Testing Strategy

### Unit Tests (Domain & Application)

```typescript
// application/users/create-user.usecase.test.ts
import { describe, it, expect, vi } from 'vitest'

describe('CreateUserUseCase', () => {
  it('should create user', async () => {
    // Mock repository
    const mockRepo: UserRepository = {
      create: vi.fn().mockResolvedValue(mockUser),
      findById: vi.fn()
    }
    
    const useCase = new CreateUserUseCase(mockRepo)
    const result = await useCase.execute(dto)
    
    expect(result).toEqual(mockUser)
    expect(mockRepo.create).toHaveBeenCalledWith(dto)
  })
})
```

### Integration Tests (Infrastructure)

```typescript
// infrastructure/database/repositories/user.repository.test.ts
import { beforeEach, describe, it } from 'vitest'
import { unstable_dev } from 'wrangler'

describe('D1UserRepository', () => {
  let worker: UnstableDevWorker
  
  beforeEach(async () => {
    worker = await unstable_dev('src/index.ts', {
      experimental: { disableExperimentalWarning: true }
    })
    // Run migrations on test DB
  })
  
  it('should persist and retrieve user', async () => {
    const db = /* get test D1 binding */
    const repo = new D1UserRepository(db)
    
    const created = await repo.create(userData)
    const found = await repo.findById(created.id)
    
    expect(found).toEqual(created)
  })
})
```

### E2E Tests (HTTP Layer)

```typescript
// interfaces/http/routes/users.test.ts
describe('POST /users', () => {
  it('should create user and return 201', async () => {
    const app = createApp(mockDependencies)
    
    const res = await app.request('/users', {
      method: 'POST',
      body: JSON.stringify(validUserData),
      headers: { 'Content-Type': 'application/json' }
    })
    
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json).toHaveProperty('id')
  })
  
  it('should return 400 for invalid data', async () => {
    const res = await app.request('/users', {
      method: 'POST',
      body: JSON.stringify(invalidData)
    })
    
    expect(res.status).toBe(400)
  })
})
```

---

## Drizzle Best Practices

```typescript
// ❌ N+1 queries problem
for (const user of users) {
  const posts = await db.select().from(posts).where(eq(posts.userId, user.id))
}

// ✅ Use joins or batch
const usersWithPosts = await db
  .select()
  .from(users)
  .leftJoin(posts, eq(posts.userId, users.id))

// ❌ Selecting all columns when not needed
const users = await db.select().from(users) // Gets all columns

// ✅ Select only what you need
const users = await db.select({
  id: users.id,
  email: users.email
}).from(users)

// ❌ Not using transactions for multi-step operations
await db.insert(users).values(userData)
await db.insert(profiles).values(profileData) // Can fail leaving orphan user

// ✅ Wrap in transaction
await db.transaction(async (tx) => {
  const user = await tx.insert(users).values(userData).returning()
  await tx.insert(profiles).values({ ...profileData, userId: user[0].id })
})
```

---

## Migration Strategy

```typescript
// 1. Generate migration
// bun run db:generate

// 2. Review generated SQL in drizzle/migrations/

// 3. Test locally
// bun run db:migrate:local

// 4. Deploy to production DB
// bun run db:migrate:remote

// CRITICAL: Never edit migration files manually
// Always generate new migration if changes needed
```

---

## Performance Patterns

### 1. Cache with KV

```typescript
// infrastructure/cache/kv.adapter.ts
export class KVCache {
  constructor(private kv: KVNamespace) {}
  
  async get<T>(key: string): Promise<T | null> {
    const value = await this.kv.get(key, 'json')
    return value as T | null
  }
  
  async set(key: string, value: unknown, ttl = 3600) {
    await this.kv.put(key, JSON.stringify(value), {
      expirationTtl: ttl
    })
  }
}

// In use case:
const cached = await cache.get(`user:${id}`)
if (cached) return cached

const user = await repository.findById(id)
await cache.set(`user:${id}`, user, 300) // 5min
return user
```

### 2. Batch Operations

```typescript
// ❌ Loop with individual queries
for (const id of userIds) {
  await db.select().from(users).where(eq(users.id, id))
}

// ✅ Single query with IN
await db.select().from(users).where(inArray(users.id, userIds))
```

### 3. Prepared Statements

```typescript
// For repeated queries with same structure
const getUserById = db
  .select()
  .from(users)
  .where(eq(users.id, sql.placeholder('id')))
  .prepare()

// Reuse:
const user1 = await getUserById.execute({ id: '1' })
const user2 = await getUserById.execute({ id: '2' })
```

---

## Common Pitfalls (AVOID)

```typescript
// 1. ❌ Async operations in global scope
const db = drizzle(D1Database) // NO - binding not available yet

// ✅ Initialize in fetch handler
export default {
  fetch(req, env, ctx) {
    const db = drizzle(env.DB)
  }
}

// 2. ❌ Mutating request object
c.req.parsedBody = data // NO - causes issues

// ✅ Pass data explicitly
return handler(c, data)

// 3. ❌ Not awaiting database operations
db.insert(users).values(data) // Missing await - operation won't complete

// ✅ Always await
await db.insert(users).values(data)

// 4. ❌ Large responses (> 1MB limit in free tier)
return c.json(hugeArray) // May exceed limit

// ✅ Paginate
return c.json({
  data: paginatedData,
  pagination: { page, limit, total }
})
```

---

## Monitoring & Observability

```typescript
// Add to middleware:
app.use('*', async (c, next) => {
  const start = Date.now()
  const requestId = crypto.randomUUID()
  
  c.set('requestId', requestId)
  
  await next()
  
  const duration = Date.now() - start
  console.log(JSON.stringify({
    requestId,
    method: c.req.method,
    path: c.req.path,
    status: c.res.status,
    duration
  }))
})

// Use Cloudflare Analytics API
// https://developers.cloudflare.com/analytics/
```

---

## File Size Rules

- **Max 150 lines per file**
- If exceeded, split by:
  - Extracting DTOs to separate file
  - Moving validation schemas
  - Splitting route handlers
  - Creating sub-use-cases

---

## Environment Variables (Generally those generated by Wrangler are sufficient)

```typescript
// config/env.ts
import { z } from 'zod'

const envSchema = z.object({
  CLERK_SECRET_KEY: z.string().min(1),
  ENVIRONMENT: z.enum(['development', 'staging', 'production']),
  // Add all vars
})

export function validateEnv(env: unknown) {
  return envSchema.parse(env)
}

// In worker:
const validatedEnv = validateEnv(env)
```

---

## Deployment Checklist

```markdown
- [ ] Migrations applied to production D1
- [ ] Environment variables set in Cloudflare dashboard
- [ ] KV namespaces bound correctly
- [ ] Rate limits configured
- [ ] CORS origins whitelisted
- [ ] Error tracking enabled
- [ ] Clerk production keys configured
- [ ] Tests passing (`bun test`)
- [ ] No console.logs with sensitive data
```

---

## Quick Reference

### Create New Feature

```bash
# 1. Add domain entity
touch src/domain/entities/[entity].ts

# 2. Define repository interface
touch src/domain/repositories/[entity].repository.ts

# 3. Create use case
touch src/application/[feature]/[action].usecase.ts

# 4. Implement repository
touch src/infrastructure/database/repositories/[entity].repository.ts

# 5. Add HTTP route
touch src/interfaces/http/routes/[feature].ts

# 6. Add tests for each layer
```

### Debugging D1 Locally

```bash
# Shell into local D1
npx wrangler d1 execute DB --local --command "SELECT * FROM users"

# View migrations status
npx wrangler d1 migrations list DB --local
```

---

**Remember**: This architecture optimizes for **changeability**. You can swap D1 for Postgres, Clerk for Auth0, or even replace Hono—without touching domain logic.