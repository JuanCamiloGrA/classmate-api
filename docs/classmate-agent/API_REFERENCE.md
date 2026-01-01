# ClassmateAgent API Reference

> **For**: Frontend/Client Developers  
> **Version**: 5.0.0  
> **Last Updated**: December 2025

This reference documents how to integrate the ClassmateAgent into your frontend application using the official Cloudflare Agents SDK.

## ⚠️ Breaking Change (v5.0.0)

**Chats must now be provisioned before connecting to the agent.**

The agent no longer auto-creates chats. You must call `POST /chats` to provision a chat ID, then use that ID when connecting to the agent. This prevents unlimited Durable Object creation and enforces subscription-based quotas.

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Installation](#installation)
3. [Chat Provisioning](#chat-provisioning)
4. [Authentication (Clerk)](#authentication-clerk)
5. [Connection](#connection)
6. [Sending Messages](#sending-messages)
7. [Tool Calls & HITL](#tool-calls--hitl)
8. [Modes](#modes)
9. [Error Handling](#error-handling)
10. [Full Example](#full-example)

---

## Quick Start

```tsx
import { useState, useCallback, useEffect } from "react";
import { useAgent } from "agents/react";
import { useAgentChat } from "@cloudflare/ai-chat/react";
import { isStaticToolUIPart } from "ai";
import { useAuth } from "@clerk/nextjs"; // or @clerk/clerk-react
import type { UIMessage } from "@ai-sdk/react";

// Tools requiring human confirmation (must match backend)
const toolsRequiringConfirmation = ["removeClass"];

// Approval constants (must match backend shared.ts)
const APPROVAL = {
  YES: "Yes, confirmed.",
  NO: "No, denied."
} as const;

export default function Chat() {
  const [input, setInput] = useState("");
  const [chatId, setChatId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { getToken } = useAuth();

  // 1. Provision a chat before connecting
  useEffect(() => {
    async function provisionChat() {
      try {
        const token = await getToken();
        const response = await fetch("https://api.classmate.studio/chats", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            title: null,
            context_type: null,
            context_id: null
          })
        });

        if (!response.ok) {
          const data = await response.json();
          if (data.code === "CHAT_QUOTA_EXCEEDED") {
            setError(`Chat limit reached: ${data.max_allowed} chats allowed on ${data.tier} tier`);
            return;
          }
          throw new Error(`Failed to create chat: ${response.status}`);
        }

        const data = await response.json();
        setChatId(data.result.id);
      } catch (err) {
        console.error("Failed to provision chat:", err);
        setError("Failed to create chat. Please try again.");
      }
    }

    provisionChat();
  }, [getToken]);

  // 2. Create async query function for authentication
  const getAuthQuery = useCallback(async () => {
    const token = await getToken();
    return {
      _clerk_session_token: token || ""
    };
  }, [getToken]);

  // 3. Connect to the agent with the provisioned chatId
  const agent = useAgent({
    agent: "classmate-agent",
    host: "https://api.classmate.studio",
    name: chatId || undefined, // Use provisioned chat ID
    query: getAuthQuery
  });

  // 4. Use the chat hook
  const {
    messages,
    sendMessage,
    addToolResult,
    clearHistory,
    status,
    stop
  } = useAgentChat<unknown, UIMessage<{ createdAt: string }>>({
    agent
  });

  // 5. Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !chatId) return;

    const message = input;
    setInput("");

    await sendMessage({
      role: "user",
      parts: [{ type: "text", text: message }]
    });
  };

  // Show error if chat provisioning failed
  if (error) {
    return <div className="error">{error}</div>;
  }

  // Show loading while provisioning chat
  if (!chatId) {
    return <div>Creating chat...</div>;
  }

  return (
    <div>
      {/* Messages */}
      {messages.map((m) => (
        <div key={m.id}>
          <strong>{m.role}:</strong>
          {m.parts?.map((part, i) => {
            if (part.type === "text") {
              return <p key={i}>{part.text}</p>;
            }

            // Handle tool calls
            if (isStaticToolUIPart(part)) {
              const toolName = part.type.replace("tool-", "");
              const needsConfirmation = toolsRequiringConfirmation.includes(toolName);

              return (
                <div key={i}>
                  <span>Tool: {toolName}</span>

                  {/* Show confirmation UI for HITL tools */}
                  {part.state === "input-available" && needsConfirmation && (
                    <div>
                      <pre>{JSON.stringify(part.input, null, 2)}</pre>
                      <button
                        onClick={() =>
                          addToolResult({
                            tool: toolName,
                            toolCallId: part.toolCallId,
                            output: APPROVAL.YES
                          })
                        }
                      >
                        Approve
                      </button>
                      <button
                        onClick={() =>
                          addToolResult({
                            tool: toolName,
                            toolCallId: part.toolCallId,
                            output: APPROVAL.NO
                          })
                        }
                      >
                        Deny
                      </button>
                    </div>
                  )}

                  {/* Show output when available */}
                  {part.state === "output-available" && part.output && (
                    <pre>{JSON.stringify(part.output, null, 2)}</pre>
                  )}
                </div>
              );
            }

            return null;
          })}
        </div>
      ))}

      {/* Input form */}
      <form onSubmit={handleSubmit}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask your classmate..."
        />
        {status === "streaming" ? (
          <button type="button" onClick={stop}>Stop</button>
        ) : (
          <button type="submit" disabled={!input.trim()}>Send</button>
        )}
      </form>

      <button onClick={clearHistory}>Clear History</button>
    </div>
  );
}
```

---

## Installation

```bash
npm install agents @cloudflare/ai-chat ai @ai-sdk/react
```

| Package | Purpose |
|---------|---------|
| `agents` | `useAgent` hook for WebSocket connection |
| `@cloudflare/ai-chat` | `useAgentChat` hook for chat functionality |
| `ai` | Utilities like `isStaticToolUIPart` |
| `@ai-sdk/react` | TypeScript types (`UIMessage`) |

---

## Chat Provisioning

**⚠️ Required Step**: Before connecting to the agent, you must provision a chat via the REST API.

### Why Provisioning is Required

- **Security**: Prevents unlimited Durable Object creation
- **Quotas**: Enforces subscription-based chat limits (free=50, pro=500, premium=2000)
- **Ownership**: Ensures only the chat owner can connect to the agent

### Creating a Chat

```tsx
async function createChat(token: string, options?: {
  title?: string | null;
  contextType?: "global" | "subject" | "task" | "pdf";
  contextId?: string;
}) {
  const response = await fetch("https://api.classmate.studio/chats", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      title: options?.title ?? null,
      context_type: options?.contextType ?? null,
      context_id: options?.contextId ?? null
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.code || "Failed to create chat");
  }

  const data = await response.json();
  return data.result.id; // Returns UUID
}
```

### Handling Quota Errors

```tsx
try {
  const chatId = await createChat(token);
  // Use chatId to connect to agent
} catch (error) {
  if (error.message === "CHAT_QUOTA_EXCEEDED") {
    // Show upgrade prompt to user
    showUpgradeDialog();
  } else if (error.message === "UNAUTHORIZED") {
    // Re-authenticate user
    redirectToLogin();
  } else {
    // Generic error handling
    showError("Failed to create chat");
  }
}
```

### Listing Existing Chats

Instead of always creating a new chat, you can list existing chats and reuse them:

```tsx
async function listChats(token: string) {
  const response = await fetch("https://api.classmate.studio/chats?limit=20&offset=0", {
    headers: {
      "Authorization": `Bearer ${token}`
    }
  });

  const data = await response.json();
  return data.result.data; // Array of chat objects
}
```

### Full Provisioning Flow

```tsx
// 1. Check if user has existing chats
const existingChats = await listChats(token);

let chatId: string;

if (existingChats.length > 0) {
  // 2a. Reuse existing chat
  chatId = existingChats[0].id;
} else {
  // 2b. Create new chat
  chatId = await createChat(token);
}

// 3. Connect to agent with provisioned chatId
const agent = useAgent({
  agent: "classmate-agent",
  host: "https://api.classmate.studio",
  name: chatId,
  query: getAuthQuery
});
```

---

## Authentication (Clerk)

The ClassmateAgent requires Clerk authentication. Since WebSockets cannot use standard HTTP headers for auth, **you must pass the Clerk token via query parameters**.

### How It Works

1. Frontend gets a fresh Clerk token using `getToken()`
2. Token is passed to `useAgent` via the `query` option
3. Backend extracts and verifies the token from `_clerk_session_token` query param
4. User identity (userId, orgId) is injected into the agent connection

### Using Async Query (Recommended)

The `query` option accepts an **async function** that fetches fresh tokens automatically:

```tsx
import { useAuth } from "@clerk/nextjs";
import { useCallback } from "react";

function ChatComponent() {
  const { getToken } = useAuth();

  // Async function that fetches fresh token
  const getAuthQuery = useCallback(async () => {
    const token = await getToken();
    return {
      _clerk_session_token: token || ""
    };
  }, [getToken]);

  const agent = useAgent({
    agent: "classmate-agent",
    host: "https://api.classmate.studio",
    query: getAuthQuery // Async function - automatically handles token refresh
  });

  // ...
}
```

### Using Static Token (Alternative)

For simpler cases, you can pass a static token object (but you'll need to handle refresh manually):

```tsx
import { useAuth } from "@clerk/nextjs";
import { useState, useEffect } from "react";

function ChatComponent() {
  const { getToken } = useAuth();
  const [token, setToken] = useState<string | null>(null);

  // Get initial token
  useEffect(() => {
    getToken().then(setToken);
  }, [getToken]);

  const agent = useAgent({
    agent: "classmate-agent",
    host: "https://api.classmate.studio",
    query: token ? { _clerk_session_token: token } : undefined
  });

  // Note: Connection will reconnect when token changes
}
```

### Important Notes

- The query param must be `_clerk_session_token` (this is what the backend expects)
- Always use `https://` for production (not `wss://` - the SDK handles protocol selection)
- The async query function is called when establishing the connection
- If the token is invalid/expired, you'll receive a 401 error

---

## Connection

### useAgent Hook

Connect to the ClassmateAgent Durable Object:

```tsx
import { useAgent } from "agents/react";

// Basic connection (same-origin, with auth via query)
const agent = useAgent({
  agent: "classmate-agent",
  query: getAuthQuery
});

// Cross-origin connection (different domain)
const agent = useAgent({
  agent: "classmate-agent",
  host: "https://api.classmate.studio",
  query: getAuthQuery
});

// Resume existing conversation (must be provisioned via POST /chats first)
const agent = useAgent({
  agent: "classmate-agent",
  host: "https://api.classmate.studio",
  name: "existing-chat-uuid", // Must be a UUID from POST /chats
  query: getAuthQuery
});
```

| Option | Type | Description |
|--------|------|-------------|
| `agent` | `string` | Agent name (must match `wrangler.jsonc`) |
| `host` | `string?` | API host URL for cross-origin connections |
| `name` | `string?` | **Chat UUID from POST /chats (required for v5.0+)** |
| `query` | `object \| (() => Promise<object>)` | Query params for auth token |
| `onOpen` | `() => void` | Called when connection opens |
| `onClose` | `() => void` | Called when connection closes |
| `onError` | `(error: Event) => void` | Called on connection error |
| `onMessage` | `(message: MessageEvent) => void` | Called on raw message |

**Important Notes:**

- The `name` parameter must be a UUID obtained from `POST /chats`
- If `name` is omitted or invalid, the connection will be rejected with a `403` error
- The chat must be owned by the authenticated user
- The chat must not be soft-deleted

### useAgentChat Hook

Handle chat state and messaging:

```tsx
import { useAgentChat } from "@cloudflare/ai-chat/react";
import type { UIMessage } from "@ai-sdk/react";

const {
  messages,      // Array of UIMessage
  sendMessage,   // Send a new message
  addToolResult, // Respond to HITL tool calls
  clearHistory,  // Clear conversation
  status,        // 'ready' | 'submitted' | 'streaming'
  stop           // Stop streaming response
} = useAgentChat<unknown, UIMessage<{ createdAt: string }>>({
  agent
});
```

---

## Sending Messages

### Basic Message

```tsx
await sendMessage({
  role: "user",
  parts: [{ type: "text", text: "What topics are in my Biology class?" }]
});
```

### Message with Extra Data

Pass mode, context, or custom annotations via `body`:

```tsx
await sendMessage(
  {
    role: "user",
    parts: [{ type: "text", text: "Quiz me on photosynthesis" }]
  },
  {
    body: {
      mode: "EXAM",
      contextId: "class-abc123",
      contextType: "class",
      annotations: {
        source: "mobile-app"
      }
    }
  }
);
```

---

## Tool Calls & HITL

### Detecting Tool Parts

Use `isStaticToolUIPart` from the `ai` package:

```tsx
import { isStaticToolUIPart } from "ai";

{m.parts?.map((part, i) => {
  if (isStaticToolUIPart(part)) {
    const toolName = part.type.replace("tool-", "");
    // Handle tool display...
  }
})}
```

### Tool States

| State | Description |
|-------|-------------|
| `input-streaming` | Tool input being generated |
| `input-available` | Ready for execution or awaiting approval |
| `output-available` | Completed (check `output` or `errorText`) |

### Human-in-the-Loop (HITL)

Some tools require user approval before execution. Define which tools need confirmation:

```tsx
// Must match tools without execute() on the backend
const toolsRequiringConfirmation = ["removeClass", "deleteTask"];
```

Handle approval with `addToolResult`:

```tsx
// Approval constants (must match backend)
const APPROVAL = {
  YES: "Yes, confirmed.",
  NO: "No, denied."
} as const;

// Check if pending confirmation
const pendingConfirmation = messages.some((m) =>
  m.parts?.some(
    (part) =>
      isStaticToolUIPart(part) &&
      part.state === "input-available" &&
      toolsRequiringConfirmation.includes(part.type.replace("tool-", ""))
  )
);

// Approve tool execution
addToolResult({
  tool: toolName,
  toolCallId: part.toolCallId,
  output: APPROVAL.YES
});

// Deny tool execution
addToolResult({
  tool: toolName,
  toolCallId: part.toolCallId,
  output: APPROVAL.NO
});
```

---

## Modes

The agent operates in different modes affecting behavior and tools.

| Mode | Purpose |
|------|---------|
| `DEFAULT` | General academic assistant |
| `EXAM` | Exam preparation, active recall |
| `STUDY` | Deep learning, detailed explanations |
| `REVIEW` | Quick review, concise summaries |

Set mode per-message via `body`:

```tsx
await sendMessage(
  {
    role: "user",
    parts: [{ type: "text", text: "Quiz me on chapter 5" }]
  },
  {
    body: { mode: "EXAM" }
  }
);
```

---

## Error Handling

### Error Codes

The agent API returns specific error codes for different failure scenarios:

| Code | HTTP | Description | Action |
|------|------|-------------|--------|
| `CHAT_QUOTA_EXCEEDED` | 403 | User has reached their tier's chat limit | Show upgrade prompt |
| `CHAT_FORBIDDEN` | 403 | Chat doesn't exist or not owned by user | Create new chat or check authentication |
| `INVALID_CHAT_ID` | 403 | Chat ID is not a valid UUID | Use ID from `POST /chats` |
| `UNAUTHORIZED` | 401 | Missing or invalid Clerk token | Re-authenticate user |

### Handling Chat Creation Errors

```tsx
async function createChatWithErrorHandling(token: string) {
  try {
    const response = await fetch("https://api.classmate.studio/chats", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ title: null })
    });

    if (!response.ok) {
      const error = await response.json();
      
      switch (error.code) {
        case "CHAT_QUOTA_EXCEEDED":
          return {
            success: false,
            error: "quota",
            message: `You've reached your limit of ${error.max_allowed} chats`,
            tier: error.tier,
            upgradeRequired: true
          };
        
        case "UNAUTHORIZED":
          return {
            success: false,
            error: "auth",
            message: "Please sign in again",
            reauthRequired: true
          };
        
        default:
          return {
            success: false,
            error: "unknown",
            message: error.error || "Failed to create chat"
          };
      }
    }

    const data = await response.json();
    return {
      success: true,
      chatId: data.result.id
    };
  } catch (err) {
    return {
      success: false,
      error: "network",
      message: "Network error. Please check your connection."
    };
  }
}
```

### Handling Connection Errors

```tsx
const agent = useAgent({
  agent: "classmate-agent",
  host: "https://api.classmate.studio",
  name: chatId,
  query: getAuthQuery,
  onError: (error) => {
    console.error("Agent connection error:", error);
    // Connection rejected (likely 403 CHAT_FORBIDDEN or INVALID_CHAT_ID)
    showError("Failed to connect. Please create a new chat.");
  },
  onClose: () => {
    // Connection closed (could be normal or due to error)
    console.log("Connection closed");
  }
});
```

### React Error Boundary Example

```tsx
import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

class ChatErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error("Chat error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="error-container">
          <h2>Chat Error</h2>
          <p>{this.state.error?.message || "Something went wrong"}</p>
          <button onClick={() => this.setState({ hasError: false })}>
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// Usage
<ChatErrorBoundary>
  <ClassmateChat chatId={chatId} />
</ChatErrorBoundary>
```

---

## Full Example

Complete production-ready chat component with Clerk authentication:

```tsx
import { useState, useEffect, useRef, useCallback } from "react";
import { useAgent } from "agents/react";
import { useAgentChat } from "@cloudflare/ai-chat/react";
import { isStaticToolUIPart } from "ai";
import { useAuth, useUser } from "@clerk/nextjs"; // or @clerk/clerk-react
import type { UIMessage } from "@ai-sdk/react";

// Configuration
const API_HOST = process.env.NEXT_PUBLIC_API_URL || "https://api.classmate.studio";
const toolsRequiringConfirmation = ["removeClass", "deleteTask"];
const APPROVAL = {
  YES: "Yes, confirmed.",
  NO: "No, denied."
} as const;

type AgentMode = "DEFAULT" | "EXAM" | "STUDY" | "REVIEW";

interface ClassmateChatProps {
  existingChatId?: string; // Optional: reuse existing chat
  defaultMode?: AgentMode;
  contextId?: string;
  contextType?: "class" | "subject" | "task";
}

export function ClassmateChat({
  existingChatId,
  defaultMode = "DEFAULT",
  contextId,
  contextType
}: ClassmateChatProps) {
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<AgentMode>(defaultMode);
  const [chatId, setChatId] = useState<string | null>(existingChatId || null);
  const [chatError, setChatError] = useState<string | null>(null);
  const [isProvisioning, setIsProvisioning] = useState(!existingChatId);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Clerk authentication
  const { getToken, isSignedIn } = useAuth();
  const { user } = useUser();

  // Provision chat if not using existing one
  useEffect(() => {
    if (existingChatId || !isSignedIn) return;

    async function provisionChat() {
      setIsProvisioning(true);
      setChatError(null);

      try {
        const token = await getToken();
        const response = await fetch(`${API_HOST}/chats`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            title: null,
            context_type: contextType || null,
            context_id: contextId || null
          })
        });

        if (!response.ok) {
          const error = await response.json();
          if (error.code === "CHAT_QUOTA_EXCEEDED") {
            setChatError(
              `Chat limit reached: ${error.max_allowed} chats allowed on ${error.tier} tier. Please upgrade or delete old chats.`
            );
          } else {
            setChatError(error.error || "Failed to create chat");
          }
          return;
        }

        const data = await response.json();
        setChatId(data.result.id);
      } catch (err) {
        console.error("Chat provisioning error:", err);
        setChatError("Network error. Please check your connection.");
      } finally {
        setIsProvisioning(false);
      }
    }

    provisionChat();
  }, [existingChatId, isSignedIn, getToken, contextType, contextId]);

  // Async query function for authentication
  const getAuthQuery = useCallback(async () => {
    const token = await getToken();
    if (!token) {
      console.error("No auth token available");
      return {};
    }
    return {
      _clerk_session_token: token
    };
  }, [getToken]);

  // Connect to agent with provisioned chatId
  const agent = useAgent({
    agent: "classmate-agent",
    host: API_HOST,
    name: chatId || undefined, // Only connect if chat is provisioned
    query: getAuthQuery,
    onOpen: () => console.log("Connected to Classmate Agent"),
    onClose: () => console.log("Disconnected from Classmate Agent"),
    onError: (error) => {
      console.error("Agent connection error:", error);
      setChatError("Connection failed. The chat may have been deleted.");
    }
  });

  // Chat state
  const {
    messages,
    sendMessage,
    addToolResult,
    clearHistory,
    status,
    stop
  } = useAgentChat<unknown, UIMessage<{ createdAt: string }>>({
    agent
  });

  // Auto-scroll
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    if (messages.length > 0) scrollToBottom();
  }, [messages, scrollToBottom]);

  // Check for pending HITL confirmations
  const pendingConfirmation = messages.some((m) =>
    m.parts?.some(
      (part) =>
        isStaticToolUIPart(part) &&
        part.state === "input-available" &&
        toolsRequiringConfirmation.includes(part.type.replace("tool-", ""))
    )
  );

  // Submit handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || pendingConfirmation) return;

    const message = input;
    setInput("");

    await sendMessage(
      {
        role: "user",
        parts: [{ type: "text", text: message }]
      },
      {
        body: {
          mode,
          contextId,
          contextType
        }
      }
    );
  };

  // Tool confirmation handler
  const handleToolConfirmation = (
    toolName: string,
    toolCallId: string,
    approved: boolean
  ) => {
    addToolResult({
      tool: toolName,
      toolCallId,
      output: approved ? APPROVAL.YES : APPROVAL.NO
    });
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  // Show login prompt if not authenticated
  if (!isSignedIn) {
    return (
      <div className="flex items-center justify-center h-full">
        <p>Please sign in to use the Classmate AI assistant.</p>
      </div>
    );
  }

  // Show error if chat provisioning failed
  if (chatError) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4">
        <div className="max-w-md text-center">
          <h3 className="text-lg font-semibold mb-2">Chat Error</h3>
          <p className="text-gray-600 mb-4">{chatError}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-500 text-white rounded"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // Show loading while provisioning
  if (isProvisioning || !chatId) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
          <p>Creating chat...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="flex items-center justify-between p-4 border-b">
        <div>
          <h2 className="font-semibold">Classmate AI</h2>
          {user && <span className="text-sm text-gray-500">Hi, {user.firstName}!</span>}
        </div>
        <div className="flex items-center gap-2">
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as AgentMode)}
            className="px-2 py-1 border rounded"
          >
            <option value="DEFAULT">Default</option>
            <option value="EXAM">Exam</option>
            <option value="STUDY">Study</option>
            <option value="REVIEW">Review</option>
          </select>
          <button onClick={clearHistory} className="px-2 py-1 border rounded">
            Clear
          </button>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-gray-500 py-8">
            Start a conversation with your AI classmate!
          </div>
        )}

        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] rounded-lg p-3 ${
                m.role === "user" ? "bg-blue-500 text-white" : "bg-gray-100"
              }`}
            >
              {m.parts?.map((part, i) => {
                if (part.type === "text") {
                  return (
                    <p key={i} className="whitespace-pre-wrap">
                      {part.text}
                    </p>
                  );
                }

                if (isStaticToolUIPart(part)) {
                  const toolName = part.type.replace("tool-", "");
                  const needsConfirmation = toolsRequiringConfirmation.includes(toolName);

                  return (
                    <div key={i} className="mt-2 p-2 bg-white border rounded text-sm text-gray-900">
                      <div className="font-medium">Tool: {toolName}</div>

                      {part.state === "input-streaming" && (
                        <div className="text-gray-500">Loading...</div>
                      )}

                      {part.state === "input-available" && needsConfirmation && (
                        <div className="mt-2">
                          <p className="text-orange-600 mb-2">
                            This action requires your approval:
                          </p>
                          <pre className="text-xs bg-gray-50 p-2 rounded mb-2 overflow-auto">
                            {JSON.stringify(part.input, null, 2)}
                          </pre>
                          <div className="flex gap-2">
                            <button
                              onClick={() =>
                                handleToolConfirmation(toolName, part.toolCallId, false)
                              }
                              className="px-3 py-1 border rounded hover:bg-gray-100"
                            >
                              Deny
                            </button>
                            <button
                              onClick={() =>
                                handleToolConfirmation(toolName, part.toolCallId, true)
                              }
                              className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
                            >
                              Approve
                            </button>
                          </div>
                        </div>
                      )}

                      {part.state === "output-available" && part.output && (
                        <pre className="text-xs bg-gray-50 p-2 rounded mt-1 overflow-auto">
                          {JSON.stringify(part.output, null, 2)}
                        </pre>
                      )}

                      {part.state === "output-available" && part.errorText && (
                        <div className="text-red-600 mt-1">Error: {part.errorText}</div>
                      )}
                    </div>
                  );
                }

                return null;
              })}

              {m.metadata?.createdAt && (
                <div className="text-xs opacity-60 mt-1">
                  {formatTime(new Date(m.metadata.createdAt))}
                </div>
              )}
            </div>
          </div>
        ))}

        {(status === "submitted" || status === "streaming") && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-lg p-3">
              <span className="animate-pulse">Thinking...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-4 border-t">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              pendingConfirmation
                ? "Please respond to the confirmation above..."
                : "Ask your classmate..."
            }
            disabled={pendingConfirmation}
            className="flex-1 px-4 py-2 border rounded-lg disabled:bg-gray-100"
          />
          {status === "streaming" ? (
            <button
              type="button"
              onClick={stop}
              className="px-4 py-2 bg-red-500 text-white rounded-lg"
            >
              Stop
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim() || pendingConfirmation}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg disabled:opacity-50"
            >
              Send
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
```

---

## Troubleshooting

### Chat Provisioning Failed

**Symptom**: Error when calling `POST /chats`

**Common Causes & Solutions**:

1. **`CHAT_QUOTA_EXCEEDED` (403)**
   - User has reached their tier's chat limit
   - Solution: Show upgrade prompt or have user delete old chats via `DELETE /chats/:id`

2. **`UNAUTHORIZED` (401)**
   - Missing or invalid auth token
   - Solution: Re-authenticate user with Clerk

3. **Network Error**
   - Connection to API failed
   - Solution: Check network connection and API host URL

### Connection Rejected (403)

**Symptom**: WebSocket connection closes immediately with 403 error

**Common Causes & Solutions**:

1. **`INVALID_CHAT_ID`**
   - Chat ID is not a valid UUID
   - Solution: Always use the ID returned from `POST /chats`, never generate your own

2. **`CHAT_FORBIDDEN`**
   - Chat doesn't exist, was deleted, or not owned by user
   - Solution: Create a new chat via `POST /chats`

3. **Missing Chat Provisioning**
   - Trying to connect without calling `POST /chats` first
   - Solution: Always provision a chat before connecting

```tsx
// Example: Debug connection issues
const agent = useAgent({
  agent: "classmate-agent",
  host: API_HOST,
  name: chatId,
  query: getAuthQuery,
  onError: (error) => {
    console.error("Connection error:", error);
    // Check if chatId is valid UUID
    const isValidUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(chatId);
    if (!isValidUUID) {
      console.error("Invalid chat ID format:", chatId);
    }
  }
});
```

### 401 Unauthorized Loop

**Cause**: Token not being passed correctly or expired token.

**Solution**:
1. Ensure you're using the async `query` function pattern
2. Verify the query param name is `_clerk_session_token`
3. Check that `getToken()` returns a valid token
4. Ensure `host` is set to your API domain

```tsx
// Debug: Log the token being sent
const getAuthQuery = useCallback(async () => {
  const token = await getToken();
  console.log("Auth token:", token ? "present" : "missing");
  return { _clerk_session_token: token || "" };
}, [getToken]);
```

### WebSocket Connection Failed

**Cause**: CORS issues or wrong host URL.

**Solution**:
1. Verify `host` matches your API domain exactly
2. Check that your API has CORS configured for your frontend domain
3. Don't include protocol prefix like `wss://` - the SDK handles this

### Token Expiration

**Cause**: Clerk tokens expire after some time.

**Solution**:
- Use the async `query` function pattern - it fetches fresh tokens on reconnection
- The SDK will automatically reconnect with a new token when needed

### Chat Suddenly Disconnects

**Symptom**: Connection works initially but closes unexpectedly

**Common Causes & Solutions**:

1. **Chat was deleted**
   - Another user/device deleted the chat
   - Solution: Handle gracefully by creating a new chat

2. **Token expired during session**
   - Long-running sessions may outlive token validity
   - Solution: The SDK handles this automatically with async `query` function

3. **Network interruption**
   - Temporary network issues
   - Solution: The SDK will attempt to reconnect automatically

---

## Support

- **Backend Documentation**: See [CLASSMATE_AGENT.md](CLASSMATE_AGENT.md)
- **Cloudflare Agents**: [developers.cloudflare.com/agents](https://developers.cloudflare.com/agents/)
- **AI SDK**: [sdk.vercel.ai/docs](https://sdk.vercel.ai/docs)
