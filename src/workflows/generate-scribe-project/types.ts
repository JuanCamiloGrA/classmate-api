export interface GenerateScribeProjectWorkflowParams {
	projectId: string;
	userId: string;
	action?: "start" | "continue" | "retry";
}

export type WorkflowRequestBody = GenerateScribeProjectWorkflowParams;
