import { describe, expect, it } from "vitest";
import type { ClerkWebhookPayload } from "../../interfaces/http/validators/profile.validator";
import { extractProfileDataFromWebhook } from "./profile.mapper";

describe("extractProfileDataFromWebhook", () => {
	it("should extract profile data from valid webhook payload", () => {
		const payload: ClerkWebhookPayload = {
			data: {
				id: "user_123",
				first_name: "John",
				last_name: "Doe",
				email_addresses: [
					{
						id: "idn_123",
						email_address: "john@example.com",
						verification: { status: "verified" },
					},
				],
				primary_email_address_id: "idn_123",
			},
			type: "user.created",
			object: "event",
			timestamp: 1728000000,
		};

		const result = extractProfileDataFromWebhook(payload);

		expect(result).toEqual({
			id: "user_123",
			email: "john@example.com",
			name: "John",
		});
	});

	it("should handle missing first name", () => {
		const payload: ClerkWebhookPayload = {
			data: {
				id: "user_123",
				first_name: null,
				last_name: "Doe",
				email_addresses: [
					{
						id: "idn_123",
						email_address: "john@example.com",
						verification: { status: "verified" },
					},
				],
				primary_email_address_id: "idn_123",
			},
			type: "user.created",
			object: "event",
			timestamp: 1728000000,
		};

		const result = extractProfileDataFromWebhook(payload);

		expect(result.name).toBeNull();
	});

	it("should find correct email when multiple emails exist", () => {
		const payload: ClerkWebhookPayload = {
			data: {
				id: "user_123",
				first_name: "John",
				last_name: "Doe",
				email_addresses: [
					{
						id: "idn_456",
						email_address: "old@example.com",
						verification: { status: "verified" },
					},
					{
						id: "idn_789",
						email_address: "new@example.com",
						verification: { status: "verified" },
					},
				],
				primary_email_address_id: "idn_789",
			},
			type: "user.created",
			object: "event",
			timestamp: 1728000000,
		};

		const result = extractProfileDataFromWebhook(payload);

		expect(result.email).toBe("new@example.com");
	});

	it("should handle missing primary email ID", () => {
		const payload: ClerkWebhookPayload = {
			data: {
				id: "user_123",
				first_name: "John",
				last_name: "Doe",
				email_addresses: [
					{
						id: "idn_123",
						email_address: "john@example.com",
						verification: { status: "verified" },
					},
				],
				primary_email_address_id: null,
			},
			type: "user.created",
			object: "event",
			timestamp: 1728000000,
		};

		const result = extractProfileDataFromWebhook(payload);

		expect(result.email).toBeNull();
	});

	it("should preserve user ID", () => {
		const payload: ClerkWebhookPayload = {
			data: {
				id: "user_very_long_id_12345",
				first_name: "Alice",
				last_name: "Smith",
				email_addresses: [
					{
						id: "idn_123",
						email_address: "alice@example.com",
						verification: { status: "verified" },
					},
				],
				primary_email_address_id: "idn_123",
			},
			type: "user.created",
			object: "event",
			timestamp: 1728000000,
		};

		const result = extractProfileDataFromWebhook(payload);

		expect(result.id).toBe("user_very_long_id_12345");
	});
});
