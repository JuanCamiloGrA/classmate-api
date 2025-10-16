# 📚 Documentation Index

## 🚀 EMPEZAR AQUÍ

### 1. **[QUICK_START.md](./QUICK_START.md)** ⭐ IMPRESCINDIBLE
Guía paso a paso para implementar tu primer feature (Profiles).
- 8 pasos claros
- Ejemplos de código completos
- ~30-45 minutos
- **Lee esto primero**

### 2. **[ARCHITECTURE_HEALTH_CHECK.md](./ARCHITECTURE_HEALTH_CHECK.md)** 📊 
Verificación visual del estado de la base.
- Checklist completado
- Problemas arreglados
- Timeline estimado
- Status: 100% READY

### 3. **[FIXES_SUMMARY.md](./FIXES_SUMMARY.md)** 🔧
Detalle de qué se arregló en la base.
- 8 problemas corregidos
- Antes/después del código
- Archivos modificados
- Por qué cada cambio

---

## 📖 Documentación por Capa

### Domain Layer
**[src/domain/README.md](./src/domain/README.md)**
- Qué es la capa de dominio
- Estructura: entities, repositories, services
- Cómo escribir lógica pura
- Reglas de oro

### Application Layer  
**[src/application/README.md](./src/application/README.md)**
- Use cases y orquestación
- DTOs (Data Transfer Objects)
- Inyección de dependencias
- Patrones de varios use cases

### Infrastructure Layer
**[src/infrastructure/database/repositories/README.md](./src/infrastructure/database/repositories/README.md)**
- Implementación de repositorios
- Database factory pattern
- Cómo usar Drizzle ORM
- Best practices y antipatterns

### Interfaces Layer
**[src/interfaces/http/routes/README.md](./src/interfaces/http/routes/README.md)**
- Cómo crear rutas HTTP
- Estructura de rutas
- Inyección en la app
- Orden de middleware

**[src/interfaces/http/validators/README.md](./src/interfaces/http/validators/README.md)**
- Validación con Zod
- Schemas y types
- Request/Response DTOs
- Error handling

---

## 🎯 Guía Rápida por Objetivo

### "Quiero entender la arquitectura"
→ Lee `AGENTS.md` luego `ARCHITECTURE_HEALTH_CHECK.md`

### "Quiero crear mi primer feature rápido"
→ Lee `QUICK_START.md` y síguelo paso a paso

### "Quiero entender cómo se conectan las capas"
→ Lee la sección de Domain → Application → Infrastructure en orden

### "Quiero saber qué se arregló"
→ Lee `FIXES_SUMMARY.md`

### "Quiero referencia de la arquitectura global"
→ Lee `AGENTS.md` (guía completa del proyecto)

---

## 📂 Referencia Rápida de Archivos

### Configuración
| Archivo | Propósito |
|---------|-----------|
| `src/types.ts` | AppContext type-safe |
| `src/config/bindings.ts` | Bindings y Variables types |
| `src/config/env.ts` | Env vars validation |
| `wrangler.jsonc` | Cloudflare Workers config |
| `drizzle.config.ts` | Drizzle ORM config |

### Base de Datos
| Archivo | Propósito |
|---------|-----------|
| `src/infrastructure/database/schema.ts` | Drizzle schema (10 tablas) |
| `src/infrastructure/database/client.ts` | DatabaseFactory pattern |
| `src/infrastructure/database/repositories/` | Repository implementations |

### HTTP
| Archivo | Propósito |
|---------|-----------|
| `src/interfaces/index.ts` | App creator + middleware order |
| `src/interfaces/http/middleware/` | Error handler, request ID |
| `src/interfaces/http/routes/` | Route handlers (por crear) |
| `src/interfaces/http/validators/` | Zod schemas (por crear) |

### Autenticación
| Archivo | Propósito |
|---------|-----------|
| `src/infrastructure/auth/clerk-auth.ts` | Clerk middleware |
| `src/infrastructure/auth/index.ts` | Exports |

---

## 🔄 Workflow Típico

```
1. Lee QUICK_START.md (15 min)
2. Crea domain/entities/profile.ts
3. Crea domain/repositories/profile.repository.ts
4. Crea application/profiles/create-profile.usecase.ts
5. Crea infrastructure/database/repositories/profile.repository.ts
6. Crea interfaces/http/validators/profile.validators.ts
7. Crea interfaces/http/routes/profiles.ts
8. Registra rutas en interfaces/index.ts
9. Test con: bun dev + curl
10. Listo para el siguiente feature ✨
```

Tiempo por feature: **15-30 min** después del primero

---

## ✅ Comandos Útiles

```bash
# Development
bun run dev              # Inicia el servidor local

# Testing
bun run test             # Corre los tests
bun run test --ui        # Tests con interfaz visual

# Code Quality
bun check                # Linting + type checking
bun run format           # (si lo agregas a scripts)

# Database
bun run db:generate      # Genera migrations
bun run db:migrate:local # Aplica migrations (local)
bun run db:migrate:remote # Aplica migrations (remote)

# Deployment
bun run deploy           # Deploy a Cloudflare Workers

# Type Generation
bun run cf-typegen       # Genera worker-configuration.d.ts
```

---

## 📞 En Caso de Dudas

### ¿Error de tipos en TypeScript?
→ Revisa `src/types.ts` y `src/config/bindings.ts`

### ¿Error en validación?
→ Revisa `src/interfaces/http/validators/README.md`

### ¿Error 404 en ruta?
→ Verifica que la ruta esté registrada en `src/interfaces/index.ts`

### ¿Cómo agregar una nueva tabla?
→ Edita `src/infrastructure/database/schema.ts` luego `bun run db:generate`

### ¿Cómo crear un nuevo repositorio?
→ Sigue el patrón en `src/infrastructure/database/repositories/README.md`

### ¿Cómo manejar errores?
→ Usa los domain errors de `src/interfaces/http/middleware/error-handler.ts`

---

## 🎓 Learning Path

### Novato
1. QUICK_START.md
2. Implementa Profiles
3. Implementa Terms
4. Implementa Subjects

### Intermedio
1. Agregar caching (src/infrastructure/cache/)
2. Agregar validación más compleja
3. Rate limiting
4. Transacciones en BD

### Avanzado
1. Durable Objects (para trabajos pesados)
2. Analytics (Cloudflare Analytics)
3. Webhooks (Clerk webhooks)
4. Streaming responses

---

## 🚀 Status: READY TO BUILD

La documentación está completa. Todo lo que necesitas está aquí.

**Siguiente paso:** Abre `QUICK_START.md` y empieza con Profiles 🎯

---

**Última actualización:** Oct 15, 2025  
**Versión:** 1.0 - Base Lista  
**Status:** ✅ Production Ready
