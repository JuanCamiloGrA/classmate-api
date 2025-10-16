# Application Layer (Use Cases)

La capa de aplicación orquesta la lógica de negocio y coordina entre el dominio y la infraestructura.

## Estructura

```
application/
├── [feature]/
│   ├── [action].usecase.ts
│   └── dto.ts              # DTOs para entrada/salida
└── ...
```

## Patrón de Use Case

```typescript
// src/application/profiles/create-profile.usecase.ts
import type { ProfileRepository } from "../../domain/repositories/profile.repository";
import type { CreateProfileInput } from "../../domain/entities/profile";
import { ProfileDomainService } from "../../domain/services/profile.service";

export class CreateProfileUseCase {
  constructor(private profileRepository: ProfileRepository) {}

  async execute(input: CreateProfileInput) {
    // 1. Usar servicios de dominio para validación
    const service = new ProfileDomainService();
    if (!service.isValidEmail(input.email)) {
      throw new Error("Invalid email");
    }

    // 2. Verificar precondiciones
    const existing = await this.profileRepository.findByEmail(input.email);
    if (existing) {
      throw new Error("Email already exists");
    }

    // 3. Ejecutar operación
    const profile = await this.profileRepository.create({
      ...input,
      subscriptionTier: input.subscriptionTier ?? "free",
    });

    // 4. Retornar resultado
    return profile;
  }
}
```

## DTOs (Data Transfer Objects)

```typescript
// src/application/profiles/dto.ts
import type { ProfileEntity } from "../../domain/entities/profile";

// Input DTO
export interface CreateProfileDTO {
  email: string;
  name: string;
  subscriptionTier?: "free" | "pro" | "premium";
}

// Output DTO
export interface ProfileResponseDTO {
  id: string;
  email: string;
  name: string;
  subscriptionTier: "free" | "pro" | "premium";
  createdAt: string;
}

// Mapper
export function profileToDTO(entity: ProfileEntity): ProfileResponseDTO {
  return {
    id: entity.id,
    email: entity.email,
    name: entity.name,
    subscriptionTier: entity.subscriptionTier,
    createdAt: entity.createdAt,
  };
}
```

## Dependencias

```typescript
// ✅ PUEDE importar de:
import type { ProfileRepository } from "../../domain/repositories/profile.repository";
import { ProfileDomainService } from "../../domain/services/profile.service";
import type { CreateProfileInput } from "../../domain/entities/profile";

// ❌ NO PUEDE importar de:
// import { drizzle } from "drizzle-orm"; // ← Infrastructure
// import { c } from "hono"; // ← Interfaces
```

## Ejemplo: Varios Use Cases

```typescript
// src/application/profiles/get-profile.usecase.ts
export class GetProfileUseCase {
  constructor(private profileRepository: ProfileRepository) {}

  async execute(id: string) {
    const profile = await this.profileRepository.findById(id);
    if (!profile) {
      throw new NotFoundError(`Profile ${id} not found`);
    }
    return profile;
  }
}

// src/application/profiles/update-profile.usecase.ts
export class UpdateProfileUseCase {
  constructor(private profileRepository: ProfileRepository) {}

  async execute(id: string, input: Partial<CreateProfileInput>) {
    const existing = await this.profileRepository.findById(id);
    if (!existing) {
      throw new NotFoundError(`Profile ${id} not found`);
    }
    
    return this.profileRepository.update(id, input);
  }
}

// src/application/profiles/delete-profile.usecase.ts
export class DeleteProfileUseCase {
  constructor(private profileRepository: ProfileRepository) {}

  async execute(id: string) {
    await this.profileRepository.delete(id);
  }
}
```

## Index para fácil importación

```typescript
// src/application/profiles/index.ts
export { CreateProfileUseCase } from "./create-profile.usecase";
export { GetProfileUseCase } from "./get-profile.usecase";
export { UpdateProfileUseCase } from "./update-profile.usecase";
export { DeleteProfileUseCase } from "./delete-profile.usecase";

export type { CreateProfileDTO, ProfileResponseDTO } from "./dto";
export { profileToDTO } from "./dto";
```

## Reglas de Oro

1. ✅ **Inyección de Dependencias**: Pasar repos en constructor
2. ✅ **Un caso de uso por clase**: Single Responsibility
3. ✅ **DTOs para entrada/salida**: Separar dominio de presentación
4. ✅ **Throw domain errors**: NotFoundError, ValidationError, etc
5. ❌ **NO retornar raw repositories**: Mapear a DTOs
6. ❌ **NO importar de interfaces/**: Las rutas importan de aquí
