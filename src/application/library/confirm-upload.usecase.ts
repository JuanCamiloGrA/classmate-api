import type { LibraryRepository } from "../../domain/repositories/library.repository";

export interface ConfirmUploadInput {
	fileId: string;
	userId: string;
}

/**
 * Use case for confirming a successful file upload.
 * Updates storage usage after file is uploaded to R2.
 */
export class ConfirmUploadUseCase {
	constructor(private readonly libraryRepository: LibraryRepository) {}

	async execute(input: ConfirmUploadInput): Promise<boolean> {
		const confirmed = await this.libraryRepository.confirmUpload(
			input.fileId,
			input.userId,
		);

		return confirmed;
	}
}
