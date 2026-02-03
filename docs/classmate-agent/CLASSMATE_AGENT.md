# ClassmateAgent Documentation

> **Status**: Production Ready (Chat Provisioning + Hard Gating)  
> **Version**: 3.0.0  
> **Last Updated**: December 2025

The ClassmateAgent is an AI-powered chat agent built on the Cloudflare Agents SDK with Vercel AI SDK integration. It provides a stateful, WebSocket-based conversational interface with mode-specific behavior, composable skills system, and Human-in-the-Loop (HITL) support for sensitive operations.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [File Structure](#file-structure)
3. [Core Concepts](#core-concepts)
4. [Skills System](#skills-system)
5. [Configuration](#configuration)
6. [Adding New Tools](#adding-new-tools)
7. [Adding New Skills](#adding-new-skills)
8. [Adding New Modes](#adding-new-modes)
9. [Human-in-the-Loop (HITL)](#human-in-the-loop-hitl)
10. [Client Integration](#client-integration)
11. [Development Guide](#development-guide)
12. [Pending Implementation](#pending-implementation)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Client (Web/Mobile)                       │
│                    useChat() from @ai-sdk/react                  │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          │ 1. POST /chats (provision chat)
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Hono HTTP Layer (Public API)                  │
│  • POST /chats - Create chat with quota enforcement              │
│  • GET /chats - List user's chats                                │
│  • GET /chats/:id/messages - Retrieve chat history              │
└─────────────────────────┬───────────────────────────────────────┘
                          │ Returns {chatId} (UUID)
                          │
                          │ 2. WebSocket to /agents/:name/:chatId
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Worker Entry Point (index.ts)                 │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ HARD GATE (before routeAgentRequest)                      │   │
│  │  1. Clerk Authentication                                  │   │
│  │  2. UUID Validation (INVALID_CHAT_ID if not UUID)        │   │
│  │  3. D1 Ownership Check (CHAT_FORBIDDEN if not owned)     │   │
│  └──────────────────────────────────────────────────────────┘   │
│                          │                                       │
│                          ▼                                       │
│                    routeAgentRequest()                           │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                ClassmateAgent (Durable Object)                   │
│                extends AIChatAgent<Env, State>                   │
│                                                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │  onConnect  │  │onChatMessage│  │   State     │              │
│  │             │  │             │  │  (SQLite)   │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
│                          │                                       │
│                          ▼                                       │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                    ModeManager                           │    │
│  │  • Composes skills into system prompts                   │    │
│  │  • Selects tools per mode                                │    │
│  │  • Configures model per mode                             │    │
│  └─────────────────────────────────────────────────────────┘    │
│                          │                                       │
│                          ▼                                       │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                   Vercel AI SDK                          │    │
│  │  streamText() → AI Gateway → LLM Provider                │    │
│  └─────────────────────────────────────────────────────────┘    │
│                          │                                       │
│                          │ 3. Periodic sync alarm                │
│                          ▼                                       │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  POST /internal/chats/sync (X-Internal-Key auth)        │    │
│  │  • Syncs messages to D1 in batches                       │    │
│  │  • Generates chat titles from first message              │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

### Key Technologies

| Component | Technology | Purpose |
|-----------|------------|---------|
| Agent Runtime | Cloudflare Agents SDK (`agents`) | Durable Object-based stateful agents |
| AI Orchestration | Vercel AI SDK (`ai@^6.0.0`) | Tool calling, streaming, message handling |
| State Persistence | Durable Object SQLite | Conversation history, agent state |
| Authentication | Clerk | User identity verification |
| Model Access | Cloudflare AI Gateway | Unified API for multiple LLM providers |

---

## File Structure

```
src/
├── infrastructure/
│   ├── agents/
│   │   └── classmate-agent.ts      # Main agent class
│   └── ai/
│       ├── shared.ts               # APPROVAL constants (shared with frontend)
│       ├── utils.ts                # processToolCalls, cleanupMessages
│       ├── config/
│       │   ├── modes.ts            # Mode configuration & ModeManager
│       │   └── skills.ts           # Skills registry & SkillLoader
│       └── tools/
│           ├── definitions.ts      # Types, interfaces, helpers
│           ├── class-tools.ts      # Class-related tools (mock)
│           ├── executions.ts       # HITL tool execution implementations
│           └── tool-registry.ts    # Mode-to-tools mapping
├── interfaces/
│   └── http/
│       └── routes/
│           └── chat.ts             # WebSocket route handler
└── index.ts                        # Agent export & route mounting

assets/
└── agents/
    └── classmate/
        └── skills/                 # Composable skill fragments
            ├── tools/              # Tool usage instructions
            │   ├── multi-tool-calling.txt
            │   ├── tool-confirmation.txt
            │   └── tool-error-handling.txt
            ├── personalities/      # Agent personality traits
            │   ├── base-personality.txt
            │   ├── serious-personality.txt
            │   └── supportive-personality.txt
            ├── knowledge/          # Domain knowledge
            │   ├── memory-palace.txt
            │   ├── pedagogy-fundamentals.txt
            │   └── active-recall.txt
            └── modes/              # Mode-specific behavior
                ├── mode-default.txt
                ├── mode-exam.txt
                ├── mode-study.txt
                └── mode-review.txt

wrangler.jsonc                      # Durable Object bindings
```

---

## Core Concepts

### Agent State

The agent maintains state in Durable Object SQLite storage:

```typescript
interface ClassmateAgentState {
  userId: string;           // Authenticated user ID from Clerk
  organizationId?: string;  // Optional organization context
  currentMode: AgentMode;   // Current operating mode
  currentContextId?: string;// Optional context (class, subject, etc.)
  createdAt: number;        // Timestamp of agent creation
  lastActiveAt: number;     // Last activity timestamp
  lastSyncedSequence: number; // Last message sequence synced to D1
}
```

### Chat Provisioning & Security

**Important**: Chats must be provisioned via `POST /chats` before connecting to the agent. This prevents unlimited Durable Object creation and enforces subscription-based quotas.

#### Tiered Chat Quotas

| Tier | Max Active Chats |
|------|------------------|
| Free | 50 |
| Pro | 500 |
| Premium | 2000 |

#### Hard Gating

All `/agents/*` traffic is validated before reaching the Durable Object:

1. **Clerk Authentication** - Valid session token required
2. **UUID Validation** - `conversationId` must be a valid UUID
3. **D1 Ownership Check** - Chat must exist, belong to user, and not be deleted

If any check fails, the connection is rejected with a `403` error and the Durable Object is **never created**.

#### Error Codes

| Code | HTTP | Meaning |
|------|------|---------|
| `CHAT_QUOTA_EXCEEDED` | 403 | User has reached tier chat limit |
| `CHAT_FORBIDDEN` | 403 | Chat doesn't exist or not owned |
| `INVALID_CHAT_ID` | 403 | conversationId is not a valid UUID |
| `UNAUTHORIZED` | 401 | Missing or invalid Clerk token |

### Modes

Modes define the agent's behavior, available tools, and composed skills:

| Mode | Purpose | Model | Skills |
|------|---------|-------|--------|
| `DEFAULT` | General academic assistant | gemini-3-flash | Base + Personality + Default Mode |
| `EXAM` | Exam preparation & practice | gemini-3-flash | Base + Serious + Active Recall + Exam Mode |
| `STUDY` | Deep learning & comprehension | gemini-3-flash | Base + Supportive + Pedagogy + Memory Palace + Study Mode |
| `REVIEW` | Quick review & summarization | gemini-2.5-flash-lite | Base + Active Recall + Review Mode |

### Tools

Tools are functions the AI can call to interact with the system:

| Tool | Category | HITL | Description |
|------|----------|------|-------------|
| `listClasses` | class | No | List user's classes |
| `getClass` | class | No | Get full class details |
| `createClass` | class | No | Create a class for a subject |
| `deleteClass` | class | **Yes** | Permanently delete a class |
| `updateClass` | class | **Yes** | Update class fields |
| `listTasks` | task | No | List tasks |
| `getTask` | task | No | Get full task details |
| `createTask` | task | No | Create a task for a subject |
| `deleteTask` | task | **Yes** | Permanently delete a task |
| `updateTask` | task | **Yes** | Update task fields |
| `createSubject` | subject | No | Create a subject within a term |
| `updateSubject` | subject | No | Update subject fields |

---

## Configuration

### Wrangler Configuration

The agent requires Durable Object bindings in `wrangler.jsonc`:

```jsonc
{
  "durable_objects": {
    "bindings": [
      {
        "name": "ClassmateAgent",
        "class_name": "ClassmateAgent"
      }
    ]
  },
  "migrations": [
    {
      "tag": "v1",
      "new_sqlite_classes": ["ClassmateAgent"]
    }
  ]
}
```

### Environment Bindings

Required bindings in `src/config/bindings.ts`:

```typescript
export type Bindings = {
  // ... other bindings
  AI_GATEWAY_API_KEY: SecretsStoreBinding;  // For LLM access
  ASSETS: Fetcher;                           // For loading skills
  ClassmateAgent: DurableObjectNamespace<ClassmateAgent>;
};
```

### Export Requirements

In `src/index.ts`, the agent must be exported:

```typescript
import { ClassmateAgent } from "./infrastructure/agents/classmate-agent";

// Export for Cloudflare Workers
export { ClassmateAgent };
```

---

## Skills System

Skills are composable prompt fragments that can be combined to create system prompts. This architecture allows for:
- **Reusability**: Share common behaviors across modes
- **Maintainability**: Update one skill file to affect all modes using it
- **Flexibility**: Easily customize modes by adding/removing skills

### Skill Categories

| Category | Purpose | Examples |
|----------|---------|----------|
| `tools` | Tool usage instructions | Multi-tool calling, error handling |
| `personalities` | Agent personality traits | Base, Serious, Supportive |
| `knowledge` | Domain expertise | Memory palace, pedagogy, active recall |
| `modes` | Mode-specific behavior | Default, Exam, Study, Review |

### Skill Compositions

Skills are composed hierarchically:

```typescript
// Base skills shared by ALL modes
const BASE_AGENT_SKILLS = [
  "multi-tool-calling",    // Parallel tool execution
  "tool-confirmation",     // HITL guidelines
  "tool-error-handling",   // Error communication
];

// Mode-specific compositions
const DEFAULT_MODE_SKILLS = [
  ...BASE_AGENT_SKILLS,
  "base-personality",
  "mode-default",
];

const EXAM_MODE_SKILLS = [
  ...BASE_AGENT_SKILLS,
  "base-personality",
  "serious-personality",
  "active-recall",
  "mode-exam",
];

const STUDY_MODE_SKILLS = [
  ...BASE_AGENT_SKILLS,
  "base-personality",
  "supportive-personality",
  "pedagogy-fundamentals",
  "memory-palace",
  "mode-study",
];

const REVIEW_MODE_SKILLS = [
  ...BASE_AGENT_SKILLS,
  "base-personality",
  "active-recall",
  "mode-review",
];
```

### Multi-Tool Calling

The `multi-tool-calling` skill enables efficient parallel tool execution:

```text
You can call multiple tools in a single response. If you intend to call 
multiple tools and there are no dependencies between them, make all 
independent tool calls in parallel. Maximize use of parallel tool calls 
where possible to increase efficiency.
```

This is powered by the Vercel AI SDK's native multi-tool capability, which:
1. Allows LLMs to return multiple tool calls in a single response
2. Executes independent tools concurrently via `Promise.all()`
3. Tracks each tool call by unique ID for proper result correlation

---

## Adding New Tools

### Step 1: Define Tool Metadata

In `src/infrastructure/ai/tools/definitions.ts`, add the tool name to the union type:

```typescript
export type ClassmateToolName =
  | "listClasses"
  | "getClass"
  | "createClass"
  | "deleteClass"
  | "updateClass"
  | "listTasks"
  | "getTask"
  | "createTask"
  | "deleteTask"
  | "updateTask"
  | "createSubject"
  | "updateSubject"
  | "newToolName";  // Add your tool
```

### Step 2: Create Tool Implementation

Create a new file or add to an existing category file (e.g., `class-tools.ts`):

```typescript
// src/infrastructure/ai/tools/my-tools.ts

import { tool } from "ai";
import { z } from "zod";
import { successResult, errorResult, type ToolMetadata } from "./definitions";

// 1. Define metadata
export const myNewToolMeta: ToolMetadata = {
  name: "myNewTool",
  description: "Description of what this tool does",
  requiresConfirmation: false,  // Set true for HITL
  category: "class",            // class | task | subject | profile | general
};

// 2. Create the tool
export const myNewTool = tool({
  description: myNewToolMeta.description,
  inputSchema: z.object({
    param1: z.string().describe("Description for the AI"),
    param2: z.number().optional().describe("Optional parameter"),
  }),
  // Include execute for automatic tools
  execute: async ({ param1, param2 }) => {
    try {
      // Your implementation here
      const result = await someService.doSomething(param1, param2);
      return successResult(result);
    } catch (error) {
      return errorResult(`Failed: ${error.message}`);
    }
  },
});

// 3. Export collection
export const myTools = {
  myNewTool,
};

export const myToolsMeta: ToolMetadata[] = [myNewToolMeta];
```

### Step 3: Register in Tool Registry

Update `src/infrastructure/ai/tools/tool-registry.ts`:

```typescript
import { myTools, myToolsMeta } from "./my-tools";

// Add to mode tool sets
const DEFAULT_TOOLS: ClassmateToolName[] = [
  // ... existing tools
  "myNewTool",
];

// Update getToolsForMode to include new tools
export function getToolsForMode(mode: AgentMode) {
  const toolNames = MODE_TOOLS_MAP[mode] || MODE_TOOLS_MAP.DEFAULT;
  
  const tools: Record<string, any> = {};
  
  for (const name of toolNames) {
    if (name in classTools) {
      tools[name] = classTools[name as keyof typeof classTools];
    }
    // Add new tool category
    if (name in myTools) {
      tools[name] = myTools[name as keyof typeof myTools];
    }
  }
  
  return tools;
}
```

### Step 4: Update Tool Metadata Registry

```typescript
// In tool-registry.ts, update metadata functions
export function getToolMetadataForMode(mode: AgentMode): ToolMetadata[] {
  const toolNames = MODE_TOOLS_MAP[mode] || MODE_TOOLS_MAP.DEFAULT;
  
  const allMeta = [...classToolsMeta, ...taskToolsMeta, ...subjectToolsMeta, ...myToolsMeta];  // Add new metadata
  
  return allMeta.filter((meta) =>
    toolNames.includes(meta.name as ClassmateToolName)
  );
}
```

---

## Adding New Skills

### Step 1: Create Skill File

Create a `.txt` file in the appropriate category folder:

```
assets/agents/classmate/skills/
├── tools/          # Tool usage instructions
├── personalities/  # Agent personality traits
├── knowledge/      # Domain expertise
└── modes/          # Mode-specific behavior
```

Example skill file `assets/agents/classmate/skills/knowledge/new-technique.txt`:

```text
## New Learning Technique

Description of the technique and when to apply it.

### How to Apply

1. Step one
2. Step two
3. Step three

### Best Practices

- Practice tip 1
- Practice tip 2
```

### Step 2: Register Skill in Registry

In `src/infrastructure/ai/config/skills.ts`:

```typescript
// 1. Add to SkillId union type
export type SkillId =
  | "multi-tool-calling"
  // ... existing skills
  | "new-technique";  // Add your skill

// 2. Add to SKILL_REGISTRY
export const SKILL_REGISTRY: Record<SkillId, SkillDefinition> = {
  // ... existing skills
  "new-technique": {
    id: "new-technique",
    category: "knowledge",
    name: "New Technique",
    description: "Description of the new technique",
    path: "skills/knowledge/new-technique.txt",
  },
};
```

### Step 3: Add to Mode Compositions (Optional)

If the skill should be included in specific modes:

```typescript
// In skills.ts
export const STUDY_MODE_SKILLS: SkillId[] = [
  ...BASE_AGENT_SKILLS,
  "base-personality",
  "supportive-personality",
  "new-technique",  // Add your skill
  "mode-study",
];
```

---

## Adding New Modes

### Step 1: Define Mode Type

In `src/infrastructure/ai/tools/definitions.ts`:

```typescript
export type AgentMode = "DEFAULT" | "EXAM" | "STUDY" | "REVIEW" | "NEWMODE";
```

### Step 2: Create Mode Skill File

Create `assets/agents/classmate/skills/modes/mode-newmode.txt`:

```text
## New Mode Behavior

You are in NEWMODE mode, specialized for [purpose].

### Mode Purpose

This mode is optimized for:
- [Specific use case 1]
- [Specific use case 2]

### Behavior Guidelines

1. [Guideline 1]
2. [Guideline 2]

### Response Style

- [Style instruction 1]
- [Style instruction 2]
```

### Step 3: Register Mode Skill

In `src/infrastructure/ai/config/skills.ts`:

```typescript
// Add to SkillId
export type SkillId = 
  // ... existing
  | "mode-newmode";

// Add to SKILL_REGISTRY
"mode-newmode": {
  id: "mode-newmode",
  category: "modes",
  name: "New Mode Behavior",
  description: "New mode specific behavior",
  path: "skills/modes/mode-newmode.txt",
},

// Create skill composition
export const NEWMODE_SKILLS: SkillId[] = [
  ...BASE_AGENT_SKILLS,
  "base-personality",
  // Add other skills as needed
  "mode-newmode",
];

// Add to MODE_SKILLS_MAP
export const MODE_SKILLS_MAP: Record<AgentMode, SkillId[]> = {
  // ... existing
  NEWMODE: NEWMODE_SKILLS,
};
```

### Step 4: Configure Mode

In `src/infrastructure/ai/config/modes.ts`:

```typescript
const MODE_CONFIGS: Record<AgentMode, ModeConfig> = {
  // ... existing modes
  NEWMODE: {
    mode: "NEWMODE",
    displayName: "New Mode Name",
    skills: MODE_SKILLS_MAP.NEWMODE,
    modelId: "google/gemini-3-flash",
    description: "Description of this mode's purpose",
  },
};
```

### Step 5: Define Mode Tools

In `src/infrastructure/ai/tools/tool-registry.ts`:

```typescript
const NEWMODE_TOOLS: ClassmateToolName[] = [
  "listClasses",
  "getClass",
  // Add tools appropriate for this mode
];

const MODE_TOOLS_MAP: Record<AgentMode, ClassmateToolName[]> = {
  // ... existing modes
  NEWMODE: NEWMODE_TOOLS,
};
```

---

## Human-in-the-Loop (HITL)

HITL tools require user confirmation before execution. This is essential for destructive operations like deleting data.

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. AI calls tool (no execute fn)  →  Tool call sent to client  │
│ 2. Client shows confirmation UI   →  User approves/denies      │
│ 3. Client sends addToolResult()   →  APPROVAL.YES or APPROVAL.NO│
│ 4. Server processToolCalls()      →  Executes if approved      │
│ 5. Result streamed back to client →  AI continues conversation │
└─────────────────────────────────────────────────────────────────┘
```

### Creating a HITL Tool

The key is to **omit the `execute` function**:

```typescript
// src/infrastructure/ai/tools/class-tools.ts
export const dangerousActionTool = tool({
  description: "Perform a dangerous action that requires confirmation",
  inputSchema: z.object({
    targetId: z.string().describe("ID of the item to affect"),
    reason: z.string().optional().describe("Reason for this action"),
  }),
  // NO execute function = HITL tool
  // The stream will pause, waiting for client approval
});
```

### Add Server-Side Execution

Add the actual execution logic in `executions.ts`:

```typescript
// src/infrastructure/ai/tools/executions.ts
import type { ToolExecutions } from "../utils";

export const executions: ToolExecutions = {
  dangerousAction: async ({ targetId, reason }) => {
    // Actual implementation runs AFTER user approval
    const result = await repository.delete(targetId);
    return { success: true, deletedId: targetId };
  },
};
```

### Client-Side Handling

The client receives tool calls and must approve them using the shared APPROVAL constants:

```typescript
import { APPROVAL } from "@/shared"; // Must match server's shared.ts

// When user approves
const handleApprove = (toolCallId: string) => {
  addToolResult({
    toolCallId,
    result: APPROVAL.YES,  // "Yes, confirmed."
  });
};

// When user denies
const handleDeny = (toolCallId: string) => {
  addToolResult({
    toolCallId,
    result: APPROVAL.NO,   // "No, denied."
  });
};
```

### Server-Side Processing

The agent automatically processes approvals via `processToolCalls()`:

```typescript
// In classmate-agent.ts onChatMessage()
const cleanedMessages = cleanupMessages(this.messages);
const processedMessages = await processToolCalls({
  messages: cleanedMessages,
  dataStream: writer,
  tools: config.tools,
  executions,  // From tools/executions.ts
});
```

### Metadata Configuration

Mark tools requiring confirmation in metadata:

```typescript
export const deleteClassMeta: ToolMetadata = {
  name: "deleteClass",
  description: "Permanently delete a class",
  requiresConfirmation: true,  // <-- Important flag
  category: "class",
};
```

---

## Client Integration

### WebSocket Connection

Connect to the agent via WebSocket:

```
wss://api.classmate.studio/agents/classmate-agent/{conversationId}
```

The `conversationId` is used to:
- Resume existing conversations
- Create new conversation instances
- Isolate state between conversations

### Using @ai-sdk/react

```typescript
import { useChat } from "@ai-sdk/react";

function ChatComponent() {
  const { 
    messages, 
    input, 
    handleInputChange, 
    handleSubmit,
    addToolResult 
  } = useChat({
    api: "/agents/classmate-agent/conv-123",
    // Send mode in message metadata
    body: {
      metadata: {
        mode: "STUDY",
        contextId: "class-abc",
        contextType: "class",
      },
    },
  });

  return (
    <form onSubmit={handleSubmit}>
      {messages.map((m) => (
        <div key={m.id}>
          {m.role}: {m.content}
          {/* Handle tool calls for HITL */}
          {m.toolInvocations?.map((tool) => (
            <ToolApproval 
              key={tool.toolCallId}
              tool={tool}
              onApprove={(result) => addToolResult({
                toolCallId: tool.toolCallId,
                result: JSON.stringify(result),
              })}
            />
          ))}
        </div>
      ))}
      <input value={input} onChange={handleInputChange} />
      <button type="submit">Send</button>
    </form>
  );
}
```

### Message Metadata

Send mode and context information with each message:

```typescript
interface ChatMessageMetadata {
  mode?: "DEFAULT" | "EXAM" | "STUDY" | "REVIEW";
  contextId?: string;      // e.g., class ID being discussed
  contextType?: "class" | "subject" | "task";
}
```

---

## Development Guide

### Running Locally

```bash
# Start development server
bun run dev

# Generate types after wrangler.jsonc changes
bun run cf-typegen

# Run tests
bun run test

# Lint and format
bun run check
```

### Testing the Agent

1. Start the dev server: `bun run dev`
2. Connect via WebSocket client or test with curl:

```bash
# The agent uses WebSocket, test with wscat or similar
wscat -c "ws://localhost:8787/agents/classmate-agent/test-conv"
```

### Debugging

Enable console logging in the agent:

```typescript
console.log(`[ClassmateAgent] Connected: userId=${userId}`);
console.log(`[TOOL] myTool called with:`, params);
```

View logs in the Wrangler dev console.

### Adding Repository Dependencies

To inject actual repositories into tools:

```typescript
// In definitions.ts, expand ToolExecutionContext
export interface ToolExecutionContext {
  userId: string;
  contextId?: string;
  mode: string;
  // Add repository injections
  classRepository?: ClassRepository;
  taskRepository?: TaskRepository;
}
```

Then pass context to tools in the agent's `onChatMessage`.

---

## Pending Implementation

The following items are planned but not yet implemented:

### High Priority

- [ ] **Real Tool Implementations**: Replace mock tools with actual repository calls
- [ ] **Tool Context Injection**: Pass repositories to tool execute functions
- [ ] **Error Handling**: Comprehensive error boundaries and user-friendly messages

### Medium Priority

- [x] ~~**Conversation History API**~~: ✅ Implemented (`GET /chats`, `GET /chats/:id/messages`)
- [x] ~~**Chat Provisioning**~~: ✅ Implemented with tiered quotas
- [x] ~~**Hard Gating**~~: ✅ D1 ownership checks before DO access
- [ ] **Mode Switching UI**: Client-side mode selector integration
- [ ] **Tool Result Caching**: Cache frequently accessed data
- [ ] **Streaming Progress**: Show tool execution progress to users

### Low Priority

- [ ] **Analytics Integration**: Track tool usage and conversation metrics
- [ ] **Multi-language Support**: Localized system prompts
- [ ] **Custom Model Selection**: User-configurable model preferences
- [ ] **Conversation Export**: Export chat history as PDF/markdown

### Recently Completed (v3.0.0)

- [x] **Chat Provisioning System**: Server-side chat creation with UUID-only IDs
- [x] **Tiered Quotas**: Subscription-based limits (free=50, pro=500, premium=2000)
- [x] **Hard Agent Gating**: D1 ownership validation before DO creation
- [x] **Public Chat API**: Full CRUD endpoints for chat management
- [x] **Internal Sync Endpoint**: Secure DO → Worker message synchronization
- [x] **Message History**: REST endpoints to retrieve past conversations

---

## API Reference

### Agent Class

```typescript
class ClassmateAgent extends AIChatAgent<Env, ClassmateAgentState> {
  // Lifecycle
  onConnect(connection: Connection, ctx: ConnectionContext): Promise<void>
  onChatMessage(onFinish: any, options?: { abortSignal?: AbortSignal }): Promise<Response>
  
  // State
  state: ClassmateAgentState
  setState(newState: Partial<ClassmateAgentState>): void
  
  // Messages (inherited)
  messages: UIMessage[]
}
```

### ModeManager

```typescript
class ModeManager {
  getConfiguration(mode: AgentMode): Promise<LoadedModeConfiguration>
  getModeConfig(mode: AgentMode): ModeConfig
  getAvailableModes(): ModeConfig[]
  isValidMode(mode: string): mode is AgentMode
  clearCache(): void
}
```

### Tool Registry Functions

```typescript
function getToolsForMode(mode: AgentMode): Record<string, Tool>
function getToolMetadataForMode(mode: AgentMode): ToolMetadata[]
function getToolsRequiringConfirmationForMode(mode: AgentMode): string[]
function toolRequiresConfirmation(toolName: string): boolean
function getAllToolNames(): ClassmateToolName[]
```

---

## Troubleshooting

### "Services failed to initialize"

**Cause**: AI Gateway API key not configured.  
**Fix**: Ensure `AI_GATEWAY_API_KEY` is set in `.dev.vars` or Cloudflare secrets.

### WebSocket Connection Rejected

**Cause**: Missing or invalid Clerk authentication.  
**Fix**: Ensure the client sends valid Clerk session token in headers.

### Tool Not Executing

**Cause**: Tool may be a HITL tool requiring approval.  
**Fix**: Check if `requiresConfirmation: true` in metadata. Client must call `addToolResult`.

### Mode Not Changing

**Cause**: Mode not sent in message metadata.  
**Fix**: Include `metadata: { mode: "EXAM" }` in the chat request body.

---

## Further Reading

- [Cloudflare Agents SDK](https://developers.cloudflare.com/agents/)
- [Vercel AI SDK Documentation](https://sdk.vercel.ai/docs)
- [Durable Objects Guide](https://developers.cloudflare.com/durable-objects/)
- [Clerk Authentication](https://clerk.com/docs)
