# Client Integration Guide: Process URL Endpoint

## Overview

This guide shows how to integrate the `/classes/:classId/process-url` endpoint into your client application.

## Prerequisites

- Valid Clerk authentication setup
- Class ID for the class you want to process
- URL to a publicly accessible file (audio or video)

## Integration Steps

### Step 1: Authentication

Ensure you have a valid Clerk session token:

```typescript
import { useAuth } from '@clerk/clerk-react';

function MyComponent() {
  const { getToken } = useAuth();
  
  const token = await getToken();
  // Use this token in API requests
}
```

### Step 2: API Client Setup

Create a typed API client:

```typescript
// api/classes.ts
export interface ProcessUrlRequest {
  source_url: string;
}

export interface ProcessUrlResponse {
  success: true;
  result: {
    workflow_instance_id: string;
    status: 'accepted';
  };
}

export interface ErrorResponse {
  error: string;
}

export class ClassesAPI {
  constructor(
    private baseUrl: string,
    private getToken: () => Promise<string>
  ) {}

  async processUrl(
    classId: string,
    sourceUrl: string
  ): Promise<ProcessUrlResponse> {
    const token = await this.getToken();
    
    const response = await fetch(
      `${this.baseUrl}/classes/${classId}/process-url`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ source_url: sourceUrl })
      }
    );

    if (!response.ok) {
      const error: ErrorResponse = await response.json();
      throw new Error(error.error);
    }

    return response.json();
  }
}
```

### Step 3: React Hook

Create a custom hook for the endpoint:

```typescript
// hooks/useProcessUrl.ts
import { useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { ClassesAPI } from '../api/classes';

export function useProcessUrl() {
  const { getToken } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [workflowId, setWorkflowId] = useState<string | null>(null);

  const api = new ClassesAPI(
    process.env.NEXT_PUBLIC_API_URL!,
    getToken
  );

  const processUrl = async (classId: string, sourceUrl: string) => {
    setLoading(true);
    setError(null);
    setWorkflowId(null);

    try {
      const result = await api.processUrl(classId, sourceUrl);
      setWorkflowId(result.result.workflow_instance_id);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { processUrl, loading, error, workflowId };
}
```

### Step 4: UI Component

Build a component to trigger the processing:

```typescript
// components/ProcessUrlForm.tsx
import { useState } from 'react';
import { useProcessUrl } from '../hooks/useProcessUrl';

interface ProcessUrlFormProps {
  classId: string;
  onSuccess?: (workflowId: string) => void;
}

export function ProcessUrlForm({ classId, onSuccess }: ProcessUrlFormProps) {
  const [url, setUrl] = useState('');
  const { processUrl, loading, error, workflowId } = useProcessUrl();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const result = await processUrl(classId, url);
      onSuccess?.(result.result.workflow_instance_id);
      setUrl(''); // Reset form
    } catch {
      // Error already handled by hook
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="url" className="block text-sm font-medium">
          File URL
        </label>
        <input
          id="url"
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.com/lecture.mp4"
          required
          disabled={loading}
          className="mt-1 block w-full rounded border px-3 py-2"
        />
        <p className="mt-1 text-xs text-gray-500">
          Enter a URL to a publicly accessible audio or video file
        </p>
      </div>

      {error && (
        <div className="rounded bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {workflowId && (
        <div className="rounded bg-green-50 p-3 text-sm text-green-700">
          Processing started! Workflow ID: {workflowId}
        </div>
      )}

      <button
        type="submit"
        disabled={loading || !url}
        className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? 'Starting...' : 'Process URL'}
      </button>
    </form>
  );
}
```

## Complete Example: Next.js Page

```typescript
// app/classes/[classId]/process/page.tsx
'use client';

import { useParams, useRouter } from 'next/navigation';
import { ProcessUrlForm } from '@/components/ProcessUrlForm';

export default function ProcessClassPage() {
  const params = useParams();
  const router = useRouter();
  const classId = params.classId as string;

  const handleSuccess = (workflowId: string) => {
    console.log('Workflow started:', workflowId);
    
    // Optionally redirect to class details page
    router.push(`/classes/${classId}`);
    
    // Or show a success toast
    // toast.success('Processing started successfully!');
  };

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="mb-6 text-2xl font-bold">
        Process Class from URL
      </h1>
      
      <ProcessUrlForm 
        classId={classId} 
        onSuccess={handleSuccess}
      />
      
      <div className="mt-8 rounded bg-blue-50 p-4">
        <h2 className="font-semibold text-blue-900">What happens next?</h2>
        <ul className="mt-2 space-y-1 text-sm text-blue-800">
          <li>• Your file will be downloaded and processed</li>
          <li>• Audio will be extracted if it's a video</li>
          <li>• AI will generate a summary of the content</li>
          <li>• Results will appear in your class details</li>
        </ul>
      </div>
    </div>
  );
}
```

## Error Handling

### Comprehensive Error Handling

```typescript
async function processUrlWithErrorHandling(
  classId: string,
  sourceUrl: string
) {
  try {
    const result = await api.processUrl(classId, sourceUrl);
    
    // Success
    console.log('Workflow ID:', result.result.workflow_instance_id);
    return result;
    
  } catch (error) {
    if (error instanceof Error) {
      // Parse structured errors
      if (error.message.includes('valid URL')) {
        // Invalid URL format
        showError('Please enter a valid URL');
      } else if (error.message.includes('not found')) {
        // Class doesn't exist or no access
        showError('Class not found or you don\'t have access');
      } else if (error.message.includes('Unauthorized')) {
        // Authentication issue
        redirectToLogin();
      } else {
        // Generic error
        showError('Failed to start processing. Please try again.');
      }
    }
    
    throw error;
  }
}
```

### Retry Logic

```typescript
async function processUrlWithRetry(
  classId: string,
  sourceUrl: string,
  maxRetries = 3
) {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await api.processUrl(classId, sourceUrl);
    } catch (error) {
      lastError = error as Error;
      
      // Don't retry on validation errors (4xx)
      if (error instanceof Error && 
          (error.message.includes('valid URL') ||
           error.message.includes('not found'))) {
        throw error;
      }
      
      // Wait before retrying (exponential backoff)
      if (attempt < maxRetries - 1) {
        await new Promise(resolve => 
          setTimeout(resolve, Math.pow(2, attempt) * 1000)
        );
      }
    }
  }
  
  throw lastError;
}
```

## URL Validation

### Client-Side Validation

```typescript
function validateUrl(url: string): { valid: boolean; error?: string } {
  try {
    const parsed = new URL(url);
    
    // Check protocol
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { 
        valid: false, 
        error: 'URL must use HTTP or HTTPS protocol' 
      };
    }
    
    // Optional: Check file extension
    const supportedExtensions = [
      '.mp3', '.mp4', '.m4a', '.wav', '.webm', 
      '.ogg', '.txt', '.pdf'
    ];
    const hasValidExtension = supportedExtensions.some(ext => 
      parsed.pathname.toLowerCase().endsWith(ext)
    );
    
    if (!hasValidExtension) {
      return { 
        valid: false, 
        error: 'URL must point to a supported file type' 
      };
    }
    
    return { valid: true };
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }
}

// Usage
const validation = validateUrl(userInput);
if (!validation.valid) {
  showError(validation.error);
  return;
}
```

## Loading States

### Progress Indicator

```typescript
function ProcessingIndicator({ workflowId }: { workflowId: string }) {
  return (
    <div className="flex items-center space-x-3 rounded bg-blue-50 p-4">
      <div className="animate-spin h-5 w-5 border-2 border-blue-600 border-t-transparent rounded-full" />
      <div>
        <p className="font-medium text-blue-900">Processing in progress</p>
        <p className="text-sm text-blue-700">
          Workflow ID: <code className="text-xs">{workflowId}</code>
        </p>
      </div>
    </div>
  );
}
```

### Multi-Step Status

```typescript
type ProcessingStep = 
  | 'preparing' 
  | 'downloading' 
  | 'generating' 
  | 'saving' 
  | 'complete';

function ProcessingSteps({ currentStep }: { currentStep: ProcessingStep }) {
  const steps = [
    { id: 'preparing', label: 'Preparing file' },
    { id: 'downloading', label: 'Downloading from URL' },
    { id: 'generating', label: 'Generating summary' },
    { id: 'saving', label: 'Saving results' },
    { id: 'complete', label: 'Complete' },
  ];

  const currentIndex = steps.findIndex(s => s.id === currentStep);

  return (
    <div className="space-y-2">
      {steps.map((step, index) => (
        <div key={step.id} className="flex items-center space-x-3">
          <div 
            className={`h-8 w-8 rounded-full flex items-center justify-center ${
              index <= currentIndex 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-200 text-gray-600'
            }`}
          >
            {index < currentIndex ? '✓' : index + 1}
          </div>
          <span className={
            index <= currentIndex ? 'font-medium' : 'text-gray-500'
          }>
            {step.label}
          </span>
        </div>
      ))}
    </div>
  );
}
```

## Testing

### Unit Test Example

```typescript
import { describe, it, expect, vi } from 'vitest';
import { ClassesAPI } from '../api/classes';

describe('ClassesAPI.processUrl', () => {
  it('should call the API with correct parameters', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        result: {
          workflow_instance_id: 'wf_123',
          status: 'accepted'
        }
      })
    });
    global.fetch = mockFetch;

    const getToken = vi.fn().mockResolvedValue('token_123');
    const api = new ClassesAPI('https://api.test', getToken);

    await api.processUrl('class_456', 'https://example.com/file.mp4');

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.test/classes/class_456/process-url',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer token_123'
        },
        body: JSON.stringify({ source_url: 'https://example.com/file.mp4' })
      }
    );
  });

  it('should throw error on API failure', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Class not found' })
    });
    global.fetch = mockFetch;

    const api = new ClassesAPI('https://api.test', async () => 'token');

    await expect(
      api.processUrl('invalid', 'https://example.com/file.mp4')
    ).rejects.toThrow('Class not found');
  });
});
```

## Best Practices

1. **Always validate URLs client-side** before sending to API
2. **Show clear loading states** - processing can take several minutes
3. **Handle all error cases** - network, validation, authorization
4. **Store workflow IDs** for future status tracking
5. **Provide user feedback** throughout the process
6. **Implement retry logic** for transient failures
7. **Use TypeScript** for type safety
8. **Log workflow IDs** for debugging and support

## Common Issues

### Issue: "A valid URL is required"

**Cause**: URL format is invalid or missing protocol

**Solution**:
```typescript
// Ensure URL has protocol
const normalizedUrl = url.startsWith('http') 
  ? url 
  : `https://${url}`;
```

### Issue: "Class not found or you don't have access to it"

**Cause**: Invalid class ID or user doesn't own the class

**Solution**:
- Verify class exists before showing the form
- Check user permissions
- Handle gracefully in UI

### Issue: Workflow completes but summary not visible

**Cause**: Polling class details too quickly

**Solution**:
```typescript
// Poll with exponential backoff
async function waitForSummary(classId: string, maxAttempts = 10) {
  for (let i = 0; i < maxAttempts; i++) {
    const classData = await fetchClass(classId);
    if (classData.summary) {
      return classData;
    }
    await new Promise(resolve => 
      setTimeout(resolve, Math.min(1000 * Math.pow(2, i), 30000))
    );
  }
  throw new Error('Summary generation timed out');
}
```

## Support

For issues or questions:
- Check API documentation: `/docs/process-url/PROCESS_URL.md`
- Review error messages carefully
- Check Cloudflare workflow logs (requires admin access)
- Contact API support with workflow ID for debugging
