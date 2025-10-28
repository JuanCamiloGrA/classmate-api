import {
	WorkflowEntrypoint,
	type WorkflowEvent,
	type WorkflowStep,
} from "cloudflare:workers";
import type { Bindings } from "../../config/bindings";
import { createSummarizeClassWorkflowHandler } from "./dependencies";
import type { WorkflowRequestBody } from "./types";

/**
 * Summarize Class Workflow Entrypoint
 * Cloudflare Workflow that processes audio/text files and generates class summaries
 */
export class SummarizeClassWorkflow extends WorkflowEntrypoint<
	Bindings,
	WorkflowRequestBody
> {
	async run(
		event: WorkflowEvent<WorkflowRequestBody>,
		step: WorkflowStep,
	): Promise<void> {
		console.log("🚀 [WORKFLOW] Starting SummarizeClassWorkflow", {
			classId: event.payload.classId,
			userId: event.payload.userId,
			timestamp: event.timestamp,
		});

		// Create handler with dependency injection
		const handler = await createSummarizeClassWorkflowHandler(this.env);

		// Execute workflow
		await handler.run(event, step);

		console.log("✅ [WORKFLOW] SummarizeClassWorkflow completed successfully", {
			classId: event.payload.classId,
		});
	}
}
