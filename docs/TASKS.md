# Tasks API Documentation

## Overview

The Tasks API provides endpoints for managing academic tasks/assignments within subjects. All endpoints require Clerk authentication via the `Authorization` header.

Each task belongs to a specific subject and can have associated files (resources). Tasks support status tracking, priority levels, due dates, grades, and long-form content.

---

## Authentication

All requests require a valid Clerk authentication token in the `Authorization` header:

```
Authorization: Bearer <clerk-token>
```

---

## Endpoints

### 1. List Tasks (Advanced Filtering, Sorting & Pagination)

**GET** `/tasks`

List tasks with advanced filtering, sorting, and pagination. Clients can request exactly what they need without receiving unnecessary data.

#### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `subject_id` | string | No | Filter by subject ID |
| `status` | string | No | Comma-separated statuses: `todo,doing,ai_review,done` |
| `priority` | string | No | Comma-separated priorities: `low,medium,high` |
| `search` | string | No | Search in task titles (text contains) |
| `due_date_from` | ISO 8601 | No | Filter tasks due on or after this date |
| `due_date_to` | ISO 8601 | No | Filter tasks due on or before this date |
| `sort_by` | string | No | Sort field: `dueDate`, `createdAt`, or `priority` (default: `createdAt`) |
| `sort_order` | string | No | Sort direction: `asc` or `desc` (default: `desc`) |
| `limit` | number | No | Results per page (1-100, default: 20) |
| `offset` | number | No | Skip N results (default: 0) |

#### Response (200)
```json
{
  "success": true,
  "result": {
    "data": [
      {
        "id": "task-550e8400-e29b-41d4-a716-446655440000",
        "subject_id": "subject-123",
        "title": "Math Homework Chapter 5",
        "due_date": "2024-10-25T23:59:59Z",
        "status": "todo",
        "priority": "high",
        "grade": null,
        "created_at": "2024-10-16T10:00:00.000Z",
        "updated_at": "2024-10-16T10:00:00.000Z"
      },
      {
        "id": "task-550e8400-e29b-41d4-a716-446655440001",
        "subject_id": "subject-123",
        "title": "Physics Lab Report",
        "due_date": "2024-10-30T23:59:59Z",
        "status": "ai_review",
        "priority": "medium",
        "grade": 8.5,
        "created_at": "2024-10-18T09:30:00.000Z",
        "updated_at": "2024-10-19T14:20:00.000Z"
      }
    ],
    "meta": {
      "total": 150,
      "limit": 20,
      "offset": 0
    }
  }
}
```

#### Example Requests

```bash
# List high-priority tasks due this month
GET /tasks?priority=high&due_date_from=2024-10-01T00:00:00Z&due_date_to=2024-10-31T23:59:59Z

# Search for tasks and sort by due date
GET /tasks?search=essay&sort_by=dueDate&sort_order=asc

# List todo and doing tasks with pagination
GET /tasks?status=todo,doing&limit=10&offset=20

# Filter by subject and priority
GET /tasks?subject_id=subject-123&priority=high,medium&limit=50
```

#### Error Response (400)
```json
{
  "error": "Invalid sort_by value. Must be 'dueDate', 'createdAt', or 'priority'"
}
```

#### Error Response (401)
```json
{
  "error": "Unauthorized"
}
```

---

### 2. Get Task Details

**GET** `/tasks/{id}`

Retrieve a single task with all details and associated files.

#### Path Parameters
- `id`: The task ID to retrieve

#### Response (200)
```json
{
  "success": true,
  "result": {
    "id": "task-550e8400-e29b-41d4-a716-446655440000",
    "subject_id": "subject-123",
    "title": "Math Homework Chapter 5",
    "due_date": "2024-10-25T23:59:59Z",
    "status": "doing",
    "priority": "high",
    "content": "Complete exercises 1-10 on page 42. Show all work.",
    "grade": 9.5,
    "is_deleted": 0,
    "deleted_at": null,
    "created_at": "2024-10-16T10:00:00.000Z",
    "updated_at": "2024-10-19T15:30:00.000Z",
    "resources": [
      {
        "id": "file-1",
        "original_filename": "homework-guide.pdf",
        "mime_type": "application/pdf",
        "size_bytes": 2048000,
        "association_type": "resource"
      },
      {
        "id": "file-2",
        "original_filename": "chapter-5-summary.pdf",
        "mime_type": "application/pdf",
        "size_bytes": 1024000,
        "association_type": "resource"
      }
    ]
  }
}
```

#### Error Response (404)
```json
{
  "error": "Task not found"
}
```

#### Error Response (401)
```json
{
  "error": "Unauthorized"
}
```

---

### 3. Create a Task

**POST** `/tasks`

Create a new task within a subject.

#### Request Body
```json
{
  "title": "Biology Essay on Ecosystems",
  "subject_id": "subject-123",
  "due_date": "2024-11-05T23:59:59Z",
  "status": "todo",
  "priority": "high",
  "content": "Write a 5-page essay covering ecosystem types and biodiversity.",
  "grade": null
}
```

#### Request Body (Minimal)
Only `title` and `subject_id` are required:
```json
{
  "title": "Quick Quiz Study",
  "subject_id": "subject-123"
}
```

#### Response (201)
```json
{
  "success": true,
  "result": {
    "id": "task-550e8400-e29b-41d4-a716-446655440002",
    "subject_id": "subject-123",
    "title": "Biology Essay on Ecosystems",
    "due_date": "2024-11-05T23:59:59Z",
    "status": "todo",
    "priority": "high",
    "content": "Write a 5-page essay covering ecosystem types and biodiversity.",
    "grade": null,
    "created_at": "2024-10-19T16:00:00.000Z",
    "updated_at": "2024-10-19T16:00:00.000Z"
  }
}
```

#### Error Response (400)
```json
{
  "error": "title: Title is required; subject_id: Subject ID is required"
}
```

#### Error Response (400 - Invalid Priority)
```json
{
  "error": "priority: Invalid enum value"
}
```

#### Error Response (400 - Negative Grade)
```json
{
  "error": "grade: Grade cannot be negative"
}
```

---

### 4. Update a Task

**PUT** `/tasks/{id}`

Update an existing task. All fields are optional, but at least one must be provided.

#### Path Parameters
- `id`: The task ID to update

#### Request Body (Update Status & Priority)
```json
{
  "status": "done",
  "priority": "low",
  "grade": 9.5
}
```

#### Request Body (Update Content)
```json
{
  "content": "Updated essay content with corrections.",
  "due_date": "2024-11-10T23:59:59Z"
}
```

#### Request Body (Update Multiple Fields)
```json
{
  "title": "Advanced Biology Essay",
  "status": "doing",
  "priority": "medium",
  "grade": 8.75,
  "due_date": "2024-11-08T23:59:59Z"
}
```

#### Response (200)
```json
{
  "success": true,
  "result": {
    "id": "task-550e8400-e29b-41d4-a716-446655440002",
    "subject_id": "subject-123",
    "title": "Advanced Biology Essay",
    "due_date": "2024-11-08T23:59:59Z",
    "status": "doing",
    "priority": "medium",
    "grade": 8.75,
    "updated_at": "2024-10-19T17:00:00.000Z"
  }
}
```

#### Error Response (400 - Empty Title)
```json
{
  "error": "title: Title cannot be empty"
}
```

#### Error Response (400 - No Fields Provided)
```json
{
  "error": "At least one field must be provided for update"
}
```

#### Error Response (404)
```json
{
  "error": "Task not found"
}
```

---

### 5. Soft Delete a Task

**DELETE** `/tasks/{id}`

Soft delete a task without permanently removing data. The task is marked as deleted and hidden from list views.

#### Path Parameters
- `id`: The task ID to soft delete

#### Response (200)
```json
{
  "success": true,
  "result": {
    "id": "task-550e8400-e29b-41d4-a716-446655440002",
    "is_deleted": 1,
    "deleted_at": "2024-10-19T18:00:00.000Z"
  }
}
```

**Note**: Soft-deleted tasks can be recovered by querying the database with soft delete flag, or by implementing an admin restore function.

#### Error Response (404)
```json
{
  "error": "Task not found"
}
```

---

### 6. Hard Delete a Task

**DELETE** `/tasks/{id}/hard`

Permanently delete a task and all related files. This operation is irreversible.

#### Path Parameters
- `id`: The task ID to permanently delete

#### Response (200)
```json
{
  "success": true,
  "result": {
    "id": "task-550e8400-e29b-41d4-a716-446655440002"
  }
}
```

**⚠️ Warning**: This operation is permanent and cannot be undone. All associated files will also be permanently deleted.

#### Error Response (404)
```json
{
  "error": "Task not found"
}
```

---

## Common Error Responses

### 401 Unauthorized
```json
{
  "error": "Unauthorized"
}
```
**Cause**: Missing or invalid Clerk authentication token.

### 400 Bad Request
```json
{
  "error": "Validation error message"
}
```
**Cause**: Validation error in request payload or query parameters.

### 404 Not Found
```json
{
  "error": "Task not found"
}
```
**Cause**: Task does not exist or doesn't belong to the authenticated user.

### 500 Internal Server Error
```json
{
  "error": "Internal server error"
}
```
**Cause**: Unexpected server error. Check logs for details.

---

## Data Model

### Task Entity
```typescript
interface Task {
  id: string;                    // UUID
  subject_id: string;            // Parent subject UUID
  title: string;                 // Task title (required)
  due_date: string | null;       // ISO 8601 timestamp
  status: "todo" | "doing" | "ai_review" | "done"; // Task status (default: "todo")
  priority: "low" | "medium" | "high"; // Task priority (default: "medium")
  content: string | null;        // Long-form content (editor content)
  grade: number | null;          // Decimal grade (e.g., 8.5)
  is_deleted: number;            // 0 = active, 1 = soft deleted
  deleted_at: string | null;     // ISO 8601 timestamp
  created_at: string;            // ISO 8601 timestamp
  updated_at: string;            // ISO 8601 timestamp
}
```

### Task Resource (File Association)
```typescript
interface TaskResource {
  id: string;                    // File UUID
  original_filename: string;     // Original filename
  mime_type: string;             // MIME type (e.g., "application/pdf")
  size_bytes: number;            // File size in bytes
  association_type: string;      // "resource" or "embedded_content"
}
```

### Status Values
- `"todo"` - Task not started
- `"doing"` - Task in progress
- `"ai_review"` - Task completed and awaiting AI review/feedback
- `"done"` - Task finalized after AI review or manual completion

### Priority Values
- `"low"` - Low priority
- `"medium"` - Medium priority (default)
- `"high"` - High priority

---

## Usage Examples

### cURL

```bash
# List all high-priority tasks for a subject
curl -X GET "https://api.classmate.studio/tasks?subject_id=subject-123&priority=high&sort_by=dueDate" \
  -H "Authorization: Bearer <clerk-token>"

# Search and filter with pagination
curl -X GET "https://api.classmate.studio/tasks?search=essay&status=todo,doing&limit=10&offset=0" \
  -H "Authorization: Bearer <clerk-token>"

# Filter by due date range
curl -X GET "https://api.classmate.studio/tasks?due_date_from=2024-10-01T00:00:00Z&due_date_to=2024-10-31T23:59:59Z" \
  -H "Authorization: Bearer <clerk-token>"

# Get task details with files
curl -X GET "https://api.classmate.studio/tasks/task-550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer <clerk-token>"

# Create a task with priority
curl -X POST "https://api.classmate.studio/tasks" \
  -H "Authorization: Bearer <clerk-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Calculus Homework",
    "subject_id": "subject-123",
    "due_date": "2024-10-25T23:59:59Z",
    "priority": "high",
    "status": "todo"
  }'

# Update task priority and status
curl -X PUT "https://api.classmate.studio/tasks/task-550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer <clerk-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "done",
    "priority": "low",
    "grade": 9.5
  }'

# Soft delete a task
curl -X DELETE "https://api.classmate.studio/tasks/task-550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer <clerk-token>"

# Hard delete a task (permanent)
curl -X DELETE "https://api.classmate.studio/tasks/task-550e8400-e29b-41d4-a716-446655440000/hard" \
  -H "Authorization: Bearer <clerk-token>"
```

### JavaScript/TypeScript

```typescript
const apiBase = "https://api.classmate.studio";
const token = "your-clerk-token";

const headers = {
  "Authorization": `Bearer ${token}`,
  "Content-Type": "application/json"
};

// List tasks with advanced filters
const tasks = await fetch(
  `${apiBase}/tasks?priority=high&status=todo,doing&sort_by=dueDate&limit=20`,
  { headers }
).then(res => res.json());

console.log(tasks.result.data); // Array of filtered tasks
console.log(tasks.result.meta); // { total: 150, limit: 20, offset: 0 }

// Search tasks
const searchResults = await fetch(
  `${apiBase}/tasks?search=essay&limit=10`,
  { headers }
).then(res => res.json());

// Filter by due date
const dueSoon = await fetch(
  `${apiBase}/tasks?due_date_from=2024-10-20T00:00:00Z&due_date_to=2024-10-31T23:59:59Z`,
  { headers }
).then(res => res.json());

// Create a task with priority
const newTask = await fetch(`${apiBase}/tasks`, {
  method: "POST",
  headers,
  body: JSON.stringify({
    title: "Advanced Biology Essay",
    subject_id: "subject-456",
    due_date: "2024-11-01T23:59:59Z",
    priority: "high",
    content: "Write about cellular biology"
  })
}).then(res => res.json());

console.log(newTask.result.id); // New task ID

// Update task priority
const updated = await fetch(
  `${apiBase}/tasks/${newTask.result.id}`,
  {
    method: "PUT",
    headers,
    body: JSON.stringify({
      priority: "medium",
      status: "doing"
    })
  }
).then(res => res.json());

// Mark task as done with grade
const completed = await fetch(
  `${apiBase}/tasks/${newTask.result.id}`,
  {
    method: "PUT",
    headers,
    body: JSON.stringify({
      status: "done",
      grade: 9.0,
      priority: "low"
    })
  }
).then(res => res.json());

// Soft delete
await fetch(`${apiBase}/tasks/${newTask.result.id}`, {
  method: "DELETE",
  headers
});

// Hard delete (permanent)
await fetch(`${apiBase}/tasks/${newTask.result.id}/hard`, {
  method: "DELETE",
  headers
});
```

### React Hook Example

```typescript
import { useState } from 'react';

export function useTasks(subjectId?: string) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [total, setTotal] = useState(0);

  const token = useAuth().token; // Your auth hook

  const listTasks = async (filters?: {
    status?: string[];
    priority?: string[];
    search?: string;
    sortBy?: 'dueDate' | 'createdAt' | 'priority';
    limit?: number;
    offset?: number;
  }) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      
      if (subjectId) params.set('subject_id', subjectId);
      if (filters?.status?.length) params.set('status', filters.status.join(','));
      if (filters?.priority?.length) params.set('priority', filters.priority.join(','));
      if (filters?.search) params.set('search', filters.search);
      if (filters?.sortBy) params.set('sort_by', filters.sortBy);
      params.set('limit', String(filters?.limit ?? 20));
      params.set('offset', String(filters?.offset ?? 0));

      const res = await fetch(
        `https://api.classmate.studio/tasks?${params}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();
      setTasks(data.result.data);
      setTotal(data.result.meta.total);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  const createTask = async (
    title: string,
    priority: 'low' | 'medium' | 'high' = 'medium',
    content?: string,
    dueDate?: string
  ) => {
    try {
      const res = await fetch('https://api.classmate.studio/tasks', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title,
          subject_id: subjectId,
          priority,
          content,
          due_date: dueDate
        })
      });
      const data = await res.json();
      setTasks([...tasks, data.result]);
      return data.result;
    } catch (err) {
      setError(err);
    }
  };

  const updateTask = async (
    taskId: string,
    updates: {
      status?: 'todo' | 'doing' | 'done';
      priority?: 'low' | 'medium' | 'high';
      grade?: number;
      title?: string;
      content?: string;
    }
  ) => {
    try {
      const res = await fetch(`https://api.classmate.studio/tasks/${taskId}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updates)
      });
      const data = await res.json();
      setTasks(tasks.map(t => t.id === taskId ? data.result : t));
    } catch (err) {
      setError(err);
    }
  };

  return { tasks, total, loading, error, listTasks, createTask, updateTask };
}
```

---

## Query Performance Notes

- **Filtering** reduces query time dramatically—use `status`, `priority`, and `search` liberally
- **Pagination** is required—always include `limit` to avoid timeouts
- **Sorting** defaults to `createdAt` descending—specify `sort_by` for custom order
- **Due date filters** are efficient with proper database indexes
- **Search** is case-insensitive and searches task titles only

---

## Ownership & Privacy

- Users can only access, modify, and delete tasks they own
- Attempting to access another user's task returns a 404 error
- All operations are scoped to the authenticated user's ID
- The backend enforces ownership checks for security

---

## Cascade Behavior

### Soft Delete Subject
When a subject is soft deleted, all its tasks are also soft deleted automatically.

### Hard Delete Subject
When a subject is hard deleted:
- All related tasks are permanently deleted
- All files associated with those tasks are permanently deleted
- This operation cascades via foreign key constraints

---

## Best Practices

1. **Always require authentication** - Provide valid Clerk token
2. **Use filtering** - Don't request all tasks; filter by status, priority, or date
3. **Paginate results** - Always include `limit` and `offset` parameters
4. **Handle null values** - `due_date`, `content`, and `grade` can be null
5. **Validate priority** - Only use "low", "medium", or "high"
6. **Use soft delete first** - Soft delete before hard delete to allow recovery
7. **Sort efficiently** - Default sort is by creation date; specify `sort_by` for others

---

## Rate Limiting

Currently no rate limiting is enforced, but it's recommended to implement it for production use.

---

## Version History

- **v2.0.0** (2025-11-21): Added advanced filtering, sorting, pagination, and priority support
- **v1.0.0** (2025-10-19): Initial release with basic CRUD and cascade delete operations

