# Classmate API - Análisis Completo del Proyecto

## 📋 Descripción General

**Classmate API** es una API de gestión académica construida sobre Cloudflare Workers, diseñada para ayudar a estudiantes a organizar su vida académica con la ayuda de Inteligencia Artificial. El proyecto implementa una arquitectura hexagonal (Ports & Adapters) y proporciona endpoints para la gestión de clases, tareas, asignaturas, términos, y un sistema de generación de documentos con IA llamado "Scribe".

## 🛠 Stack Tecnológico

### Core
- **Runtime**: Cloudflare Workers (Serverless edge computing)
- **Framework**: Hono (Framework web rápido y ligero)
- **Lenguaje**: TypeScript
- **Base de Datos**: Cloudflare D1 (SQLite distribuido)
- **ORM**: Drizzle ORM (Type-safe SQL)
- **Runtime Package Manager**: Bun

### Integraciones Externas
- **Autenticación**: Clerk (Gestión de usuarios y sesiones)
- **Almacenamiento**: Cloudflare R2 (S3-compatible storage)
- **AI/ML**:
  - Vercel AI SDK (Integración con modelos de IA)
  - Google AI (@ai-sdk/google)
  - Typst (Generación de PDFs)

### Herramientas de Desarrollo
- **Testing**: Vitest
- **Linting/Formatting**: Biome
- **API Documentation**: Chanfana (OpenAPI/Swagger para Hono)
- **Git Hooks**: Husky

## 🏗 Arquitectura: Hexagonal (Ports & Adapters)

El proyecto sigue el patrón arquitectónico Hexagonal, que separa claramente las responsabilidades en capas:

```
┌─────────────────────────────────────────────────────┐
│           Interfaces (HTTP Layer)                    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │
│  │   Routes    │  │ Middleware  │  │ Validators  │  │
│  └─────────────┘  └─────────────┘  └─────────────┘  │
└────────────────────────┬────────────────────────────┘
                         │
┌────────────────────────┼────────────────────────────┐
│      Application (Use Cases)                         │
│  ┌──────────────────────────────────────────────┐   │
│  │  Business Logic Orchestration               │   │
│  └──────────────────────────────────────────────┘   │
└────────────────────────┬────────────────────────────┘
                         │
┌────────────────────────┼────────────────────────────┐
│           Domain (Core)                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │
│  │  Entities   │  │ Repositories│  │  Services   │  │
│  └─────────────┘  └─────────────┘  └─────────────┘  │
└────────────────────────┬────────────────────────────┘
                         │
┌────────────────────────┼────────────────────────────┐
│     Infrastructure (Adapters)                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │
│  │   Database  │  │   Storage   │  │    AI/ML    │  │
│  └─────────────┘  └─────────────┘  └─────────────┘  │
└─────────────────────────────────────────────────────┘
```

### Capa por Capa:

#### 1. **Domain Layer** (src/domain/)
- **Responsabilidad**: Lógica de negocio pura, sin dependencias externas
- **Componentes**:
  - `entities/`: Modelos de dominio (interfaces TypeScript)
  - `repositories/`: Interfaces de repositorios (puertos)
  - `services/`: Servicios de dominio para lógica compleja

#### 2. **Application Layer** (src/application/)
- **Responsabilidad**: Orquestación de casos de uso
- **Componentes**:
  - Casos de uso por característica (ej: `create-class.usecase.ts`)
  - DTOs para entrada/salida de datos
  - Mappers entre entidades y DTOs

#### 3. **Infrastructure Layer** (src/infrastructure/)
- **Responsabilidad**: Implementaciones de adaptadores externos
- **Componentes**:
  - `database/`: Implementaciones de repositorios con Drizzle
  - `auth/`: Adaptador de autenticación con Clerk
  - `storage/`: Adaptador de almacenamiento R2
  - `ai/`: Servicios de IA (Vercel AI SDK)
  - `markdown/`: Procesamiento de Markdown
  - `pdf/`: Generación de PDFs
  - `processing/`: Servicios de procesamiento

#### 4. **Interfaces Layer** (src/interfaces/)
- **Responsabilidad**: Manejo de HTTP y presentación
- **Componentes**:
  - `routes/`: Endpoints HTTP usando Hono + Chanfana
  - `middleware/`: Middleware HTTP (CORS, auth, rate limiting)
  - `validators/`: Schemas de validación con Zod

## 📊 Árbol Completo de Archivos

```
api/
├── .gitattributes
├── .gitignore
├── .husky/
│   ├── _/
│   └── pre-commit
├── AGENTS.md
├── README.md
├── assets/
│   ├── prompt.txt
│   └── scribe/
│       ├── prompt-scribe-agent.txt
│       ├── prompt-scribe-exam-agent.txt
│       └── prompt-scribe-fixer-agent.txt
├── biome.json
├── bun.lock
├── docs/
│   ├── CLASSES.md
│   ├── PROFILES.md
│   ├── R2_STORAGE_GUIDE.md
│   ├── SUBJECTS.md
│   ├── TASKS.md
│   ├── TERMS.md
│   ├── feedback/
│   │   ├── FEEDBACK.md
│   │   └── FEEDBACK_QUICK.md
│   ├── generate-upload-url/
│   │   ├── CLIENT_INTEGRATION.md
│   │   └── GENERATE_UPLOAD_URL.md
│   ├── library/
│   │   └── CLIENT_INTEGRATION.md
│   ├── notifications/
│   │   └── CLIENT_INTEGRATION.md
│   ├── process-audio/
│   │   ├── CLIENT_INTEGRATION.md
│   │   └── PROCESS_AUDIO.md
│   ├── process-url/
│   │   ├── CLIENT_INTEGRATION.md
│   │   ├── IMPLEMENTATION_SUMMARY.md
│   │   └── PROCESS_URL.md
│   ├── scribe/
│   │   ├── API_REFERENCE.md
│   │   └── CLIENT_INTEGRATION.md
│   └── storage/
│       └── STORAGE_QUOTA_MANAGEMENT.md
├── drizzle/
│   └── migrations/
│       ├── 0000_peaceful_scorpion.sql
│       ├── 0001_public_ulik.sql
│       ├── 0002_true_mentor.sql
│       ├── 0003_amazing_arclight.sql
│       ├── 0004_cold_shen.sql
│       ├── 0005_dark_bulldozer.sql
│       ├── 0006_smooth_gorgon.sql
│       ├── 0007_jazzy_chameleon.sql
│       ├── 0008_keen_santa_claus.sql
│       ├── 0009_romantic_paibok.sql
│       ├── 0010_known_madripoor.sql
│       ├── 0011_hot_molten_man.sql
│       ├── 0012_abandoned_epoch.sql
│       ├── 0013_abandoned_junta.sql
│       ├── 0014_modern_mimic.sql
│       ├── 0015_late_terrax.sql
│       └── meta/
│           ├── 0000_snapshot.json
│           ├── 0001_snapshot.json
│           ├── 0002_snapshot.json
│           ├── 0003_snapshot.json
│           ├── 0004_snapshot.json
│           ├── 0005_snapshot.json
│           ├── 0006_snapshot.json
│           ├── 0007_snapshot.json
│           ├── 0008_snapshot.json
│           ├── 0009_snapshot.json
│           ├── 0010_snapshot.json
│           ├── 0011_snapshot.json
│           ├── 0012_snapshot.json
│           ├── 0013_snapshot.json
│           ├── 0014_snapshot.json
│           ├── 0015_snapshot.json
│           └── _journal.json
├── drizzle.config.ts
├── package.json
├── src/
│   ├── application/
│   │   ├── README.md
│   │   ├── classes/
│   │   │   ├── README.md
│   │   │   ├── class.dto.ts
│   │   │   ├── classes.usecase.test.ts
│   │   │   ├── create-class.usecase.ts
│   │   │   ├── generate-class-audio-upload-url.usecase.test.ts
│   │   │   ├── generate-class-audio-upload-url.usecase.ts
│   │   │   ├── get-class.usecase.ts
│   │   │   ├── hard-delete-class.usecase.ts
│   │   │   ├── list-classes.usecase.ts
│   │   │   ├── soft-delete-class.usecase.ts
│   │   │   └── update-class.usecase.ts
│   │   ├── feedback/
│   │   │   └── create-feedback.usecase.ts
│   │   ├── library/
│   │   │   ├── confirm-upload.usecase.ts
│   │   │   ├── delete-library-item.usecase.ts
│   │   │   ├── generate-upload-url.usecase.ts
│   │   │   ├── get-storage-usage.usecase.ts
│   │   │   ├── library.dto.ts
│   │   │   └── list-library-items.usecase.ts
│   │   ├── notifications/
│   │   │   ├── create-notification.usecase.ts
│   │   │   ├── delete-notification.usecase.ts
│   │   │   ├── get-notification.usecase.ts
│   │   │   ├── get-unread-count.usecase.ts
│   │   │   ├── list-notifications.usecase.ts
│   │   │   ├── mark-all-notifications-read.usecase.ts
│   │   │   ├── mark-notification-read.usecase.ts
│   │   │   └── notification.dto.ts
│   │   ├── profiles/
│   │   │   ├── create-profile.usecase.test.ts
│   │   │   ├── create-profile.usecase.ts
│   │   │   ├── generate-scribe-style-upload-url.usecase.ts
│   │   │   ├── get-profile.usecase.test.ts
│   │   │   ├── get-profile.usecase.ts
│   │   │   ├── profile.mapper.test.ts
│   │   │   ├── profile.mapper.ts
│   │   │   ├── update-scribe-style-slot.usecase.ts
│   │   │   ├── upsert-profile-identity.usecase.test.ts
│   │   │   └── upsert-profile-identity.usecase.ts
│   │   ├── scribe/
│   │   │   ├── create-scribe-project.usecase.ts
│   │   │   ├── generate-scribe-answer-upload-url.usecase.ts
│   │   │   ├── get-scribe-project.usecase.ts
│   │   │   ├── list-scribe-projects.usecase.ts
│   │   │   ├── run-scribe-iteration.usecase.ts
│   │   │   ├── unlock-scribe-pdf.usecase.ts
│   │   │   └── update-scribe-project.usecase.ts
│   │   ├── storage/
│   │   │   ├── confirm-upload.service.ts
│   │   │   └── upload-guard.service.ts
│   │   ├── subjects/
│   │   │   ├── README.md
│   │   │   ├── create-subject.usecase.ts
│   │   │   ├── hard-delete-subject.usecase.ts
│   │   │   ├── list-subjects.usecase.ts
│   │   │   ├── soft-delete-subject.usecase.ts
│   │   │   ├── subject.dto.ts
│   │   │   ├── subjects.usecase.test.ts
│   │   │   └── update-subject.usecase.ts
│   │   ├── tasks/
│   │   │   ├── README.md
│   │   │   ├── create-task.usecase.ts
│   │   │   ├── get-task.usecase.ts
│   │   │   ├── hard-delete-task.usecase.ts
│   │   │   ├── list-tasks.usecase.ts
│   │   │   ├── soft-delete-task.usecase.ts
│   │   │   ├── task.dto.ts
│   │   │   ├── task.mapper.test.ts
│   │   │   ├── tasks.usecase.test.ts
│   │   │   └── update-task.usecase.ts
│   │   └── terms/
│   │       ├── README.md
│   │       ├── create-term.usecase.ts
│   │       ├── hard-delete-term.usecase.ts
│   │       ├── list-terms.usecase.ts
│   │       ├── soft-delete-term.usecase.ts
│   │       ├── term.dto.ts
│   │       ├── terms.usecase.test.ts
│   │       └── update-term.usecase.ts
│   ├── config/
│   │   ├── bindings.ts
│   │   └── env.ts
│   ├── domain/
│   │   ├── README.md
│   │   ├── entities/
│   │   │   ├── class.ts
│   │   │   ├── feedback.ts
│   │   │   ├── library.ts
│   │   │   ├── notification.ts
│   │   │   ├── profile.ts
│   │   │   ├── scribe-project.ts
│   │   │   ├── subject.ts
│   │   │   ├── task.ts
│   │   │   └── term.ts
│   │   ├── repositories/
│   │   │   ├── class.repository.ts
│   │   │   ├── feedback.repository.ts
│   │   │   ├── library.repository.ts
│   │   │   ├── notification.repository.ts
│   │   │   ├── profile.repository.ts
│   │   │   ├── scribe-project.repository.ts
│   │   │   ├── storage-accounting.repository.ts
│   │   │   ├── storage.repository.ts
│   │   │   ├── subject.repository.ts
│   │   │   ├── summary.repository.ts
│   │   │   ├── task.repository.ts
│   │   │   └── term.repository.ts
│   │   └── services/
│   │       ├── ai.service.ts
│   │       ├── markdown.service.ts
│   │       ├── processing.service.ts
│   │       ├── prompt.service.ts
│   │       ├── r2-path.service.ts
│   │       ├── scribe/
│   │       │   └── agents.ts
│   │       ├── storage.service.ts
│   │       └── typst-escape.service.ts
│   ├── index.ts
│   ├── infrastructure/
│   │   ├── ai/
│   │   │   ├── scribe.ai.service.ts
│   │   │   ├── tools/
│   │   │   │   └── edit-content/
│   │   │   │       ├── edit-content.ts
│   │   │   │       └── edit.tool.ts
│   │   │   └── vercel.ai.service.ts
│   │   ├── api/
│   │   │   └── scribe-manifest.service.ts
│   │   ├── auth/
│   │   │   ├── README.md
│   │   │   ├── clerk-auth.test.ts
│   │   │   ├── clerk-auth.ts
│   │   │   ├── index.ts
│   │   │   ├── svix-webhook.test.ts
│   │   │   └── svix-webhook.ts
│   │   ├── database/
│   │   │   ├── client.ts
│   │   │   ├── repositories/
│   │   │   │   ├── README.md
│   │   │   │   ├── class.repository.test.ts
│   │   │   │   ├── class.repository.ts
│   │   │   │   ├── d1-scribe-project.repository.ts
│   │   │   │   ├── feedback.repository.ts
│   │   │   │   ├── library.repository.ts
│   │   │   │   ├── notification.repository.ts
│   │   │   │   ├── profile.repository.test.ts
│   │   │   │   ├── profile.repository.ts
│   │   │   │   ├── storage-accounting.repository.ts
│   │   │   │   ├── subject.repository.test.ts
│   │   │   │   ├── subject.repository.ts
│   │   │   │   ├── summary.repository.ts
│   │   │   │   ├── task.repository.test.ts
│   │   │   │   ├── task.repository.ts
│   │   │   │   └── term.repository.ts
│   │   │   └── schema.ts
│   │   ├── logging/
│   │   │   └── dev-logger.ts
│   │   ├── markdown/
│   │   │   ├── minigfm.markdown.service.test.ts
│   │   │   └── minigfm.markdown.service.ts
│   │   ├── pdf/
│   │   │   └── scribe-pdf.service.ts
│   │   ├── processing/
│   │   │   └── cloud-run.processing.service.ts
│   │   ├── prompt/
│   │   │   ├── assets.prompt.service.test.ts
│   │   │   └── assets.prompt.service.ts
│   │   └── storage/
│   │       ├── r2.storage.service.ts
│   │       └── r2.storage.ts
│   ├── interfaces/
│   │   ├── http/
│   │   │   ├── middleware/
│   │   │   │   ├── cors.ts
│   │   │   │   ├── error-handler.ts
│   │   │   │   ├── index.ts
│   │   │   │   ├── rate-limiter.ts
│   │   │   │   └── request-id.ts
│   │   │   ├── routes/
│   │   │   │   ├── README.md
│   │   │   │   ├── classes-generate-upload-url.ts
│   │   │   │   ├── classes-process-audio.test.ts
│   │   │   │   ├── classes-process-audio.ts
│   │   │   │   ├── classes-process-url.ts
│   │   │   │   ├── classes.ts
│   │   │   │   ├── feedback.ts
│   │   │   │   ├── library.ts
│   │   │   │   ├── notifications.ts
│   │   │   │   ├── profiles-scribe-style.ts
│   │   │   │   ├── profiles.ts
│   │   │   │   ├── scribe.ts
│   │   │   │   ├── subjects.ts
│   │   │   │   ├── tasks.ts
│   │   │   │   ├── terms.ts
│   │   │   │   ├── uploads.ts
│   │   │   │   └── webhooks-clerk.ts
│   │   │   └── validators/
│   │   │       ├── README.md
│   │   │       ├── class.validator.test.ts
│   │   │       ├── class.validator.ts
│   │   │       ├── feedback.validator.ts
│   │   │       ├── library.validator.ts
│   │   │       ├── notification.validator.ts
│   │   │       ├── profile.validator.ts
│   │   │       ├── subject.validator.ts
│   │   │       ├── task.validator.ts
│   │   │       └── term.validator.ts
│   │   └── index.ts
│   ├── types.ts
│   └── workflows/
│       ├── generate-scribe-project/
│       │   └── (empty)
│       └── summarize-class/
│           ├── README.md
│           ├── dependencies.ts
│           ├── file-validator.test.ts
│           ├── file-validator.ts
│           ├── handler.test.ts
│           ├── handler.ts
│           ├── index.ts
│           └── types.ts
├── tsconfig.json
├── vitest.config.ts
├── worker-configuration.d.ts
└── wrangler.jsonc
```

## 🎯 Funcionalidades Principales

### 1. **Gestión de Perfiles (Profiles)**
- Creación automática de perfiles vía webhooks de Clerk
- Gestión de suscripción (free/pro/premium)
- Cuota de almacenamiento
- Slots de estilo para Scribe (2 slots para referencias de estilo)

### 2. **Gestión Académica**
- **Terms (Trimestres/Semestres)**: Organización por periodos académicos
- **Subjects (Asignaturas)**: Materias con profesor, créditos, horarios, color temático
- **Classes (Clases)**: Sesiones de clase con:
  - Transcripción automática de audio/URL
  - Resúmenes generados por IA
  - Estado del ciclo de vida (scheduled/live/completed)
  - Estado de procesamiento AI (none/processing/done/failed)
- **Tasks (Tareas)**: Tareas y evaluaciones con:
  - Tipos: reading, exam, essay, presentation, assignment
  - Prioridades: low, medium, high
  - Estados: todo, doing, ai_review, done
  - Calificaciones y contenido

### 3. **Scribe (Generación de Documentos con IA)**
Sistema avanzado de generación de documentos usando AI:
- **Workflow de Scribe v2**:
  1. `needs_input`: El agente necesita más información (retorna formSchema)
  2. `processing`: El agente está procesando (iteración server-side)
  3. `blocked`: PDF generado + examen generado (bloqueado hasta unlock_pdf)
  4. `available`: Desbloqueado por el usuario (pasó examen)
  5. `failed`: Algo salió mal
- **Templates**: Soporte para múltiples plantillas Typst (default, apa, ieee)
- **Examen de validación**: El usuario debe pasar un examen para desbloquear el PDF
- **Referencias de estilo**: Soporte para subida de archivos de referencia de estilo

### 4. **Biblioteca (Library)**
- Sistema de almacenamiento de archivos en R2
- URLs presignadas para upload seguro
- Gestión de cuotas de almacenamiento
- Confirmación de uploads
- Listado de archivos por usuario

### 5. **Procesamiento de Clases**
- Procesamiento de archivos de audio de clases
- Procesamiento de URLs (YouTube, etc.)
- Workflow de resumen automático usando Cloudflare Workflows
- Validación de archivos

### 6. **Notificaciones**
- Sistema de notificaciones para:
  - Resúmenes de clases listos
  - Tareas próximas a vencer
  - Calificaciones publicadas
  - Alertas del sistema
- Contador de notificaciones no leídas
- Marcado como leído/leer todas

### 7. **Feedback**
- Sistema de feedback de usuarios
- Contexto de página donde se envió el feedback

## 🗄 Esquema de Base de Datos

### Tablas Principales:

1. **profiles**: Información del usuario
2. **terms**: Periodos académicos
3. **subjects**: Asignaturas
4. **tasks**: Tareas y evaluaciones
5. **classes**: Sesiones de clase
6. **flashcards**: Tarjetas de memoria
7. **user_files**: Archivos de usuario
8. **user_storage_objects**: Control de almacenamiento
9. **task_resources**: Recursos asociados a tareas
10. **class_resources**: Recursos asociados a clases
11. **feedback**: Feedback de usuarios
12. **chats**: Conversaciones con IA
13. **messages**: Mensajes de chat
14. **scribe_projects**: Proyectos de generación de documentos
15. **notifications**: Notificaciones de sistema

### Características del Schema:
- Soft delete (isDeleted, deletedAt)
- Timestamps automáticos (createdAt, updatedAt)
- Índices optimizados para consultas
- Foreign keys con cascade delete
- Columnas JSON para datos flexibles

## 🔌 Endpoints de la API

### Authentication Webhooks
- `POST /webhooks/clerk/user.created`
- `POST /webhooks/clerk/user.updated`

### Profile
- `GET /profiles/me`
- `POST /profiles/me/scribe-style/upload-url`
- `PUT /profiles/me/scribe-style`

### Terms
- `GET /terms`
- `POST /terms`
- `PUT /terms/:id`
- `DELETE /terms/:id` (soft)
- `DELETE /terms/:id/hard` (hard)

### Subjects
- `GET /subjects`
- `POST /subjects`
- `PUT /subjects/:id`
- `DELETE /subjects/:id` (soft)
- `DELETE /subjects/:id/hard` (hard)

### Tasks
- `GET /tasks`
- `GET /tasks/:id`
- `POST /tasks`
- `PUT /tasks/:id`
- `DELETE /tasks/:id` (soft)
- `DELETE /tasks/:id/hard` (hard)

### Classes
- `GET /classes`
- `GET /classes/:id`
- `POST /classes`
- `PUT /classes/:id`
- `DELETE /classes/:id` (soft)
- `DELETE /classes/:id/hard` (hard)
- `POST /classes/:classId/generate-upload-url`
- `POST /classes/:classId/process-audio`
- `POST /classes/:classId/process-url`

### Scribe
- `POST /scribe/upload-url`
- `POST /scribe/projects/:id/answer-upload-url`
- `POST /scribe` (iterate)
- `GET /scribe`
- `GET /scribe/templates`
- `GET /scribe/:id`
- `POST /scribe/:id/unlock_pdf`

### Library
- `GET /library`
- `GET /library/storage`
- `POST /library/upload/presigned`
- `POST /library/upload/confirm`
- `DELETE /library/:id`

### Uploads
- `POST /uploads/confirm`

### Feedback
- `POST /feedback`

### Notifications
- `GET /notifications`
- `GET /notifications/unread-count`
- `GET /notifications/:id`
- `POST /notifications`
- `POST /notifications/:id/read`
- `POST /notifications/read-all`
- `DELETE /notifications/:id`

## ⚙ Configuración Cloudflare Workers

### Bindings Principales
- **DB**: D1 Database (classmate-prod)
- **ASSETS**: Directorio de assets estáticos
- **SUMMARIZE_CLASS_WORKFLOW**: Cloudflare Workflow para resúmenes de clase

### Secrets (configurados vía Cloudflare Secrets Store)
- `ALLOWED_ORIGIN`: Orígenes permitidos para CORS
- `CLERK_SECRET_KEY`: Secret key de Clerk
- `CLERK_PUBLISHABLE_KEY`: Publishable key de Clerk
- `R2_S3_API_ENDPOINT`: Endpoint temporal de R2
- `R2_ACCESS_KEY_ID`: Access key para R2 temporal
- `R2_SECRET_ACCESS_KEY`: Secret key para R2 temporal
- `R2_TEMPORAL_BUCKET_NAME`: Nombre del bucket temporal
- `R2_S3_PERSISTENT_API_ENDPOINT`: Endpoint persistente de R2
- `R2_PERSISTENT_ACCESS_KEY_ID`: Access key para R2 persistente
- `R2_PERSISTENT_SECRET_ACCESS_KEY`: Secret key para R2 persistente
- `R2_PERSISTENT_BUCKET_NAME`: Nombre del bucket persistente
- `AI_GATEWAY_API_KEY`: API key para el gateway de IA
- `PROCESSING_SERVICE_URL`: URL del servicio de procesamiento
- `INTERNAL_API_KEY`: API key interna
- `INTERNAL_SCRIBE_API_KEY`: API key interna para Scribe
- `SCRIBE_HEAVY_API_URL`: URL del API pesado de Scribe

### Variables de Entorno
- `ENVIRONMENT`: development|staging|production
- `R2_PRESIGNED_URL_EXPIRATION_SECONDS`: 300 (5 minutos)

## 🚀 Scripts y Comandos Disponibles

```json
{
  "deploy": "wrangler deploy",
  "dev": "wrangler dev",
  "start": "wrangler dev",
  "test": "vitest",
  "test:ui": "vitest --ui",
  "cf-typegen": "wrangler types",
  "check": "biome check --write",
  "db:generate": "drizzle-kit generate",
  "db:migrate:local": "wrangler d1 migrations apply DB --local",
  "db:migrate:remote": "wrangler d1 migrations apply DB --remote",
  "prepare": "husky"
}
```

## 🔐 Autenticación

El proyecto utiliza **Clerk** para la autenticación:
- Validación automática de session tokens
- Middleware inyecta auth context en todas las rutas
- Helper `getAuth(c)` para acceder a información del usuario
- Webhooks para sincronización de perfiles
- CORS configurado por origen

## 🧪 Testing

El proyecto incluye tests escritos con **Vitest**:
- Tests unitarios para casos de uso
- Tests de integración para repositorios
- Tests de rutas HTTP
- Tests de servicios

## 📚 Documentación

- **OpenAPI/Swagger**: Disponible en `GET /` (Swagger UI) y `GET /openapi.json`
- **AGENTS.md**: Guía de arquitectura y mejores prácticas
- **docs/**: Documentación por feature (CLASSES.md, PROFILES.md, etc.)
- **README.md**: Guía de inicio rápido

## 🔒 Seguridad

- Validación de bindings obligatoria
- Rate limiting por IP + usuario
- Sanitización de inputs SQL (manejado por Drizzle)
- CORS configurado
- No logging de datos sensibles
- Pre-commit hooks con Husky
- Environment variables tipadas

## 🎨 Patrones de Diseño Utilizados

1. **Repository Pattern**: Abstracción del acceso a datos
2. **Dependency Injection**: Inyección de dependencias en constructor
3. **Factory Pattern**: DatabaseFactory para Drizzle
4. **DTO Pattern**: Separación de dominio y presentación
5. **Use Case Pattern**: Un caso de uso por clase
6. **Middleware Pattern**: Pipeline de middleware en Hono

## 📊 Métricas y Observabilidad

- Smart Placement de Cloudflare Workers
- Request ID para tracking
- Latency measurement en mensajes
- Token counting para AI
- Logging estructurado

## 🚢 Deployment

El deployment se realiza a través de:
- **GitHub Actions** (CI/CD automático para main branch)
- **Wrangler CLI** (manual para deploys específicos)
- **Migrations**: Automáticas en deploy a producción

---

**Resumen**: Classmate API es un sistema completo de gestión académica con integración avanzada de IA, arquitectura limpia, y despliegue en la edge de Cloudflare Workers. Está diseñado para ser escalable, mantenible y type-safe en todas sus capas.
