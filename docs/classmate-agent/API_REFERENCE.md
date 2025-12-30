# ClassmateAgent API Reference

> **For**: Frontend/Client Developers  
> **Version**: 2.0.0  
> **Last Updated**: December 2025

This reference documents how to integrate the ClassmateAgent into your Next.js application using AI Elements components and the Vercel AI SDK.

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Connection](#connection)
3. [Sending Messages](#sending-messages)
4. [Message Structure](#message-structure)
5. [Modes](#modes)
6. [Tool Calls](#tool-calls)
7. [Human-in-the-Loop (HITL)](#human-in-the-loop-hitl)
8. [AI Elements Integration](#ai-elements-integration)
9. [Error Handling](#error-handling)
10. [TypeScript Types](#typescript-types)

---

## Quick Start

### Installation

```bash
npm install @ai-sdk/react ai
```

### Basic Implementation

```typescript
'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';

export default function Chat() {
  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({
      api: '/agents/classmate-agent/my-conversation-id',
    }),
  });

  return (
    <div>
      {messages.map((message) => (
        <div key={message.id}>
          <strong>{message.role}:</strong>
          {message.parts.map((part, i) => {
            if (part.type === 'text') {
              return <p key={i}>{part.text}</p>;
            }
          })}
        </div>
      ))}
      
      <button onClick={() => sendMessage({ text: 'Hello!' })}>
        Send
      </button>
    </div>
  );
}
```

---

## Connection

### Endpoint

```
WebSocket: wss://api.classmate.studio/agents/classmate-agent/{conversationId}
HTTP:      https://api.classmate.studio/agents/classmate-agent/{conversationId}
```

### Conversation ID

The `conversationId` is a unique identifier for each conversation session:

- Use a **UUID** or unique string for new conversations
- Reuse the same ID to **resume** a previous conversation
- Each user can have multiple conversations

```typescript
// New conversation
const conversationId = crypto.randomUUID();

// Resume existing conversation
const conversationId = 'conv-abc123';
```

### Authentication

Requests must include a valid Clerk session token. The `@ai-sdk/react` hook automatically includes credentials when configured:

```typescript
const { messages, sendMessage } = useChat({
  transport: new DefaultChatTransport({
    api: `/agents/classmate-agent/${conversationId}`,
    // Credentials included automatically with same-origin requests
  }),
});
```

---

## Sending Messages

### Basic Message

```typescript
sendMessage({ text: 'What topics are covered in my Biology class?' });
```

### Message with Mode

```typescript
sendMessage(
  { text: 'Quiz me on photosynthesis' },
  {
    body: {
      mode: 'EXAM',
    },
  }
);
```

### Message with Context

```typescript
sendMessage(
  { text: 'Summarize this class' },
  {
    body: {
      mode: 'REVIEW',
      contextId: 'class-abc123',
      contextType: 'class',
    },
  }
);
```

### Message with Attachments

```typescript
sendMessage({
  text: 'Analyze this document',
  files: [selectedFile], // File objects
});
```

---

## Message Structure

### UIMessage Format

Messages returned from `useChat` follow the AI SDK's `UIMessage` format:

```typescript
interface UIMessage {
  id: string;
  role: 'user' | 'assistant';
  parts: MessagePart[];
}

type MessagePart =
  | { type: 'text'; text: string }
  | { type: 'reasoning'; text: string }
  | { type: 'source-url'; url: string }
  | ToolPart;
```

### Rendering Message Parts

```typescript
{message.parts.map((part, i) => {
  switch (part.type) {
    case 'text':
      return <p key={i}>{part.text}</p>;
    
    case 'reasoning':
      return <ReasoningBlock key={i} text={part.text} />;
    
    case 'source-url':
      return <SourceLink key={i} url={part.url} />;
    
    // Tool calls (see Tool Calls section)
    case 'tool-readClassContent':
    case 'tool-listClasses':
      return <ToolDisplay key={i} part={part} />;
  }
})}
```

---

## Modes

The agent operates in different modes that affect its behavior, personality, and available tools.

| Mode | Purpose | Best For |
|------|---------|----------|
| `DEFAULT` | General academic assistant | Everyday questions, general help |
| `EXAM` | Exam preparation & practice | Quizzes, test prep, active recall |
| `STUDY` | Deep learning & comprehension | Learning new topics, understanding concepts |
| `REVIEW` | Quick review & summarization | Before exams, quick refreshers |

### Setting the Mode

```typescript
// Per-message mode
sendMessage(
  { text: 'Quiz me on chapter 5' },
  { body: { mode: 'EXAM' } }
);

// Or set default mode for all messages
const { messages, sendMessage } = useChat({
  transport: new DefaultChatTransport({
    api: `/agents/classmate-agent/${conversationId}`,
  }),
  body: {
    mode: 'STUDY',
  },
});
```

### Mode Characteristics

**DEFAULT Mode**
- Balanced, helpful personality
- Access to all standard tools
- General-purpose responses

**EXAM Mode**
- Serious, focused personality
- Emphasizes active recall techniques
- Won't give away answers directly
- Challenges you with follow-up questions

**STUDY Mode**
- Supportive, encouraging personality
- Uses pedagogy fundamentals and memory techniques
- Provides detailed explanations
- Breaks down complex topics

**REVIEW Mode**
- Efficient, concise responses
- Summarizes key points
- Uses lighter-weight model for faster responses
- Great for quick refreshers

---

## Tool Calls

The agent can use tools to interact with your data. Tool calls appear as special message parts.

### Available Tools

| Tool | Description | Requires Approval |
|------|-------------|-------------------|
| `readClassContent` | Retrieve full class content | No |
| `listClasses` | List user's classes | No |
| `getClassSummary` | Get brief class summary | No |
| `removeClass` | Delete a class | **Yes** |

### Tool Call States

```typescript
type ToolState =
  | 'input-streaming'   // Tool input being generated
  | 'input-available'   // Input ready, executing or waiting for approval
  | 'output-available'  // Tool completed successfully
  | 'output-error';     // Tool execution failed
```

### Rendering Tool Calls

```typescript
{message.parts.map((part, i) => {
  // Tool parts are prefixed with 'tool-'
  if (part.type.startsWith('tool-')) {
    return (
      <div key={i} className="tool-call">
        <span className="tool-name">{part.type.replace('tool-', '')}</span>
        
        {part.state === 'input-streaming' && (
          <span>Loading...</span>
        )}
        
        {part.state === 'input-available' && (
          <pre>{JSON.stringify(part.input, null, 2)}</pre>
        )}
        
        {part.state === 'output-available' && (
          <pre>{JSON.stringify(part.output, null, 2)}</pre>
        )}
        
        {part.state === 'output-error' && (
          <span className="error">{part.errorText}</span>
        )}
      </div>
    );
  }
})}
```

---

## Human-in-the-Loop (HITL)

Some tools require user approval before execution. These are typically destructive operations like deleting data.

### Identifying HITL Tools

HITL tools will have an `approval` property in their tool part:

```typescript
if (part.approval) {
  // This tool requires user confirmation
}
```

### Handling Approval Requests

```typescript
const { messages, sendMessage, respondToConfirmationRequest } = useChat({
  transport: new DefaultChatTransport({
    api: `/agents/classmate-agent/${conversationId}`,
  }),
});

// In your render:
{part.approval && part.state === 'input-available' && (
  <div className="confirmation-dialog">
    <p>The assistant wants to: {part.type.replace('tool-', '')}</p>
    <pre>{JSON.stringify(part.input, null, 2)}</pre>
    
    <button
      onClick={() => respondToConfirmationRequest({
        approvalId: part.approval.id,
        approved: true,
      })}
    >
      Approve
    </button>
    
    <button
      onClick={() => respondToConfirmationRequest({
        approvalId: part.approval.id,
        approved: false,
      })}
    >
      Deny
    </button>
  </div>
)}
```

### After Approval/Denial

Once you respond, the tool part will update:

- **Approved**: `state` changes to `'output-available'` with the result
- **Denied**: `state` changes to `'output-available'` with a denial message

---

## AI Elements Integration

AI Elements provides pre-built components for chat interfaces. Here's how to integrate with ClassmateAgent:

### Full Chat Implementation

```typescript
'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useState } from 'react';

// AI Elements components
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from '@/components/ai-elements/conversation';
import {
  Message,
  MessageContent,
  MessageResponse,
} from '@/components/ai-elements/message';
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputSubmit,
} from '@/components/ai-elements/prompt-input';
import {
  Confirmation,
  ConfirmationContent,
  ConfirmationRequest,
  ConfirmationAccepted,
  ConfirmationRejected,
  ConfirmationActions,
  ConfirmationAction,
} from '@/components/ai-elements/confirmation';
import { Loader } from '@/components/ai-elements/loader';

interface ClassmateChatProps {
  conversationId: string;
  defaultMode?: 'DEFAULT' | 'EXAM' | 'STUDY' | 'REVIEW';
  contextId?: string;
  contextType?: 'class' | 'subject' | 'task';
}

export function ClassmateChat({
  conversationId,
  defaultMode = 'DEFAULT',
  contextId,
  contextType,
}: ClassmateChatProps) {
  const [input, setInput] = useState('');
  const [mode, setMode] = useState(defaultMode);

  const { messages, sendMessage, status, respondToConfirmationRequest } = useChat({
    transport: new DefaultChatTransport({
      api: `/agents/classmate-agent/${conversationId}`,
    }),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    sendMessage(
      { text: input },
      {
        body: {
          mode,
          contextId,
          contextType,
        },
      }
    );
    setInput('');
  };

  return (
    <div className="flex flex-col h-full">
      {/* Mode Selector */}
      <div className="p-2 border-b">
        <select value={mode} onChange={(e) => setMode(e.target.value as any)}>
          <option value="DEFAULT">Default</option>
          <option value="EXAM">Exam Mode</option>
          <option value="STUDY">Study Mode</option>
          <option value="REVIEW">Review Mode</option>
        </select>
      </div>

      {/* Conversation */}
      <Conversation className="flex-1">
        <ConversationContent>
          {messages.map((message) => (
            <Message key={message.id} from={message.role}>
              <MessageContent>
                {message.parts.map((part, i) => {
                  switch (part.type) {
                    case 'text':
                      return (
                        <MessageResponse key={i}>
                          {part.text}
                        </MessageResponse>
                      );

                    // Handle HITL tool calls
                    default:
                      if (part.type.startsWith('tool-') && part.approval) {
                        return (
                          <Confirmation
                            key={i}
                            approval={part.approval}
                            state={part.state}
                          >
                            <ConfirmationContent>
                              <ConfirmationRequest>
                                Confirm action: {part.type.replace('tool-', '')}
                                <pre className="mt-2 text-sm">
                                  {JSON.stringify(part.input, null, 2)}
                                </pre>
                              </ConfirmationRequest>
                              <ConfirmationAccepted>
                                Action approved
                              </ConfirmationAccepted>
                              <ConfirmationRejected>
                                Action denied
                              </ConfirmationRejected>
                            </ConfirmationContent>
                            <ConfirmationActions>
                              <ConfirmationAction
                                variant="outline"
                                onClick={() =>
                                  respondToConfirmationRequest({
                                    approvalId: part.approval!.id,
                                    approved: false,
                                  })
                                }
                              >
                                Deny
                              </ConfirmationAction>
                              <ConfirmationAction
                                variant="default"
                                onClick={() =>
                                  respondToConfirmationRequest({
                                    approvalId: part.approval!.id,
                                    approved: true,
                                  })
                                }
                              >
                                Approve
                              </ConfirmationAction>
                            </ConfirmationActions>
                          </Confirmation>
                        );
                      }
                      return null;
                  }
                })}
              </MessageContent>
            </Message>
          ))}

          {status === 'submitted' && <Loader />}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      {/* Input */}
      <PromptInput onSubmit={handleSubmit} className="p-4">
        <PromptInputTextarea
          value={input}
          placeholder="Ask your classmate..."
          onChange={(e) => setInput(e.currentTarget.value)}
        />
        <PromptInputSubmit
          status={status === 'streaming' ? 'streaming' : 'ready'}
          disabled={!input.trim()}
        />
      </PromptInput>
    </div>
  );
}
```

### Displaying Tool Results

```typescript
import { Tool, ToolContent, ToolStatus } from '@/components/ai-elements/tool';

// Inside message rendering:
{part.type.startsWith('tool-') && !part.approval && (
  <Tool>
    <ToolStatus state={part.state} />
    <ToolContent>
      {part.state === 'output-available' && (
        <div>{JSON.stringify(part.output)}</div>
      )}
    </ToolContent>
  </Tool>
)}
```

---

## Error Handling

### Connection Errors

```typescript
const { messages, sendMessage, error } = useChat({
  transport: new DefaultChatTransport({
    api: `/agents/classmate-agent/${conversationId}`,
  }),
  onError: (error) => {
    console.error('Chat error:', error);
    // Show toast notification, etc.
  },
});

// Display error state
{error && (
  <div className="error-banner">
    Connection error. Please try again.
  </div>
)}
```

### Tool Errors

Tool errors appear in the tool part with `state: 'output-error'`:

```typescript
{part.state === 'output-error' && (
  <div className="tool-error">
    <span>Tool failed: {part.errorText}</span>
  </div>
)}
```

### Common Error Codes

| Error | Cause | Solution |
|-------|-------|----------|
| 401 Unauthorized | Invalid or expired session | Re-authenticate with Clerk |
| 404 Not Found | Invalid conversation ID | Check conversation ID format |
| 429 Too Many Requests | Rate limit exceeded | Wait and retry |
| 500 Internal Error | Server error | Retry or contact support |

---

## TypeScript Types

### Request Body Types

```typescript
interface ChatRequestBody {
  mode?: 'DEFAULT' | 'EXAM' | 'STUDY' | 'REVIEW';
  contextId?: string;
  contextType?: 'class' | 'subject' | 'task';
}
```

### Tool Types

```typescript
// Tool input/output types for each tool
interface ReadClassContentInput {
  classId: string;
}

interface ReadClassContentOutput {
  success: boolean;
  data?: {
    id: string;
    title: string;
    content: string;
    summary?: string;
  };
  error?: string;
}

interface ListClassesInput {
  limit?: number;
  offset?: number;
}

interface ListClassesOutput {
  success: boolean;
  data?: Array<{
    id: string;
    title: string;
    subjectId: string;
  }>;
  error?: string;
}

interface RemoveClassInput {
  classId: string;
  reason?: string;
}

interface RemoveClassOutput {
  success: boolean;
  message: string;
}
```

### Custom Hook Example

```typescript
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';

type AgentMode = 'DEFAULT' | 'EXAM' | 'STUDY' | 'REVIEW';

interface UseClassmateAgentOptions {
  conversationId: string;
  defaultMode?: AgentMode;
  contextId?: string;
  contextType?: 'class' | 'subject' | 'task';
}

export function useClassmateAgent({
  conversationId,
  defaultMode = 'DEFAULT',
  contextId,
  contextType,
}: UseClassmateAgentOptions) {
  const chat = useChat({
    transport: new DefaultChatTransport({
      api: `/agents/classmate-agent/${conversationId}`,
    }),
    body: {
      mode: defaultMode,
      contextId,
      contextType,
    },
  });

  const sendWithMode = (text: string, mode?: AgentMode) => {
    chat.sendMessage(
      { text },
      mode ? { body: { mode, contextId, contextType } } : undefined
    );
  };

  return {
    ...chat,
    sendWithMode,
  };
}
```

---

## Best Practices

### 1. Persist Conversation IDs

Store conversation IDs to allow users to resume conversations:

```typescript
// Save to localStorage or your backend
localStorage.setItem('lastConversationId', conversationId);
```

### 2. Set Context When Relevant

Always provide context when discussing specific items:

```typescript
// When viewing a class page
sendMessage(
  { text: 'Explain this topic' },
  { body: { contextId: classId, contextType: 'class' } }
);
```

### 3. Use Appropriate Modes

- **Studying new material**: Use `STUDY` mode
- **Preparing for exams**: Use `EXAM` mode
- **Quick questions**: Use `DEFAULT` mode
- **Before a test**: Use `REVIEW` mode

### 4. Handle Loading States

Always show feedback during streaming:

```typescript
{status === 'streaming' && <Loader />}
{status === 'submitted' && <span>Thinking...</span>}
```

### 5. Graceful HITL Handling

Clearly explain what approval means:

```typescript
<ConfirmationRequest>
  <strong>Warning:</strong> This will permanently delete your class 
  "{part.input?.classId}". This action cannot be undone.
</ConfirmationRequest>
```

---

## Support

For issues or questions:

- API Status: Check Cloudflare dashboard
- Documentation: See internal `CLASSMATE_AGENT.md`
- Frontend Issues: File in the frontend repository
