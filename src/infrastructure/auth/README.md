# Clerk middleware for Hono

This middleware can be used to inject the active Clerk session into the request context.

## Configuration

Before starting using the middleware you must set the following environment variables:

### Development (.dev.vars file)

```plain
CLERK_SECRET_KEY=sk_test_your_secret_key_here
CLERK_PUBLISHABLE_KEY=pk_test_your_publishable_key_here
ALLOWED_ORIGIN=http://localhost:3000
```

### Production (Cloudflare Secrets Store)

Set these via `wrangler.jsonc` using `secrets_store_secrets` binding or as regular environment variables.

## How to Use

```ts
import { clerkMiddleware, getAuth } from '@infrastructure/auth'
import { Hono } from 'hono'

const app = new Hono()

app.use('*', clerkMiddleware())

app.get('/', (c) => {
  const auth = getAuth(c)

  if (!auth?.userId) {
    return c.json({
      message: 'You are not logged in.',
    })
  }

  return c.json({
    message: 'You are logged in!',
    userId: auth.userId,
  })
})

export default app
```

## Accessing instance of Backend API client

```ts
import { clerkMiddleware, getAuth } from '@infrastructure/auth'
import { Hono } from 'hono'

const app = new Hono()

app.use('*', clerkMiddleware())

app.get('/user/:id', async (c) => {
  const clerkClient = c.get('clerk')
  const userId = c.req.param('id')

  try {
    const user = await clerkClient.users.getUser(userId)

    return c.json({
      user,
    })
  } catch (e) {
    return c.json(
      {
        message: 'User not found.',
      },
      404
    )
  }
})

export default app
```

## Type Safety

The middleware automatically extends Hono's `ContextVariableMap` with:

```ts
interface ContextVariableMap {
  clerk: ClerkClient
  clerkAuth: () => SessionAuthObject | null
}
```

This allows you to use `c.get('clerk')` and `getAuth(c)` with full TypeScript support.

