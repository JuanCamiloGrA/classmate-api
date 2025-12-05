# Notifications API - Client Integration Guide

> Quick reference for frontend integration with the Notifications API.

## Base URL

```
https://api.classmate.studio
```

All endpoints require authentication via Clerk JWT in the `Authorization` header:
```
Authorization: Bearer <clerk_session_token>
```

---

## Endpoints Summary

| Method | Endpoint                          | Description                          | Auth Required |
|--------|-----------------------------------|--------------------------------------|---------------|
| GET    | `/notifications`                  | List notifications (paginated)       | ✅            |
| GET    | `/notifications/unread-count`     | Get unread notification count        | ✅            |
| GET    | `/notifications/:id`              | Get a single notification            | ✅            |
| POST   | `/notifications`                  | Create a notification                | ✅            |
| POST   | `/notifications/:id/read`         | Mark notification as read            | ✅            |
| POST   | `/notifications/read-all`         | Mark all notifications as read       | ✅            |
| DELETE | `/notifications/:id`              | Delete a notification                | ✅            |

> All endpoints require Clerk authentication. The `user_id` is automatically extracted from the JWT token.

---

## Notification Types

The `type` field determines which UI component to render:

| Type                  | Description                          | Payload Example                                     |
|-----------------------|--------------------------------------|-----------------------------------------------------|
| `class_summary_ready` | Class summary has been generated     | `{ "classId": "abc", "className": "Neuroscience" }` |
| `task_due_soon`       | Task deadline approaching            | `{ "taskId": "xyz", "taskTitle": "Essay", "dueDate": "2024-12-10" }` |
| `grade_posted`        | Grade has been posted for a task     | `{ "taskId": "xyz", "grade": 95, "taskTitle": "Final Exam" }` |
| `system_alert`        | System-wide announcement             | `{ "title": "Maintenance", "message": "..." }`      |

---

## List Notifications

```http
GET /notifications?is_read=false&limit=20&offset=0
```

### Query Parameters

| Param       | Type   | Default | Description                                      |
|-------------|--------|---------|--------------------------------------------------|
| `type`      | string | —       | Comma-separated types to filter                  |
| `is_read`   | string | —       | `true`, `false`, `1`, or `0`                     |
| `limit`     | number | 20      | Max items per page (1-100)                       |
| `offset`    | number | 0       | Pagination offset                                |
| `sort_order`| string | `desc`  | `asc` or `desc` by `created_at`                  |

### Response

```json
{
  "success": true,
  "result": {
    "data": [
      {
        "id": "notif-123",
        "type": "class_summary_ready",
        "payload": { "classId": "abc", "className": "Neuroscience" },
        "is_read": 0,
        "action_url": "/classes/abc",
        "created_at": "2024-12-05T10:30:00.000Z"
      }
    ],
    "meta": {
      "total": 42,
      "unread_count": 5,
      "limit": 20,
      "offset": 0
    }
  }
}
```

---

## Get Unread Count

Quick endpoint for badge counters:

```http
GET /notifications/unread-count
```

### Response

```json
{
  "success": true,
  "result": {
    "unread_count": 5
  }
}
```

---

## Get Single Notification

```http
GET /notifications/:id
```

### Response

```json
{
  "success": true,
  "result": {
    "id": "notif-123",
    "user_id": "user_abc",
    "type": "task_due_soon",
    "payload": { "taskId": "xyz", "taskTitle": "Essay" },
    "is_read": 1,
    "read_at": "2024-12-05T11:00:00.000Z",
    "action_url": "/tasks/xyz",
    "created_at": "2024-12-05T10:30:00.000Z"
  }
}
```

---

## Mark Notification as Read

```http
POST /notifications/:id/read
```

### Response

```json
{
  "success": true,
  "result": {
    "id": "notif-123",
    "is_read": 1,
    "read_at": "2024-12-05T11:00:00.000Z"
  }
}
```

---

## Mark All as Read

```http
POST /notifications/read-all
```

### Response

```json
{
  "success": true,
  "result": {
    "marked_count": 5
  }
}
```

---

## Delete Notification

```http
DELETE /notifications/:id
```

### Response

```json
{
  "success": true,
  "result": {
    "id": "notif-123"
  }
}
```

---

## Create Notification

Create a notification for the authenticated user.

```http
POST /notifications
Content-Type: application/json

{
  "type": "class_summary_ready",
  "payload": { "classId": "abc", "className": "Neuroscience" },
  "action_url": "/classes/abc"
}
```

### Request Body

| Field        | Type   | Required | Description                                |
|--------------|--------|----------|--------------------------------------------|
| `type`       | string | ✅       | One of the notification types (see above)  |
| `payload`    | object | ❌       | Dynamic data for the widget (default: `{}`) |
| `action_url` | string | ❌       | URL to navigate when clicking notification |

### Response

```json
{
  "success": true,
  "result": {
    "id": "notif-456",
    "user_id": "user_abc",
    "type": "class_summary_ready",
    "payload": { "classId": "abc", "className": "Neuroscience" },
    "is_read": 0,
    "read_at": null,
    "action_url": "/classes/abc",
    "created_at": "2024-12-05T12:00:00.000Z"
  }
}
```

---

## Error Responses

All errors follow this format:

```json
{
  "error": "Error message",
  "name": "ErrorType"
}
```

| Status | Error Type        | Description              |
|--------|-------------------|--------------------------|
| 400    | ValidationError   | Invalid request params   |
| 401    | UnauthorizedError | Missing/invalid auth     |
| 404    | NotFoundError     | Notification not found   |
| 500    | Internal error    | Server error             |

---

## TypeScript Types

```typescript
type NotificationType = 
  | "class_summary_ready" 
  | "task_due_soon" 
  | "grade_posted" 
  | "system_alert";

interface NotificationListItem {
  id: string;
  type: NotificationType;
  payload: Record<string, unknown>;
  is_read: number; // 0 = unread, 1 = read
  action_url: string | null;
  created_at: string; // ISO 8601
}

interface NotificationDetail extends NotificationListItem {
  user_id: string;
  read_at: string | null; // ISO 8601
}

interface ListNotificationsResponse {
  success: true;
  result: {
    data: NotificationListItem[];
    meta: {
      total: number;
      unread_count: number;
      limit: number;
      offset: number;
    };
  };
}
```

---

## React Query Example

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@clerk/clerk-react';

const API_BASE = 'https://api.classmate.studio';

export function useNotifications(filters?: { isRead?: boolean; limit?: number }) {
  const { getToken } = useAuth();
  
  return useQuery({
    queryKey: ['notifications', filters],
    queryFn: async () => {
      const token = await getToken();
      const params = new URLSearchParams();
      if (filters?.isRead !== undefined) params.set('is_read', String(filters.isRead));
      if (filters?.limit) params.set('limit', String(filters.limit));
      
      const res = await fetch(`${API_BASE}/notifications?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return res.json();
    },
  });
}

export function useUnreadCount() {
  const { getToken } = useAuth();
  
  return useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: async () => {
      const token = await getToken();
      const res = await fetch(`${API_BASE}/notifications/unread-count`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return res.json();
    },
    refetchInterval: 30000, // Poll every 30s
  });
}

export function useMarkAsRead() {
  const queryClient = useQueryClient();
  const { getToken } = useAuth();
  
  return useMutation({
    mutationFn: async (notificationId: string) => {
      const token = await getToken();
      const res = await fetch(`${API_BASE}/notifications/${notificationId}/read`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useMarkAllAsRead() {
  const queryClient = useQueryClient();
  const { getToken } = useAuth();
  
  return useMutation({
    mutationFn: async () => {
      const token = await getToken();
      const res = await fetch(`${API_BASE}/notifications/read-all`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useCreateNotification() {
  const queryClient = useQueryClient();
  const { getToken } = useAuth();
  
  return useMutation({
    mutationFn: async (data: { 
      type: NotificationType; 
      payload?: Record<string, unknown>; 
      action_url?: string;
    }) => {
      const token = await getToken();
      const res = await fetch(`${API_BASE}/notifications`, {
        method: 'POST',
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useDeleteNotification() {
  const queryClient = useQueryClient();
  const { getToken } = useAuth();
  
  return useMutation({
    mutationFn: async (notificationId: string) => {
      const token = await getToken();
      const res = await fetch(`${API_BASE}/notifications/${notificationId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}
```

---

## Payload Rendering Guide

Use the `type` field to determine which component renders the notification:

```tsx
function NotificationItem({ notification }: { notification: NotificationListItem }) {
  switch (notification.type) {
    case 'class_summary_ready':
      return <ClassSummaryNotification payload={notification.payload} />;
    case 'task_due_soon':
      return <TaskDueNotification payload={notification.payload} />;
    case 'grade_posted':
      return <GradePostedNotification payload={notification.payload} />;
    case 'system_alert':
      return <SystemAlertNotification payload={notification.payload} />;
    default:
      return <GenericNotification notification={notification} />;
  }
}
```
