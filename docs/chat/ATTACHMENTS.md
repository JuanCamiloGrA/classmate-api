# Chat Attachments

## Overview

Chat messages support multiple file attachments (images and PDFs). Uploads go
directly to the R2 persistent bucket using presigned URLs and count toward the
user's storage quota. Attachments are persisted alongside messages and returned
with presigned GET URLs in chat history responses.

## Limits

- Max file size: 10MB per attachment
- Max total per message: 40MB
- Allowed MIME types:
  - image/jpeg
  - image/png
  - image/webp
  - image/gif
  - application/pdf

## Endpoints

### Generate upload URL

```
POST /chats/:id/attachments
```

Request body:

```json
{
  "filename": "diagram.png",
  "mimeType": "image/png",
  "sizeBytes": 245000
}
```

Response:

```json
{
  "success": true,
  "result": {
    "attachmentId": "uuid",
    "uploadUrl": "https://...",
    "r2Key": "users/<userId>/chat_attachments/..."
  }
}
```

Upload the file directly to R2 using the returned `uploadUrl` (HTTP PUT).

### Send message with attachments

Send attachment references in message metadata so the agent can persist them:

```json
{
  "role": "user",
  "parts": [
    { "type": "text", "text": "Please analyze this PDF" }
  ],
  "metadata": {
    "attachments": [
      {
        "r2Key": "users/<userId>/chat_attachments/...",
        "thumbnailR2Key": null,
        "originalFilename": "notes.pdf",
        "mimeType": "application/pdf",
        "sizeBytes": 245000
      }
    ]
  }
}
```

### Get chat messages

```
GET /chats/:id/messages
```

Response includes `attachments` with presigned URLs:

```json
{
  "success": true,
  "result": {
    "messages": [
      {
        "id": "...",
        "role": "user",
        "sequence": 1,
        "content": "Please analyze this PDF",
        "attachments": [
          {
            "id": "...",
            "r2Key": "users/<userId>/chat_attachments/...",
            "thumbnailR2Key": null,
            "originalFilename": "notes.pdf",
            "mimeType": "application/pdf",
            "sizeBytes": 245000,
            "url": "https://...",
            "thumbnailUrl": null,
            "expiresAt": "2026-02-02T14:00:00.000Z"
          }
        ],
        "created_at": "..."
      }
    ],
    "has_more": false
  }
}
```

## Thumbnails

Image attachments automatically generate a 512px WebP thumbnail stored in the
persistent bucket. The thumbnail URL is returned in `thumbnailUrl` when
available.

## Notes

- Presigned GET URLs are valid for 1 hour.
- Attachments are confirmed into storage accounting during message sync.
- Hard delete should remove R2 objects and update storage accounting.

## Hard delete chat

```
DELETE /chats/:id/hard
```

This permanently removes the chat, all messages, attachments, and associated
R2 objects. It also updates storage accounting.
