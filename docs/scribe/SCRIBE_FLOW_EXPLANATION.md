# Explicación Completa del Flujo Scribe

## Resumen Ejecutivo

El sistema **Scribe** es un motor de generación de documentos académicos completamente **basado en AI**. Funciona en **4 etapas secuenciales** ejecutadas por 4 agentes de IA distintos, cada uno especializado en una tarea específica.

**Puntos clave:**
- ✅ **MARKDOWN → LATEX → PDF** — El flujo completo de generación
- ✅ **El Markdown y LaTeX son INTERNOS** — El cliente solo recibe una URL prefirmada al PDF final
- ✅ **PDF generado en `SCRIBE_HEAVY_API_URL`** — Servicio externo para compilación de LaTeX
- ✅ **Solo usa Gemini 2.5 Flash Lite** via Vercel AI Gateway (sin modelo selection logic)
- ✅ **Completamente serverless** en Cloudflare Workers + D1 + Durable Workflows
- ✅ **Acumulación de contexto** — Las respuestas del usuario se preservan entre rondas de revisión

---

## Arquitectura del Flujo: State Machine

```
┌─────────┐
│  draft  │ (Proyecto creado)
└────┬────┘
     │ Architect Agent (analiza rubrica)
     ↓
┌──────────────────┐
│collecting_answers│ (Esperando respuestas del usuario)
└────┬─────────────┘
     │ (Usuario envía answers)
     ↓
┌──────────┐
│ drafting │ (Ghostwriter Agent genera contenido)
└────┬─────┘
     ↓
┌──────────┐
│reviewing │ (Supervisor Agent revisa)
└────┬─────┘
     │
     ├─→ ¿Aprobado? ─→ SI ──→ ┌───────────┐
     │                         │typesetting│ (Typesetter Agent convierte a LaTeX)
     │                         └─────┬─────┘
     │                               ↓
     │                         ┌───────────┐
     │                         │ completed │ (Listo para descargar)
     │                         └───────────┘
     │
     └─→ ¿Rechazado? ─→ SI ──→ collecting_answers (Nueva ronda de preguntas)
                               ⚠️ Las respuestas previas se PRESERVAN
                               ⚠️ El markdown previo se pasa al Ghostwriter
```

### Flujo desde la Perspectiva del Cliente

El cliente solo ve estos estados:
1. `collecting_answers` → Formulario para responder (puede repetirse)
2. `completed` → **URL prefirmada al PDF** listo para visualizar

Los estados intermedios (`drafting`, `reviewing`, `typesetting`) son internos y el cliente puede ignorarlos o usarlos solo para mostrar estados de carga.

---

## Los 4 Agentes IA y Sus Prompts

Todos usan **Google Gemini 2.5 Flash Lite** via Vercel AI Gateway.

### 1️⃣ ARCHITECT AGENT
**Archivo:** `scribe/prompt-01-architect.txt`
**Entrada:** Rúbrica (PDF, imagen, texto)
**Salida:** JSON con estructura de formulario dinámico
**Método IA:** `generateObject()` (salida estructurada)

```typescript
// handler.ts línea 59-73
const output: ArchitectOutput = await this.scribeAIService.runAgentWithSchema(
  ARCHITECT_AGENT,
  {
    fileUrl: project.rubricFileUrl ?? undefined,
    fileMimeType: project.rubricMimeType ?? undefined,
    textContent: project.rubricContent ?? undefined,
  }
);
```

**¿Qué hace?**
- Analiza la rúbrica (de un archivo subido o texto)
- Extrae los puntos clave que necesita del estudiante
- Genera un JSON con secciones y preguntas dinámicas

**Output Schema:**
```typescript
{
  form_title: string,
  estimated_time: string,
  sections: [
    {
      section_title: string,
      questions: [
        {
          id: string,
          type: "select" | "text_input" | "textarea" | "checkbox",
          label: string,
          helper_text?: string,
          options?: string[]
        }
      ]
    }
  ]
}
```

---

### 2️⃣ GHOSTWRITER AGENT
**Archivo:** `scribe/prompt-02-ghostwriter.txt`
**Entrada:** Rúbrica + Respuestas del usuario (JSON) + [Opcional] Markdown previo
**Salida:** Documento en **MARKDOWN** (ojo: no LaTeX aún)
**Método IA:** `generateText()` (salida libre)

**Modos de Operación:**

| Modo | Condición | Comportamiento |
|------|-----------|----------------|
| **MODE A: Initial Draft** | `contentMarkdown` es null | Genera documento desde cero |
| **MODE B: Revision** | `contentMarkdown` existe | Mejora el documento existente con nueva información |

```typescript
// handler.ts - Detección de modo
const isRevision = !!project.contentMarkdown;

if (isRevision) {
  // Incluye: rubric + previous markdown + structured answers + supervisor feedback
  textContent = this.buildRevisionContext(project);
} else {
  // Solo: rubric + user answers
  textContent = `RUBRIC:\n${project.rubricContent}\n\nUSER ANSWERS:\n${JSON.stringify(project.userAnswers)}`;
}
```

**¿Qué hace?**
- Toma las respuestas del usuario (generadas por Architect)
- Las sintetiza en un documento académico completo
- Eleva el tono del lenguaje (convierte texto casual → formal)
- **Salida en MARKDOWN puro** (estructura con headings #, ##, ###)
- **NO genera LaTeX aquí** — es solo Markdown
- **NO usa placeholders** — El documento debe estar completo

**Proceso Inicial (Mode A):**
1. Recibe: `RUBRIC + USER_ANSWERS`
2. Sintetiza, no concatena
3. Estructura lógicamente con encabezados
4. Agrega secciones de Referencias
5. Retorna Markdown limpio

**Proceso de Revisión (Mode B):**
1. Recibe: `RUBRIC + PREVIOUS_MARKDOWN + INITIAL_ANSWERS + REVISION_ANSWERS[] + SUPERVISOR_FEEDBACK`
2. Identifica las áreas que necesitan mejora
3. Integra la nueva información quirúrgicamente
4. Preserva la estructura existente
5. Retorna Markdown mejorado

---

### 3️⃣ SUPERVISOR AGENT
**Archivo:** `scribe/prompt-03-supervisor.txt`
**Entrada:** Markdown generado + Rúbrica (para referencia)
**Salida:** JSON con aprobación o preguntas de revisión
**Método IA:** `generateText()` con parsing

**Reglas Críticas:**
- ❌ **NO PLACEHOLDERS:** Si encuentra `[INSERT...]`, `[TODO]`, etc. → RECHAZA
- ❌ **NO FABRICACIÓN:** Si detecta datos inventados → RECHAZA
- ✅ **MINIMAL INTERVENTION:** Solo pide información estrictamente necesaria

```typescript
// handler.ts
const response = await this.scribeAIService.runAgentWithText(
  SUPERVISOR_AGENT,
  {
    fileUrl: project.rubricFileUrl ?? undefined,
    fileMimeType: project.rubricMimeType ?? undefined,
    textContent: `CONTENT TO REVIEW:\n${project.contentMarkdown}\n\nRUBRIC:\n${project.rubricContent}`,
    templateVars: {
      CONTENT: project.contentMarkdown || "",
      RUBRIC: project.rubricContent || "",
    },
  },
);

// Dos casos:
if (response.includes("STATUS: APPROVED")) {
  return { approved: true };
} else {
  const jsonStr = response.replace(/```json\n?|\n?```/g, "").trim();
  const parsed = JSON.parse(jsonStr); // Extrae preguntas de revisión
  return { approved: false, ...parsed };
}
```

**¿Qué hace?**
- Revisa el Markdown contra la rúbrica original
- Comprueba que se cumplan todos los requisitos
- **Dos caminos posibles:**
  - ✅ `STATUS: APPROVED` → Pasa a typesetting
  - ❌ Rechazado + nuevas preguntas → Vuelve a `collecting_answers` con nuevas preguntas

**Loop de Revisión:**
```typescript
// handler.ts línea 161-189
if (review.approved) {
  // 🟢 Aprobado → Typesetting
  status: "typesetting"
} else {
  if (review.questions?.length > 0) {
    // 🔴 Rechazado → Nueva ronda de preguntas
    status: "collecting_answers",
    formQuestions: review.questions, // Nuevas preguntas de revisión
    userAnswers: null, // Limpia respuestas previas
  }
}
```

---

### 4️⃣ TYPESETTER AGENT + PDF GENERATION
**Archivo:** `scribe/prompt-04-typesetter.txt`
**Entrada:** Markdown del Ghostwriter
**Salida:** **PDF PRESIGNED URL** (accesible directamente)
**Método IA:** `generateText()` (raw text)

```typescript
// handler.ts - Flujo completo de typesetting
// Paso 1: Generar LaTeX con IA
const latex = await step.do("typesetter-agent", async () => {
  const response = await this.scribeAIService.runAgentWithText(
    TYPESETTER_AGENT,
    {
      textContent: project.contentMarkdown || "",
      templateVars: {
        CONTENT: project.contentMarkdown || "",
      },
    },
  );
  return response;
});

// Paso 2: Obtener metadata del usuario para el PDF
const pdfMetadata = await step.do("fetch-pdf-metadata", async () => {
  const profile = await this.profileRepository.findById(project.userId);
  const studentName = profile?.name || "Estudiante";

  let courseName = "Documento Académico";
  if (project.subjectId) {
    const subject = await this.subjectRepository.findByIdAndUserId(
      project.userId,
      project.subjectId,
    );
    if (subject) courseName = subject.name;
  }

  return { studentName, courseName, fecha: new Date().toLocaleDateString("es-ES", {...}) };
});

// Paso 3: Llamar al servicio de generación de PDF
const pdfResult = await step.do("generate-pdf", async () => {
  return await this.pdfService.generatePdf({
    user_id: project.userId,
    titulo: project.title || "Documento Sin Título",
    curso: pdfMetadata.courseName,
    estudiante: pdfMetadata.studentName,
    fecha: pdfMetadata.fecha,
    contenido_latex: latex,
  });
});

// Paso 4: Generar URL prefirmada para el PDF
const presignedUrl = await step.do("generate-presigned-url", async () => {
  return await this.storageAdapter.generatePresignedGetUrl(
    this.r2BucketName,
    pdfResult.r2Key,
    7 * 24 * 60 * 60, // 7 días
  );
});

// Paso 5: Guardar en BD
await step.do("update-after-typesetter", async () => {
  await this.scribeProjectRepository.update(project.userId, project.id, {
    currentLatex: latex,
    finalPdfFileId: pdfResult.r2Key,
    finalPdfUrl: presignedUrl,
    status: "completed",
  });
});
```

**¿Qué hace?**
1. Convierte el Markdown a **LaTeX puro y compilable** (via IA)
2. Obtiene nombre del estudiante y curso desde los repositorios
3. Llama a `SCRIBE_HEAVY_API_URL` para compilar LaTeX → PDF
4. Genera una URL prefirmada (7 días) para el PDF en R2
5. Guarda la URL y marca el proyecto como completado

**Servicio de PDF (`SCRIBE_HEAVY_API_URL`):**
- **Endpoint:** `POST /v1/generate`
- **Auth:** Header `X-API-KEY: {INTERNAL_SCRIBE_API_KEY}`
- **Request:**
```json
{
  "user_id": "user-123",
  "titulo": "Mi Ensayo",
  "curso": "Historia Universal",
  "estudiante": "Juan Pérez",
  "fecha": "26 de noviembre, 2025",
  "contenido_latex": "\\section{Introducción}..."
}
```
- **Response:**
```json
{
  "r2Key": "generated-pdfs/user_user-123/2025/11/mi-ensayo-abc123.pdf",
  "filename": "mi-ensayo-abc123.pdf",
  "mimeType": "application/pdf"
}
```

---

## Tipos de Datos en la Base de Datos

Tabla `scribe_projects`:

```typescript
id: string (UUID)
userId: string (Clerk user ID)
title: string? (opcional)
status: "draft" | "collecting_answers" | "drafting" | "reviewing" | "typesetting" | "completed" | "failed"

// Rubrica (flexible: archivo O contenido de texto)
rubricContent: string? (texto plano/markdown de la rúbrica)
rubricFileUrl: string? (URL de R2 para PDF/imagen)
rubricMimeType: string? (application/pdf, image/png, etc.)

// Respuestas y contenido generado
formQuestions: JSON? (estructura del formulario del Architect)
userAnswers: JSON? (respuestas del usuario)
contentMarkdown: string? (output del Ghostwriter - INTERNO)
reviewFeedback: JSON? (output del Supervisor)
currentLatex: string? (output del Typesetter - INTERNO)

// PDF final
finalPdfFileId: string? (R2 key del PDF generado)
finalPdfUrl: string? (URL prefirmada para acceso al PDF - 7 días)

createdAt: timestamp
updatedAt: timestamp
```

---

## Flujo HTTP Completo (Cliente)

### Fase 1: Subir Rúbrica

**Opción A: Subida de Archivo**

1. **GET presigned URL:**
```bash
POST /scribe/upload-url
{
  "fileName": "rubric.pdf",
  "contentType": "application/pdf"
}

Response:
{
  "signedUrl": "https://r2-signed-url...",
  "key": "scribe/rubrics/user-id/timestamp-rubric.pdf",
  "publicUrl": "https://r2-public-url..."
}
```

2. **Upload archivo a R2:**
```bash
PUT {signedUrl}
Content-Type: application/pdf
[binary PDF content]
```

3. **Crear proyecto:**
```bash
POST /scribe
{
  "rubricFileUrl": "https://r2-public-url...",
  "rubricMimeType": "application/pdf",
  "title": "Mi Ensayo de Historia"
}

Response (201):
{
  "id": "project-uuid",
  "status": "draft",
  "rubricFileUrl": "...",
  "rubricMimeType": "application/pdf",
  ...
}
```

**Opción B: Texto Manual**
```bash
POST /scribe
{
  "rubricContent": "Tu texto de rúbrica aquí...",
  "title": "Mi Ensayo"
}
```

### Fase 2: Esperar Architect + Responder Formulario

1. **Poll hasta `collecting_answers`:**
```bash
GET /scribe/{project-id}
Loop cada 500ms hasta: status === "collecting_answers"

Response:
{
  "id": "...",
  "status": "collecting_answers",
  "formQuestions": {
    "form_title": "Contexto del Ensayo",
    "estimated_time": "5 minutos",
    "sections": [
      {
        "section_title": "Introducción",
        "questions": [
          {
            "id": "q1",
            "type": "select",
            "label": "¿Tono deseado?",
            "options": ["Formal", "Persuasivo", "Narrativo"]
          },
          {
            "id": "q2",
            "type": "textarea",
            "label": "Describe tu argumento principal"
          }
        ]
      }
    ]
  }
}
```

2. **Usuario completa el formulario y envía:**
```bash
PUT /scribe/{project-id}
{
  "userAnswers": {
    "q1": "Formal",
    "q2": "La revolución industrial fue..."
  }
}

Response (200):
{
  "id": "...",
  "status": "drafting",  // Ahora el Ghostwriter está generando
  ...
}
```

### Fase 3: Esperar Procesamiento + Recibir Resultado

Después de enviar las respuestas, el cliente hace polling hasta recibir uno de dos resultados:
- `collecting_answers` con nuevas preguntas (revisión necesaria)
- `completed` con la **URL prefirmada al PDF**

**⚠️ IMPORTANTE:** El cliente **NUNCA** ve el markdown ni el LaTeX. Son de uso interno entre agentes.

1. **Poll hasta `collecting_answers` (con nuevas preguntas) o `completed`:**
```bash
GET /scribe/{project-id}

# Caso A: Supervisor rechazó → Nuevas preguntas
Response:
{
  "id": "...",
  "status": "collecting_answers",
  "formQuestions": {
    "form_title": "Additional Information Needed",
    "estimated_time": "5 minutes",
    "sections": [
      {
        "section_title": "Clarifications",
        "questions": [
          {
            "id": "missing_citation_1",
            "type": "text_input",
            "label": "Please provide the source for: '80% of users...'",
            "context_snippet": "In paragraph 3..."
          }
        ]
      }
    ]
  },
  "reviewFeedback": {
    "status": "REVISION",
    "feedback_summary": "Se necesita la fuente de una estadística mencionada."
  },
  ...
}

# Caso B: Aprobado → PDF listo
Response:
{
  "id": "...",
  "status": "completed",
  "finalPdfUrl": "https://r2-presigned-url.../generated-pdfs/user_xxx/2025/11/documento.pdf?signature=...",
  ...
}
```

2. **Si `collecting_answers` (Caso A) → Responder nuevas preguntas:**
```bash
PUT /scribe/{project-id}
{
  "userAnswers": {
    "missing_citation_1": "https://example.com/study-2024"
  }
}

Response (200):
{
  "id": "...",
  "status": "drafting",  // Ghostwriter está mejorando el documento
  ...
}
```

Las respuestas se **acumulan** internamente:
```json
{
  "_initialAnswers": { "q1": "Formal", "q2": "La revolución..." },
  "_revisionAnswers": [
    { "missing_citation_1": "https://example.com/study-2024" }
  ]
}
```

3. **Repetir polling hasta `completed`**

### Fase 4: Visualizar el PDF

```bash
GET /scribe/{project-id}

Response:
{
  "id": "...",
  "status": "completed",
  "finalPdfUrl": "https://r2-presigned-url.../generated-pdfs/user_xxx/2025/11/mi-ensayo-abc123.pdf?...",
  // ⚠️ contentMarkdown y currentLatex NO están en la respuesta - son internos
  ...
}
```

El cliente puede:
- Mostrar el PDF directamente en un `<iframe>` o visor
- Abrir `finalPdfUrl` en una nueva pestaña para descargar
- La URL es válida por **7 días** desde la generación

---

## Campos Excluidos del API Response

Los siguientes campos **NO se incluyen** en ninguna respuesta del API:
- `contentMarkdown` — Markdown es solo para uso interno entre Ghostwriter y Supervisor
- `currentLatex` — LaTeX es interno, el cliente recibe `finalPdfUrl`
- `finalPdfFileId` — R2 key interno, el cliente solo necesita la URL prefirmada

Endpoints afectados:
- `GET /scribe` (list)
- `GET /scribe/{id}` (get)
- `POST /scribe` (create)
- `PUT /scribe/{id}` (update)

---

## ¿Dónde está el PDF?

### PDF ✅
**Se genera en:** Servicio externo `SCRIBE_HEAVY_API_URL`
**Almacenado en:** R2 bucket persistente
**Acceso:** URL prefirmada en `finalPdfUrl` (válida 7 días)

### Flujo de Generación:
1. **Typesetter Agent** genera LaTeX (en Cloudflare Worker)
2. **ScribePdfService** envía LaTeX a `SCRIBE_HEAVY_API_URL/v1/generate`
3. Servicio externo compila con `pdflatex` y sube a R2
4. Worker genera URL prefirmada para el R2 key devuelto
5. `finalPdfUrl` se guarda en la BD

### ¿Por qué un servicio externo?
1. **Compilar LaTeX es CPU-intensive** (pdflatex tarda ~500ms+)
2. **Cloudflare Workers máx 50ms CPU time** (límite strict)
3. **Solución:** Servicio dedicado en Cloud Run (o similar) que puede tomar más tiempo

---

## Variables de Entorno Relevantes

```typescript
// Secrets para el servicio de PDF
SCRIBE_HEAVY_API_URL: string;      // URL del servicio de compilación LaTeX
INTERNAL_SCRIBE_API_KEY: string;   // API key para autenticación

// Secrets para R2 (URLs prefirmadas)
R2_S3_PERSISTENT_API_ENDPOINT: string;
R2_PERSISTENT_ACCESS_KEY_ID: string;
R2_PERSISTENT_SECRET_ACCESS_KEY: string;
R2_PERSISTENT_BUCKET_NAME: string;
```

---

## Archivos Clave del Flujo

```
src/
├── workflows/generate-scribe-project/
│   ├── index.ts                    # Entrypoint de Cloudflare Workflow
│   ├── handler.ts                  # State machine (4 agentes + PDF generation)
│   ├── dependencies.ts             # DI factory (inyecta PDF service, repos, storage)
│   └── types.ts                    # Tipos del workflow
│
├── domain/services/scribe/
│   └── agents.ts                   # Configuración de 4 agentes
│
├── infrastructure/ai/
│   └── scribe.ai.service.ts        # ScribeAIService (runAgentWithSchema, runAgentWithText)
│
├── infrastructure/pdf/
│   └── scribe-pdf.service.ts       # ScribePdfService (llama a SCRIBE_HEAVY_API_URL)
│
├── infrastructure/storage/
│   └── r2.storage.ts               # R2StorageAdapter (URLs prefirmadas)
│
├── infrastructure/prompt/
│   └── assets.prompt.service.ts    # Carga prompts desde R2
│
├── interfaces/http/routes/
│   └── scribe.ts                   # Endpoints HTTP (POST, GET, PUT)
│
└── assets/scribe/
    ├── prompt-01-architect.txt     # Analyzes rubric → form JSON
    ├── prompt-02-ghostwriter.txt   # Generates Markdown
    ├── prompt-03-supervisor.txt    # Reviews + approves/rejects
    └── prompt-04-typesetter.txt    # Converts Markdown → LaTeX
```

---

## Resumen: ¿Qué es Cada Campo?

| Campo | ¿Cuándo se llena? | ¿Qué contiene? | ¿De dónde viene? | ¿Visible al cliente? |
|-------|-------------------|----------------|------------------|---------------------|
| `rubricContent` | Usuario (Phase 1) | Texto plano de la rúbrica | HTTP POST | ✅ Sí |
| `rubricFileUrl` | Usuario (Phase 1) | URL pública en R2 | Presigned upload | ✅ Sí |
| `rubricMimeType` | Usuario (Phase 1) | `application/pdf`, `image/png`, etc. | HTTP POST | ✅ Sí |
| `formQuestions` | Architect/Supervisor | JSON con estructura de formulario | `generateObject()` | ✅ Sí |
| `userAnswers` | Usuario (Phase 2+) | JSON estructurado con respuestas acumuladas | HTTP PUT | ✅ Sí |
| `contentMarkdown` | Ghostwriter Agent | Documento en **Markdown** | `generateText()` | ❌ **NO** (interno) |
| `reviewFeedback` | Supervisor Agent | JSON: aprobado o rechazado + nuevas preguntas | `generateText()` + parsing | ✅ Sí |
| `currentLatex` | Typesetter Agent | Código **LaTeX compilable** | `generateText()` | ❌ **NO** (interno) |
| `finalPdfFileId` | PDF Service | R2 key del PDF | `SCRIBE_HEAVY_API_URL` | ❌ **NO** (interno) |
| `finalPdfUrl` | Workflow | **URL prefirmada al PDF** (7 días) | `generatePresignedGetUrl()` | ✅ Sí |

### Estructura de `userAnswers` (Acumulada)

```json
{
  "_initialAnswers": {
    "q1": "Formal",
    "q2": "La revolución industrial..."
  },
  "_revisionAnswers": [
    { "missing_citation_1": "https://example.com/study" },
    { "clarification_thesis": "El argumento central es..." }
  ]
}
```

O en formato plano (primera ronda solamente):
```json
{
  "q1": "Formal",
  "q2": "La revolución industrial..."
}
```

---

## Conclusión

```mermaid
graph LR
    A["📄 Rúbrica (PDF/Texto)"] -->|Architect| B["📋 Formulario JSON"]
    C["✍️ Respuestas Usuario"] -->|Ghostwriter| D["📝 Markdown (interno)"]
    D -->|Supervisor| E{"✅ Aprobado?"}
    E -->|No + preguntas| B
    E -->|Yes| F["🔧 Typesetter"]
    F -->|Typesetter| G["📠 LaTeX (interno)"]
    G -->|SCRIBE_HEAVY_API| H["📄 PDF en R2"]
    H -->|Presigned URL| I["🔗 finalPdfUrl"]
```

**Flow Summary:**
1. Usuario sube rúbrica (PDF/texto)
2. **Architect** analiza → genera formulario dinámico
3. Usuario responde
4. **Ghostwriter** crea documento en Markdown
5. **Supervisor** revisa (loop de revisión si necesario)
6. **Typesetter** convierte Markdown → LaTeX
7. **PDF Service** compila LaTeX → PDF y lo sube a R2
8. Cliente recibe `finalPdfUrl` → puede visualizar/descargar directamente

**Stack:**
- ✅ Cloudflare Workers (HTTP)
- ✅ Cloudflare Durable Workflows (state machine)
- ✅ D1 (database)
- ✅ R2 (file storage + prompts + PDFs generados)
- ✅ Vercel AI Gateway (Gemini 2.5 Flash Lite)
- ✅ SCRIBE_HEAVY_API_URL (PDF generation service)
- ✅ URLs prefirmadas (7 días de validez)
