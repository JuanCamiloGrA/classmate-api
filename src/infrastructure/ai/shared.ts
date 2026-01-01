/**
 * Shared constants for HITL (Human-in-the-Loop) tool confirmations
 * Must match frontend implementation for proper approval flow
 */
export const APPROVAL = {
	YES: "Yes, confirmed.",
	NO: "No, denied.",
} as const;

export type ApprovalResponse = (typeof APPROVAL)[keyof typeof APPROVAL];
