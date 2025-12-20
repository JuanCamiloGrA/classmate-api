import type { ProfileData } from "../../domain/entities/profile";
import type { ClerkUserWebhookPayload } from "../../interfaces/http/validators/profile.validator";

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
	payload: ClerkUserWebhookPayload,
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

	const normalizeNamePart = (value: string | null | undefined) => {
		const trimmed = value?.trim();
		return trimmed ? trimmed : null;
	};

	const firstName = normalizeNamePart(userData.first_name);
	const lastName = normalizeNamePart(userData.last_name);

	// Extract name - prefer "first last", fall back to either part, else null
	const name =
		[firstName, lastName].filter((p): p is string => Boolean(p)).join(" ") ||
		null;

	return {
		id: userData.id,
		email,
		name,
	};
}
