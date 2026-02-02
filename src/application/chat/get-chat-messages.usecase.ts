import type { ChatRepository } from "../../domain/repositories/chat.repository";
import type { StorageRepository } from "../../domain/repositories/storage.repository";

export interface GetChatMessagesInput {
	userId: string;
	chatId: string;
	limit: number;
	afterSequence: number;
	attachmentUrlExpiresInSeconds: number;
	bucket: string;
}

export interface ChatMessageAttachmentView {
	id: string;
	r2Key: string;
	thumbnailR2Key: string | null;
	originalFilename: string;
	mimeType: string;
	sizeBytes: number;
	url: string | null;
	thumbnailUrl: string | null;
	expiresAt: string | null;
}

export interface ChatMessageView {
	id: string;
	role: string;
	sequence: number;
	content: string;
	createdAt: string;
	attachments?: ChatMessageAttachmentView[];
}

export interface GetChatMessagesResult {
	messages: ChatMessageView[];
	hasMore: boolean;
}

export class GetChatMessagesUseCase {
	constructor(
		private readonly chatRepository: ChatRepository,
		private readonly storageRepository: StorageRepository,
	) {}

	async execute(input: GetChatMessagesInput): Promise<GetChatMessagesResult> {
		const messages = await this.chatRepository.getMessages(
			input.userId,
			input.chatId,
			input.limit + 1,
			input.afterSequence,
		);

		const hasMore = messages.length > input.limit;
		const resultMessages = hasMore ? messages.slice(0, input.limit) : messages;
		const expiresAt = new Date(
			Date.now() + input.attachmentUrlExpiresInSeconds * 1000,
		).toISOString();

		const mapped = await Promise.all(
			resultMessages.map(async (message) => {
				const attachments = message.attachments ?? [];
				const attachmentViews = await Promise.all(
					attachments.map(async (attachment) => {
						const url = await this.storageRepository.generatePresignedGetUrl(
							input.bucket,
							attachment.r2Key,
							input.attachmentUrlExpiresInSeconds,
						);
						const thumbnailUrl = attachment.thumbnailR2Key
							? await this.storageRepository.generatePresignedGetUrl(
									input.bucket,
									attachment.thumbnailR2Key,
									input.attachmentUrlExpiresInSeconds,
								)
							: null;

						return {
							id: attachment.id,
							r2Key: attachment.r2Key,
							thumbnailR2Key: attachment.thumbnailR2Key,
							originalFilename: attachment.originalFilename,
							mimeType: attachment.mimeType,
							sizeBytes: attachment.sizeBytes,
							url,
							thumbnailUrl,
							expiresAt,
						};
					}),
				);

				return {
					id: message.id,
					role: message.role,
					sequence: message.sequence,
					content: message.content,
					createdAt: message.createdAt,
					attachments: attachmentViews.length ? attachmentViews : undefined,
				};
			}),
		);

		return { messages: mapped, hasMore };
	}
}
