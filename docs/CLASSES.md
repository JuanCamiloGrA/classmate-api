# Classes API Documentation

## Overview

The Classes API provides endpoints for managing class sessions and lectures within subjects. Classes contain session information, transcriptions, summaries, and associated resources (files). All endpoints are protected and require authentication.

---

## Endpoints

### 1. List Classes

**Endpoint:** `GET /classes`

**Purpose:** Retrieve all non-deleted classes for a specific subject.

**Headers (Required):**

| Header | Value | Description |
|--------|-------|-------------|
| `Authorization` | `Bearer <jwt-token>` | Clerk JWT token for authentication |

**Query Parameters (Required):**

| Parameter | Type | Description |
|-----------|------|-------------|
| `subject_id` | `string` | UUID of the subject to list classes for |

**Request Body:** None

**Response:**

**Status: 200 OK**

```json
{
  "success": true,
  "result": [
    {
      "id": "class-550e8400-e29b-41d4-a716-446655440000",
      "subject_id": "subject-123",
      "title": "Chapter 5 Introduction",
      "start_date": "2024-10-20T09:00:00Z",
      "end_date": "2024-10-20T10:30:00Z",
      "link": "https://example.com/class/123",
      "created_at": "2024-10-16T10:00:00.000Z",
      "updated_at": "2024-10-16T10:00:00.000Z"
    },
    {
      "id": "class-660e8400-e29b-41d4-a716-446655440001",
      "subject_id": "subject-123",
      "title": "Advanced Topics",
      "start_date": "2024-10-21T09:00:00Z",
      "end_date": "2024-10-21T10:30:00Z",
      "link": "https://example.com/class/124",
      "created_at": "2024-10-17T10:00:00.000Z",
      "updated_at": "2024-10-17T10:00:00.000Z"
    }
  ]
}
```

**Status: 400 Bad Request**

```json
{
  "error": "subject_id is required"
}
```

**Status: 401 Unauthorized**

```json
{
  "error": "Unauthorized"
}
```

**Status: 500 Internal Server Error**

```json
{
  "error": "Internal server error"
}
```

---

### 2. Get Class Details

**Endpoint:** `GET /classes/:id`

**Purpose:** Retrieve a single class with all details, content, summary, and associated files.

**Headers (Required):**

| Header | Value | Description |
|--------|-------|-------------|
| `Authorization` | `Bearer <jwt-token>` | Clerk JWT token for authentication |

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `string` | UUID of the class to retrieve |

**Request Body:** None

**Response:**

**Status: 200 OK**

```json
{
  "success": true,
  "result": {
    "id": "class-550e8400-e29b-41d4-a716-446655440000",
    "subject_id": "subject-123",
    "title": "Chapter 5 Introduction",
    "start_date": "2024-10-20T09:00:00Z",
    "end_date": "2024-10-20T10:30:00Z",
    "link": "https://example.com/class/123",
    "content": "Introduction to advanced concepts in mathematics. We covered derivatives, integrals, and their applications...",
    "summary": "Covered chapter 5 topics including derivatives and integrals. Students learned how to apply calculus to real-world problems.",
    "is_deleted": 0,
    "deleted_at": null,
    "created_at": "2024-10-16T10:00:00.000Z",
    "updated_at": "2024-10-16T10:00:00.000Z",
    "resources": [
      {
        "id": "file-1",
        "original_filename": "lecture-slides.pdf",
        "mime_type": "application/pdf",
        "size_bytes": 5242880,
        "association_type": "resource"
      },
      {
        "id": "file-2",
        "original_filename": "class-notes.txt",
        "mime_type": "text/plain",
        "size_bytes": 102400,
        "association_type": "embedded_content"
      }
    ]
  }
}
```

**Status: 401 Unauthorized**

```json
{
  "error": "Unauthorized"
}
```

**Status: 404 Not Found**

```json
{
  "error": "Class not found"
}
```

**Status: 500 Internal Server Error**

```json
{
  "error": "Internal server error"
}
```

---

### 3. Create Class

**Endpoint:** `POST /classes`

**Purpose:** Create a new class within a subject for the authenticated user.

**Headers (Required):**

| Header | Value | Description |
|--------|-------|-------------|
| `Authorization` | `Bearer <jwt-token>` | Clerk JWT token for authentication |
| `Content-Type` | `application/json` | Must be application/json |

**Request Body:**

```json
{
  "subject_id": "subject-123",
  "title": "Chapter 5 Introduction",
  "start_date": "2024-10-20T09:00:00Z",
  "end_date": "2024-10-20T10:30:00Z",
  "link": "https://example.com/class/123",
  "content": "Introduction to advanced concepts in mathematics...",
  "summary": "Covered chapter 5 topics..."
}
```

**Field Descriptions:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `subject_id` | `string` | Yes | UUID of the subject this class belongs to |
| `title` | `string \| null` | No | Class title/name |
| `start_date` | `string (ISO 8601) \| null` | No | Class start datetime |
| `end_date` | `string (ISO 8601) \| null` | No | Class end datetime |
| `link` | `string (URL) \| null` | No | Class meeting link or recording link |
| `content` | `string \| null` | No | Class content/transcription/notes |
| `summary` | `string \| null` | No | AI-generated summary |

**Response:**

**Status: 201 Created**

```json
{
  "success": true,
  "result": {
    "id": "class-550e8400-e29b-41d4-a716-446655440000",
    "subject_id": "subject-123",
    "title": "Chapter 5 Introduction",
    "start_date": "2024-10-20T09:00:00Z",
    "end_date": "2024-10-20T10:30:00Z",
    "link": "https://example.com/class/123",
    "content": "Introduction to advanced concepts in mathematics...",
    "summary": "Covered chapter 5 topics...",
    "created_at": "2024-10-16T10:00:00.000Z",
    "updated_at": "2024-10-16T10:00:00.000Z"
  }
}
```

**Status: 400 Bad Request**

```json
{
  "error": "subject_id is required"
}
```

or

```json
{
  "error": "link: Link must be a valid URL"
}
```

**Status: 401 Unauthorized**

```json
{
  "error": "Unauthorized"
}
```

**Status: 500 Internal Server Error**

```json
{
  "error": "Internal server error"
}
```

---

### 4. Update Class

**Endpoint:** `PUT /classes/:id`

**Purpose:** Update an existing class belonging to the authenticated user.

**Headers (Required):**

| Header | Value | Description |
|--------|-------|-------------|
| `Authorization` | `Bearer <jwt-token>` | Clerk JWT token for authentication |
| `Content-Type` | `application/json` | Must be application/json |

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `string` | UUID of the class to update |

**Request Body:**

```json
{
  "title": "Updated Chapter 5",
  "content": "Updated content with more details...",
  "summary": "Updated summary..."
}
```

**Field Descriptions (all optional):**

| Field | Type | Description |
|-------|------|-------------|
| `title` | `string \| null` | Class title/name |
| `start_date` | `string (ISO 8601) \| null` | Class start datetime |
| `end_date` | `string (ISO 8601) \| null` | Class end datetime |
| `link` | `string (URL) \| null` | Class meeting link or recording link |
| `content` | `string \| null` | Class content/transcription/notes |
| `summary` | `string \| null` | AI-generated summary |

**Response:**

**Status: 200 OK**

```json
{
  "success": true,
  "result": {
    "id": "class-550e8400-e29b-41d4-a716-446655440000",
    "subject_id": "subject-123",
    "title": "Updated Chapter 5",
    "start_date": "2024-10-20T09:00:00Z",
    "end_date": "2024-10-20T10:30:00Z",
    "link": "https://example.com/class/123",
    "content": "Updated content with more details...",
    "summary": "Updated summary...",
    "updated_at": "2024-10-16T10:30:00.000Z"
  }
}
```

**Status: 400 Bad Request**

```json
{
  "error": "At least one field must be provided for update"
}
```

or

```json
{
  "error": "link: Link must be a valid URL"
}
```

**Status: 401 Unauthorized**

```json
{
  "error": "Unauthorized"
}
```

**Status: 404 Not Found**

```json
{
  "error": "Class not found"
}
```

**Status: 500 Internal Server Error**

```json
{
  "error": "Internal server error"
}
```

---

### 5. Soft Delete Class

**Endpoint:** `DELETE /classes/:id`

**Purpose:** Soft delete a class (mark as deleted without removing data). Deleted classes are excluded from list operations.

**Headers (Required):**

| Header | Value | Description |
|--------|-------|-------------|
| `Authorization` | `Bearer <jwt-token>` | Clerk JWT token for authentication |

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `string` | UUID of the class to soft delete |

**Request Body:** None

**Response:**

**Status: 200 OK**

```json
{
  "success": true,
  "result": {
    "id": "class-550e8400-e29b-41d4-a716-446655440000",
    "is_deleted": 1,
    "deleted_at": "2024-10-16T10:35:00.000Z"
  }
}
```

**Status: 401 Unauthorized**

```json
{
  "error": "Unauthorized"
}
```

**Status: 404 Not Found**

```json
{
  "error": "Class not found"
}
```

**Status: 500 Internal Server Error**

```json
{
  "error": "Internal server error"
}
```

---

### 6. Hard Delete Class

**Endpoint:** `DELETE /classes/:id/hard`

**Purpose:** Permanently delete a class and all associated resources (files). This action is irreversible.

**Headers (Required):**

| Header | Value | Description |
|--------|-------|-------------|
| `Authorization` | `Bearer <jwt-token>` | Clerk JWT token for authentication |

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `string` | UUID of the class to permanently delete |

**Request Body:** None

**Response:**

**Status: 200 OK**

```json
{
  "success": true,
  "result": {
    "id": "class-550e8400-e29b-41d4-a716-446655440000"
  }
}
```

**Status: 401 Unauthorized**

```json
{
  "error": "Unauthorized"
}
```

**Status: 404 Not Found**

```json
{
  "error": "Class not found"
}
```

**Status: 500 Internal Server Error**

```json
{
  "error": "Internal server error"
}
```

---

## Authentication

All endpoints (except webhook handlers) require a valid Clerk JWT token. Include it in the `Authorization` header as:

```
Authorization: Bearer <jwt-token>
```

---

## Error Handling

All error responses follow this format:

```json
{
  "error": "Error description"
}
```

or for complex errors with multiple field issues:

```json
{
  "error": "field1.path: error message; field2.path: error message"
}
```

Refer to the status codes in each endpoint section for specific error scenarios.

---

## Data Types

### Class

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | UUID of the class |
| `subject_id` | `string` | UUID of the subject |
| `title` | `string \| null` | Class title |
| `start_date` | `string (ISO 8601) \| null` | Start datetime |
| `end_date` | `string (ISO 8601) \| null` | End datetime |
| `link` | `string (URL) \| null` | Class link |
| `content` | `string \| null` | Class content/transcription |
| `summary` | `string \| null` | AI-generated summary |
| `is_deleted` | `number` | Deletion status (0 = active, 1 = deleted) |
| `deleted_at` | `string (ISO 8601) \| null` | Soft delete timestamp |
| `created_at` | `string (ISO 8601)` | Creation timestamp |
| `updated_at` | `string (ISO 8601)` | Last update timestamp |

### ClassResource

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | UUID of the file |
| `original_filename` | `string` | Original filename |
| `mime_type` | `string` | MIME type (e.g., "application/pdf") |
| `size_bytes` | `number` | File size in bytes |
| `association_type` | `string` | Type of association ("resource" or "embedded_content") |

---

## Usage Examples

### List all classes for a subject

```bash
curl -X GET "https://api.classmate.com/classes?subject_id=subject-123" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Get class details with resources

```bash
curl -X GET "https://api.classmate.com/classes/class-550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Create a new class

```bash
curl -X POST "https://api.classmate.com/classes" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "subject_id": "subject-123",
    "title": "Chapter 5 Introduction",
    "start_date": "2024-10-20T09:00:00Z",
    "end_date": "2024-10-20T10:30:00Z"
  }'
```

### Update a class

```bash
curl -X PUT "https://api.classmate.com/classes/class-550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Updated Chapter 5",
    "content": "Updated content..."
  }'
```

### Soft delete a class

```bash
curl -X DELETE "https://api.classmate.com/classes/class-550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Hard delete a class

```bash
curl -X DELETE "https://api.classmate.com/classes/class-550e8400-e29b-41d4-a716-446655440000/hard" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## Notes

- **Authentication Required**: All endpoints require a valid Clerk JWT token in the `Authorization` header.
- **User Isolation**: Users can only access their own classes. Attempting to access another user's class will result in a 404 response.
- **Soft Delete**: Soft-deleted classes are excluded from list operations but can be permanently deleted later.
- **Hard Delete**: Permanently deletes the class and all associated resources. This cannot be undone.
- **Timestamps**: All timestamps are in ISO 8601 format with UTC timezone.
- **URL Validation**: The `link` field is validated as a valid URL when provided.
