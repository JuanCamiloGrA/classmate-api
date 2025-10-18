# Subjects API Examples

## Overview

The Subjects API provides CRUD operations for managing academic subjects within terms. All endpoints require Clerk authentication via the `Authorization` header.

Each subject belongs to a specific term and can have associated tasks and classes that cascade when deleted.

---

## Authentication

All requests require a valid Clerk authentication token in the `Authorization` header:

```
Authorization: Bearer <clerk-token>
```

---

## Endpoints

### 1. List Subjects for a Term

**GET** `/subjects?term_id={term_id}`

List all non-deleted subjects for a specific term.

#### Query Parameters
- `term_id` (required): The term ID to list subjects for

#### Response (200)
```json
{
  "success": true,
  "result": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "Mathematics",
      "termId": "term-123",
      "createdAt": "2024-10-16T10:00:00.000Z",
      "updatedAt": "2024-10-16T10:00:00.000Z"
    },
    {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "name": "Physics",
      "termId": "term-123",
      "createdAt": "2024-10-16T10:05:00.000Z",
      "updatedAt": "2024-10-16T10:05:00.000Z"
    }
  ]
}
```

#### Error Response (400)
```json
{
  "error": "Term ID is required"
}
```

---

### 2. Create a Subject

**POST** `/subjects`

Create a new subject within a term.

#### Request Body
```json
{
  "name": "Advanced Mathematics",
  "termId": "term-123"
}
```

#### Response (201)
```json
{
  "success": true,
  "result": {
    "id": "550e8400-e29b-41d4-a716-446655440002",
    "name": "Advanced Mathematics",
    "termId": "term-123",
    "createdAt": "2024-10-16T11:00:00.000Z",
    "updatedAt": "2024-10-16T11:00:00.000Z"
  }
}
```

#### Error Response (400)
```json
{
  "error": "name: Name is required; termId: Term ID is required"
}
```

---

### 3. Update a Subject

**PUT** `/subjects/{id}`

Update the name of an existing subject.

#### Path Parameters
- `id`: The subject ID to update

#### Request Body
```json
{
  "name": "Calculus I"
}
```

#### Response (200)
```json
{
  "success": true,
  "result": {
    "id": "550e8400-e29b-41d4-a716-446655440002",
    "name": "Calculus I",
    "termId": "term-123",
    "updatedAt": "2024-10-16T11:30:00.000Z"
  }
}
```

#### Error Response (404)
```json
{
  "error": "Subject not found"
}
```

---

### 4. Soft Delete a Subject

**DELETE** `/subjects/{id}`

Soft delete a subject and cascade to related tasks and classes.
The data is preserved but marked as deleted.

#### Path Parameters
- `id`: The subject ID to soft delete

#### Response (200)
```json
{
  "success": true,
  "result": {
    "id": "550e8400-e29b-41d4-a716-446655440002",
    "isDeleted": 1,
    "deletedAt": "2024-10-16T12:00:00.000Z"
  }
}
```

**Note**: This operation cascades to all related tasks and classes, marking them as deleted as well.

#### Error Response (404)
```json
{
  "error": "Subject not found"
}
```

---

### 5. Hard Delete a Subject

**DELETE** `/subjects/{id}/hard`

Permanently delete a subject and all related data.
Cascading deletion happens automatically via foreign key constraints.

#### Path Parameters
- `id`: The subject ID to permanently delete

#### Response (200)
```json
{
  "success": true,
  "result": {
    "id": "550e8400-e29b-41d4-a716-446655440002"
  }
}
```

**Warning**: This operation is irreversible. All related tasks and classes will also be permanently deleted.

#### Error Response (404)
```json
{
  "error": "Subject not found"
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
Cause: Missing or invalid Clerk authentication token.

### 400 Bad Request
```json
{
  "error": "Invalid request body or parameters"
}
```
Cause: Validation error in request payload or query parameters.

### 404 Not Found
```json
{
  "error": "Subject not found"
}
```
Cause: Subject does not exist or doesn't belong to the authenticated user.

### 500 Internal Server Error
```json
{
  "error": "Internal server error"
}
```
Cause: Unexpected server error. Check logs for details.

---

## Usage Examples

### cURL

```bash
# List subjects for a term
curl -X GET "https://api.example.com/subjects?term_id=term-123" \
  -H "Authorization: Bearer <clerk-token>"

# Create a subject
curl -X POST "https://api.example.com/subjects" \
  -H "Authorization: Bearer <clerk-token>" \
  -H "Content-Type: application/json" \
  -d '{"name": "Biology", "termId": "term-123"}'

# Update a subject
curl -X PUT "https://api.example.com/subjects/550e8400-e29b-41d4-a716-446655440002" \
  -H "Authorization: Bearer <clerk-token>" \
  -H "Content-Type: application/json" \
  -d '{"name": "Advanced Biology"}'

# Soft delete a subject
curl -X DELETE "https://api.example.com/subjects/550e8400-e29b-41d4-a716-446655440002" \
  -H "Authorization: Bearer <clerk-token>"

# Hard delete a subject
curl -X DELETE "https://api.example.com/subjects/550e8400-e29b-41d4-a716-446655440002/hard" \
  -H "Authorization: Bearer <clerk-token>"
```

### JavaScript/TypeScript

```typescript
const apiBase = "https://api.example.com";
const token = "your-clerk-token";

const headers = {
  "Authorization": `Bearer ${token}`,
  "Content-Type": "application/json"
};

// List subjects
const subjects = await fetch(`${apiBase}/subjects?term_id=term-123`, {
  headers
}).then(res => res.json());

// Create subject
const newSubject = await fetch(`${apiBase}/subjects`, {
  method: "POST",
  headers,
  body: JSON.stringify({
    name: "Chemistry",
    termId: "term-123"
  })
}).then(res => res.json());

// Update subject
const updated = await fetch(`${apiBase}/subjects/${newSubject.result.id}`, {
  method: "PUT",
  headers,
  body: JSON.stringify({ name: "Organic Chemistry" })
}).then(res => res.json());

// Soft delete
await fetch(`${apiBase}/subjects/${newSubject.result.id}`, {
  method: "DELETE",
  headers
});

// Hard delete
await fetch(`${apiBase}/subjects/${newSubject.result.id}/hard`, {
  method: "DELETE",
  headers
});
```

---

## Data Model

### Subject Entity

```typescript
interface Subject {
  id: string;              // UUID
  userId: string;          // Owner (from Clerk)
  termId: string;          // Parent term
  name: string;            // Subject name
  isDeleted: number;       // 0 = active, 1 = soft deleted
  deletedAt: string | null; // ISO 8601 timestamp
  createdAt: string;       // ISO 8601 timestamp
  updatedAt: string;       // ISO 8601 timestamp
}
```

### Cascade Behavior

- **Soft Delete**: Marks the subject and all related tasks/classes as deleted
- **Hard Delete**: Permanently removes the subject and all related data via foreign keys
- **Ownership**: Users can only access their own subjects

---

## Rate Limiting

Currently no rate limiting is enforced, but it's recommended to implement it for production.

---

## Version History

- **v1.0.0** (2024-10-17): Initial release with CRUD and cascade delete operations
