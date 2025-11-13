# Client Integration - Process Audio

## Overview

This guide demonstrates how to integrate the complete upload and process flow for class audio/text files in various frontend frameworks.

---

## Complete Flow

```
┌─────────────────────────────────────────────────────────────┐
│ 1. User selects audio/text file                             │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. Request presigned URL from API                           │
│    POST /classes/:classId/generate-upload-url               │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Upload file directly to R2 using presigned URL           │
│    PUT <signed_url>                                         │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. Trigger AI processing workflow                           │
│    POST /classes/:classId/process-audio                     │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. Poll for summary completion (optional)                   │
│    GET /classes/:classId (check summary field)              │
└─────────────────────────────────────────────────────────────┘
```

---

## TypeScript/JavaScript Client

### Core Function

```typescript
interface UploadAndProcessResult {
  workflowId: string;
  r2Key: string;
}

/**
 * Complete upload and process flow for class audio/text
 * @param classId - The class ID
 * @param file - The File object from input[type="file"]
 * @param authToken - Clerk authentication token
 * @returns Workflow ID and R2 key
 */
async function uploadAndProcessFile(
  classId: string,
  file: File,
  authToken: string
): Promise<UploadAndProcessResult> {
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
        file_name: file.name,
        content_type: file.type,
      }),
    }
  );

  if (!urlResponse.ok) {
    const error = await urlResponse.json();
    throw new Error(error.error || 'Failed to generate upload URL');
  }

  const { result: uploadData } = await urlResponse.json();
  const { signed_url, key } = uploadData;

  // Step 2: Upload file to R2
  const uploadResponse = await fetch(signed_url, {
    method: 'PUT',
    body: file,
    headers: {
      'Content-Type': file.type,
    },
  });

  if (!uploadResponse.ok) {
    throw new Error('Failed to upload file to storage');
  }

  // Step 3: Trigger AI processing workflow
  const processResponse = await fetch(
    `https://api.classmate.studio/classes/${classId}/process-audio`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        r2_key: key,
        file_name: file.name,
        mime_type: file.type,
      }),
    }
  );

  if (!processResponse.ok) {
    const error = await processResponse.json();
    throw new Error(error.error || 'Failed to start processing');
  }

  const { result: processData } = await processResponse.json();

  return {
    workflowId: processData.workflow_id,
    r2Key: key,
  };
}
```

### Poll for Completion (Optional)

```typescript
interface ClassSummary {
  id: string;
  summary: string | null;
  updated_at: string;
}

/**
 * Poll for summary completion
 * @param classId - The class ID
 * @param authToken - Clerk authentication token
 * @param maxAttempts - Maximum polling attempts (default: 24 = 2 minutes)
 * @param intervalMs - Interval between polls in ms (default: 5000 = 5 seconds)
 * @returns Class data with summary
 */
async function pollForSummary(
  classId: string,
  authToken: string,
  maxAttempts = 24,
  intervalMs = 5000
): Promise<ClassSummary> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const response = await fetch(
      `https://api.classmate.studio/classes/${classId}`,
      {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error('Failed to fetch class');
    }

    const { result } = await response.json();

    // Check if summary has been generated
    if (result.summary !== null) {
      return result;
    }

    // Wait before next attempt
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }

  throw new Error('Summary generation timeout');
}
```

---

## React Component

```tsx
import { useState } from 'react';
import { useAuth } from '@clerk/clerk-react';

interface ProcessingState {
  uploading: boolean;
  processing: boolean;
  pollingForSummary: boolean;
  error: string | null;
  workflowId: string | null;
  summary: string | null;
}

export function ClassAudioProcessor({ classId }: { classId: string }) {
  const { getToken } = useAuth();
  const [state, setState] = useState<ProcessingState>({
    uploading: false,
    processing: false,
    pollingForSummary: false,
    error: null,
    workflowId: null,
    summary: null,
  });

  async function handleFileUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const isAudio = file.type.startsWith('audio/');
    const isText = file.type === 'text/plain';

    if (!isAudio && !isText) {
      setState(prev => ({ ...prev, error: 'Please select an audio or text file' }));
      return;
    }

    setState({
      uploading: true,
      processing: false,
      pollingForSummary: false,
      error: null,
      workflowId: null,
      summary: null,
    });

    try {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');

      // Upload and process
      setState(prev => ({ ...prev, uploading: true }));
      const { workflowId } = await uploadAndProcessFile(classId, file, token);

      // Start polling for summary
      setState(prev => ({
        ...prev,
        uploading: false,
        processing: true,
        pollingForSummary: true,
        workflowId,
      }));

      const classData = await pollForSummary(classId, token);

      setState(prev => ({
        ...prev,
        processing: false,
        pollingForSummary: false,
        summary: classData.summary,
      }));

    } catch (err) {
      setState(prev => ({
        ...prev,
        uploading: false,
        processing: false,
        pollingForSummary: false,
        error: err instanceof Error ? err.message : 'Processing failed',
      }));
    }
  }

  return (
    <div className="audio-processor">
      <input
        type="file"
        accept="audio/*,text/plain"
        onChange={handleFileUpload}
        disabled={state.uploading || state.processing}
      />

      {state.uploading && (
        <div className="status">📤 Uploading file...</div>
      )}

      {state.processing && (
        <div className="status">
          {state.pollingForSummary ? '🔄 Generating summary...' : '⚙️ Processing...'}
        </div>
      )}

      {state.error && (
        <div className="error" style={{ color: 'red' }}>
          ❌ {state.error}
        </div>
      )}

      {state.workflowId && (
        <div className="info">
          Workflow ID: <code>{state.workflowId}</code>
        </div>
      )}

      {state.summary && (
        <div className="summary">
          <h3>✅ Summary Generated</h3>
          <div dangerouslySetInnerHTML={{ __html: state.summary }} />
        </div>
      )}
    </div>
  );
}

// Helper functions (same as above)
async function uploadAndProcessFile(
  classId: string,
  file: File,
  authToken: string
): Promise<{ workflowId: string }> {
  // ... implementation from above
}

async function pollForSummary(
  classId: string,
  authToken: string
): Promise<{ summary: string }> {
  // ... implementation from above
}
```

---

## Vue.js Component

```vue
<template>
  <div class="audio-processor">
    <input
      type="file"
      accept="audio/*,text/plain"
      @change="handleFileUpload"
      :disabled="uploading || processing"
    />

    <div v-if="uploading" class="status">📤 Uploading file...</div>

    <div v-if="processing" class="status">
      {{ pollingForSummary ? '🔄 Generating summary...' : '⚙️ Processing...' }}
    </div>

    <div v-if="error" class="error" style="color: red">❌ {{ error }}</div>

    <div v-if="workflowId" class="info">
      Workflow ID: <code>{{ workflowId }}</code>
    </div>

    <div v-if="summary" class="summary">
      <h3>✅ Summary Generated</h3>
      <div v-html="summary"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useAuth } from '@clerk/vue';

const props = defineProps<{ classId: string }>();
const { getToken } = useAuth();

const uploading = ref(false);
const processing = ref(false);
const pollingForSummary = ref(false);
const error = ref<string | null>(null);
const workflowId = ref<string | null>(null);
const summary = ref<string | null>(null);

async function handleFileUpload(event: Event) {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;

  const isAudio = file.type.startsWith('audio/');
  const isText = file.type === 'text/plain';

  if (!isAudio && !isText) {
    error.value = 'Please select an audio or text file';
    return;
  }

  uploading.value = true;
  processing.value = false;
  pollingForSummary.value = false;
  error.value = null;
  workflowId.value = null;
  summary.value = null;

  try {
    const token = await getToken();
    if (!token) throw new Error('Not authenticated');

    const result = await uploadAndProcessFile(props.classId, file, token);
    workflowId.value = result.workflowId;

    uploading.value = false;
    processing.value = true;
    pollingForSummary.value = true;

    const classData = await pollForSummary(props.classId, token);
    summary.value = classData.summary;

    processing.value = false;
    pollingForSummary.value = false;

  } catch (err) {
    uploading.value = false;
    processing.value = false;
    pollingForSummary.value = false;
    error.value = err instanceof Error ? err.message : 'Processing failed';
  }
}

async function uploadAndProcessFile(
  classId: string,
  file: File,
  authToken: string
): Promise<{ workflowId: string }> {
  // ... implementation from TypeScript section
}

async function pollForSummary(
  classId: string,
  authToken: string
): Promise<{ summary: string }> {
  // ... implementation from TypeScript section
}
</script>
```

---

## With Progress Tracking

```typescript
interface UploadProgress {
  phase: 'uploading' | 'processing' | 'polling' | 'complete';
  percent: number;
  message: string;
}

async function uploadAndProcessWithProgress(
  classId: string,
  file: File,
  authToken: string,
  onProgress: (progress: UploadProgress) => void
): Promise<{ workflowId: string; summary: string }> {
  // Phase 1: Upload to R2 (0-50%)
  onProgress({ phase: 'uploading', percent: 0, message: 'Requesting upload URL...' });

  const urlResponse = await fetch(
    `https://api.classmate.studio/classes/${classId}/generate-upload-url`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        file_name: file.name,
        content_type: file.type,
      }),
    }
  );

  if (!urlResponse.ok) {
    throw new Error('Failed to generate upload URL');
  }

  const { result: uploadData } = await urlResponse.json();

  onProgress({ phase: 'uploading', percent: 25, message: 'Uploading file...' });

  // Upload with XMLHttpRequest for progress tracking
  const uploadResult = await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) {
        const uploadPercent = Math.round((event.loaded / event.total) * 25); // 0-25%
        onProgress({
          phase: 'uploading',
          percent: 25 + uploadPercent,
          message: `Uploading... ${Math.round((event.loaded / event.total) * 100)}%`,
        });
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status === 200) {
        resolve();
      } else {
        reject(new Error('Upload failed'));
      }
    });

    xhr.addEventListener('error', () => reject(new Error('Network error')));

    xhr.open('PUT', uploadData.signed_url);
    xhr.setRequestHeader('Content-Type', file.type);
    xhr.send(file);
  });

  // Phase 2: Trigger processing (50-60%)
  onProgress({ phase: 'processing', percent: 50, message: 'Starting AI processing...' });

  const processResponse = await fetch(
    `https://api.classmate.studio/classes/${classId}/process-audio`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        r2_key: uploadData.key,
        file_name: file.name,
        mime_type: file.type,
      }),
    }
  );

  if (!processResponse.ok) {
    throw new Error('Failed to start processing');
  }

  const { result: processData } = await processResponse.json();

  // Phase 3: Poll for completion (60-100%)
  onProgress({ phase: 'polling', percent: 60, message: 'Generating summary...' });

  const maxAttempts = 24; // 2 minutes
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const pollPercent = 60 + Math.round((attempt / maxAttempts) * 40); // 60-100%
    onProgress({
      phase: 'polling',
      percent: pollPercent,
      message: `Generating summary... ${attempt * 5}s`,
    });

    const response = await fetch(
      `https://api.classmate.studio/classes/${classId}`,
      {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      }
    );

    if (response.ok) {
      const { result } = await response.json();
      if (result.summary !== null) {
        onProgress({ phase: 'complete', percent: 100, message: 'Summary ready!' });
        return {
          workflowId: processData.workflow_id,
          summary: result.summary,
        };
      }
    }

    await new Promise(resolve => setTimeout(resolve, 5000));
  }

  throw new Error('Summary generation timeout');
}
```

---

## Error Handling

```typescript
async function uploadAndProcessWithRetry(
  classId: string,
  file: File,
  authToken: string,
  maxRetries = 3
): Promise<{ workflowId: string }> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await uploadAndProcessFile(classId, file, authToken);
    } catch (error) {
      if (error instanceof Error) {
        // Don't retry on auth errors
        if (error.message.includes('Unauthorized') || error.message.includes('not found')) {
          throw error;
        }

        // Don't retry on validation errors
        if (error.message.includes('required')) {
          throw error;
        }
      }

      // Retry on network errors
      if (attempt === maxRetries - 1) {
        throw error; // Last attempt, give up
      }

      // Wait before retry (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
    }
  }

  throw new Error('Max retries exceeded');
}
```

---

## Best Practices

1. **Show clear progress**: Use phase-based progress indicators (upload → process → poll)
2. **Handle large files**: Show upload progress for files > 10MB
3. **Set realistic timeouts**: Audio processing can take 30-60 seconds
4. **Retry on failures**: Network errors are common, implement retry logic
5. **Validate before upload**: Check file type and size on client
6. **Store workflow ID**: Useful for debugging and support
7. **Graceful degradation**: If polling fails, user can refresh to see summary later
8. **Clean error messages**: Map technical errors to user-friendly messages
9. **Cancel support**: Allow users to cancel uploads (use AbortController)
10. **Disable multiple uploads**: Prevent simultaneous uploads to same class

---

## Complete Example with All Features

```typescript
class ClassAudioUploader {
  private abortController: AbortController | null = null;

  async uploadAndProcess(
    classId: string,
    file: File,
    authToken: string,
    onProgress: (progress: UploadProgress) => void
  ): Promise<{ workflowId: string; summary: string }> {
    // Validate file
    this.validateFile(file);

    // Create abort controller
    this.abortController = new AbortController();

    try {
      return await uploadAndProcessWithProgress(
        classId,
        file,
        authToken,
        onProgress
      );
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error('Upload cancelled');
      }
      throw error;
    } finally {
      this.abortController = null;
    }
  }

  cancel() {
    this.abortController?.abort();
  }

  private validateFile(file: File) {
    // Check file type
    const isAudio = file.type.startsWith('audio/');
    const isText = file.type === 'text/plain';

    if (!isAudio && !isText) {
      throw new Error('Only audio and text files are supported');
    }

    // Check file size (100MB limit)
    const maxSize = 100 * 1024 * 1024; // 100MB
    if (file.size > maxSize) {
      throw new Error('File size must be less than 100MB');
    }

    // Validate audio extensions
    if (isAudio) {
      const validExtensions = ['.mp3', '.wav', '.ogg', '.webm', '.m4a', '.flac'];
      const extension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));

      if (!validExtensions.includes(extension)) {
        throw new Error(`Unsupported audio format: ${extension}`);
      }
    }
  }
}
```
