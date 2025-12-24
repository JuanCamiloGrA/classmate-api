# Storage Quota Management

> **Version**: 2.0.0  
> **Last Updated**: December 2024

## Overview

The storage quota management system provides centralized tracking and enforcement of user storage limits across all upload endpoints. It ensures consistent quota validation, accurate storage accounting, and idempotent upload confirmation.

## Architecture

### Core Components

```
src/
├── application/storage/
│   ├── upload-guard.service.ts      # Policy enforcement + presigned URL generation
│   └── confirm-upload.service.ts    # Idempotent upload confirmation
├── domain/repositories/
│   └── storage-accounting.repository.ts  # Interface for storage tracking
├── infrastructure/database/
│   ├── schema.ts                    # user_storage_objects table
│   └── repositories/
│       └── storage-accounting.repository.ts  # D1 implementation
```

### Storage Tiers

| Tier | Storage Limit |
|------|---------------|
| `free` | 1 GB |
| `pro` | 10 GB |
| `premium` | 100 GB |

### Bucket Types

| Bucket | Counts Toward Quota | Confirmation Required |
|--------|--------------------|-----------------------|
| `persistent` | Yes | Yes |
| `temporal` | No (24h TTL) | No |

## Upload Flow

### 1. Request Presigned URL

All upload endpoints now require `sizeBytes` parameter:

```json
POST /library/upload/presigned
{
  "filename": "document.pdf",
  "mimeType": "application/pdf",
  "sizeBytes": 2500000
}
```

### 2. Policy Check

The `UploadGuardService` validates:
- User exists and has a profile
- Current usage + file size <= tier limit
- Returns `402 Payment Required` if quota exceeded

### 3. Pending Record

Before returning the presigned URL, a `pending` record is created in `user_storage_objects`:

```sql
INSERT INTO user_storage_objects (user_id, r2_key, bucket_type, status, size_bytes)
VALUES ('user_123', 'users/user_123/files/...', 'persistent', 'pending', 2500000)
```

### 4. Upload to R2

Client uploads directly to R2 using the presigned PUT URL.

### 5. Confirm Upload

After successful upload, client calls confirmation endpoint:

```json
POST /uploads/confirm
{
  "r2Key": "users/user_123/files/2024/12/uuid-document.pdf"
}
```

The `ConfirmUploadService`:
1. Gets actual file size from R2 via HEAD request
2. Updates `user_storage_objects` to `confirmed` status
3. Calculates delta (actual size - previous size)
4. Updates `profiles.storageUsedBytes` with delta

### 6. Idempotency

Confirming the same upload multiple times is safe:
- If already confirmed with same size: returns `deltaBytes: 0`
- If file was overwritten: calculates delta from previous size

## Endpoints

### Generic Upload Confirmation

**POST** `/uploads/confirm`

Confirms any persistent bucket upload by R2 key.

#### Request

```json
{
  "r2Key": "users/user_123/rubrics/2024/12/uuid-rubric.pdf"
}
```

#### Response (200 OK)

```json
{
  "success": true,
  "message": "Upload confirmed successfully",
  "actualSizeBytes": 2456789
}
```

#### Security

- R2 key must match pattern `users/{userId}/...`
- User ID extracted from Clerk auth must match key path

### Library Upload Confirmation

**POST** `/library/upload/confirm`

Confirms library file uploads using `fileId`.

```json
{
  "fileId": "file-uuid-123"
}
```

## Affected Endpoints

All upload endpoints now use the centralized system:

| Endpoint | Bucket Type | Requires sizeBytes |
|----------|-------------|-------------------|
| `POST /library/upload/presigned` | persistent | Yes |
| `POST /scribe/upload-url` | persistent | Yes |
| `POST /scribe/projects/:id/answer-upload-url` | persistent | Yes |
| `POST /profiles/me/scribe-style/upload-url` | persistent | Yes |
| `POST /classes/:classId/generate-upload-url` | temporal | Yes |

## Database Schema

### user_storage_objects

```sql
CREATE TABLE user_storage_objects (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  r2_key TEXT NOT NULL UNIQUE,
  bucket_type TEXT NOT NULL,  -- 'persistent' | 'temporal'
  status TEXT NOT NULL,       -- 'pending' | 'confirmed' | 'deleted'
  size_bytes INTEGER NOT NULL DEFAULT 0,
  confirmed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

### profiles (updated)

```sql
-- Existing column, now actively used
storage_used_bytes INTEGER NOT NULL DEFAULT 0
```

## Client Integration

### TypeScript Example

```typescript
interface UploadResult {
  uploadUrl: string;
  r2Key: string;
  fileId?: string;
}

async function uploadFile(
  file: File, 
  endpoint: string,
  additionalParams?: Record<string, unknown>
): Promise<string> {
  // 1. Request presigned URL with sizeBytes
  const presignedResponse = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      filename: file.name,
      mimeType: file.type,
      sizeBytes: file.size,  // Required!
      ...additionalParams
    })
  });

  if (presignedResponse.status === 402) {
    throw new StorageQuotaExceededError();
  }

  const { result } = await presignedResponse.json();

  // 2. Upload to R2
  await fetch(result.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type },
    body: file
  });

  // 3. Confirm upload (for persistent bucket)
  if (result.r2Key && !endpoint.includes('class')) {
    await fetch('/uploads/confirm', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ r2Key: result.r2Key })
    });
  }

  return result.r2Key || result.fileId;
}
```

### React Hook Example

```typescript
function useFileUpload() {
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<Error | null>(null);

  const upload = async (file: File, endpoint: string) => {
    try {
      setError(null);
      
      // Get presigned URL
      const { result } = await api.post(endpoint, {
        filename: file.name,
        mimeType: file.type,
        sizeBytes: file.size
      });

      // Upload with progress
      await uploadWithProgress(result.uploadUrl, file, setProgress);

      // Confirm
      await api.post('/uploads/confirm', { r2Key: result.r2Key });

      return result.r2Key;
    } catch (err) {
      if (err.status === 402) {
        setError(new Error('Storage quota exceeded'));
      } else {
        setError(err);
      }
      throw err;
    }
  };

  return { upload, progress, error };
}
```

## Migration Notes

### Breaking Changes

1. **`sizeBytes` is now required** for all upload URL generation endpoints
2. **Scribe rubric field renamed**: `rubricFileUrl` -> `rubricFileR2Key`

### Database Migrations

```bash
# Apply migrations
bun run db:migrate:local   # Local
bun run db:migrate:remote  # Production
```

Migrations:
- `0014_modern_mimic.sql`: Creates `user_storage_objects` table
- `0015_late_terrax.sql`: Renames `rubric_file_url` to `rubric_file_r2_key`

### Backward Compatibility

- Existing library uploads continue to work (already had `sizeBytes`)
- Scribe projects with old `rubricFileUrl` data will be renamed in place (column rename preserves data)
- Temporal bucket uploads (class audio) don't require confirmation

## Error Handling

### 402 Payment Required

```json
{
  "error": "Upload would exceed storage quota. Used: 1073000000, Limit: 1073741824, File size: 2500000"
}
```

### 400 Bad Request

```json
{
  "error": "sizeBytes: File size must be positive"
}
```

### 404 Not Found (Confirmation)

```json
{
  "error": "Object not found in R2: persistent-bucket/users/user_123/..."
}
```

## Monitoring

### Key Metrics

- `storage_accounting.pending_count` - Uploads started but not confirmed
- `storage_accounting.confirmed_count` - Successfully confirmed uploads
- `storage_accounting.delta_bytes` - Storage changes per confirmation
- `storage_quota.exceeded_count` - Quota exceeded rejections

### Debugging

Check user's storage objects:

```sql
SELECT * FROM user_storage_objects 
WHERE user_id = 'user_123' 
ORDER BY created_at DESC;
```

Check user's quota:

```sql
SELECT storage_used_bytes, subscription_tier 
FROM profiles 
WHERE user_id = 'user_123';
```
