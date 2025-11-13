# Terms API - Client Examples

## Setup

```typescript
const BASE_URL = "https://api.classmate.studio";
const token = "your_clerk_token";

const headers = {
  "Authorization": `Bearer ${token}`,
  "Content-Type": "application/json",
};
```

## List Terms

```typescript
// Get all terms for the authenticated user
const response = await fetch(`${BASE_URL}/terms`, {
  method: "GET",
  headers,
});

const data = await response.json();
console.log(data.result); // Array of terms
```

## Create Term

```typescript
// Create a new term
const response = await fetch(`${BASE_URL}/terms`, {
  method: "POST",
  headers,
  body: JSON.stringify({
    name: "Fall 2024",
    order: 0,
  }),
});

if (response.status === 201) {
  const { result } = await response.json();
  console.log("Created term:", result.id);
} else {
  const error = await response.json();
  console.error("Failed to create term:", error);
}
```

## Update Term

```typescript
// Update a term (partial update)
const termId = "550e8400-e29b-41d4-a716-446655440000";

const response = await fetch(`${BASE_URL}/terms/${termId}`, {
  method: "PUT",
  headers,
  body: JSON.stringify({
    name: "Fall 2024 - Updated",
    order: 1,
  }),
});

const data = await response.json();
console.log("Updated term:", data.result);
```

## Update Just the Name

```typescript
// You can update just one field
const response = await fetch(`${BASE_URL}/terms/${termId}`, {
  method: "PUT",
  headers,
  body: JSON.stringify({
    name: "Winter 2025",
  }),
});

const data = await response.json();
console.log(data.result);
```

## Soft Delete Term

```typescript
// Soft delete (marks as deleted, preserves data)
const termId = "550e8400-e29b-41d4-a716-446655440000";

const response = await fetch(`${BASE_URL}/terms/${termId}`, {
  method: "DELETE",
  headers,
});

const data = await response.json();
console.log("Soft deleted:", data.result.isDeleted); // 1
console.log("Deleted at:", data.result.deletedAt); // timestamp
```

## Hard Delete Term

```typescript
// ⚠️ WARNING: Permanent deletion - irreversible!
const termId = "550e8400-e29b-41d4-a716-446655440000";

const response = await fetch(`${BASE_URL}/terms/${termId}/hard`, {
  method: "DELETE",
  headers,
});

const data = await response.json();
console.log("Permanently deleted:", data.result.id);
```

## Error Handling

### 400 Bad Request - Validation Error

```json
{
  "error": "Validation error",
  "issues": [
    {
      "path": "order",
      "message": "Order must be an integer",
      "code": "invalid_type"
    }
  ]
}
```

### 401 Unauthorized

```json
{
  "error": "Unauthorized",
  "name": "UnauthorizedError"
}
```

### 404 Not Found

```json
{
  "error": "Term not found",
  "name": "NotFoundError"
}
```

## Cascading Deletes

When you soft delete a term, all its subjects are also soft deleted:

```typescript
// Soft delete term
DELETE /terms/term-123

// Result:
// - terms table: term.isDeleted = 1, term.deletedAt = NOW()
// - subjects table: all rows with term_id = term-123 get isDeleted = 1
```

When you hard delete a term, everything is permanently removed:

```typescript
// Hard delete term
DELETE /terms/term-123/hard

// Result:
// - All subjects related to this term are deleted
// - All tasks related to those subjects are deleted
// - All classes related to those subjects are deleted
// - All files related to those tasks/classes are deleted
```
