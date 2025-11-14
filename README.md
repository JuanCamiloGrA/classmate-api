# Classmate API

Academic management API built with Cloudflare Workers, Hono, Drizzle ORM, and D1 Database.

## Stack

- **Runtime**: Cloudflare Workers
- **Framework**: Hono
- **Database**: Cloudflare D1 (SQLite)
- **ORM**: Drizzle ORM
- **Auth**: Clerk
- **OpenAPI**: Chanfana
- **Architecture**: Hexagonal (Ports & Adapters)

## Quick Start

### Prerequisites

1. [Cloudflare Workers](https://workers.dev) account
2. [Bun](https://bun.sh) installed
3. Wrangler CLI configured
4. [Clerk](https://clerk.com) account for authentication

### Installation

```bash
# Install dependencies
bun install

# Login to Cloudflare
wrangler login

# Generate TypeScript types for bindings
bun run cf-typegen
```

### Environment Setup

Create a `.dev.vars` file in the root directory for local development:

```bash
# Copy the example file
cp .dev.vars.example .dev.vars

# Edit .dev.vars with your actual values
CLERK_SECRET_KEY=sk_test_your_secret_key_here
CLERK_PUBLISHABLE_KEY=pk_test_your_publishable_key_here
ALLOWED_ORIGIN=http://localhost:3000
```

For production, these variables are configured in `wrangler.jsonc` using Cloudflare Secrets Store.

### Database Setup

```bash
# Generate migration from schema
bun run db:generate

# Apply migrations to local database
bun run db:migrate:local

# Apply migrations to remote database
bun run db:migrate:remote
```

### Development

```bash
# Start local development server
bun run dev

# Open http://localhost:8787/ for OpenAPI docs

# Run tests
bun run test

# Run tests with UI
bun run test:ui
```

### Exposing locally for Clerk

```bash
# Start the worker locally
bun run dev

# Keep a Cloudflare tunnel open so Clerk can reach the POST /profiles webhook
cloudflared tunnel run classmate-api-dev
```

> This makes `http://api.dev.classmate.studio` proxy to local port 8787, allowing
> Clerk to call `POST /profiles` during webhook testing.

### Deployment

```bash
# Deploy to Cloudflare Workers
bun run deploy
```

## Project Structure

```
src/
├── domain/              # Pure business logic
│   ├── entities/        # Domain models
│   ├── repositories/    # Repository interfaces (ports)
│   └── services/        # Domain services
├── application/         # Use cases / application services
├── infrastructure/      # External adapters
│   ├── database/
│   │   ├── schema.ts    # Drizzle schema
│   │   ├── client.ts    # Database factory
│   │   └── repositories/# Repository implementations
│   ├── auth/            # Clerk middleware
│   └── cache/           # KV adapters
├── interfaces/          # HTTP layer
│   ├── http/
│   │   ├── routes/      # Hono route handlers
│   │   ├── middleware/  # HTTP middleware
│   │   └── validators/  # Zod schemas
│   └── index.ts         # Hono app composition
└── config/
    ├── bindings.ts      # Cloudflare bindings types
    └── env.ts           # Environment configuration
```

## Available Scripts

- `bun run dev` - Start local development server
- `bun run deploy` - Deploy to Cloudflare Workers
- `bun run test` - Run tests with Vitest
- `bun run test:ui` - Run tests with Vitest UI
- `bun run cf-typegen` - Generate TypeScript types for bindings
- `bun run db:generate` - Generate migrations from schema
- `bun run db:migrate:local` - Apply migrations to local D1
- `bun run db:migrate:remote` - Apply migrations to remote D1
- `bun run check` - Run Biome linter and formatter

## Authentication

This project uses Clerk for authentication. The middleware automatically:

- Validates session tokens from Authorization Bearer headers or cookies
- Injects auth context into all routes
- Provides `getAuth(c)` helper to access user information
- Exposes Clerk client via `c.get('clerk')` for advanced use cases

### Protected Routes

```typescript
import { getAuth } from '@infrastructure/auth'

app.get('/protected', (c) => {
  const auth = getAuth(c)
  
  if (!auth?.userId) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  
  return c.json({ message: 'Welcome!', userId: auth.userId })
})
```

See [Authentication README](./src/infrastructure/auth/README.md) for more details.

## Documentation

For more details, see [AGENTS.md](./AGENTS.md) for architecture guidelines and best practices.

## License

Private - © JC
