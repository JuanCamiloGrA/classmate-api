# Feedback API Documentation

## Overview

The Feedback API allows users to submit feedback about the application. **No authentication is required** - any user can submit feedback.

---

## Endpoint

### Submit Feedback

**Endpoint:** `POST /feedback`

**Purpose:** Submit feedback about the application to help us improve.

**Headers:**

| Header | Value | Required |
|--------|-------|----------|
| `Content-Type` | `application/json` | Yes |
| `Authorization` | Not required | No |

**Request Body:**

```json
{
  "message": "The interface is intuitive and easy to navigate",
  "userEmail": "user@example.com",
  "userId": "user_123",
  "pageContext": "/dashboard"
}
```

**Field Descriptions:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `message` | `string` | Yes | Feedback message (1-5000 characters) |
| `userEmail` | `string (email)` | No | Your email address for follow-up |
| `userId` | `string` | No | Your user ID if logged in |
| `pageContext` | `string` | No | Page or section where feedback was submitted (e.g., `/dashboard`, `/classes`) |

**Response:**

**Status: 201 Created**

```json
{
  "success": true,
  "result": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "message": "The interface is intuitive and easy to navigate",
    "userEmail": "user@example.com",
    "userId": "user_123",
    "pageContext": "/dashboard",
    "createdAt": "2024-11-13T10:30:45.123Z"
  }
}
```

**Status: 400 Bad Request**

```json
{
  "error": "message: Message is required"
}
```

or

```json
{
  "error": "userEmail: Invalid email format"
}
```

**Status: 429 Too Many Requests**

```json
{
  "error": "Too Many Requests",
  "message": "Rate limit exceeded. Maximum 10 requests per 5 minute(s)."
}
```

**Status: 500 Internal Server Error**

```json
{
  "error": "Internal server error"
}
```

---

## Rate Limiting

The endpoint is rate limited to prevent abuse:

- **Limit:** 10 requests per 5 minutes per IP address
- **Response:** HTTP 429 (Too Many Requests)
- **Headers:** Include `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`

---

## Usage Examples

### Basic feedback

```bash
curl -X POST "https://api.classmate.studio/feedback" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Great application!"
  }'
```

### Feedback with email

```bash
curl -X POST "https://api.classmate.studio/feedback" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "I found a bug when uploading audio files",
    "userEmail": "user@example.com",
    "pageContext": "/classes/123/upload"
  }'
```

### Feedback with user context

```bash
curl -X POST "https://api.classmate.studio/feedback" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "The new dashboard layout is confusing",
    "userEmail": "student@school.com",
    "userId": "user_abc123",
    "pageContext": "/dashboard"
  }'
```

---

## Notes

- **No Authentication Required:** Anyone can submit feedback without logging in.
- **Anonymous Feedback:** You can submit feedback without providing email or user ID.
- **Rate Limiting:** To prevent spam, there is a rate limit per IP address (10 requests per 5 minutes).
- **Message Length:** The feedback message must be between 1 and 5000 characters.
- **Email Validation:** If you provide an email, it must be valid format.
- **Response Time:** Feedback is stored immediately and you'll receive confirmation.
- **Timestamps:** All timestamps are in ISO 8601 format with UTC timezone.

---

## Response Headers

All responses include rate limit information:

```
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 9
X-RateLimit-Reset: 1699898401
```

- `X-RateLimit-Limit`: Maximum requests per window
- `X-RateLimit-Remaining`: Requests remaining in current window
- `X-RateLimit-Reset`: Unix timestamp when the limit window resets
