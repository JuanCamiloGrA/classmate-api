import { fromHono } from "chanfana";

import type { Bindings } from "./config/bindings";
import { createApp } from "./interfaces";
import {
	CreateClassEndpoint,
	GetClassEndpoint,
	HardDeleteClassEndpoint,
	ListClassesEndpoint,
	SoftDeleteClassEndpoint,
	UpdateClassEndpoint,
} from "./interfaces/http/routes/classes";
import { GenerateClassAudioUploadUrlEndpoint } from "./interfaces/http/routes/classes-generate-upload-url";
import { ProcessClassAudioEndpoint } from "./interfaces/http/routes/classes-process-audio";
import { ProcessClassUrlEndpoint } from "./interfaces/http/routes/classes-process-url";
import { CreateFeedbackEndpoint } from "./interfaces/http/routes/feedback";
import {
	ConfirmUploadEndpoint,
	DeleteLibraryItemEndpoint,
	GenerateUploadUrlEndpoint,
	GetStorageUsageEndpoint,
	ListLibraryEndpoint,
} from "./interfaces/http/routes/library";
import {
	CreateNotificationEndpoint,
	DeleteNotificationEndpoint,
	GetNotificationEndpoint,
	GetUnreadCountEndpoint,
	ListNotificationsEndpoint,
	MarkAllNotificationsReadEndpoint,
	MarkNotificationReadEndpoint,
} from "./interfaces/http/routes/notifications";
import { GetProfileEndpoint } from "./interfaces/http/routes/profiles";
import {
	GenerateProfileScribeStyleUploadUrlEndpoint,
	UpdateProfileScribeStyleEndpoint,
} from "./interfaces/http/routes/profiles-scribe-style";
import {
	GenerateScribeAnswerUploadUrlEndpoint,
	GenerateScribeRubricUploadUrlEndpoint,
	GetScribeProjectEndpoint,
	IterateScribeEndpoint,
	ListScribeProjectsEndpoint,
	ListScribeTemplatesEndpoint,
	UnlockScribePdfEndpoint,
} from "./interfaces/http/routes/scribe";
import {
	CreateSubjectEndpoint,
	HardDeleteSubjectEndpoint,
	ListSubjectsEndpoint,
	SoftDeleteSubjectEndpoint,
	UpdateSubjectEndpoint,
} from "./interfaces/http/routes/subjects";
import {
	CreateTaskEndpoint,
	GetTaskEndpoint,
	HardDeleteTaskEndpoint,
	ListTasksEndpoint,
	SoftDeleteTaskEndpoint,
	UpdateTaskEndpoint,
} from "./interfaces/http/routes/tasks";
import {
	CreateTermEndpoint,
	HardDeleteTermEndpoint,
	ListTermsEndpoint,
	SoftDeleteTermEndpoint,
	UpdateTermEndpoint,
} from "./interfaces/http/routes/terms";
import {
	CreateProfileEndpoint,
	UpdateProfileFromClerkEndpoint,
} from "./interfaces/http/routes/webhooks-clerk";
import { SummarizeClassWorkflow } from "./workflows/summarize-class";

export default {
	async fetch(request: Request, env: Bindings, ctx: ExecutionContext) {
		const honoApp = createApp({});

		// Setup OpenAPI registry
		const apiApp = fromHono(honoApp, {
			docs_url: "/",
			openapi_url: "/openapi.json",
			schema: {
				info: {
					title: "Classmate API",
					version: "1.0.0",
					description: "API for educational profile and content management",
				},
				servers: [
					{
						url: new URL(request.url).origin,
						description: "Current Server",
					},
				],
			},
		});

		// Register OpenAPI endpoints
		// Clerk webhooks
		apiApp.post("/webhooks/clerk/user.created", CreateProfileEndpoint);
		apiApp.post("/webhooks/clerk/user.updated", UpdateProfileFromClerkEndpoint);

		// Profile endpoints
		apiApp.get("/profiles/me", GetProfileEndpoint);
		apiApp.post(
			"/profiles/me/scribe-style/upload-url",
			GenerateProfileScribeStyleUploadUrlEndpoint,
		);
		apiApp.put("/profiles/me/scribe-style", UpdateProfileScribeStyleEndpoint);

		// Term endpoints
		apiApp.get("/terms", ListTermsEndpoint);
		apiApp.post("/terms", CreateTermEndpoint);
		apiApp.put("/terms/:id", UpdateTermEndpoint);
		apiApp.delete("/terms/:id", SoftDeleteTermEndpoint);
		apiApp.delete("/terms/:id/hard", HardDeleteTermEndpoint);

		// Subject endpoints
		apiApp.get("/subjects", ListSubjectsEndpoint);
		apiApp.post("/subjects", CreateSubjectEndpoint);
		apiApp.put("/subjects/:id", UpdateSubjectEndpoint);
		apiApp.delete("/subjects/:id", SoftDeleteSubjectEndpoint);
		apiApp.delete("/subjects/:id/hard", HardDeleteSubjectEndpoint);

		// Task endpoints
		apiApp.get("/tasks", ListTasksEndpoint);
		apiApp.get("/tasks/:id", GetTaskEndpoint);
		apiApp.post("/tasks", CreateTaskEndpoint);
		apiApp.put("/tasks/:id", UpdateTaskEndpoint);
		apiApp.delete("/tasks/:id", SoftDeleteTaskEndpoint);
		apiApp.delete("/tasks/:id/hard", HardDeleteTaskEndpoint);

		// Class endpoints
		apiApp.get("/classes", ListClassesEndpoint);
		apiApp.get("/classes/:id", GetClassEndpoint);
		apiApp.post("/classes", CreateClassEndpoint);
		apiApp.put("/classes/:id", UpdateClassEndpoint);
		apiApp.delete("/classes/:id", SoftDeleteClassEndpoint);
		apiApp.delete("/classes/:id/hard", HardDeleteClassEndpoint);
		apiApp.post(
			"/classes/:classId/generate-upload-url",
			GenerateClassAudioUploadUrlEndpoint,
		);
		apiApp.post("/classes/:classId/process-audio", ProcessClassAudioEndpoint);
		apiApp.post("/classes/:classId/process-url", ProcessClassUrlEndpoint);

		// Feedback endpoints
		apiApp.post("/feedback", CreateFeedbackEndpoint);

		// Scribe endpoints
		apiApp.post("/scribe/upload-url", GenerateScribeRubricUploadUrlEndpoint);
		apiApp.post(
			"/scribe/projects/:id/answer-upload-url",
			GenerateScribeAnswerUploadUrlEndpoint,
		);
		apiApp.post("/scribe", IterateScribeEndpoint);
		apiApp.get("/scribe", ListScribeProjectsEndpoint);
		apiApp.get("/scribe/templates", ListScribeTemplatesEndpoint);
		apiApp.get("/scribe/:id", GetScribeProjectEndpoint);
		apiApp.post("/scribe/:id/unlock_pdf", UnlockScribePdfEndpoint);

		// Library endpoints
		apiApp.get("/library", ListLibraryEndpoint);
		apiApp.get("/library/storage", GetStorageUsageEndpoint);
		apiApp.post("/library/upload/presigned", GenerateUploadUrlEndpoint);
		apiApp.post("/library/upload/confirm", ConfirmUploadEndpoint);
		apiApp.delete("/library/:id", DeleteLibraryItemEndpoint);

		// Notification endpoints
		apiApp.get("/notifications", ListNotificationsEndpoint);
		apiApp.get("/notifications/unread-count", GetUnreadCountEndpoint);
		apiApp.get("/notifications/:id", GetNotificationEndpoint);
		apiApp.post("/notifications", CreateNotificationEndpoint);
		apiApp.post("/notifications/:id/read", MarkNotificationReadEndpoint);
		apiApp.post("/notifications/read-all", MarkAllNotificationsReadEndpoint);
		apiApp.delete("/notifications/:id", DeleteNotificationEndpoint);

		return apiApp.fetch(request, env, ctx);
	},
};

// Export workflow for Cloudflare Workers
export { SummarizeClassWorkflow };
