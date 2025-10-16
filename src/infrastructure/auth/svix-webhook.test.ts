import { describe, expect, it } from "vitest";
import { verifySvixSignature } from "./svix-webhook";

describe("verifySvixSignature", () => {
	/**
	 * Test vectors generated using Svix's signing algorithm.
	 * These are example values for testing purposes only.
	 */
	const testSecret = "whsec_test1234567890abcdef1234567890abcd";

	it("should return false when headers are missing", async () => {
		const payload = '{"type":"user.created","data":{"id":"user_123"}}';
		const headers: Record<string, string | undefined> = {};

		const isValid = await verifySvixSignature(payload, headers, testSecret);

		expect(isValid).toBe(false);
	});

	it("should return false when svix-id header is missing", async () => {
		const payload = '{"type":"user.created","data":{"id":"user_123"}}';
		const headers: Record<string, string | undefined> = {
			"svix-timestamp": "1728000000",
			"svix-signature": "v1,test_signature",
		};

		const isValid = await verifySvixSignature(payload, headers, testSecret);

		expect(isValid).toBe(false);
	});

	it("should return false when svix-timestamp header is missing", async () => {
		const payload = '{"type":"user.created","data":{"id":"user_123"}}';
		const headers: Record<string, string | undefined> = {
			"svix-id": "msg_123",
			"svix-signature": "v1,test_signature",
		};

		const isValid = await verifySvixSignature(payload, headers, testSecret);

		expect(isValid).toBe(false);
	});

	it("should return false when svix-signature header is missing", async () => {
		const payload = '{"type":"user.created","data":{"id":"user_123"}}';
		const headers: Record<string, string | undefined> = {
			"svix-id": "msg_123",
			"svix-timestamp": "1728000000",
		};

		const isValid = await verifySvixSignature(payload, headers, testSecret);

		expect(isValid).toBe(false);
	});

	it("should return false when signature does not match", async () => {
		const payload = '{"type":"user.created","data":{"id":"user_123"}}';
		const headers: Record<string, string | undefined> = {
			"svix-id": "msg_123",
			"svix-timestamp": "1728000000",
			"svix-signature": "v1,invalid_signature_here",
		};

		const isValid = await verifySvixSignature(payload, headers, testSecret);

		expect(isValid).toBe(false);
	});

	it("should handle multiple signatures in header", async () => {
		const payload = '{"type":"user.created","data":{"id":"user_123"}}';
		const headers: Record<string, string | undefined> = {
			"svix-id": "msg_123",
			"svix-timestamp": "1728000000",
			// Multiple signatures with v1 and v0
			"svix-signature":
				"v0,first_signature v1,second_signature v1,third_signature",
		};

		// Even though signatures don't match our secret, the function should
		// attempt to process them
		const isValid = await verifySvixSignature(payload, headers, testSecret);

		// Should return false as none of the signatures are valid
		expect(isValid).toBe(false);
	});

	it("should handle secret without whsec_ prefix", async () => {
		const payload = '{"type":"user.created","data":{"id":"user_123"}}';
		const plainSecret = "test_secret_without_prefix";
		const headers: Record<string, string | undefined> = {
			"svix-id": "msg_123",
			"svix-timestamp": "1728000000",
			"svix-signature": "v1,invalid_sig",
		};

		// Should not throw even with plain secret
		const isValid = await verifySvixSignature(payload, headers, plainSecret);

		expect(typeof isValid).toBe("boolean");
	});
});
