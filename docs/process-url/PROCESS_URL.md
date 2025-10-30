# Process Class from URL

## Overview

The `/classes/:classId/process-url` endpoint allows clients to trigger asynchronous processing of a class from an external URL. This endpoint delegates the heavy lifting of downloading files and extracting audio to a Cloud Run service, while the Cloudflare Workflow orchestrates the entire summarization process.

## Endpoint

```
POST /classes/:classId/process-url
```

## Authentication

Requires valid Clerk authentication token in request headers.

## Request

### Path Parameters

| Parameter | Type   | Required | Description                                    |
|-----------|--------|----------|------------------------------------------------|
| `classId` | string | Yes      | The ID of the class to process                 |

### Request Body

```json
{
  "source_url": "https://example.com/lecture-recording.mp4"
}
```

| Field        | Type   | Required | Description                                               |
|--------------|--------|----------|-----------------------------------------------------------|
| `source_url` | string | Yes      | Valid URL pointing to the file to process (audio or text) |

### Validation Rules

- `source_url` must be a syntactically valid URL
- User must own the class specified by `classId`
- Additional validations (domain whitelist, file size, content type) are handled by the Heavy API

## Response

### Success Response (202 Accepted)

```json
{
  "success": true,
  "result": {
    "workflow_instance_id": "01JGXXX...",
    "status": "accepted"
  }
}
```

| Field                         | Type   | Description                                    |
|-------------------------------|--------|------------------------------------------------|
| `result.workflow_instance_id` | string | Unique identifier for tracking workflow status |
| `result.status`               | string | Always "accepted" for successful requests      |

### Error Responses

#### 400 Bad Request

```json
{
  "error": "source_url: A valid URL is required"
}
```

Returned when:
- `source_url` is missing or invalid
- Request body format is incorrect

#### 401 Unauthorized

```json
{
  "error": "Unauthorized: Missing or invalid authentication credentials"
}
```

Returned when:
- No authentication token provided
- Authentication token is invalid or expired

#### 404 Not Found

```json
{
  "error": "Class not found or you don't have access to it"
}
```

Returned when:
- The `classId` doesn't exist
- The authenticated user doesn't own the class

#### 500 Internal Server Error

```json
{
  "error": "Internal server error"
}
```

Returned when:
- Workflow creation fails
- Database connection issues
- Unexpected server errors

## Workflow Process

Once the request is accepted, the following workflow steps execute asynchronously:

### 1. Prepare File Input (15 min timeout, 3 retries)

- Calls the Cloud Run Heavy API with the source URL
- Heavy API downloads the file
- Extracts audio if the source is a video file
- Uploads processed file to R2 storage
- Returns R2 key, filename, and MIME type

### 2. Generate Summary (30 min timeout, 3 retries)

- Downloads the file from R2
- Processes with Google Gemini AI
- Generates markdown summary

### 3. Save Summary (10 min timeout, 5 retries)

- Converts markdown to HTML
- Saves to database (updates `classes.summary` field)

### 4. Cleanup (5 min timeout)

- Deletes temporary file from R2

## Architecture

### Components

```
Client Request
     ↓
Hono Endpoint (process-url)
     ↓
Cloudflare Workflow
     ↓
┌─────────────────────┐
│ prepare-file-input  │ ──→ Cloud Run Heavy API
└─────────────────────┘         ↓
     ↓                    Download + Extract
┌─────────────────────┐         ↓
│  generate-summary   │ ←── Upload to R2
└─────────────────────┘
     ↓
┌─────────────────────┐
│   save-summary      │ ──→ D1 Database
└─────────────────────┘
     ↓
┌─────────────────────┐
│  cleanup-temp-file  │ ──→ R2 Storage
└─────────────────────┘
```

### Service Layers

- **HTTP Layer**: `classes-process-url.ts` (route handler)
- **Validation**: `ProcessUrlSchema` (Zod schema)
- **Domain Service**: `ProcessingService` (port interface)
- **Infrastructure**: `CloudRunProcessingService` (adapter implementation)
- **Orchestration**: `SummarizeClassWorkflowHandler` (workflow steps)

## Error Handling

### Heavy API Failures

- All retry logic resides within the `prepare-file-input` workflow step
- CloudRunProcessingService throws errors on non-2xx responses
- Workflow retries automatically (3 attempts with exponential backoff)

### Workflow Step Failures

Each step has independent retry configuration:
- `prepare-file-input`: 3 retries, 10s delay, exponential backoff
- `generate-summary`: 3 retries, 10s delay, exponential backoff
- `save-summary`: 5 retries, 5s delay, exponential backoff
- `cleanup-temp-file`: No retries (cleanup is best-effort)

## Example Usage

### cURL

```bash
curl -X POST https://api.example.com/classes/class_123/process-url \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_CLERK_TOKEN" \
  -d '{
    "source_url": "https://example.com/lecture.mp4"
  }'
```

### JavaScript (Fetch)

```javascript
const response = await fetch(`https://api.example.com/classes/${classId}/process-url`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${clerkToken}`
  },
  body: JSON.stringify({
    source_url: 'https://example.com/lecture.mp4'
  })
});

const data = await response.json();
console.log('Workflow ID:', data.result.workflow_instance_id);
```

### TypeScript

```typescript
interface ProcessUrlRequest {
  source_url: string;
}

interface ProcessUrlResponse {
  success: true;
  result: {
    workflow_instance_id: string;
    status: 'accepted';
  };
}

async function processClassFromUrl(
  classId: string, 
  sourceUrl: string
): Promise<ProcessUrlResponse> {
  const response = await fetch(
    `https://api.example.com/classes/${classId}/process-url`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getClerkToken()}`
      },
      body: JSON.stringify({ source_url: sourceUrl })
    }
  );

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${await response.text()}`);
  }

  return response.json();
}
```

## Configuration

### Environment Variables

Two new secrets must be configured in Cloudflare Secrets Store:

```bash
# Local development (.dev.vars file)
PROCESSING_SERVICE_URL=https://your-cloud-run-service.run.app/process
INTERNAL_API_KEY=your-secret-api-key

# Production (Cloudflare Secrets Store)
npx wrangler secret put PROCESSING_SERVICE_URL
npx wrangler secret put INTERNAL_API_KEY
```

### Heavy API Contract

The Cloud Run service must implement the following contract:

**Request:**
```json
{
  "sourceUrl": "https://example.com/file.mp4",
  "userId": "user_123",
  "classId": "class_456"
}
```

**Headers:**
```
Content-Type: application/json
X-Internal-API-Key: <INTERNAL_API_KEY>
```

**Response (200 OK):**
```json
{
  "r2Key": "temp/user_123/class_456/audio.m4a",
  "filename": "lecture-audio.m4a",
  "mimeType": "audio/mp4"
}
```

**Error Response (4xx/5xx):**
```json
{
  "error": "Description of what went wrong"
}
```

## Comparison with process-audio Endpoint

| Feature                  | `/process-audio`                     | `/process-url`                        |
|--------------------------|--------------------------------------|---------------------------------------|
| **Input**                | Pre-uploaded file (R2 key)           | External URL                          |
| **Client Responsibility** | Upload to R2 via presigned URL      | Provide URL only                      |
| **Heavy Processing**     | Already done by client               | Delegated to Cloud Run                |
| **Workflow Steps**       | 3 steps (no prepare-file-input)      | 4 steps (includes prepare-file-input) |
| **Use Case**             | Client has file locally              | File hosted externally                |

## Monitoring

### Logs

```
🚀 [PROCESS_URL] Workflow triggered
   - classId: class_123
   - userId: user_456
   - sourceUrl: https://...
   - workflowInstanceId: 01JGXXX...

🔄 [WORKFLOW] Processing URL input
   - classId: class_123
   - sourceUrl: https://...

✅ [WORKFLOW] URL processed successfully
   - classId: class_123
   - r2Key: temp/user_456/class_123/audio.m4a
```

### Metrics to Track

- Workflow trigger rate
- Heavy API success/failure rate
- Average processing time per step
- Retry frequency per step
- R2 storage usage for temporary files

## Security Considerations

1. **Authentication**: Clerk middleware validates all requests
2. **Authorization**: Class ownership verified before workflow trigger
3. **API Key Protection**: Internal API key stored in Secrets Store
4. **URL Validation**: Only syntactic validation in endpoint; Heavy API handles security
5. **No SSRF Protection**: Heavy API must implement domain whitelisting/blacklisting

## Future Enhancements

- [ ] Add webhook notifications for workflow completion
- [ ] Support batch URL processing
- [ ] Add progress tracking endpoint (`GET /workflow/:instanceId/status`)
- [ ] Implement URL domain whitelist/blacklist at endpoint level
- [ ] Add file type/size validation before triggering workflow
- [ ] Support different AI models via query parameter
