/**
 * Create Chat Use Case
 * Creates a new chat conversation session with tier-based quota enforcement.
 */

import type { Chat, ChatContextType } from "../../domain/entities/chat";
import type { ChatRepository } from "../../domain/repositories/chat.repository";
import type { ProfileRepository } from "../../domain/repositories/profile.repository";
import {
	canCreateChat,
	getChatCapForTier,
	type SubscriptionTier,
} from "../../domain/services/chat-quota.service";

/**
 * Error thrown when user has reached their chat quota.
 */
export class ChatQuotaExceededError extends Error {
	public readonly code = "CHAT_QUOTA_EXCEEDED" as const;
	public readonly statusCode = 403 as const;
	public readonly currentCount: number;
	public readonly maxAllowed: number;
	public readonly tier: SubscriptionTier;

	constructor(currentCount: number, tier: SubscriptionTier) {
		const maxAllowed = getChatCapForTier(tier);
		super(
			`Chat quota exceeded. You have ${currentCount}/${maxAllowed} chats (${tier} tier).`,
		);
		this.name = "ChatQuotaExceededError";
		this.currentCount = currentCount;
		this.maxAllowed = maxAllowed;
		this.tier = tier;
	}
}

export interface CreateChatInput {
	userId: string;
	title?: string | null;
	model?: string | null;
	temperature?: number | null;
	contextType?: ChatContextType | null;
	contextId?: string | null;
}

export interface CreateChatOutput {
	chat: Chat;
}

/**
 * Use case for creating a new chat conversation.
 * Enforces tiered chat quotas before creation.
 */
export class CreateChatUseCase {
	constructor(
		private chatRepository: ChatRepository,
		private profileRepository: ProfileRepository,
	) {}

	async execute(input: CreateChatInput): Promise<CreateChatOutput> {
		// 1. Load user's profile to get subscription tier
		const profile = await this.profileRepository.findById(input.userId);
		if (!profile) {
			throw new Error("Profile not found");
		}

		const tier = profile.subscriptionTier as SubscriptionTier;

		// 2. Count existing active chats
		const currentCount = await this.chatRepository.countByUserId(input.userId);

		// 3. Check quota
		if (!canCreateChat(currentCount, tier)) {
			throw new ChatQuotaExceededError(currentCount, tier);
		}

		// 4. Create the chat
		const chat = await this.chatRepository.create({
			userId: input.userId,
			title: input.title,
			model: input.model,
			temperature: input.temperature,
			contextType: input.contextType,
			contextId: input.contextId,
		});

		return { chat };
	}
}
