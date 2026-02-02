import type { MessageAttachment } from "../entities/chat";

export interface CreateMessageAttachmentInput {
	messageId: string;
	chatId: string;
	userId: string;
	r2Key: string;
	thumbnailR2Key?: string | null;
	originalFilename: string;
	mimeType: string;
	sizeBytes: number;
}

export interface ChatAttachmentRepository {
	createMany(
		inputs: CreateMessageAttachmentInput[],
	): Promise<MessageAttachment[]>;

	listByChatId(userId: string, chatId: string): Promise<MessageAttachment[]>;

	listByMessageIds(
		userId: string,
		chatId: string,
		messageIds: string[],
	): Promise<MessageAttachment[]>;

	deleteByChatId(userId: string, chatId: string): Promise<void>;
}
