import { z } from "zod";

/**
 * Zod schemas for validating Clerk webhook payloads.
 * Ensures type-safe validation at the HTTP boundary.
 */
const EmailAddressSchema = z.object({
	id: z.string(),
	email_address: z.string().email(),
	verification: z.object({
		status: z.string(),
	}),
});

const ExternalAccountSchema = z.object({
	email_address: z.string().email().optional(),
	first_name: z.string().optional(),
	last_name: z.string().optional(),
});

const UserDataSchema = z.object({
	id: z.string(),
	first_name: z.string().nullable(),
	last_name: z.string().nullable(),
	email_addresses: z.array(EmailAddressSchema),
	primary_email_address_id: z.string().nullable(),
	external_accounts: z.array(ExternalAccountSchema).optional(),
});

const ClerkWebhookBaseSchema = z.object({
	data: UserDataSchema,
	object: z.literal("event"),
	timestamp: z.number(),
});

/**
 * Validates a Clerk user.created webhook payload.
 * Ensures the webhook is for the expected event type and has all required fields.
 * @see https://clerk.com/docs/reference/backend-api/tag/Webhooks
 */
export const ClerkWebhookPayloadSchema = z.object({
	data: UserDataSchema,
	type: z.literal("user.created"),
	object: z.literal("event"),
	timestamp: z.number(),
});

export type ClerkWebhookPayload = z.infer<typeof ClerkWebhookPayloadSchema>;

/** Clerk user.created webhook payload (preferred export). */
export const ClerkNewUserWebhookPayloadSchema = ClerkWebhookBaseSchema.extend({
	type: z.literal("user.created"),
});

/** Clerk user.updated webhook payload. */
export const ClerkUpdateUserWebhookPayloadSchema =
	ClerkWebhookBaseSchema.extend({
		type: z.literal("user.updated"),
	});

export type ClerkNewUserWebhookPayload = z.infer<
	typeof ClerkNewUserWebhookPayloadSchema
>;
export type ClerkUpdateUserWebhookPayload = z.infer<
	typeof ClerkUpdateUserWebhookPayloadSchema
>;
export type ClerkUserWebhookPayload =
	| ClerkNewUserWebhookPayload
	| ClerkUpdateUserWebhookPayload;
