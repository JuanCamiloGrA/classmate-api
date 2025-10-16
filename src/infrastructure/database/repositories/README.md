# Infrastructure Layer

La capa de infraestructura implementa los adaptadores concretos: base de datos, APIs externas, servicios, etc.

## Estructura

```
infrastructure/
├── database/
│   ├── schema.ts           # Drizzle schema
│   ├── client.ts           # Database factory
│   └── repositories/       # Repository implementations
├── auth/
│   ├── clerk-auth.ts       # Clerk adapter
│   └── index.ts
└── cache/                  # (opcional) KV cache
    └── index.ts
```

## Repositories (Implementaciones)

Las interfaces están en `domain/repositories/`, aquí van las implementaciones concretas.

```typescript
// src/infrastructure/database/repositories/profile.repository.ts
import { eq } from "drizzle-orm";
import type { Database } from "../client";
import type { ProfileRepository } from "../../../domain/repositories/profile.repository";
import type { ProfileEntity, CreateProfileInput } from "../../../domain/entities/profile";
import { profiles } from "../schema";

export class D1ProfileRepository implements ProfileRepository {
  constructor(private db: Database) {}

  async findById(id: string): Promise<ProfileEntity | null> {
    const result = await this.db
      .select()
      .from(profiles)
      .where(eq(profiles.id, id));
    
    return result[0] || null;
  }

  async findByEmail(email: string): Promise<ProfileEntity | null> {
    const result = await this.db
      .select()
      .from(profiles)
      .where(eq(profiles.email, email));
    
    return result[0] || null;
  }

  async create(input: CreateProfileInput): Promise<ProfileEntity> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    const result = await this.db
      .insert(profiles)
      .values({
        id,
        email: input.email,
        name: input.name,
        subscriptionTier: input.subscriptionTier ?? "free",
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    return result[0];
  }

  async update(
    id: string,
    input: Partial<CreateProfileInput>
  ): Promise<ProfileEntity> {
    const result = await this.db
      .update(profiles)
      .set({
        ...input,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(profiles.id, id))
      .returning();

    return result[0];
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(profiles).where(eq(profiles.id, id));
  }
}
```

## Factory Pattern

```typescript
// src/infrastructure/database/client.ts
import type { D1Database } from "@cloudflare/workers-types";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

export class DatabaseFactory {
  private constructor() {}

  static create(binding: D1Database) {
    return drizzle(binding, { schema });
  }
}

export type Database = ReturnType<typeof DatabaseFactory.create>;
```

## Inicializar en la app

```typescript
// src/interfaces/index.ts
app.use("*", async (c, next) => {
  const db = DatabaseFactory.create(c.env.DB);
  c.set("db", db);
  await next();
});
```

## Inyección en rutas

```typescript
// src/interfaces/http/routes/profiles.ts
export function createProfileRoutes(dependencies: Dependencies) {
  const router = new Hono<AppContext>();

  // El repositorio se pasa desde las dependencias
  const repo = dependencies.profileRepository as ProfileRepository;

  router.post("/", async (c) => {
    const body = await c.req.json();
    const validated = createProfileSchema.parse(body);
    
    const useCase = new CreateProfileUseCase(repo);
    const profile = await useCase.execute(validated);
    
    return c.json(profile, 201);
  });

  return router;
}

// En src/index.ts
const db = DatabaseFactory.create(env.DB);
const dependencies = {
  profileRepository: new D1ProfileRepository(db),
  // ... otros repos
};

const app = createApp(dependencies);
```

## Best Practices

### ✅ DO
```typescript
// Usar Drizzle helpers
const user = await this.db
  .select()
  .from(users)
  .where(eq(users.id, id))
  .then(rows => rows[0] || null);

// Transaction para operaciones multi-tabla
await this.db.transaction(async (tx) => {
  const user = await tx.insert(users).values(userData);
  await tx.insert(profiles).values({ userId: user[0].id });
});
```

### ❌ DON'T
```typescript
// Raw SQL (evitar si es posible)
const user = await this.db.query("SELECT * FROM users WHERE id = ?");

// N+1 queries
for (const id of userIds) {
  const user = await this.db.select().from(users).where(eq(users.id, id));
}

// Mutaciones directas en la DB sin transacciones
await db.insert(users).values(userData);
await db.insert(profiles).values(profileData); // ← Puede fallar
```

## Cache (Opcional)

```typescript
// src/infrastructure/cache/kv.adapter.ts
export class KVCache {
  constructor(private kv: KVNamespace) {}

  async get<T>(key: string): Promise<T | null> {
    const value = await this.kv.get(key, "json");
    return value as T | null;
  }

  async set(key: string, value: unknown, ttl = 3600) {
    await this.kv.put(key, JSON.stringify(value), {
      expirationTtl: ttl,
    });
  }
}
```

## Reglas de Oro

1. ✅ **Implementa interfaces de dominio**: `implements ProfileRepository`
2. ✅ **Inyección en constructor**: `constructor(private db: Database)`
3. ✅ **Manejo de errores**: Lanzar domain errors
4. ✅ **Type-safe**: Usar tipos de schema.ts
5. ❌ **NO exponer Drizzle**: Retornar tipos de dominio
6. ❌ **NO lógica de negocio**: Solo operaciones de acceso a datos
