import {
	WorkflowEntrypoint,
	type WorkflowEvent,
	type WorkflowStep,
} from "cloudflare:workers";
import type { Bindings } from "../../config/bindings";
import { createGenerateScribeProjectWorkflowHandler } from "./dependencies";
import type { WorkflowRequestBody } from "./types";

export class GenerateScribeProjectWorkflow extends WorkflowEntrypoint<
	Bindings,
	WorkflowRequestBody
> {
	async run(
		event: WorkflowEvent<WorkflowRequestBody>,
		step: WorkflowStep,
	): Promise<void> {
		const handler = await createGenerateScribeProjectWorkflowHandler(this.env);
		await handler.run(event, step);
	}
}
