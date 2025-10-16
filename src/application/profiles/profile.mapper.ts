import type { ProfileData } from "../../domain/entities/profile";
import type { ClerkWebhookPayload } from "../../interfaces/http/validators/profile.validator";

/**
 * Extract and transform profile data from a Clerk webhook payload.
 * Maps Clerk user data to ProfileData domain model.
 *
 * Extraction rules:
 * - ID: Uses Clerk's user ID as unique identifier
 * - Email: Finds email matching primary_email_address_id, falls back to null
 * - Name: Uses first_name if available, otherwise null
 *
 * @param payload - Parsed and validated Clerk webhook payload
 * @returns ProfileData ready for persistence
 *
 * @example
 * ```typescript
 * const clerkPayload = JSON.parse(rawBody); // Assumed validated
 * const profileData = extractProfileDataFromWebhook(clerkPayload);\n * await profileRepository.create(profileData);
 * ```
 */
export function extractProfileDataFromWebhook(
	payload: ClerkWebhookPayload,
): ProfileData {
	const userData = payload.data;

	// Extract email - find the one matching primary_email_address_id
	let email: string | null = null;
	if (
		userData.primary_email_address_id &&
		userData.email_addresses?.length > 0
	) {
		const primaryEmail = userData.email_addresses.find(
			(e) => e.id === userData.primary_email_address_id,
		);
		email = primaryEmail?.email_address || null;
	}

	// Extract name - use first_name if present, otherwise null
	const name = userData.first_name || null;

	return {
		id: userData.id,
		email,
		name,
	};
}
