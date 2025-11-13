# Tasks API Documentation

## Overview

The Tasks API provides endpoints for managing academic tasks/assignments within subjects. All endpoints require Clerk authentication via the `Authorization` header.

Each task belongs to a specific subject and can have associated files (resources). Tasks support status tracking, due dates, grades, and long-form content.

---

## Authentication

All requests require a valid Clerk authentication token in the `Authorization` header:

```
Authorization: Bearer <clerk-token>
```

---

## Endpoints

### 1. List Tasks for a Subject

**GET** `/tasks?subject_id={subject_id}`

List all non-deleted tasks for a specific subject with optimized fields for list view.

#### Query Parameters
- `subject_id` (required): The subject ID to list tasks for

#### Response (200)
```json
{
  "success": true,
  "result": [
    {
      "id": "task-550e8400-e29b-41d4-a716-446655440000",
      "subject_id": "subject-123",
      "title": "Math Homework Chapter 5",
      "due_date": "2024-10-25T23:59:59Z",
      "status": "todo",
      "grade": null,
      "created_at": "2024-10-16T10:00:00.000Z",
      "updated_at": "2024-10-16T10:00:00.000Z"
    },
    {
      "id": "task-550e8400-e29b-41d4-a716-446655440001",
      "subject_id": "subject-123",
      "title": "Physics Lab Report",
      "due_date": "2024-10-30T23:59:59Z",
      "status": "doing",
      "grade": 8.5,
      "created_at": "2024-10-18T09:30:00.000Z",
      "updated_at": "2024-10-19T14:20:00.000Z"
    }
  ]
}
```

#### Error Response (400)
```json
{
  "error": "Subject ID is required"
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

#### Error Response (400 - Invalid Status)
```json
{
  "error": "Invalid status. Must be 'todo', 'doing', or 'done'"
}
```

#### Error Response (400 - Negative Grade)
```json
{
  "error": "Grade cannot be negative"
}
```

---

### 4. Update a Task

**PUT** `/tasks/{id}`

Update an existing task. All fields are optional, but at least one must be provided.

#### Path Parameters
- `id`: The task ID to update

#### Request Body (Update Status)
```json
{
  "status": "done",
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
    "grade": 8.75,
    "updated_at": "2024-10-19T17:00:00.000Z"
  }
}
```

#### Error Response (400 - Empty Title)
```json
{
  "error": "Title cannot be empty"
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

**Note**: Soft-deleted tasks can be recovered by hard-deleting and re-creating, or by using an admin restore function (if implemented).

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

**Warning ⚠️**: This operation is permanent and cannot be undone. All associated files will also be permanently deleted.

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
  status: "todo" | "doing" | "done"; // Task status (default: "todo")
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
- `"done"` - Task completed

---

## Usage Examples

### cURL

```bash
# List tasks for a subject
curl -X GET "https://api.classmate.studio/tasks?subject_id=subject-123" \
  -H "Authorization: Bearer <clerk-token>"

# Get task details with files
curl -X GET "https://api.classmate.studio/tasks/task-550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer <clerk-token>"

# Create a task
curl -X POST "https://api.classmate.studio/tasks" \
  -H "Authorization: Bearer <clerk-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Calculus Homework",
    "subject_id": "subject-123",
    "due_date": "2024-10-25T23:59:59Z",
    "status": "todo"
  }'

# Update task status and grade
curl -X PUT "https://api.classmate.studio/tasks/task-550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer <clerk-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "done",
    "grade": 9.5
  }'

# Soft delete a task
curl -X DELETE "https://api.classmate.studio/tasks/task-550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer <clerk-token>"

# Hard delete a task
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

// List tasks for a subject
const tasks = await fetch(`${apiBase}/tasks?subject_id=subject-123`, {
  headers
}).then(res => res.json());
console.log(tasks.result); // Array of tasks

// Get task details with resources
const taskDetail = await fetch(
  `${apiBase}/tasks/task-550e8400-e29b-41d4-a716-446655440000`,
  { headers }
).then(res => res.json());
console.log(taskDetail.result.resources); // Associated files

// Create a task
const newTask = await fetch(`${apiBase}/tasks`, {
  method: "POST",
  headers,
  body: JSON.stringify({
    title: "Literature Essay",
    subject_id: "subject-456",
    due_date: "2024-11-01T23:59:59Z",
    content: "Write about symbolism in modern literature"
  })
}).then(res => res.json());
console.log(newTask.result.id); // New task ID

// Update task
const updated = await fetch(
  `${apiBase}/tasks/${newTask.result.id}`,
  {
    method: "PUT",
    headers,
    body: JSON.stringify({
      status: "doing",
      content: "Updated analysis section"
    })
  }
).then(res => res.json());
console.log(updated.result.updated_at);

// Mark task as done
const completed = await fetch(
  `${apiBase}/tasks/${newTask.result.id}`,
  {
    method: "PUT",
    headers,
    body: JSON.stringify({
      status: "done",
      grade: 9.0
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

export function useTasks(subjectId: string) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const token = useAuth().token; // Your auth hook

  const listTasks = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `https://api.classmate.studio/tasks?subject_id=${subjectId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();
      setTasks(data.result);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  const createTask = async (title: string, content?: string) => {
    try {
      const res = await fetch('https://api.classmate.studio/tasks', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ title, subject_id: subjectId, content })
      });
      const data = await res.json();
      setTasks([...tasks, data.result]);
      return data.result;
    } catch (err) {
      setError(err);
    }
  };

  const updateTaskStatus = async (taskId: string, status: string, grade?: number) => {
    try {
      const res = await fetch(`https://api.classmate.studio/tasks/${taskId}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status, ...(grade !== undefined && { grade }) })
      });
      const data = await res.json();
      setTasks(tasks.map(t => t.id === taskId ? data.result : t));
    } catch (err) {
      setError(err);
    }
  };

  return { tasks, loading, error, listTasks, createTask, updateTaskStatus };
}
```

---

## Ownership & Privacy

- Users can only access, modify, and delete tasks they own
- Attempting to access another user's task returns a 404 error
- All operations are scoped to the authenticated user's ID

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
2. **Handle null values** - `due_date`, `content`, and `grade` can be null
3. **Validate status** - Only use "todo", "doing", or "done"
4. **Use soft delete first** - Soft delete before hard delete to allow recovery
5. **Use query parameters correctly** - Include `subject_id` when listing tasks
6. **Handle errors gracefully** - Check response status and error messages

---

## Rate Limiting

Currently no rate limiting is enforced, but it's recommended to implement it for production use.

---

## Version History

- **v1.0.0** (2025-10-19): Initial release with full CRUD and cascade delete operations
