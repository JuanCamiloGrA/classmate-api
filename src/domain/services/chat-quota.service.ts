/**
 * Chat Quota Service
 * Defines tiered chat limits based on subscription tier.
 */

/**
 * Subscription tier type.
 */
export type SubscriptionTier = "free" | "pro" | "premium";

/**
 * Chat caps per subscription tier.
 * - free: 50 active chats
 * - pro: 500 active chats
 * - premium: 2000 active chats
 */
export const CHAT_CAPS: Record<SubscriptionTier, number> = {
	free: 50,
	pro: 500,
	premium: 2000,
} as const;

/**
 * Get the maximum number of chats allowed for a subscription tier.
 * @param tier - The subscription tier
 * @returns Maximum number of chats allowed
 */
export function getChatCapForTier(tier: SubscriptionTier): number {
	return CHAT_CAPS[tier];
}

/**
 * Check if a user can create a new chat based on their current count and tier.
 * @param currentCount - Number of active chats the user currently has
 * @param tier - The user's subscription tier
 * @returns True if the user can create a new chat, false otherwise
 */
export function canCreateChat(
	currentCount: number,
	tier: SubscriptionTier,
): boolean {
	const cap = getChatCapForTier(tier);
	return currentCount < cap;
}

/**
 * Get the number of remaining chats a user can create.
 * @param currentCount - Number of active chats the user currently has
 * @param tier - The user's subscription tier
 * @returns Number of chats remaining (0 if at or over cap)
 */
export function getRemainingChats(
	currentCount: number,
	tier: SubscriptionTier,
): number {
	const cap = getChatCapForTier(tier);
	return Math.max(0, cap - currentCount);
}
