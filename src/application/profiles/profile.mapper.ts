import type { User } from "@clerk/backend";
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

/**
 * Extract and transform profile data from a Clerk User object.
 * Maps Clerk user data to ProfileData domain model.
 * Used when auto-creating a profile that wasn't created by webhook.
 *
 * Extraction rules:
 * - ID: Uses Clerk's user ID as unique identifier
 * - Email: Finds email matching primaryEmailAddressId, falls back to first email or null
 * - Name: Uses firstName + lastName if available, otherwise null
 *
 * @param user - Clerk User object from Backend SDK
 * @returns ProfileData ready for persistence
 */
export function extractProfileDataFromClerkUser(user: User): ProfileData {
	// Extract email - find the one matching primaryEmailAddressId
	let email: string | null = null;
	if (user.primaryEmailAddressId && user.emailAddresses?.length > 0) {
		const primaryEmail = user.emailAddresses.find(
			(e) => e.id === user.primaryEmailAddressId,
		);
		email = primaryEmail?.emailAddress || null;
	}
	// Fallback to first email if no primary set
	if (!email && user.emailAddresses?.length > 0) {
		email = user.emailAddresses[0]?.emailAddress || null;
	}

	const normalizeNamePart = (value: string | null | undefined) => {
		const trimmed = value?.trim();
		return trimmed ? trimmed : null;
	};

	const firstName = normalizeNamePart(user.firstName);
	const lastName = normalizeNamePart(user.lastName);

	// Extract name - prefer "first last", fall back to either part, else null
	const name =
		[firstName, lastName].filter((p): p is string => Boolean(p)).join(" ") ||
		null;

	return {
		id: user.id,
		email,
		name,
	};
}
