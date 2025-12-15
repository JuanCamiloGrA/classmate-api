# Profiles API Documentation

## Overview

The Profiles API provides endpoints for managing user profiles. Profiles are automatically created when users sign up via Clerk and can be retrieved by authenticated users.

---

## Endpoints

### 1. Create Profile (Webhook)

**Endpoint:** `POST /profiles`

**Purpose:** Webhook handler for Clerk `user.created` events. This endpoint is called automatically by Clerk when a new user is created.

**Headers (Required):**

| Header | Value | Description |
|--------|-------|-------------|
| `svix-id` | `string` | Unique webhook message ID provided by Clerk |
| `svix-timestamp` | `string` | Unix timestamp of webhook provided by Clerk |
| `svix-signature` | `string` | v1,\<base64-signature\> HMAC-SHA256 signature for verification |
| `Content-Type` | `application/json` | Must be application/json |

**Request Body:**

```json
{
  "data": {
    "id": "user_2eZpWWvKJlPuwhzVTmNl6Mq5tGR",
    "email_addresses": [
      {
        "email_address": "user@example.com"
      }
    ],
    "first_name": "John",
    "last_name": "Doe"
  },
  "type": "user.created"
}
```

**Response:**

**Status: 201 Created**

```json
{
  "success": true,
  "message": "Profile created successfully",
  "profileId": "user_2eZpWWvKJlPuwhzVTmNl6Mq5tGR"
}
```

**Status: 400 Bad Request**

```json
{
  "error": "Invalid payload"
}
```

**Status: 401 Unauthorized**

```json
{
  "error": "Unauthorized"
}
```

**Status: 409 Conflict**

```json
{
  "success": false,
  "error": "Profile already exists"
}
```

**Status: 500 Internal Server Error**

```json
{
  "error": "Internal server error"
}
```

---

### 2. Get User Profile

**Endpoint:** `GET /profiles/me`

**Purpose:** Retrieve the authenticated user's profile information.

**Headers (Required):**

| Header | Value | Description |
|--------|-------|-------------|
| `Authorization` | `Bearer <jwt-token>` | Clerk JWT token for authentication |

**Request Body:** None

**Response:**

**Status: 200 OK**

```json
{
  "success": true,
  "profile": {
    "id": "user_2eZpWWvKJlPuwhzVTmNl6Mq5tGR",
    "email": "user@example.com",
    "name": "John Doe",
    "subscriptionTier": "free",
    "storageUsedBytes": 0,
    "scribeStyleSlot1R2Key": "users/user_2eZpWWvKJlPuwhzVTmNl6Mq5tGR/rubrics/2025/10/uuid-scribe-style-slot-1-style-example.pdf",
    "scribeStyleSlot1MimeType": "application/pdf",
    "scribeStyleSlot1OriginalFilename": "style-example.pdf",
    "scribeStyleSlot2R2Key": null,
    "scribeStyleSlot2MimeType": null,
    "scribeStyleSlot2OriginalFilename": null,
    "createdAt": "2025-01-15T10:30:00.000Z",
    "updatedAt": "2025-01-15T10:30:00.000Z"
  }
}
```

**Profile Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Unique identifier (Clerk user ID) |
| `email` | `string \| null` | User's email address |
| `name` | `string \| null` | User's display name |
| `subscriptionTier` | `"free" \| "pro" \| "premium"` | Current subscription tier |
| `storageUsedBytes` | `number` | Storage used in bytes |
| `scribeStyleSlot1R2Key` | `string \| null` | R2 key for scribe style reference slot 1 |
| `scribeStyleSlot1MimeType` | `string \| null` | MIME type for scribe style reference slot 1 |
| `scribeStyleSlot1OriginalFilename` | `string \| null` | Original filename for scribe style reference slot 1 |
| `scribeStyleSlot2R2Key` | `string \| null` | R2 key for scribe style reference slot 2 |
| `scribeStyleSlot2MimeType` | `string \| null` | MIME type for scribe style reference slot 2 |
| `scribeStyleSlot2OriginalFilename` | `string \| null` | Original filename for scribe style reference slot 2 |
| `createdAt` | `string` | ISO 8601 timestamp of profile creation |
| `updatedAt` | `string` | ISO 8601 timestamp of last update |

**Status: 401 Unauthorized**

```json
{
  "error": "Unauthorized"
}
```

**Status: 404 Not Found**

```json
{
  "error": "Profile not found"
}
```

**Status: 500 Internal Server Error**

```json
{
  "error": "Internal server error"
}
```

---

## Scribe Style References

The profile includes two persistent style reference slots that can be used with the Scribe API. These slots store R2 keys, MIME types, and original filenames for style reference files uploaded by the user.

- **Slot 1** (`scribeStyleSlot1R2Key`, `scribeStyleSlot1MimeType`, `scribeStyleSlot1OriginalFilename`)
- **Slot 2** (`scribeStyleSlot2R2Key`, `scribeStyleSlot2MimeType`, `scribeStyleSlot2OriginalFilename`)

To upload and manage these style references, see the [Scribe API Reference](./scribe/API_REFERENCE.md#profiles-scribe-style-references-2-slots).

---

## Authentication

The `/profiles/me` endpoint requires a valid Clerk JWT token. Include it in the `Authorization` header as:

```
Authorization: Bearer <jwt-token>
```

The webhook endpoint (`POST /profiles`) uses Svix signature verification and does not require bearer authentication.

---

## Error Handling

All error responses follow this format:

```json
{
  "error": "Error description"
}
```

or for conflict errors:

```json
{
  "success": false,
  "error": "Error description"
}
```

Refer to the status codes in each endpoint section for specific error scenarios.
