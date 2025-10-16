# Domain Layer

La capa de dominio contiene la lógica de negocio pura, independiente de cualquier framework o librería externa.

## Estructura

```
domain/
├── entities/          # Domain models (interfaces/tipos)
├── repositories/      # Repository interfaces (puertos)
└── services/          # Domain services (lógica compleja)
```

## Entities (Modelos de Dominio)

```typescript
// src/domain/entities/profile.ts
export interface ProfileEntity {
  id: string;
  email: string;
  name: string;
  subscriptionTier: "free" | "pro" | "premium";
  storageUsedBytes: number;
  createdAt: string;
  updatedAt: string;
}

// Input para crear
export interface CreateProfileInput {
  email: string;
  name: string;
  subscriptionTier?: "free" | "pro" | "premium";
}
```

**Reglas:**
- NO importar de `infrastructure/` ni `interfaces/`
- Solo tipos y interfaces
- Pueden tener métodos de lógica pura

## Repositories (Puertos)

Interfaces que definen cómo acceder a los datos.

```typescript
// src/domain/repositories/profile.repository.ts
import type { ProfileEntity, CreateProfileInput } from "../entities/profile";

export interface ProfileRepository {
  findById(id: string): Promise<ProfileEntity | null>;
  findByEmail(email: string): Promise<ProfileEntity | null>;
  create(input: CreateProfileInput): Promise<ProfileEntity>;
  update(id: string, input: Partial<CreateProfileInput>): Promise<ProfileEntity>;
  delete(id: string): Promise<void>;
}
```

**Reglas:**
- Solo interfaces, NO implementaciones
- Definen el contrato (puertos)
- Las implementaciones van en `infrastructure/`

## Services (Lógica de Dominio)

Para lógica compleja que no cabe en un use case.

```typescript
// src/domain/services/profile.service.ts
import type { ProfileEntity } from "../entities/profile";

export class ProfileDomainService {
  canUpgradeSubscription(profile: ProfileEntity): boolean {
    // Lógica de negocio pura
    return profile.subscriptionTier === "free";
  }

  calculateStorageLimit(tier: "free" | "pro" | "premium"): number {
    const limits: Record<typeof tier, number> = {
      free: 5 * 1024 * 1024, // 5MB
      pro: 100 * 1024 * 1024, // 100MB
      premium: 1024 * 1024 * 1024, // 1GB
    };
    return limits[tier];
  }
}
```

## Ejemplo Completo

```typescript
// src/domain/entities/user.ts
export interface UserEntity {
  id: string;
  email: string;
  name: string;
}

// src/domain/repositories/user.repository.ts
export interface UserRepository {
  findById(id: string): Promise<UserEntity | null>;
  create(user: UserEntity): Promise<UserEntity>;
}

// src/domain/services/user.service.ts
export class UserDomainService {
  isValidEmail(email: string): boolean {
    return email.includes("@");
  }
}
```

## Reglas de Oro

1. ✅ **Puro**: Solo lógica de negocio, sin dependencias externas
2. ✅ **Testeable**: Fácil de testear sin mocks complejos
3. ✅ **Independiente**: No conoce HTTP, BD, frameworks
4. ✅ **Reutilizable**: Puede ser usado en múltiples contextos
5. ❌ **NO importar**: De `infrastructure/` o `interfaces/`
