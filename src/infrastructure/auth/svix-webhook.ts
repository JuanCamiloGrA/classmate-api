/**
 * Svix Webhook Verification Module
 * Implements HMAC-SHA256 signature verification for Clerk webhooks.
 * Follows Svix security documentation: https://docs.svix.com/webhooks/signing
 */

/**
 * Convert a base64 string to Uint8Array.
 * Used to decode Clerk webhook secrets (format: whsec_xxxxx).
 * @param base64 - Base64 encoded string
 * @returns Decoded bytes
 * @private
 */
function base64ToBytes(base64: string): Uint8Array {
	const binaryString = atob(base64);
	const bytes = new Uint8Array(binaryString.length);
	for (let i = 0; i < binaryString.length; i++) {
		bytes[i] = binaryString.charCodeAt(i);
	}
	return bytes;
}

/**
 * Convert a Uint8Array to base64 string.
 * Used for signature comparison with Svix headers.
 * @param bytes - Raw bytes from HMAC signature
 * @returns Base64 encoded signature
 * @private
 */
function bytesToBase64(bytes: Uint8Array): string {
	const binaryString = String.fromCharCode(...bytes);
	return btoa(binaryString);
}

/**
 * Verify the HMAC-SHA256 signature of a Svix webhook.
 * Implements Svix's signature verification algorithm:
 * 1. Extract svix-id, svix-timestamp, svix-signature headers
 * 2. Construct signed_content: "id.timestamp.payload"
 * 3. Generate HMAC-SHA256 using webhook secret
 * 4. Compare against all v1 signatures in header
 *
 * @param payload - Raw request body as string (must match original)
 * @param headers - HTTP headers containing signature metadata
 * @param secret - Webhook secret from Clerk dashboard (format: whsec_xxxxx)
 * @returns True if signature is valid and fresh, false otherwise
 * @throws Does not throw; returns false for invalid signatures
 *
 * @example
 * ```typescript
 * const isValid = await verifySvixSignature(rawBody, headers, webhookSecret);
 * if (!isValid) {
 *   return c.json({ error: 'Unauthorized' }, 401);
 * }
 * ```
 */
export async function verifySvixSignature(
	payload: string,
	headers: Record<string, string | undefined>,
	secret: string,
): Promise<boolean> {
	const svixId = headers["svix-id"];
	const svixTimestamp = headers["svix-timestamp"];
	const svixSignature = headers["svix-signature"];

	if (!svixId || !svixTimestamp || !svixSignature) {
		return false;
	}

	// Clerk's webhook secret format: whsec_xxxxx
	// We need to extract the base64 part after "whsec_"
	const secretBytes = secret.startsWith("whsec_")
		? base64ToBytes(secret.slice(6))
		: new TextEncoder().encode(secret);

	// Construct the signed content: id.timestamp.payload
	const signedContent = `${svixId}.${svixTimestamp}.${payload}`;
	const encoder = new TextEncoder();
	const data = encoder.encode(signedContent);

	// Import the secret as an HMAC key
	const key = await crypto.subtle.importKey(
		"raw",
		secretBytes,
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);

	// Generate the signature
	const signature = await crypto.subtle.sign("HMAC", key, data);
	const expectedSignature = bytesToBase64(new Uint8Array(signature));

	// Svix sends multiple signatures (v1), extract all of them
	const signatures = svixSignature.split(" ");
	for (const sig of signatures) {
		const [version, sentSignature] = sig.split(",");
		if (version === "v1" && sentSignature === expectedSignature) {
			return true;
		}
	}

	return false;
}
