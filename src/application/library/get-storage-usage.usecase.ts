import { STORAGE_TIER_LIMITS } from "../../domain/entities/library";
import type { LibraryRepository } from "../../domain/repositories/library.repository";
import { type StorageUsageDTO, toStorageUsageDTO } from "./library.dto";

/**
 * Use case for getting storage usage.
 * Retrieves user's storage consumption and tier limits.
 */
export class GetStorageUsageUseCase {
	constructor(private readonly libraryRepository: LibraryRepository) {}

	async execute(userId: string): Promise<StorageUsageDTO | null> {
		const usage = await this.libraryRepository.getStorageUsage(userId);

		if (!usage) {
			return null;
		}

		// Calculate total bytes based on tier
		const totalBytes = STORAGE_TIER_LIMITS[usage.tier];

		return toStorageUsageDTO({
			usedBytes: usage.usedBytes,
			totalBytes,
			tier: usage.tier,
		});
	}
}
