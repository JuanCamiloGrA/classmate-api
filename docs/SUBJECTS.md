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

### 2. Get a Subject by ID

**GET** `/subjects/{id}`

Retrieve a single subject with all details and paginated list of associated classes.

#### Path Parameters
- `id` (required): The subject ID to retrieve

#### Query Parameters
- `page` (optional): Page number (1-based, defaults to 1)
- `limit` (optional): Items per page (1-100, defaults to 20)

#### Response (200)
```json
{
  "success": true,
  "result": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Mathematics",
    "termId": "term-123",
    "professor": "Dr. Smith",
    "credits": 4,
    "location": "Room 101",
    "scheduleText": "MWF 10:00 AM - 11:30 AM",
    "syllabusUrl": "https://example.com/syllabus.pdf",
    "colorTheme": "blue",
    "createdAt": "2024-10-16T10:00:00.000Z",
    "updatedAt": "2024-10-16T10:00:00.000Z",
    "classes": [
      {
        "id": "class-uuid-1",
        "title": "Introduction to Calculus",
        "startDate": "2024-10-16T10:00:00.000Z",
        "endDate": "2024-10-16T11:30:00.000Z",
        "link": "https://example.com/recording",
        "meetingLink": "https://zoom.us/meeting123",
        "status": "completed",
        "aiStatus": "done",
        "topics": "Limits, Derivatives",
        "durationSeconds": 5400,
        "roomLocation": "Room 101",
        "isProcessed": 1,
        "createdAt": "2024-10-16T10:00:00.000Z",
        "updatedAt": "2024-10-16T12:00:00.000Z"
      }
    ],
    "pagination": {
      "total": 15,
      "page": 1,
      "limit": 20,
      "totalPages": 1
    }
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

### 3. Create a Subject

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

### 4. Update a Subject

**PATCH** `/subjects/{id}`

Update any fields of an existing subject. All fields are optional, but at least one must be provided.

#### Path Parameters
- `id`: The subject ID to update

#### Request Body
All fields are optional. At least one must be provided:
```json
{
  "name": "Calculus I",
  "termId": "term-456",
  "professor": "Dr. Smith",
  "credits": 4,
  "location": "Room 101",
  "scheduleText": "MWF 10:00 AM - 11:30 AM",
  "syllabusUrl": "https://example.com/syllabus.pdf",
  "colorTheme": "blue"
}
```

**Field Details:**
- `name` (string, optional): Subject name
- `termId` (string, optional): Move subject to a different term
- `professor` (string, optional): Professor name (nullable)
- `credits` (number, optional): Credit hours (must be positive integer)
- `location` (string, optional): Class location (nullable)
- `scheduleText` (string, optional): Schedule information (nullable)
- `syllabusUrl` (string, optional): URL to syllabus (must be valid URL if provided, nullable)
- `colorTheme` (string, optional): Color theme identifier (nullable)

#### Response (200)
```json
{
  "success": true,
  "result": {
    "id": "550e8400-e29b-41d4-a716-446655440002",
    "name": "Calculus I",
    "termId": "term-456",
    "professor": "Dr. Smith",
    "credits": 4,
    "location": "Room 101",
    "scheduleText": "MWF 10:00 AM - 11:30 AM",
    "syllabusUrl": "https://example.com/syllabus.pdf",
    "colorTheme": "blue",
    "updatedAt": "2024-10-16T11:30:00.000Z"
  }
}
```

#### Error Response (400 - No fields provided)
```json
{
  "error": "At least one field must be provided for update"
}
```

#### Error Response (400 - Invalid data)
```json
{
  "error": "credits: Credits must be a positive integer"
}
```

#### Error Response (404)
```json
{
  "error": "Subject not found"
}
```

---

### 5. Soft Delete a Subject

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

### 6. Hard Delete a Subject

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
curl -X GET "https://api.classmate.studio/subjects?term_id=term-123" \
  -H "Authorization: Bearer <clerk-token>"

# Get a subject by ID with classes (first page, default 20 items)
curl -X GET "https://api.classmate.studio/subjects/550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer <clerk-token>"

# Get a subject by ID with classes (paginated)
curl -X GET "https://api.classmate.studio/subjects/550e8400-e29b-41d4-a716-446655440000?page=2&limit=10" \
  -H "Authorization: Bearer <clerk-token>"

# Create a subject
curl -X POST "https://api.classmate.studio/subjects" \
  -H "Authorization: Bearer <clerk-token>" \
  -H "Content-Type: application/json" \
  -d '{"name": "Biology", "termId": "term-123"}'

# Update a subject (single field)
curl -X PATCH "https://api.classmate.studio/subjects/550e8400-e29b-41d4-a716-446655440002" \
  -H "Authorization: Bearer <clerk-token>" \
  -H "Content-Type: application/json" \
  -d '{"name": "Advanced Biology"}'

# Update a subject (multiple fields)
curl -X PATCH "https://api.classmate.studio/subjects/550e8400-e29b-41d4-a716-446655440002" \
  -H "Authorization: Bearer <clerk-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Advanced Biology",
    "professor": "Dr. Johnson",
    "credits": 4,
    "location": "Lab 203",
    "colorTheme": "green"
  }'

# Soft delete a subject
curl -X DELETE "https://api.classmate.studio/subjects/550e8400-e29b-41d4-a716-446655440002" \
  -H "Authorization: Bearer <clerk-token>"

# Hard delete a subject
curl -X DELETE "https://api.classmate.studio/subjects/550e8400-e29b-41d4-a716-446655440002/hard" \
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

// List subjects
const subjects = await fetch(`${apiBase}/subjects?term_id=term-123`, {
  headers
}).then(res => res.json());

// Get a subject with classes (paginated)
const subjectWithClasses = await fetch(
  `${apiBase}/subjects/550e8400-e29b-41d4-a716-446655440000?page=1&limit=20`,
  { headers }
).then(res => res.json());

// Access subject details and classes
console.log(subjectWithClasses.result.name);
console.log(subjectWithClasses.result.classes);
console.log(subjectWithClasses.result.pagination);

// Create subject
const newSubject = await fetch(`${apiBase}/subjects`, {
  method: "POST",
  headers,
  body: JSON.stringify({
    name: "Chemistry",
    termId: "term-123"
  })
}).then(res => res.json());

// Update subject (single field)
const updated = await fetch(`${apiBase}/subjects/${newSubject.result.id}`, {
  method: "PATCH",
  headers,
  body: JSON.stringify({ name: "Organic Chemistry" })
}).then(res => res.json());

// Update subject (multiple fields)
const fullyUpdated = await fetch(`${apiBase}/subjects/${newSubject.result.id}`, {
  method: "PATCH",
  headers,
  body: JSON.stringify({
    name: "Organic Chemistry",
    professor: "Dr. Wilson",
    credits: 3,
    location: "Room 205",
    scheduleText: "TTh 2:00 PM - 3:30 PM",
    syllabusUrl: "https://example.com/chem-syllabus.pdf",
    colorTheme: "purple"
  })
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
  id: string;                      // UUID
  userId: string;                  // Owner (from Clerk)
  termId: string;                  // Parent term
  name: string;                    // Subject name
  professor: string | null;        // Professor name
  credits: number | null;          // Credit hours
  location: string | null;         // Class location
  scheduleText: string | null;     // Schedule information
  syllabusUrl: string | null;      // URL to syllabus
  colorTheme: string | null;       // Color theme identifier
  isDeleted: number;               // 0 = active, 1 = soft deleted
  deletedAt: string | null;        // ISO 8601 timestamp
  createdAt: string;               // ISO 8601 timestamp
  updatedAt: string;               // ISO 8601 timestamp
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

- **v1.2.0** (2026-01-04): Added GET /subjects/{id} endpoint to retrieve a single subject with paginated classes
- **v1.1.0** (2026-01-04): Added support for updating all subject fields (professor, credits, location, scheduleText, syllabusUrl, colorTheme, termId)
- **v1.0.0** (2024-10-17): Initial release with CRUD and cascade delete operations
