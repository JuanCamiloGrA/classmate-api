# Client Integration Example

## JavaScript/TypeScript Client

### Complete Upload Flow

```typescript
/**
 * Upload an audio file to a class
 * @param classId - The class ID
 * @param audioFile - The File object from input[type="file"]
 * @param authToken - Clerk authentication token
 */
async function uploadClassAudio(
  classId: string,
  audioFile: File,
  authToken: string
): Promise<{ key: string }> {
  // Step 1: Request presigned URL
  const urlResponse = await fetch(
    `https://api.classmate.studio/classes/${classId}/generate-upload-url`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        file_name: audioFile.name,
        content_type: audioFile.type,
      }),
    }
  );

  if (!urlResponse.ok) {
    const error = await urlResponse.json();
    throw new Error(error.error || 'Failed to generate upload URL');
  }

  const { result } = await urlResponse.json();
  const { signed_url, key } = result;

  // Step 2: Upload file directly to R2
  const uploadResponse = await fetch(signed_url, {
    method: 'PUT',
    body: audioFile,
    headers: {
      'Content-Type': audioFile.type,
    },
  });

  if (!uploadResponse.ok) {
    throw new Error('Failed to upload file to storage');
  }

  // Step 3: Return the key to save in your database
  return { key };
}
```

### React Component Example

```tsx
import { useState } from 'react';
import { useAuth } from '@clerk/clerk-react';

export function ClassAudioUploader({ classId }: { classId: string }) {
  const { getToken } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadedKey, setUploadedKey] = useState<string | null>(null);

  async function handleFileUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('audio/')) {
      setError('Please select an audio file');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const token = await getToken();
      if (!token) {
        throw new Error('Not authenticated');
      }

      const { key } = await uploadClassAudio(classId, file, token);
      setUploadedKey(key);

      // TODO: Save the key to your database via another API call
      // await saveAudioReferenceToClass(classId, key);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <input
        type="file"
        accept="audio/*"
        onChange={handleFileUpload}
        disabled={uploading}
      />
      {uploading && <p>Uploading...</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {uploadedKey && <p>✓ Uploaded: {uploadedKey}</p>}
    </div>
  );
}

async function uploadClassAudio(
  classId: string,
  audioFile: File,
  authToken: string
): Promise<{ key: string }> {
  const urlResponse = await fetch(
    `/api/classes/${classId}/generate-upload-url`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        file_name: audioFile.name,
        content_type: audioFile.type,
      }),
    }
  );

  if (!urlResponse.ok) {
    const error = await urlResponse.json();
    throw new Error(error.error || 'Failed to generate upload URL');
  }

  const { result } = await urlResponse.json();

  const uploadResponse = await fetch(result.signed_url, {
    method: 'PUT',
    body: audioFile,
    headers: {
      'Content-Type': audioFile.type,
    },
  });

  if (!uploadResponse.ok) {
    throw new Error('Failed to upload file to storage');
  }

  return { key: result.key };
}
```

### Vue.js Component Example

```vue
<template>
  <div>
    <input
      type="file"
      accept="audio/*"
      @change="handleFileUpload"
      :disabled="uploading"
    />
    <p v-if="uploading">Uploading...</p>
    <p v-if="error" style="color: red">{{ error }}</p>
    <p v-if="uploadedKey">✓ Uploaded: {{ uploadedKey }}</p>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useAuth } from '@clerk/vue';

const props = defineProps<{ classId: string }>();
const { getToken } = useAuth();

const uploading = ref(false);
const error = ref<string | null>(null);
const uploadedKey = ref<string | null>(null);

async function handleFileUpload(event: Event) {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;

  if (!file.type.startsWith('audio/')) {
    error.value = 'Please select an audio file';
    return;
  }

  uploading.value = true;
  error.value = null;

  try {
    const token = await getToken();
    if (!token) throw new Error('Not authenticated');

    const { key } = await uploadClassAudio(props.classId, file, token);
    uploadedKey.value = key;

  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Upload failed';
  } finally {
    uploading.value = false;
  }
}

async function uploadClassAudio(
  classId: string,
  audioFile: File,
  authToken: string
): Promise<{ key: string }> {
  const urlResponse = await fetch(
    `/api/classes/${classId}/generate-upload-url`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        file_name: audioFile.name,
        content_type: audioFile.type,
      }),
    }
  );

  if (!urlResponse.ok) {
    const error = await urlResponse.json();
    throw new Error(error.error || 'Failed to generate upload URL');
  }

  const { result } = await urlResponse.json();

  const uploadResponse = await fetch(result.signed_url, {
    method: 'PUT',
    body: audioFile,
    headers: {
      'Content-Type': audioFile.type,
    },
  });

  if (!uploadResponse.ok) {
    throw new Error('Failed to upload file to storage');
  }

  return { key: result.key };
}
</script>
```

## cURL Example

```bash
#!/bin/bash

CLASS_ID="cls_123"
AUTH_TOKEN="your_clerk_token"
AUDIO_FILE="recording.mp3"

# Step 1: Get presigned URL
RESPONSE=$(curl -s -X POST \
  "https://api.classmate.studio/classes/$CLASS_ID/generate-upload-url" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"file_name\": \"$AUDIO_FILE\", \"content_type\": \"audio/mpeg\"}")

SIGNED_URL=$(echo $RESPONSE | jq -r '.result.signed_url')
KEY=$(echo $RESPONSE | jq -r '.result.key')

echo "Generated key: $KEY"

# Step 2: Upload file
curl -X PUT "$SIGNED_URL" \
  -H "Content-Type: audio/mpeg" \
  --data-binary "@$AUDIO_FILE"

echo "Upload complete!"
```

## Error Handling

```typescript
async function uploadWithErrorHandling(
  classId: string,
  audioFile: File,
  authToken: string
) {
  try {
    const { key } = await uploadClassAudio(classId, audioFile, authToken);
    return { success: true, key };
  } catch (error) {
    if (error instanceof Error) {
      // Handle specific error cases
      if (error.message.includes('not found')) {
        return { success: false, error: 'Class not found' };
      }
      if (error.message.includes('Unauthorized')) {
        return { success: false, error: 'Please sign in' };
      }
      if (error.message.includes('content_type')) {
        return { success: false, error: 'Invalid file type' };
      }
    }
    return { success: false, error: 'Upload failed' };
  }
}
```

## Progress Tracking (Advanced)

```typescript
async function uploadWithProgress(
  classId: string,
  audioFile: File,
  authToken: string,
  onProgress: (percent: number) => void
): Promise<{ key: string }> {
  // Get presigned URL
  const urlResponse = await fetch(
    `/api/classes/${classId}/generate-upload-url`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        file_name: audioFile.name,
        content_type: audioFile.type,
      }),
    }
  );

  const { result } = await urlResponse.json();

  // Upload with XMLHttpRequest for progress tracking
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) {
        const percent = Math.round((event.loaded / event.total) * 100);
        onProgress(percent);
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status === 200) {
        resolve({ key: result.key });
      } else {
        reject(new Error('Upload failed'));
      }
    });

    xhr.addEventListener('error', () => reject(new Error('Network error')));

    xhr.open('PUT', result.signed_url);
    xhr.setRequestHeader('Content-Type', audioFile.type);
    xhr.send(audioFile);
  });
}
```

## Best Practices

1. **Validate file type** on the client before uploading
2. **Show upload progress** for better UX
3. **Handle network errors** gracefully with retry logic
4. **Store the returned key** in your database for future reference
5. **Clean up temporary files** in R2 after processing (e.g., after transcription)
6. **Set appropriate file size limits** based on your use case
7. **Consider chunked uploads** for very large files (> 100MB)
