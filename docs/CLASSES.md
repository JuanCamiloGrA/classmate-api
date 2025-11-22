# Classes API Documentation

## Overview

The Classes API provides endpoints for managing class sessions and lectures within subjects. Classes contain session information, transcriptions, summaries, and associated resources (files). All endpoints are protected and require authentication.

---

## Endpoints

### 1. List Classes

**Endpoint:** `GET /classes`

**Purpose:** Retrieve classes with flexible, pagination-aware filters. Filters are optional so the frontend can request only the slice it needs (subject_id is no longer required).

**Headers (Required):**

| Header | Value | Description |
|--------|-------|-------------|
| `Authorization` | `Bearer <jwt-token>` | Clerk JWT token for authentication |

**Query Parameters (Optional):**

| Parameter | Type | Description |
|-----------|------|-------------|
| `subject_id` | `string` | UUID of the subject to limit the list (omit to span all subjects). |
| `status` | `string` | Comma-separated lifecycle statuses (`scheduled`, `live`, `completed`). |
| `meeting_link` | `string (URL) \| null` | Alternate meeting URL |
| `status` | `string` | Lifecycle status (`scheduled`, `live`, `completed`).
| `ai_status` | `string` | AI processing state (`none`, `processing`, `done`, `failed`).
| `topics` | `string \| null` | Comma/JSON list of topics |
| `duration_seconds` | `number` | Session duration in seconds |
| `ai_status` | `string` | Comma-separated AI processing states (`none`, `processing`, `done`, `failed`). |
| `is_processed` | `string` | `true`/`false` or `1`/`0` to filter by processing flag. |
| `transcription_text` | `string \| null` | Full transcription text |
| `room_location` | `string \| null` | Physical location where the class was held |
| `is_processed` | `number` | Flag (0/1) indicating if AI processing already ran |
| `search` | `string` | Free-text match against titles. |
| `start_date_from` | `string (ISO 8601)` | Start date lower bound.
| `start_date_to` | `string (ISO 8601)` | Start date upper bound.
| `end_date_from` | `string (ISO 8601)` | End date lower bound.
| `end_date_to` | `string (ISO 8601)` | End date upper bound.
| `limit` | `number` | Page size (default 20, max 100).
| `offset` | `number` | Pagination offset (default 0).
| `sort_by` | `string` | Sort column (`startDate`, `createdAt`, `status`).
| `sort_order` | `string` | Sort direction (`asc` or `desc`).

**Request Body:** None

**Response:**

    "meeting_link": "https://example.com/meeting/123",
    "link": "https://example.com/class/123",
    "status": "live",
    "ai_status": "processing",
    "topics": "[\"Advanced\", \"Review\"]",
    "duration_seconds": 5400,
    "content": "Updated content with more details...",
    "summary": "Updated summary...",
    "transcription_text": "Updated transcription...",
    "room_location": "Room 101",
    "is_processed": 1,
{
  "success": true,
  "result": {
    "data": [
      {
        "id": "class-550e8400-e29b-41d4-a716-446655440000",
        "subject_id": "subject-123",
        "title": "Chapter 5 Introduction",
        "start_date": "2024-10-20T09:00:00Z",
        "end_date": "2024-10-20T10:30:00Z",
        "status": "completed",
        "ai_status": "none",
        "meeting_link": "https://example.com/meeting/123",
        "topics": "[\"Derivatives\", \"Integrals\"]",
        "duration_seconds": 5400,
        "room_location": "Room 101",
        "is_processed": 0,
        "link": "https://example.com/class/123",
        "created_at": "2024-10-16T10:00:00.000Z",
        "updated_at": "2024-10-16T10:00:00.000Z"
      }
    ],
    "meta": {
      "total": 1,
      "limit": 20,
      "offset": 0
    }
  }
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
    "meeting_link": "https://example.com/meeting/123",
    "link": "https://example.com/class/123",
    "status": "completed",
    "ai_status": "none",
    "topics": "[\"Derivatives\", \"Integrals\"]",
    "duration_seconds": 5400,
    "content": "Introduction to advanced concepts in mathematics. We covered derivatives, integrals, and their applications...",
    "summary": "Covered chapter 5 topics including derivatives and integrals. Students learned how to apply calculus to real-world problems.",
    "transcription_text": "Full transcription text...",
    "room_location": "Room 101",
    "is_processed": 1,
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
  "meeting_link": "https://example.com/meeting/123",
  "status": "scheduled",
  "ai_status": "none",
  "topics": "[\"Derivatives\", \"Integrals\"]",
  "duration_seconds": 5400,
  "content": "Introduction to advanced concepts in mathematics...",
  "summary": "Covered chapter 5 topics...",
  "transcription_text": "Full transcription text...",
  "room_location": "Room 101",
  "is_processed": 0
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
| `meeting_link` | `string (URL) \| null` | No | Dedicated meeting URL when it differs from the recording link |
| `status` | `string` | No | Lifecycle status (`scheduled`, `live`, `completed`). Defaults to `completed`.
| `ai_status` | `string` | No | AI processing state (`none`, `processing`, `done`, `failed`). Defaults to `none`.
| `topics` | `string \| null` | No | Comma/JSON list of topics covered in the session.
| `duration_seconds` | `number` | No | Recorded duration of the session in seconds.
| `content` | `string \| null` | No | Class content/transcription/notes |
| `summary` | `string \| null` | No | AI-generated summary |
| `transcription_text` | `string \| null` | No | Full transcription text from processing.
| `room_location` | `string \| null` | No | Physical location where the class was held.
| `is_processed` | `number` | No | Flag (0/1) indicating if AI processing already ran. Defaults to `0`.

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
    "meeting_link": "https://example.com/meeting/123",
    "link": "https://example.com/class/123",
    "status": "completed",
    "ai_status": "none",
    "topics": "[\"Derivatives\", \"Integrals\"]",
    "duration_seconds": 5400,
    "content": "Introduction to advanced concepts in mathematics...",
    "summary": "Covered chapter 5 topics...",
    "transcription_text": "Full transcription text...",
    "room_location": "Room 101",
    "is_processed": 0,
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
| `meeting_link` | `string (URL) \| null` | Dedicated meeting link when it differs from the recording link |
| `status` | `string` | Lifecycle status (`scheduled`, `live`, `completed`). |
| `ai_status` | `string` | AI processing status (`none`, `processing`, `done`, `failed`). |
| `topics` | `string \| null` | Serialized list of topics covered in the session. |
| `duration_seconds` | `number` | Duration of the class in seconds |
| `content` | `string \| null` | Class content/transcription |
| `summary` | `string \| null` | AI-generated summary |
| `transcription_text` | `string \| null` | Full transcription text |
| `room_location` | `string \| null` | Physical room or location |
| `is_processed` | `number` | Flag (0/1) indicating AI processing completed |
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
curl -X GET "https://api.classmate.studio/classes?subject_id=subject-123" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Get class details with resources

```bash
curl -X GET "https://api.classmate.studio/classes/class-550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Create a new class

```bash
curl -X POST "https://api.classmate.studio/classes" \
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
curl -X PUT "https://api.classmate.studio/classes/class-550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Updated Chapter 5",
    "content": "Updated content..."
  }'
```

### Soft delete a class

```bash
curl -X DELETE "https://api.classmate.studio/classes/class-550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Hard delete a class

```bash
curl -X DELETE "https://api.classmate.studio/classes/class-550e8400-e29b-41d4-a716-446655440000/hard" \
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
