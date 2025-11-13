# Feedback - Quick Start

## What is it?

Send feedback about the app to help us improve. No login required.

## How to use?

### Send feedback

```bash
curl -X POST https://api.classmate.studio/feedback \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Your feedback here"
  }'
```

### With optional info

```bash
curl -X POST https://api.classmate.studio/feedback \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Found a bug in the upload feature",
    "userEmail": "you@example.com",
    "pageContext": "/classes/123/upload"
  }'
```

## Response

**Success (201):**
```json
{
  "success": true,
  "result": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "message": "Your feedback here",
    "createdAt": "2024-11-13T10:30:45.123Z"
  }
}
```

**Error (400):**
```json
{
  "error": "message is required"
}
```

**Too many requests (429):**
```json
{
  "error": "Too Many Requests",
  "message": "Maximum 10 requests per 5 minutes"
}
```

## Fields

| Field | Required | Notes |
|-------|----------|-------|
| `message` | ✓ Yes | 1-5000 chars |
| `userEmail` | No | Must be valid email |
| `userId` | No | Your user ID if logged in |
| `pageContext` | No | Where you were (e.g., `/dashboard`) |

## Rate Limit

- **10 requests per 5 minutes** per IP address
- Returns HTTP 429 if exceeded
- Wait 5 minutes before trying again

## See Also

- Full docs: [FEEDBACK.md](./FEEDBACK.md)
- Integration examples: [docs/feedback/CLIENT_INTEGRATION.md](./feedback/CLIENT_INTEGRATION.md)
