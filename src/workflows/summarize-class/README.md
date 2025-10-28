# Summarize Class Workflow

This workflow processes audio or text files to generate class summaries using AI (Google Gemini).

## Architecture

The workflow follows the project's hexagonal architecture:

```
src/workflows/summarize-class/
├── index.ts              # Workflow entrypoint (WorkflowEntrypoint)
├── handler.ts            # Workflow logic (orchestration)
├── dependencies.ts       # Dependency injection
├── types.ts              # Workflow-specific types
└── file-validator.ts     # File validation utilities
```

## Processing Flow

### 1. Trigger (HTTP Endpoint)
**Endpoint:** `POST /classes/:classId/process-audio`

**Request Body:**
```json
{
  "r2_key": "temp/user123/audio-file.mp3",
  "file_name": "audio-file.mp3",
  "mime_type": "audio/mpeg"
}
```

**Response (202 Accepted):**
```json
{
  "success": true,
  "result": {
    "workflow_instance_id": "workflow-abc123",
    "status": "accepted"
  }
}
```

### 2. Workflow Steps

The workflow executes three main steps:

#### Step 1: Generate Summary
- **Timeout:** 30 minutes
- **Retries:** 3 attempts with exponential backoff
- **Actions:**
  1. Download file from R2 using `r2_key`
  2. Load prompt template
  3. Determine if audio or text
  4. Send content to Google Gemini to generate Markdown summary

#### Step 2: Save Summary
- **Timeout:** 10 minutes
- **Retries:** 5 attempts with exponential backoff
- **Actions:**
  1. Convert Markdown to HTML using MiniGFM (XSS-safe)
  2. Save HTML to `summary` column in `classes` table

#### Step 3: Cleanup
- **Timeout:** 5 minutes
- **Actions:**
  1. Delete temporary file from R2 bucket

## Used Services

### Domain Services (Ports)
- `AIService` - AI services interface
- `PromptService` - Prompt loading interface
- `StorageService` - File storage interface
- `MarkdownService` - Markdown→HTML conversion interface

### Infrastructure (Adapters)
- `GoogleAIService` - Google Gemini implementation
- `AssetsPromptService` - Prompt loading from assets
- `R2StorageService` - Cloudflare R2 storage via S3 SDK
- `MiniGFMMarkdownService` - Markdown→HTML conversion with sanitization
- `D1SummaryRepository` - Persistence in D1 Database

## Configuration

### Required Environment Variables

Configured in Cloudflare Secrets Store:
- `GEMINI_API_KEY` - Google Gemini API key
- `R2_S3_API_ENDPOINT` - R2 S3-compatible endpoint
- `R2_ACCESS_KEY_ID` - R2 access key
- `R2_SECRET_ACCESS_KEY` - R2 secret key
- `R2_TEMPORAL_BUCKET_NAME` - Temporary bucket name

### Workflow Binding

In `wrangler.jsonc`:
```json
{
  "workflows": [
    {
      "name": "summarize-class",
      "binding": "SUMMARIZE_CLASS_WORKFLOW",
      "class_name": "SummarizeClassWorkflow"
    }
  ]
}
```

## Endpoint Usage

### 1. Generate Upload URL
```bash
POST /classes/{classId}/generate-upload-url
{
  "file_name": "my-lecture.mp3",
  "content_type": "audio/mpeg"
}
```

Response:
```json
{
  "success": true,
  "result": {
    "signed_url": "https://...",
    "key": "temp/user123/my-lecture.mp3"
  }
}
```

### 2. Upload File to R2
```bash
PUT {signed_url}
Content-Type: audio/mpeg
Body: [binary file]
```

### 3. Process File
```bash
POST /classes/{classId}/process-audio
{
  "r2_key": "temp/user123/my-lecture.mp3",
  "file_name": "my-lecture.mp3",
  "mime_type": "audio/mpeg"
}
```

Response:
```json
{
  "success": true,
  "result": {
    "workflow_instance_id": "workflow-abc123",
    "status": "accepted"
  }
}
```

### 4. Check Summary
```bash
GET /classes/{classId}
```

The `summary` field will contain the generated HTML when the workflow completes.

## Supported File Types

### Audio
- MP3 (`audio/mpeg`)
- WAV (`audio/wav`)
- OGG (`audio/ogg`)
- FLAC (`audio/flac`)
- M4A (`audio/m4a`)
- AAC (`audio/aac`)
- Other audio formats

### Text
- TXT (`text/plain`)
- Markdown (`text/markdown`)

## Error Handling

The workflow implements automatic retries per step:
- R2 network errors → exponential retries
- AI errors (Gemini) → 3 retries
- Database errors → 5 retries

If all retries fail, the workflow is marked as failed and logs the error.

## Monitoring

Generated logs:
- `[WORKFLOW]` - Workflow start and end
- `[R2_STORAGE]` - Download/delete operations
- `[AI]` - Gemini processing
- `[SUMMARY_REPO]` - Database saving

## Local Development

### Prerequisites
```bash
# Install dependencies
bun install

# Configure local secrets
echo "GEMINI_API_KEY=your_key" >> .dev.vars
echo "R2_S3_API_ENDPOINT=https://..." >> .dev.vars
# ... other secrets
```

### Run in Dev Mode
```bash
bun run dev
```

The workflow will be available but uses Cloudflare Workflows in local mode.

## Testing

Unit tests in:
- `src/application/classes/generate-class-audio-upload-url.usecase.test.ts`
- Future workflow handler tests can be added in `src/workflows/summarize-class/`

## Future Improvements

- [ ] Support more file formats (PDF, DOCX)
- [ ] Add webhooks to notify when processing ends
- [ ] Implement endpoint to query workflow status
- [ ] Add metrics and tracing with Cloudflare Analytics
- [ ] Implement user rate limits
