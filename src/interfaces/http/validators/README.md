# HTTP Validators

Schemas Zod para validación de entrada en las rutas HTTP.

## Estructura

```typescript
// src/interfaces/http/validators/profile.validators.ts
import { z } from "zod";

// Input validators
export const createProfileSchema = z.object({
  email: z.string().email("Invalid email format"),
  name: z.string().min(1, "Name is required"),
  subscriptionTier: z.enum(["free", "pro", "premium"]).default("free"),
});

export type CreateProfileInput = z.infer<typeof createProfileSchema>;

export const updateProfileSchema = createProfileSchema.partial();
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

// Query parameter validators (opcional)
export const profileQuerySchema = z.object({
  limit: z.number().int().min(1).max(100).default(10),
  offset: z.number().int().min(0).default(0),
});

export type ProfileQuery = z.infer<typeof profileQuerySchema>;
```

## Cómo usar

```typescript
// En routes/profiles.ts
import { createProfileSchema, type CreateProfileInput } from "../validators/profile.validators";

router.post("/", async (c) => {
  const body = await c.req.json();
  
  // Zod lanzará error automáticamente si no valida
  // El error handler global lo capturará y retornará 400
  const input: CreateProfileInput = createProfileSchema.parse(body);
  
  // input ahora está 100% type-safe
  const result = await useCase.execute(input);
  
  return c.json(result, 201);
});
```

## Ventajas

- ✅ Type-safe automático (inference)
- ✅ Validación en runtime
- ✅ Errores claros y estructurados
- ✅ Reutilizable en DTOs de aplicación

## Pattern: Request/Response DTOs

```typescript
// Input DTO (validado con Zod)
export const createProfileRequestSchema = z.object({
  email: z.string().email(),
  name: z.string(),
});

export type CreateProfileRequest = z.infer<typeof createProfileRequestSchema>;

// Output DTO (opcional, documentación)
export type CreateProfileResponse = {
  id: string;
  email: string;
  name: string;
  createdAt: string;
};
```
