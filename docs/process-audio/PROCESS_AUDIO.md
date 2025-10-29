# Process Audio API Documentation

## Overview

The Process Audio API enables asynchronous processing of audio recordings and text files to generate AI-powered summaries for class sessions. This endpoint triggers a durable Cloudflare Workflow that handles audio transcription (via Google Gemini AI), content summarization, and automatic cleanup of temporary files.

---

## Endpoint

### Process Class Audio/Text

**Endpoint:** `POST /classes/:classId/process-audio`

**Purpose:** Trigger asynchronous AI processing of an uploaded audio recording or text file to generate a class summary. The file must be previously uploaded to R2 storage via the presigned URL flow.

**Headers (Required):**

| Header | Value | Description |
|--------|-------|-------------|
| `Authorization` | `Bearer <jwt-token>` | Clerk JWT token for authentication |
| `Content-Type` | `application/json` | Must be application/json |

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `classId` | `string` | UUID of the class to process audio for |

**Request Body:**

```json
{
  "r2_key": "temp/user-abc123/class-xyz789/audio-recording.mp3",
  "file_name": "lecture-recording.mp3",
  "mime_type": "audio/mpeg"
}
```

**Field Descriptions:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `r2_key` | `string` | Yes | R2 storage key where the file was uploaded (from presigned URL response) |
| `file_name` | `string` | Yes | Original filename of the uploaded file |
| `mime_type` | `string` | Yes | MIME type of the file (e.g., "audio/mpeg", "audio/wav", "text/plain") |

**Supported File Types:**

**Audio formats:**
- `audio/mpeg` (MP3)
- `audio/wav` (WAV)
- `audio/ogg` (OGG)
- `audio/webm` (WebM Audio)
- `audio/mp4` (M4A)
- `audio/flac` (FLAC)
- Files with `application/octet-stream` and audio extensions (`.mp3`, `.wav`, `.ogg`, etc.)

**Text formats:**
- `text/plain` (TXT)
- Any non-audio MIME type with text content

**Response:**

**Status: 202 Accepted**

```json
{
  "success": true,
  "result": {
    "workflow_id": "wf_550e8400-e29b-41d4-a716-446655440000",
    "status": "running",
    "message": "Audio processing started. Summary will be available once workflow completes."
  }
}
```

**Status: 400 Bad Request**

```json
{
  "error": "r2_key is required"
}
```

or

```json
{
  "error": "file_name is required"
}
```

or

```json
{
  "error": "mime_type is required"
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
  "error": "Class not found or does not belong to user"
}
```

**Status: 500 Internal Server Error**

```json
{
  "error": "Internal server error"
}
```

---

## Workflow Process

Once triggered, the endpoint initiates a **durable Cloudflare Workflow** that executes the following steps:

### Step 1: Generate Summary
- Downloads the file from R2 storage using the provided `r2_key`
- Detects if the file is audio or text based on MIME type and extension
- For **audio files**: Uploads to Google Gemini AI for transcription and summarization
- For **text files**: Processes the content directly with Google Gemini AI
- Generates a markdown-formatted summary of the class content

### Step 2: Save Summary
- Converts the markdown summary to XSS-safe HTML using MiniGFM
- Updates the class record in the database with the generated summary
- Sets the `updated_at` timestamp

### Step 3: Cleanup Temporary File
- Deletes the temporary file from R2 storage to free up space
- Only temporary files (those in `temp/` prefix) are cleaned up
- Permanent files are preserved

**Processing Time:** Typically 10-60 seconds depending on file size and AI processing time.

**Durability:** The workflow is durable and will automatically retry on transient failures. If the worker crashes or restarts, the workflow resumes from the last completed step.

---

## Complete Upload & Process Flow

### 1. Generate Presigned URL

```bash
curl -X POST "https://api.ascendclassmate.workers.dev/classes/class-123/generate-upload-url" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "file_name": "lecture-recording.mp3",
    "content_type": "audio/mpeg"
  }'
```

**Response:**
```json
{
  "success": true,
  "result": {
    "signed_url": "https://r2.cloudflare.com/...",
    "key": "temp/user-abc123/class-123/lecture-recording.mp3"
  }
}
```

### 2. Upload File to R2

```bash
curl -X PUT "https://r2.cloudflare.com/..." \
  -H "Content-Type: audio/mpeg" \
  --data-binary "@lecture-recording.mp3"
```

### 3. Trigger Processing

```bash
curl -X POST "https://api.ascendclassmate.workers.dev/classes/class-123/process-audio" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "r2_key": "temp/user-abc123/class-123/lecture-recording.mp3",
    "file_name": "lecture-recording.mp3",
    "mime_type": "audio/mpeg"
  }'
```

**Response:**
```json
{
  "success": true,
  "result": {
    "workflow_id": "wf_550e8400-e29b-41d4-a716-446655440000",
    "status": "running",
    "message": "Audio processing started. Summary will be available once workflow completes."
  }
}
```

### 4. Check Class for Summary

After the workflow completes (typically 10-60 seconds), retrieve the class to access the generated summary:

```bash
curl -X GET "https://api.ascendclassmate.workers.dev/classes/class-123" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "result": {
    "id": "class-123",
    "subject_id": "subject-456",
    "title": "Advanced Calculus Lecture",
    "summary": "<h2>Class Summary</h2><p>This lecture covered the fundamentals of derivatives and their applications...</p>",
    "content": null,
    "updated_at": "2024-10-28T10:15:00.000Z"
  }
}
```

---

## Authentication

This endpoint requires a valid Clerk JWT token. Include it in the `Authorization` header as:

```
Authorization: Bearer <jwt-token>
```

The authenticated user must own the class specified by `classId`.

---

## Error Handling

All error responses follow this format:

```json
{
  "error": "Error description"
}
```

Common error scenarios:

| Error | Status | Cause |
|-------|--------|-------|
| `r2_key is required` | 400 | Missing `r2_key` field |
| `file_name is required` | 400 | Missing `file_name` field |
| `mime_type is required` | 400 | Missing `mime_type` field |
| `Unauthorized` | 401 | Invalid or missing JWT token |
| `Class not found or does not belong to user` | 404 | Class doesn't exist or user doesn't have access |
| `Internal server error` | 500 | Server-side processing error |

---

## Important Notes

- **Asynchronous Processing**: This endpoint returns immediately (202 Accepted) and processes the file in the background
- **Workflow Durability**: The workflow is durable and will retry on failures automatically
- **File Cleanup**: Temporary files are automatically deleted after processing to save storage costs
- **Overwrite Behavior**: If the class already has a summary, it will be overwritten with the new one
- **File Size Limits**: Audio files are limited by Google Gemini AI constraints (typically up to 2GB)
- **Processing Time**: Varies based on file size and AI load, typically 10-60 seconds
- **User Isolation**: Users can only process audio for their own classes
- **XSS Protection**: Generated summaries are converted to safe HTML to prevent XSS attacks

---

## AI Processing Details

### Audio Files
- Uploaded to Google Gemini AI (`gemini-flash-lite-latest` model)
- AI performs both transcription and summarization in one step
- Output format: Structured markdown with headings, lists, and key points

### Text Files
- Content is wrapped in XML tags for structured processing
- AI generates a summary based on the text content
- Output format: Same structured markdown as audio processing

### Prompt Template
The AI uses a production prompt template loaded from Cloudflare Workers ASSETS binding. The prompt ensures:
- Consistent summary structure (headings, key points, important concepts)
- Educational focus appropriate for class notes
- Markdown formatting for easy rendering

---

## Client Integration Example

See [CLIENT_INTEGRATION.md](./process-audio/CLIENT_INTEGRATION.md) for complete TypeScript/JavaScript examples with React and Vue.js components.

### Quick Example

```typescript
async function processClassAudio(
  classId: string,
  r2Key: string,
  fileName: string,
  mimeType: string,
  authToken: string
): Promise<{ workflowId: string }> {
  const response = await fetch(
    `https://api.ascendclassmate.workers.dev/classes/${classId}/process-audio`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        r2_key: r2Key,
        file_name: fileName,
        mime_type: mimeType,
      }),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to process audio');
  }

  const { result } = await response.json();
  return { workflowId: result.workflow_id };
}
```

---

## Best Practices

1. **Upload First**: Always upload the file to R2 via presigned URL before calling this endpoint
2. **Store Workflow ID**: Save the returned `workflow_id` for tracking and debugging
3. **Poll for Completion**: Poll the class endpoint every 5-10 seconds to check if `summary` has been populated
4. **Handle Failures**: Check class `summary` field; if it remains `null` after 2 minutes, consider retrying
5. **Validate MIME Types**: Ensure `mime_type` accurately represents the file type
6. **Use Temporary Storage**: Upload to `temp/` prefix paths for automatic cleanup
7. **Show Progress UI**: Display a loading state while the workflow processes the file
8. **Consider File Size**: Larger audio files take longer to process; set appropriate timeout expectations
