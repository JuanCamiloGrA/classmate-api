/**
 * Workflow Request Types
 */

export interface FileInput {
	r2Key: string;
	mimeType: string;
	filename: string;
}

export interface WorkflowRequestBody {
	classId: string;
	userId: string;
	file: FileInput;
}

/**
 * Workflow Configuration
 */
export const WORKFLOW_CONFIG = {
	retries: { limit: 3, delay: "10 seconds", backoff: "exponential" as const },
	timeout: "30 minutes",
} as const;

export const SAVE_SUMMARY_CONFIG = {
	retries: { limit: 5, delay: "5 seconds", backoff: "exponential" as const },
	timeout: "10 minutes",
} as const;
