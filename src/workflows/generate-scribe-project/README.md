# Generate Scribe Project Workflow

## Overview

This Cloudflare Durable Workflow orchestrates the **Scribe Engine** — an AI-powered academic paper generation system. It implements a state machine that guides users through four distinct AI agents, each specialized for different aspects of document creation.

---

## File Structure

| File | Purpose |
| --- | --- |
| `index.ts` | Cloudflare Workflow entrypoint; extends `WorkflowEntrypoint` |
| `handler.ts` | Core state machine; executes agents based on project status |
| `types.ts` | TypeScript interfaces for workflow payload |
| `dependencies.ts` | DI factory; creates and wires up all services (AI, Prompt, Repository, Manifest, PDF) |

---

## Workflow Architecture

### State Machine Flow

```
draft
  ↓ (Architect Agent)
collecting_answers
  ↓ (user submits answers)
drafting/collecting_answers → reviewing (Ghostwriter Agent)
  ↓ (Supervisor Agent)
reviewing
  ├─→ typesetting (if approved)
  └─→ collecting_answers (if revision needed)
  ↓ (Typesetter Agent + Heavy API)
typesetting
  ↓
completed
```

---

## AI Agents & Prompts

All agents use AI models via Vercel AI Gateway.

| Agent | Prompt File | Input | Output |
| --- | --- | --- | --- |
| **Architect** | `scribe/prompt-01-architect.txt` | Rubric content | Form questions (JSON) |
| **Ghostwriter** | `scribe/prompt-02-ghostwriter.txt` | Rubric + User answers | Markdown document |
| **Supervisor** | `scribe/prompt-03-supervisor.txt` | Markdown + Rubric | JSON feedback (approved/revision) |
| **Typesetter** | `scribe/prompt-04-typesetter.txt` | Markdown content + Template Schema | Typst JSON (metadata, content, template_config) |

### Agent Selection Strategy

Each agent is **hardcoded** to a specific prompt template:
- Prompts are loaded from `env.ASSETS` (Cloudflare R2 bucket) via `AssetsPromptService`
- No dynamic selection logic — each step always executes the same agent based on project status
- Agents are **sequential and stateless** — each one processes the current project state independently

---

## Key Implementation Details

### Service Injection (dependencies.ts)

```typescript
const aiService = new ScribeAIService(aiGatewayApiKey, promptService)
const promptService = new AssetsPromptService(env.ASSETS)
const manifestService = new ScribeManifestService(scribeHeavyApiUrl, apiKey)
const pdfService = new ScribePdfService(scribeHeavyApiUrl, apiKey)
const scribeProjectRepository = new D1ScribeProjectRepository(db)
```

- **ScribeAIService**: Wraps Vercel AI Gateway for LLM calls with prompt template support
- **PromptService**: Loads prompt templates from R2 with template variable replacement (`{{RUBRIC}}`, `{{TEMPLATE_CONFIG_SCHEMA_JSON}}`, etc.)
- **ManifestService**: Fetches template configuration schemas from the Heavy API
- **PdfService**: Calls Heavy API to generate PDFs from Typst content
- **Repository**: Persists project state to D1 database

### Workflow Steps (handler.ts)

Each agent runs in a `step.do()` block — Cloudflare's retry mechanism ensures idempotency:

```typescript
const result = await step.do("architect-agent", async () => {
  // Fetch prompt, replace variables, call AI
  // Return parsed JSON or markdown
})

// Update project after agent completes
await step.do("update-after-architect", async () => {
  // Persist new state to database
})
```

### Typst PDF Generation (New Architecture)

The **Typesetter Agent** now produces structured JSON for the Heavy API:

1. **Fetch Manifest**: Get template config schema from `GET /v1/templates/{template_id}/manifest`
2. **Inject Schema**: Replace `{{TEMPLATE_CONFIG_SCHEMA_JSON}}` placeholder in prompt
3. **Generate JSON**: AI outputs `{ metadata, content, template_config }`
4. **Call Heavy API**: POST to `/v1/generate` with full payload
5. **Store Result**: Save R2 key and generate presigned URL

The `currentTypstJson` field stores the raw Typesetter output for debugging.

### User Feedback Loop

- After Ghostwriter generates content, **Supervisor** reviews it
- If revision needed: Supervisor returns JSON with new questions → status resets to `collecting_answers`
- If approved: Status moves to `typesetting` → Typesetter generates Typst JSON → Heavy API generates PDF → `completed`

---

## Statuses

| Status | Agent Running | Next Step |
| --- | --- | --- |
| `draft` | Architect | Poll until `collecting_answers` |
| `collecting_answers` | None (waiting for user) | User submits answers → Ghostwriter |
| `drafting` | Ghostwriter | Poll until `reviewing` |
| `reviewing` | Supervisor | Poll until `typesetting` or back to `collecting_answers` |
| `typesetting` | Typesetter + Heavy API | Poll until `completed` |
| `completed` | None | Document ready for download |

---

## Important Notes

- **Heavy API for PDF generation**: The workflow calls `SCRIBE_HEAVY_API_URL` for Typst-to-PDF conversion
- **Template-based generation**: Each project has a `templateId` (e.g., "apa", "ieee") that determines the output format
- **Dynamic schema injection**: Template config schemas are fetched at runtime and injected into the Typesetter prompt
- **Database-backed state machine**: Each project state persists in D1; workflow is idempotent
