# Generate Presigned Upload URL for Class Audio

## Overview

This feature provides a secure way for clients to upload audio files directly to R2 storage without routing the file data through the API. The endpoint generates a presigned URL that grants temporary permission to upload a specific file.

## Endpoint

```
POST /classes/:classId/generate-upload-url
```

## Authentication

Requires Clerk authentication. The user must own the class.

## Request

### Path Parameters

- `classId` (string, required): The ID of the class for which to generate the upload URL

### Body

```json
{
  "file_name": "recording.mp3",
  "content_type": "audio/mpeg"
}
```

- `file_name` (string, required): Name of the file to be uploaded
- `content_type` (string, required): MIME type, must start with `audio/`

### Example Request

```bash
curl -X POST https://api.ascendclassmate.workers.dev/classes/cls_123/generate-upload-url \
  -H "Authorization: Bearer YOUR_CLERK_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "file_name": "lecture-recording.mp3",
    "content_type": "audio/mpeg"
  }'
```

## Response

### Success (200 OK)

```json
{
  "success": true,
  "result": {
    "signed_url": "https://bucket.r2.cloudflarestorage.com/temporal/class-audio/user_abc/cls_123/550e8400-e29b-41d4-a716-446655440000-lecture-recording.mp3?X-Amz-Algorithm=...",
    "key": "temporal/class-audio/user_abc/cls_123/550e8400-e29b-41d4-a716-446655440000-lecture-recording.mp3"
  }
}
```

- `signed_url`: Presigned URL for uploading the file (valid for 300 seconds by default)
- `key`: The object key in R2 storage (save this to reference the file later)

### Error Responses

**400 Bad Request**
```json
{
  "error": "file_name: File name is required"
}
```

**401 Unauthorized**
```json
{
  "error": "Unauthorized"
}
```

**404 Not Found**
```json
{
  "error": "Class not found or you do not have access to it"
}
```

## Client Upload Flow

1. **Request presigned URL** from this endpoint
2. **Upload file** directly to R2 using the presigned URL:
   ```javascript
   const response = await fetch(signedUrl, {
     method: 'PUT',
     body: audioFile,
     headers: {
       'Content-Type': contentType
     }
   });
   ```
3. **Store the key** returned from step 1 in your application database for future reference

## Configuration

### Environment Variables

- `R2_PRESIGNED_URL_EXPIRATION_SECONDS` (optional, default: 300): URL expiration time in seconds

### Secrets (Cloudflare Secrets Store)

- `R2_S3_API_ENDPOINT`: R2 S3-compatible API endpoint
- `R2_ACCESS_KEY_ID`: R2 access key ID
- `R2_SECRET_ACCESS_KEY`: R2 secret access key
- `R2_TEMPORAL_BUCKET_NAME`: Name of the R2 bucket for temporary files

## Security

- **Ownership validation**: The endpoint verifies the class belongs to the authenticated user
- **Soft-delete check**: Rejects requests for soft-deleted classes
- **File name sanitization**: Removes path separators to prevent directory traversal
- **Content type validation**: Only accepts audio MIME types
- **Unique keys**: Each upload gets a UUID prefix to prevent collisions
- **Time-limited access**: Presigned URLs expire after configured duration

## Storage Structure

Files are stored with the following key pattern:
```
temporal/class-audio/{userId}/{classId}/{uuid}-{fileName}
```

Example:
```
temporal/class-audio/user_abc123/cls_xyz789/550e8400-e29b-41d4-a716-446655440000-lecture.mp3
```

This structure allows:
- Easy filtering by user or class
- Collision-free uploads (UUID prefix)
- Debugging and auditing

## Architecture

Following hexagonal architecture:

- **Route**: `src/interfaces/http/routes/classes-generate-upload-url.ts`
- **Use Case**: `src/application/classes/generate-class-audio-upload-url.usecase.ts`
- **Storage Port**: `src/domain/repositories/storage.repository.ts`
- **R2 Adapter**: `src/infrastructure/storage/r2.storage.ts`
- **Validator**: `src/interfaces/http/validators/class.validator.ts` (GenerateUploadUrlSchema)

## Testing

Run tests:
```bash
bun run test src/application/classes/generate-class-audio-upload-url.usecase.test.ts
```

The test suite covers:
- Valid upload URL generation
- Class ownership validation
- Soft-delete rejection
- File name sanitization
- Empty file name rejection
- Custom expiration times
- Unique key generation
