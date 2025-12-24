import { and, eq } from "drizzle-orm";
import type {
	ConfirmStorageObjectInput,
	CreateStorageObjectInput,
	StorageAccountingRepository,
	StorageObject,
} from "../../../domain/repositories/storage-accounting.repository";
import type { Database } from "../client";
import { userStorageObjects } from "../schema";

/**
 * D1 implementation of StorageAccountingRepository.
 * Handles storage object lifecycle and delta calculations for quota tracking.
 */
export class D1StorageAccountingRepository
	implements StorageAccountingRepository
{
	constructor(private db: Database) {}

	async createOrUpdatePending(
		input: CreateStorageObjectInput,
	): Promise<StorageObject> {
		const existing = await this.getByR2Key(input.r2Key);

		if (existing) {
			// Update existing object to pending status
			const now = new Date().toISOString();
			const updated = await this.db
				.update(userStorageObjects)
				.set({
					status: "pending",
					sizeBytes: input.sizeBytes,
					updatedAt: now,
				})
				.where(eq(userStorageObjects.r2Key, input.r2Key))
				.returning()
				.get();

			if (!updated) {
				throw new Error("Failed to update storage object");
			}

			return updated;
		}

		// Create new pending object
		const id = crypto.randomUUID();
		const now = new Date().toISOString();

		const created = await this.db
			.insert(userStorageObjects)
			.values({
				id,
				userId: input.userId,
				r2Key: input.r2Key,
				bucketType: input.bucketType,
				status: "pending",
				sizeBytes: input.sizeBytes,
				confirmedAt: null,
				createdAt: now,
				updatedAt: now,
			})
			.returning()
			.get();

		if (!created) {
			throw new Error("Failed to create storage object");
		}

		return created;
	}

	async confirmUpload(input: ConfirmStorageObjectInput): Promise<{
		deltaBytes: number;
		storageObject: StorageObject;
	}> {
		const existing = await this.getByR2Key(input.r2Key);

		if (!existing) {
			throw new Error(`Storage object not found for key: ${input.r2Key}`);
		}

		// Calculate delta: actual size - previous size
		const previousSize =
			existing.status === "confirmed" ? existing.sizeBytes : 0;
		const deltaBytes = input.actualSizeBytes - previousSize;

		// Update to confirmed status with actual size
		const now = new Date().toISOString();
		const updated = await this.db
			.update(userStorageObjects)
			.set({
				status: "confirmed",
				sizeBytes: input.actualSizeBytes,
				confirmedAt: now,
				updatedAt: now,
			})
			.where(eq(userStorageObjects.r2Key, input.r2Key))
			.returning()
			.get();

		if (!updated) {
			throw new Error("Failed to confirm storage object");
		}

		return {
			deltaBytes,
			storageObject: updated,
		};
	}

	async markDeleted(r2Key: string): Promise<{ deltaBytes: number }> {
		const existing = await this.getByR2Key(r2Key);

		if (!existing) {
			return { deltaBytes: 0 };
		}

		// Only subtract if object was confirmed
		const deltaBytes =
			existing.status === "confirmed" ? -existing.sizeBytes : 0;

		const now = new Date().toISOString();
		await this.db
			.update(userStorageObjects)
			.set({
				status: "deleted",
				updatedAt: now,
			})
			.where(eq(userStorageObjects.r2Key, r2Key))
			.run();

		return { deltaBytes };
	}

	async getByR2Key(r2Key: string): Promise<StorageObject | null> {
		const result = await this.db
			.select()
			.from(userStorageObjects)
			.where(eq(userStorageObjects.r2Key, r2Key))
			.get();

		return result ?? null;
	}

	async listConfirmedByUser(userId: string): Promise<StorageObject[]> {
		const results = await this.db
			.select()
			.from(userStorageObjects)
			.where(
				and(
					eq(userStorageObjects.userId, userId),
					eq(userStorageObjects.status, "confirmed"),
				),
			)
			.all();

		return results;
	}
}
