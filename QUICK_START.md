# 🚀 QUICK START - Guía para Implementar tu Primer Feature

La base está lista. Aquí está el paso a paso para crear tu primer feature (ejemplo: **Profiles**).

## ⏱️ Tiempo estimado: 30-45 min

---

## PASO 1: Crear la Entidad de Dominio

**Archivo:** `src/domain/entities/profile.ts`

```typescript
export interface ProfileEntity {
  id: string;
  email: string;
  name: string;
  subscriptionTier: "free" | "pro" | "premium";
  storageUsedBytes: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProfileInput {
  email: string;
  name: string;
  subscriptionTier?: "free" | "pro" | "premium";
}
```

---

## PASO 2: Crear la Interface del Repositorio

**Archivo:** `src/domain/repositories/profile.repository.ts`

```typescript
import type { ProfileEntity, CreateProfileInput } from "../entities/profile";

export interface ProfileRepository {
  findById(id: string): Promise<ProfileEntity | null>;
  findByEmail(email: string): Promise<ProfileEntity | null>;
  create(input: CreateProfileInput): Promise<ProfileEntity>;
  update(id: string, input: Partial<CreateProfileInput>): Promise<ProfileEntity>;
  delete(id: string): Promise<void>;
}
```

---

## PASO 3: Crear el Validador (Zod)

**Archivo:** `src/interfaces/http/validators/profile.validators.ts`

```typescript
import { z } from "zod";

export const createProfileSchema = z.object({
  email: z.string().email("Invalid email format"),
  name: z.string().min(1, "Name is required").max(255),
  subscriptionTier: z
    .enum(["free", "pro", "premium"])
    .default("free"),
});

export type CreateProfileInput = z.infer<typeof createProfileSchema>;
```

---

## PASO 4: Crear el Use Case

**Archivo:** `src/application/profiles/create-profile.usecase.ts`

```typescript
import type { ProfileRepository } from "../../domain/repositories/profile.repository";
import type { CreateProfileInput } from "../../domain/entities/profile";
import { NotFoundError } from "../../interfaces/http/middleware/error-handler";

export class CreateProfileUseCase {
  constructor(private profileRepository: ProfileRepository) {}

  async execute(input: CreateProfileInput) {
    // Validar que el email no exista
    const existing = await this.profileRepository.findByEmail(input.email);
    if (existing) {
      throw new NotFoundError("Email already registered");
    }

    // Crear el profile
    const profile = await this.profileRepository.create({
      ...input,
      subscriptionTier: input.subscriptionTier ?? "free",
    });

    return profile;
  }
}
```

---

## PASO 5: Implementar el Repositorio

**Archivo:** `src/infrastructure/database/repositories/profile.repository.ts`

```typescript
import { eq } from "drizzle-orm";
import type { Database } from "../client";
import type { ProfileRepository } from "../../../domain/repositories/profile.repository";
import type { CreateProfileInput } from "../../../domain/entities/profile";
import { profiles } from "../schema";

export class D1ProfileRepository implements ProfileRepository {
  constructor(private db: Database) {}

  async findById(id: string) {
    const result = await this.db
      .select()
      .from(profiles)
      .where(eq(profiles.id, id));
    return result[0] || null;
  }

  async findByEmail(email: string) {
    const result = await this.db
      .select()
      .from(profiles)
      .where(eq(profiles.email, email));
    return result[0] || null;
  }

  async create(input: CreateProfileInput) {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    const result = await this.db
      .insert(profiles)
      .values({
        id,
        email: input.email,
        name: input.name,
        subscriptionTier: input.subscriptionTier ?? "free",
        storageUsedBytes: 0,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    return result[0];
  }

  async update(id: string, input: Partial<CreateProfileInput>) {
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

  async delete(id: string) {
    await this.db.delete(profiles).where(eq(profiles.id, id));
  }
}
```

---

## PASO 6: Crear las Rutas HTTP

**Archivo:** `src/interfaces/http/routes/profiles.ts`

```typescript
import { Hono } from "hono";
import type { AppContext } from "../../../types";
import { createProfileSchema } from "../validators/profile.validators";
import type { ProfileRepository } from "../../../domain/repositories/profile.repository";
import { CreateProfileUseCase } from "../../../application/profiles/create-profile.usecase";
import { NotFoundError } from "../middleware/error-handler";

interface Dependencies {
  profileRepository: ProfileRepository;
}

export function createProfileRoutes(deps: Dependencies) {
  const router = new Hono<AppContext>();

  // POST /profiles - Create
  router.post("/", async (c) => {
    const body = await c.req.json();
    const validated = createProfileSchema.parse(body);

    const useCase = new CreateProfileUseCase(deps.profileRepository);
    const profile = await useCase.execute(validated);

    return c.json(profile, 201);
  });

  // GET /profiles/:id - Get by ID
  router.get("/:id", async (c) => {
    const id = c.req.param("id");
    const profile = await deps.profileRepository.findById(id);

    if (!profile) {
      throw new NotFoundError(`Profile ${id} not found`);
    }

    return c.json(profile);
  });

  return router;
}
```

---

## PASO 7: Registrar en la App

**Archivo:** `src/interfaces/index.ts`

En la función `createApp`, agrega:

```typescript
// Importar el repositorio
import { D1ProfileRepository } from "../infrastructure/database/repositories/profile.repository";
import { createProfileRoutes } from "./http/routes/profiles";

export function createApp(dependencies?: Dependencies) {
  const app = new Hono<HonoContext>();

  // ... middlewares ...

  // RUTAS
  const db = DatabaseFactory.create(c.env.DB); // Ya está en middleware
  
  // Crear repositorios
  const profileRepository = new D1ProfileRepository(db);
  const routeDependencies = { profileRepository };

  app.route("/api/profiles", createProfileRoutes(routeDependencies));

  // ... error handler ...
}
```

O mejor aún, en `src/index.ts`:

```typescript
import { D1ProfileRepository } from "./infrastructure/database/repositories/profile.repository";

export default {
  async fetch(request: Request, env: Bindings, ctx: ExecutionContext) {
    const db = DatabaseFactory.create(env.DB);
    
    const dependencies = {
      profileRepository: new D1ProfileRepository(db),
      // ... otros repos
    };

    const app = createApp(dependencies);
    return app.fetch(request, env, ctx);
  },
};
```

---

## PASO 8: Probar

```bash
# Desarrollo
bun run dev

# Testing
bun run test

# Deploy
bun run deploy
```

### Test manual con curl:

```bash
curl -X POST http://localhost:8787/api/profiles \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","name":"John Doe"}'

curl http://localhost:8787/api/profiles/[id]
```

---

## ✅ Checklist

- [ ] Entidad en `domain/entities/`
- [ ] Repository interface en `domain/repositories/`
- [ ] Validador Zod en `interfaces/http/validators/`
- [ ] Use case en `application/profiles/`
- [ ] Repository implementation en `infrastructure/database/repositories/`
- [ ] Routes en `interfaces/http/routes/`
- [ ] Routes registradas en `createApp()`
- [ ] `bun check` sin errores
- [ ] `bun dev` funciona
- [ ] Endpoints responden correctamente

---

## 📝 Notas

1. **Orden de capas**: Dominio → Aplicación → Infraestructura → Interfaces
2. **Errores**: Lanzar desde domain errors (ya están en error-handler.ts)
3. **Tipos**: Todo automáticamente type-safe gracias a Zod + TypeScript
4. **Testing**: Cada capa es testeaable por separado
5. **Reutilización**: Este mismo patrón para Terms, Subjects, Tasks, Classes, etc.

---

## 🚀 Próximo Feature

Repite los mismos 8 pasos para **Terms**, **Subjects**, **Tasks**, etc.
La diferencia será solo la lógica de negocio específica de cada entidad.

**Tiempo por feature después del primero: 15-20 min** 🎯
