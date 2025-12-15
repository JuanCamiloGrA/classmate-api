import type { Profile } from "../../domain/entities/profile";
import type { ProfileRepository } from "../../domain/repositories/profile.repository";

export interface UpdateScribeStyleSlotInput {
	userId: string;
	slot: 1 | 2;
	file_route: string;
	mimeType: string;
	originalFilename: string;
}

/**
 * Persists the selected Scribe style slot metadata in the user profile.
 */
export class UpdateScribeStyleSlotUseCase {
	constructor(private readonly profileRepository: ProfileRepository) {}

	async execute(input: UpdateScribeStyleSlotInput): Promise<Profile> {
		return this.profileRepository.updateScribeStyleSlot(
			input.userId,
			input.slot,
			{
				r2Key: input.file_route,
				mimeType: input.mimeType,
				originalFilename: input.originalFilename,
			},
		);
	}
}
