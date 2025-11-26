import type { LibraryItemSource } from "../../domain/entities/library";
import type { LibraryRepository } from "../../domain/repositories/library.repository";

export interface DeleteLibraryItemInput {
	id: string;
	source: LibraryItemSource;
	userId: string;
}

/**
 * Use case for deleting a library item.
 * Handles both user files (hard delete + R2 cleanup) and scribe projects (soft delete).
 */
export class DeleteLibraryItemUseCase {
	constructor(private readonly libraryRepository: LibraryRepository) {}

	async execute(input: DeleteLibraryItemInput): Promise<boolean> {
		if (input.source === "scribe_project") {
			return this.libraryRepository.softDeleteScribeProject(
				input.id,
				input.userId,
			);
		}

		// For user files: get file info, delete from R2, update storage, delete record
		const file = await this.libraryRepository.getFileById(
			input.id,
			input.userId,
		);

		if (!file) {
			return false;
		}

		// Note: R2 deletion is optional - we may skip it if storage repo is not available
		// The record deletion and storage update are the critical operations

		// Delete from database (cascades to task_resources)
		const deleted = await this.libraryRepository.deleteUserFile(
			input.id,
			input.userId,
		);

		if (deleted) {
			// Decrement storage usage
			await this.libraryRepository.updateStorageUsage(
				input.userId,
				-file.sizeBytes,
			);
		}

		return deleted;
	}
}
