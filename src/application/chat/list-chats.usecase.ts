/**
 * List Chats Use Case
 * Retrieves paginated list of user's chat conversations.
 */

import type { ChatListItem } from "../../domain/entities/chat";
import type {
	ChatFilters,
	ChatRepository,
} from "../../domain/repositories/chat.repository";

export interface ListChatsInput {
	userId: string;
	filters: ChatFilters;
}

export interface ListChatsOutput {
	data: ChatListItem[];
	total: number;
	limit: number;
	offset: number;
}

/**
 * Use case for listing chat conversations with filtering and pagination.
 */
export class ListChatsUseCase {
	constructor(private chatRepository: ChatRepository) {}

	async execute(input: ListChatsInput): Promise<ListChatsOutput> {
		const { data, total } = await this.chatRepository.findAllByUserId(
			input.userId,
			input.filters,
		);

		return {
			data,
			total,
			limit: input.filters.limit ?? 20,
			offset: input.filters.offset ?? 0,
		};
	}
}
