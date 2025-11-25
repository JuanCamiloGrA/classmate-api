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
| `dependencies.ts` | DI factory; creates and wires up all services (AI, Prompt, Repository) |

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
  ↓ (Typesetter Agent)
typesetting
  ↓
completed
```

---

## AI Agents & Prompts

All agents use **Google Gemini 2.5 Flash Lite** via Vercel AI Gateway (`google/gemini-2.5-flash-lite`).

| Agent | Prompt File | Input | Output |
| --- | --- | --- | --- |
| **Architect** | `scribe/prompt-01-architect.txt` | Rubric content | Form questions (JSON) |
| **Ghostwriter** | `scribe/prompt-02-ghostwriter.txt` | Rubric + User answers | Markdown document |
| **Supervisor** | `scribe/prompt-03-supervisor.txt` | Markdown + Rubric | JSON feedback (approved/revision) |
| **Typesetter** | `scribe/prompt-04-typesetter.txt` | Markdown content | LaTeX code |

### Agent Selection Strategy

Each agent is **hardcoded** to a specific prompt template:
- Prompts are loaded from `env.ASSETS` (Cloudflare R2 bucket) via `AssetsPromptService`
- No dynamic selection logic — each step always executes the same agent based on project status
- Agents are **sequential and stateless** — each one processes the current project state independently

---

## Key Implementation Details

### Service Injection (dependencies.ts)

```typescript
const aiService = new VercelAIService(aiGatewayApiKey)
const promptService = new AssetsPromptService(env.ASSETS)
const scribeProjectRepository = new D1ScribeProjectRepository(db)
```

- **AIService**: Wraps Vercel AI Gateway for LLM calls
- **PromptService**: Loads prompt templates from R2 with template variable replacement (`{{RUBRIC}}`, `{{CONTENT}}`, etc.)
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

### LaTeX Generation

- The **Typesetter Agent** converts Markdown to LaTeX code (stored in `currentLatex` field)
- **No PDF generation occurs in this workflow** — LaTeX is returned as-is for the client to render
- The workflow never calls `PROCESSING_SERVICE_URL` (that's used only for audio processing in other workflows)

### User Feedback Loop

- After Ghostwriter generates content, **Supervisor** reviews it
- If revision needed: Supervisor returns JSON with new questions → status resets to `collecting_answers` with `userAnswers: null` (forces user to re-answer)
- If approved: Status moves to `typesetting` → Typesetter generates LaTeX → `completed`

---

## Statuses

| Status | Agent Running | Next Step |
| --- | --- | --- |
| `draft` | Architect | Poll until `collecting_answers` |
| `collecting_answers` | None (waiting for user) | User submits answers → Ghostwriter |
| `drafting` | Ghostwriter | Poll until `reviewing` |
| `reviewing` | Supervisor | Poll until `typesetting` or back to `collecting_answers` |
| `typesetting` | Typesetter | Poll until `completed` |
| `completed` | None | Document ready for download |

---

## Important Notes

- **No external heavy services called**: The workflow uses only Vercel AI Gateway (LLM inference)
- **No PDF generation**: LaTeX is generated but not converted to PDF
- **All AI calls use Gemini 2.5 Flash Lite**: Cost-optimized, no model selection logic
- **Database-backed state machine**: Each project state persists in D1; workflow is idempotent
