# ClassmateAgent TODO

> **Status**: Pending Implementation  
> **Priority**: High (Cost Optimization)  
> **Last Updated**: January 2026

---

## Durable Objects Billing Model

Cloudflare Durable Objects incur two types of charges:

### 1. Compute (Requests + Duration)
- ✅ **Inactive objects** (no requests) = **$0 duration charges**
- Requests: $0.15/million (after 1M free/month)
- Duration: $12.50/million GB-s (after 400k free/month)

### 2. Storage (Persistent Data)
- ❌ **Storage is charged until explicitly deleted** via `storage.deleteAll()`
- SQLite storage: **$0.20/GB-month** (after 5GB free)
- Rows written: $1.00/million (after 50M free/month)

### Current Problem

Our soft delete implementation (`deletedAt != null` in D1) leaves Durable Object storage orphaned:
- ✅ Hard Gate blocks requests → No compute charges
- ❌ DO storage persists → **Ongoing storage charges**

**Impact**: 1000 deleted chats (~100-500 MB) = **$0.02-0.10/month** in wasted storage costs.

---

## Pending Implementation

### 1. Chat Restoration Endpoint

**Endpoint**: `POST /chats/:id/restore`

**Purpose**: Allow users to undelete soft-deleted chats within grace period.

**Requirements**:
- Verify chat ownership
- Check if `deletedAt` is within allowed restoration window
- Set `deletedAt = null`, `deleted = false`
- Return restored chat metadata

**Pseudocode**:
```typescript
app.post('/chats/:id/restore', async (c) => {
  // 1. Auth check
  // 2. Find soft-deleted chat
  // 3. Validate restoration window (< 30 days for free tier)
  // 4. Update: deletedAt = null
  // 5. Return success
});
```

---

### 2. Automated Hard Delete Cron Job

**Trigger**: Weekly cron (every Sunday at 00:00 UTC)

**Purpose**: Permanently delete soft-deleted chats past grace period to avoid storage charges.

**Requirements**:
- **CRITICAL**: Minimize D1 read operations (charged at $0.001/million rows)
- Use `DELETE FROM chats WHERE deleted = true AND deletedAt < ?` (single query, no reads)
- For each deleted chat ID:
  - Get DO stub: `env.ClassmateAgent.idFromName(chatId)`
  - Call internal `POST /cleanup` endpoint
  - Execute `storage.deleteAll()` to release storage
- Handle errors gracefully (DO may not exist)

**Grace Period by Tier**:
| Tier | Grace Period |
|------|--------------|
| Free | 30 days |
| Pro | 90 days |
| Premium | 365 days |

**Pseudocode**:
```typescript
// wrangler.jsonc
{
  "triggers": {
    "crons": ["0 0 * * 0"] // Every Sunday at 00:00 UTC
  }
}

// scheduled handler
export default {
  async scheduled(event, env, ctx) {
    // 1. Calculate cutoff dates by tier
    const cutoffFree = Date.now() - (30 * 24 * 60 * 60 * 1000);
    const cutoffPro = Date.now() - (90 * 24 * 60 * 60 * 1000);
    const cutoffPremium = Date.now() - (365 * 24 * 60 * 60 * 1000);
    
    // 2. Batch delete from D1 with RETURNING clause
    const deletedChats = await db.delete(chats)
      .where(and(
        eq(chats.deleted, true),
        // Join with profiles to get tier and apply correct cutoff
      ))
      .returning({ id: chats.id });
    
    // 3. Cleanup DOs in parallel (batches of 100)
    for (const batch of chunks(deletedChats, 100)) {
      await Promise.allSettled(batch.map(async ({ id }) => {
        const doStub = env.ClassmateAgent.get(
          env.ClassmateAgent.idFromName(id)
        );
        await doStub.fetch(new Request('http://internal/cleanup', {
          method: 'POST',
          headers: { 'X-Internal-Key': env.INTERNAL_KEY }
        }));
      }));
    }
    
    // 4. Log metrics
    console.log(`Cleaned up ${deletedChats.length} DOs`);
  }
}
```

---

## Implementation Notes

### DO Cleanup Endpoint (Already needed)

The `ClassmateAgent` must expose an internal cleanup endpoint:

```typescript
// src/infrastructure/agents/classmate-agent.ts
async fetch(request: Request) {
  const url = new URL(request.url);
  
  if (url.pathname === '/cleanup' && request.method === 'POST') {
    const key = request.headers.get('X-Internal-Key');
    if (key !== this.env.INTERNAL_KEY) {
      return new Response('Forbidden', { status: 403 });
    }
    
    await this.ctx.storage.deleteAlarm();
    await this.ctx.storage.deleteAll();
    
    return Response.json({ success: true });
  }
  
  // Normal WebSocket logic...
}
```

### Cost Optimization Strategy

**Why this approach?**
1. **No extra reads**: Use `DELETE ... WHERE ...` directly (single write operation)
2. **Batch processing**: Cleanup DOs in parallel with `Promise.allSettled()`
3. **Grace periods**: Users can restore accidentally deleted chats
4. **Tier-based retention**: Premium users get longer restoration windows

**Expected savings**:
- Free tier users: ~1000 chats/month × 250 KB/chat = 250 MB saved
- Monthly savings: **~$0.05-0.10/month per 1000 users**
- Scales linearly with user base

---

## Testing Checklist

- [ ] Create chat, soft delete, verify restoration works
- [ ] Create chat, soft delete, wait past grace period, verify hard delete
- [ ] Verify DO storage is freed after hard delete (`storage.deleteAll()`)
- [ ] Test cron job with mock data (1000+ soft-deleted chats)
- [ ] Verify no read charges in D1 analytics (only writes from DELETE)
- [ ] Test error handling when DO doesn't exist
- [ ] Verify tier-based grace periods work correctly

---

## Related Documentation

- [Durable Objects Pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/)
- [D1 Pricing](https://developers.cloudflare.com/d1/platform/pricing/)
- [Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/)
- [ClassmateAgent Main Docs](./CLASSMATE_AGENT.md)
