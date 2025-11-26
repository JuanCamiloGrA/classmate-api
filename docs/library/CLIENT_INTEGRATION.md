# Library API - Client Integration Guide

> **Version**: 1.0.0  
> **Last Updated**: November 2025  
> **Base URL**: `/library`

## Overview

The Library API provides a unified "Knowledge Base" view that aggregates:
- **User Files**: Uploaded assets stored in R2 (PDFs, audio, images, etc.)
- **Scribe Projects**: Draft documents created with the Scribe feature

All endpoints require Clerk authentication. The API uses offset-based pagination (not page-based).

---

## Endpoints

### 1. List Library Items

**GET** `/library`

Retrieves a paginated, sorted, and filtered list of both files and scribe projects.

#### Query Parameters

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `search` | string | - | Search term for filename or document title (SQL LIKE) |
| `type` | string | `all` | Filter: `all`, `scribe_doc`, `audio`, `pdf`, `image`, `summary`, `other` |
| `subject_id` | string | - | Filter by subject UUID (applies to scribe projects only) |
| `sort_by` | string | `date` | Sort field: `date`, `name` |
| `sort_order` | string | `desc` | Sort direction: `asc`, `desc` |
| `limit` | number | 50 | Items per page (1-100) |
| `offset` | number | 0 | Number of items to skip |

#### Response (200 OK)

```json
{
  "success": true,
  "meta": {
    "total": 142,
    "limit": 50,
    "offset": 0
  },
  "result": [
    {
      "id": "scribe-uuid-1",
      "source": "scribe_project",
      "title": "Ensayo Final: Rev. Francesa",
      "type": "scribe_doc",
      "subject": "History 101",
      "subjectColor": "indigo",
      "date": "2025-10-24T14:30:00.000Z",
      "size": "1.2 KB",
      "status": "draft",
      "linkedTaskId": "task-uuid-99",
      "linkedTaskTitle": "Ensayo Historia",
      "downloadUrl": null
    },
    {
      "id": "file-uuid-2",
      "source": "user_file",
      "title": "Lecture 4: Audio Raw.mp3",
      "type": "audio",
      "subject": null,
      "subjectColor": null,
      "date": "2025-10-24T10:00:00.000Z",
      "size": "45 MB",
      "status": "final",
      "linkedTaskId": null,
      "linkedTaskTitle": null,
      "downloadUrl": null
    }
  ]
}
```

#### Frontend Adaptation Notes

- **Pagination**: Use `offset` instead of `page`. To convert: `offset = (page - 1) * limit`
- **`downloadUrl`**: Currently returns `null`. Generate presigned URLs on-demand when user requests download.
- **`status`**: For user files, always `"final"`. For scribe projects: `draft`, `collecting_answers`, `drafting`, `reviewing`, `needs_input`, `typesetting`, `completed`, `failed`.
- **`subject`/`subjectColor`**: User files don't have direct subject association (always `null`). Only scribe projects have this.

#### Example Usage (TypeScript)

```typescript
interface LibraryListParams {
  search?: string;
  type?: 'all' | 'scribe_doc' | 'audio' | 'pdf' | 'image' | 'summary' | 'other';
  subjectId?: string;
  sortBy?: 'date' | 'name';
  sortOrder?: 'asc' | 'desc';
  page?: number;  // Frontend uses page
  limit?: number;
}

async function fetchLibraryItems(params: LibraryListParams) {
  const { page = 1, limit = 50, subjectId, sortBy, sortOrder, ...rest } = params;
  
  const query = new URLSearchParams({
    ...rest,
    limit: String(limit),
    offset: String((page - 1) * limit),
    ...(subjectId && { subject_id: subjectId }),
    ...(sortBy && { sort_by: sortBy }),
    ...(sortOrder && { sort_order: sortOrder }),
  });

  const response = await fetch(`/library?${query}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  
  return response.json();
}
```

---

### 2. Get Storage Usage

**GET** `/library/storage`

Returns current storage consumption and quota for the authenticated user.

#### Response (200 OK)

```json
{
  "success": true,
  "result": {
    "usedBytes": 4500000000,
    "totalBytes": 1073741824,
    "usedFormatted": "4.2 GB",
    "totalFormatted": "1 GB",
    "percentage": 84,
    "tier": "free"
  }
}
```

#### Tier Limits

| Tier | Storage Limit |
|------|---------------|
| `free` | 1 GB |
| `pro` | 10 GB |
| `premium` | 100 GB |

---

### 3. Generate Presigned Upload URL

**POST** `/library/upload/presigned`

Generates a presigned URL for direct upload to R2 storage.

#### Request Body

```json
{
  "filename": "my_homework.pdf",
  "mimeType": "application/pdf",
  "sizeBytes": 2500000,
  "subjectId": "opt_subject_uuid",
  "taskId": "opt_task_uuid"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `filename` | string | Yes | Original filename |
| `mimeType` | string | Yes | MIME type (e.g., `application/pdf`, `audio/mpeg`) |
| `sizeBytes` | number | Yes | File size in bytes |
| `subjectId` | string | No | Optional subject UUID for tagging |
| `taskId` | string | No | Optional task UUID for linking |

#### Response (200 OK)

```json
{
  "success": true,
  "result": {
    "uploadUrl": "https://r2-presigned-upload-url...",
    "fileId": "new-file-uuid",
    "r2Key": "users/user123/1700000000-uuid-my_homework.pdf"
  }
}
```

#### Error Response (402 Payment Required)

```json
{
  "error": "Upload would exceed storage quota. Used: 1073000000, Limit: 1073741824, File size: 2500000"
}
```

#### Upload Flow

```typescript
async function uploadFile(file: File, subjectId?: string, taskId?: string) {
  // 1. Get presigned URL
  const presignedResponse = await fetch('/library/upload/presigned', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      filename: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
      subjectId,
      taskId
    })
  });

  if (presignedResponse.status === 402) {
    throw new Error('Storage quota exceeded');
  }

  const { result } = await presignedResponse.json();

  // 2. Upload directly to R2
  await fetch(result.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type },
    body: file
  });

  // 3. Confirm upload
  await fetch('/library/upload/confirm', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ fileId: result.fileId })
  });

  return result.fileId;
}
```

---

### 4. Confirm Upload

**POST** `/library/upload/confirm`

Called after successful R2 upload to finalize the file record and update storage usage.

#### Request Body

```json
{
  "fileId": "new-file-uuid"
}
```

#### Response (200 OK)

```json
{
  "success": true,
  "message": "Upload confirmed successfully"
}
```

#### Error Response (404 Not Found)

```json
{
  "error": "File not found or not owned by user"
}
```

---

### 5. Delete Library Item

**DELETE** `/library/{id}?source={source}`

Deletes a library item. User files are hard-deleted; scribe projects are soft-deleted.

#### Path Parameters

| Param | Type | Description |
|-------|------|-------------|
| `id` | string | Item UUID |

#### Query Parameters

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `source` | string | Yes | `user_file` or `scribe_project` |

#### Response (200 OK)

```json
{
  "success": true,
  "message": "Item deleted successfully"
}
```

#### Example Usage

```typescript
async function deleteLibraryItem(id: string, source: 'user_file' | 'scribe_project') {
  const response = await fetch(`/library/${id}?source=${source}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` }
  });
  
  if (!response.ok) {
    throw new Error('Failed to delete item');
  }
  
  return response.json();
}
```

---

## Type Definitions

```typescript
type LibraryItemSource = 'user_file' | 'scribe_project';

type LibraryItemType = 
  | 'scribe_doc' 
  | 'audio' 
  | 'pdf' 
  | 'image' 
  | 'summary' 
  | 'other';

type LibraryItemStatus = 
  | 'draft'
  | 'collecting_answers'
  | 'drafting'
  | 'reviewing'
  | 'needs_input'
  | 'typesetting'
  | 'completed'
  | 'failed'
  | 'final';

interface LibraryItem {
  id: string;
  source: LibraryItemSource;
  title: string;
  type: LibraryItemType;
  subject: string | null;
  subjectColor: string | null;
  date: string;  // ISO 8601 format
  size: string;  // Formatted (e.g., "1.2 KB", "45 MB")
  status: LibraryItemStatus;
  linkedTaskId: string | null;
  linkedTaskTitle: string | null;
  downloadUrl: string | null;
}

interface StorageUsage {
  usedBytes: number;
  totalBytes: number;
  usedFormatted: string;
  totalFormatted: string;
  percentage: number;
  tier: 'free' | 'pro' | 'premium';
}
```

---

## MIME Type Mapping

The API automatically maps MIME types to library item types:

| MIME Type Pattern | Library Type |
|-------------------|--------------|
| `application/pdf` | `pdf` |
| `audio/*` | `audio` |
| `image/*` | `image` |
| `text/plain`, `text/markdown` | `summary` |
| Other | `other` |

Scribe projects are always type `scribe_doc`.

---

## Error Handling

All endpoints return consistent error responses:

```json
{
  "error": "Error message here"
}
```

### Common HTTP Status Codes

| Status | Description |
|--------|-------------|
| 200 | Success |
| 400 | Validation error (invalid parameters) |
| 401 | Unauthorized (missing/invalid auth) |
| 402 | Payment required (storage quota exceeded) |
| 404 | Resource not found |
| 500 | Internal server error |

---

## Migration Notes for Frontend

### From Page-Based to Offset-Based Pagination

If your frontend currently uses `page` parameter:

```typescript
// Before (hypothetical page-based)
const params = { page: 2, limit: 50 };

// After (offset-based)
const page = 2;
const limit = 50;
const params = { 
  offset: (page - 1) * limit,  // offset = 50
  limit: 50 
};

// Calculate total pages from response
const totalPages = Math.ceil(response.meta.total / response.meta.limit);
```

### Handling Subject Colors

The `subjectColor` field contains the user's configured color theme for subjects (e.g., `"indigo"`, `"blue"`, `"red"`). Use this for consistent badge/tag styling:

```tsx
<Badge color={item.subjectColor ?? 'gray'}>
  {item.subject}
</Badge>
```

### Date Formatting

Dates are returned in ISO 8601 format. Use your preferred date library:

```typescript
import { formatDistanceToNow } from 'date-fns';

const formattedDate = formatDistanceToNow(new Date(item.date), { addSuffix: true });
// "2 hours ago"
```
