# Notifications API - Client Integration Guide

> Quick reference for frontend integration with the Notifications API.

## Base URL
```
https://api.classmate.studio
```
*Requires Clerk JWT in `Authorization: Bearer <token>`.*

---

## 🚀 Quick Start (Cheat Sheet)

### 1. List Unread Notifications
`GET /notifications?is_read=false&limit=10`

### 2. Mark One as Read
`POST /notifications/:id/read`

### 3. Mark ALL as Read
`POST /notifications/read-all`

### 4. Get Unread Count (for badges)
`GET /notifications/unread-count`

---

## 📂 Notification Types

| Type | UI Component | Description |
| :--- | :--- | :--- |
| `class_summary_ready` | Summary Widget | Class summary generated. Payload: `{ "classId", "className" }` |
| `task_due_soon` | Reminder Card | Task deadline. Payload: `{ "taskId", "taskTitle", "dueDate" }` |
| `grade_posted` | Grade Widget | Grade posted. Payload: `{ "taskId", "grade", "taskTitle" }` |
| `system_alert` | Banner / Modal | System announcement. Payload: `{ "title", "message" }` |

---

## 🛠️ Production-Ready Hooks (React Query)

Use these hooks for a robust integration.

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@clerk/clerk-react';

const API_BASE = 'https://api.classmate.studio';

/**
 * 1. Fetch unread count for the navbar badge.
 * Recommended polling: 30-60 seconds.
 */
export function useUnreadCount() {
  const { getToken } = useAuth();
  return useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: async () => {
      const token = await getToken();
      const res = await fetch(`${API_BASE}/notifications/unread-count`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      return data.result.unread_count;
    },
    refetchInterval: 60000,
  });
}

/**
 * 2. List notifications with pagination and filtering.
 */
export function useNotifications(isRead?: boolean, limit = 20) {
  const { getToken } = useAuth();
  return useQuery({
    queryKey: ['notifications', { isRead, limit }],
    queryFn: async () => {
      const token = await getToken();
      const params = new URLSearchParams();
      if (isRead !== undefined) params.set('is_read', String(isRead));
      params.set('limit', String(limit));
      
      const res = await fetch(`${API_BASE}/notifications?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      return data.result; // Returns { data: [...], meta: {...} }
    },
  });
}

/**
 * 3. Mark all as read with Optimistic UI updates.
 */
export function useMarkAllAsRead() {
  const queryClient = useQueryClient();
  const { getToken } = useAuth();
  
  return useMutation({
    mutationFn: async () => {
      const token = await getToken();
      await fetch(`${API_BASE}/notifications/read-all`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
    },
    onSuccess: () => {
      // Refresh both the list and the unread count
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

/**
 * 4. Mark single notification as read.
 */
export function useMarkAsRead() {
  const queryClient = useQueryClient();
  const { getToken } = useAuth();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const token = await getToken();
      await fetch(`${API_BASE}/notifications/${id}/read`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}
```

---

## 💡 Integration Tips

1. **Badge Polling**: Use `useUnreadCount` with a `refetchInterval` to keep the notification badge updated without refreshing the whole page.
2. **Optimistic UI**: When "Marking All as Read", you can manually update the cache for `unread_count` to `0` for an instant feel.
3. **Action URLs**: Most notifications include an `action_url`. Use your router's `push` or `Link` component to navigate there when the user clicks the notification.
4. **Polling vs WebSockets**: Currently, the API uses polling. For high-frequency updates, keep the polling interval around 30-60 seconds to avoid unnecessary server load.

---

## 🔍 API Reference Details

### Parameters for `GET /notifications`
- `type`: Comma-separated types (e.g., `class_summary_ready,task_due_soon`).
- `is_read`: `true`/`false` or `1`/`0`.
- `limit`: `1-100` (default: 20).
- `offset`: For pagination.
- `sort_order`: `asc` or `desc` (default: `desc`).

### Error Format
```json
{
  "error": "Detailed error message",
  "name": "ErrorType"
}
```
*Common types: `ValidationError`, `UnauthorizedError`, `NotFoundError`.*
