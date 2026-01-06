# Trash Bin (Papelera) - Repository Refactor

## Context

The current `softDelete` implementation works correctly after the fix in PR #XXX, but the repository pattern is not optimized for a future "trash bin" feature where users can view and restore deleted items.

## Current Problem

1. **`findByIdAndUserId` filters `isDeleted = 0`**: Once an item is soft-deleted, it cannot be retrieved with this method.

2. **`hardDelete` uses `findByIdAndUserId`**: This means you cannot permanently delete items that are already in the trash (soft deleted), because `findByIdAndUserId` won't find them.

3. **No way to list deleted items**: There's no method to retrieve soft-deleted items for displaying in a trash bin UI.

4. **No restore functionality**: There's no method to restore soft-deleted items.

## Affected Repositories

- `subject.repository.ts`
- `term.repository.ts`
- `task.repository.ts`
- `class.repository.ts`

## Recommended Solution

### 1. Add Private Raw Finder Method

```typescript
/**
 * Internal method that finds by ID without filtering by isDeleted.
 * Used by other methods that need to access both active and deleted records.
 */
private async findByIdAndUserIdRaw(
  userId: string,
  entityId: string,
): Promise<Entity | null> {
  const result = await this.db
    .select()
    .from(entities)
    .where(
      and(
        eq(entities.id, entityId),
        eq(entities.userId, userId),
      ),
    )
    .get();

  return result || null;
}
```

### 2. Update Domain Repository Interface

Add to each repository interface:

```typescript
/**
 * Retrieve a single deleted entity by ID for a specific user.
 * Used for trash bin functionality.
 */
findDeletedByIdAndUserId(userId: string, entityId: string): Promise<Entity | null>;

/**
 * List all soft-deleted entities for a user (trash bin).
 */
findDeletedByUserId(userId: string): Promise<Entity[]>;

/**
 * Restore a soft-deleted entity from trash.
 * @throws NotFoundError if entity not found in trash
 */
restore(userId: string, entityId: string): Promise<Entity>;
```

### 3. Implementation Pattern

```typescript
// Public - only active (current behavior)
async findByIdAndUserId(userId: string, entityId: string): Promise<Entity | null> {
  const result = await this.findByIdAndUserIdRaw(userId, entityId);
  return result?.isDeleted === 0 ? result : null;
}

// Public - only deleted (for trash bin)
async findDeletedByIdAndUserId(userId: string, entityId: string): Promise<Entity | null> {
  const result = await this.findByIdAndUserIdRaw(userId, entityId);
  return result?.isDeleted === 1 ? result : null;
}

// Public - list deleted (for trash bin)
async findDeletedByUserId(userId: string): Promise<Entity[]> {
  return this.db
    .select()
    .from(entities)
    .where(
      and(
        eq(entities.userId, userId),
        eq(entities.isDeleted, 1),
      ),
    )
    .all();
}

// Restore from trash
async restore(userId: string, entityId: string): Promise<Entity> {
  const existing = await this.findDeletedByIdAndUserId(userId, entityId);
  if (!existing) {
    throw new NotFoundError("Entity not found in trash");
  }

  const restored = await this.db
    .update(entities)
    .set({
      isDeleted: 0,
      deletedAt: null,
      updatedAt: new Date().toISOString(),
    })
    .where(and(eq(entities.id, entityId), eq(entities.userId, userId)))
    .returning()
    .get();

  if (!restored) {
    throw new Error("Failed to restore entity");
  }

  return restored;
}

// Fix hardDelete to work with deleted items
async hardDelete(userId: string, entityId: string): Promise<Entity> {
  // Use raw finder to allow deleting from trash
  const existing = await this.findByIdAndUserIdRaw(userId, entityId);
  if (!existing) {
    throw new NotFoundError("Entity not found");
  }

  await this.db
    .delete(entities)
    .where(and(eq(entities.id, entityId), eq(entities.userId, userId)))
    .run();

  return existing;
}
```

### 4. Cascade Considerations for Restore

When restoring a parent entity (e.g., Subject), consider whether to:

- **Option A**: Only restore the parent, leave children deleted
- **Option B**: Restore parent and all children that were deleted at the same time (match `deletedAt` timestamp)
- **Option C**: Restore parent and all children regardless of when they were deleted

Recommended: **Option B** - This preserves user intent. If they deleted items individually before deleting the parent, those should stay deleted.

```typescript
async restore(userId: string, subjectId: string): Promise<Subject> {
  const existing = await this.findDeletedByIdAndUserId(userId, subjectId);
  if (!existing) {
    throw new NotFoundError("Subject not found in trash");
  }

  const deletedAt = existing.deletedAt;
  const now = new Date().toISOString();

  // Restore the subject
  const restored = await this.db
    .update(subjects)
    .set({ isDeleted: 0, deletedAt: null, updatedAt: now })
    .where(and(eq(subjects.id, subjectId), eq(subjects.userId, userId)))
    .returning()
    .get();

  // Cascade restore: only items deleted at the same time
  if (deletedAt) {
    await this.db
      .update(tasks)
      .set({ isDeleted: 0, deletedAt: null, updatedAt: now })
      .where(
        and(
          eq(tasks.subjectId, subjectId),
          eq(tasks.userId, userId),
          eq(tasks.deletedAt, deletedAt),
        ),
      )
      .run();

    await this.db
      .update(classes)
      .set({ isDeleted: 0, deletedAt: null, updatedAt: now })
      .where(
        and(
          eq(classes.subjectId, subjectId),
          eq(classes.userId, userId),
          eq(classes.deletedAt, deletedAt),
        ),
      )
      .run();
  }

  return restored!;
}
```

## Priority

Medium - Not blocking, but should be done before implementing trash bin UI.

## Estimated Effort

- Repository interfaces: 1 hour
- Repository implementations: 2-3 hours
- Use cases: 2 hours
- HTTP routes: 1-2 hours
- Tests: 2-3 hours

**Total: ~1 day**
